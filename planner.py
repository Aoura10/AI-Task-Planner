import json
import os
import threading
from datetime import datetime, date

DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tasks.json")
PRIORITY_WEIGHTS = {"high": 3, "medium": 2, "low": 1}

_lock = threading.Lock()


# --------------------------------------------------------------------------
# Persistence
# --------------------------------------------------------------------------

def load_tasks():
    if not os.path.exists(DATA_FILE):
        return []
    with open(DATA_FILE, "r") as f:
        return json.load(f)


def save_tasks(tasks):
    with open(DATA_FILE, "w") as f:
        json.dump(tasks, f, indent=2)


# --------------------------------------------------------------------------
# Scoring
# --------------------------------------------------------------------------

def days_until(deadline_str):
    if not deadline_str:
        return 999
    deadline = datetime.strptime(deadline_str, "%Y-%m-%d").date()
    return (deadline - date.today()).days


def score_task(task):
    """Higher score = more urgent / important, do it first."""
    days_left = days_until(task.get("deadline"))

    if days_left <= 0 and task.get("deadline"):
        urgency = 50
    elif days_left <= 1:
        urgency = 40
    elif days_left <= 3:
        urgency = 25
    elif days_left <= 7:
        urgency = 15
    else:
        urgency = 5

    priority = PRIORITY_WEIGHTS.get(task.get("priority", "medium"), 2) * 10
    effort = task.get("effort_hours", 1) or 1
    effort_bonus = max(0, 5 - effort)

    return round(urgency + priority + effort_bonus, 2)


def reason_for(task):
    days_left = days_until(task.get("deadline"))
    reasons = []
    if task.get("deadline") and days_left <= 0:
        reasons.append("it's overdue")
    elif task.get("deadline") and days_left <= 3:
        reasons.append(f"it's due in {days_left} day(s)")
    if task.get("priority") == "high":
        reasons.append("it's marked high priority")
    if (task.get("effort_hours") or 1) <= 1:
        reasons.append("it's a quick win")
    return ", and ".join(reasons) if reasons else "it scores highest overall"


def rank_tasks(tasks):
    open_tasks = [t for t in tasks if not t["done"]]
    scored = [dict(t, score=score_task(t)) for t in open_tasks]
    return sorted(scored, key=lambda t: t["score"], reverse=True)


# --------------------------------------------------------------------------
# Mutations (thread-safe for the web server)
# --------------------------------------------------------------------------

def add_task(title, priority="medium", deadline="", effort_hours=1):
    with _lock:
        tasks = load_tasks()
        if priority not in PRIORITY_WEIGHTS:
            priority = "medium"
        if deadline:
            try:
                datetime.strptime(deadline, "%Y-%m-%d")
            except ValueError:
                deadline = ""
        try:
            effort_hours = float(effort_hours)
        except (TypeError, ValueError):
            effort_hours = 1

        task = {
            "id": (max((t["id"] for t in tasks), default=0) + 1),
            "title": title.strip(),
            "priority": priority,
            "deadline": deadline,
            "effort_hours": effort_hours,
            "done": False,
            "created": date.today().isoformat(),
        }
        tasks.append(task)
        save_tasks(tasks)
        return task


def complete_task(task_id):
    with _lock:
        tasks = load_tasks()
        for t in tasks:
            if t["id"] == task_id:
                t["done"] = True
                save_tasks(tasks)
                return t
        return None


def reopen_task(task_id):
    with _lock:
        tasks = load_tasks()
        for t in tasks:
            if t["id"] == task_id:
                t["done"] = False
                save_tasks(tasks)
                return t
        return None


def delete_task(task_id):
    with _lock:
        tasks = load_tasks()
        for t in tasks:
            if t["id"] == task_id:
                tasks.remove(t)
                save_tasks(tasks)
                return True
        return False


def get_suggestion():
    tasks = load_tasks()
    ranked = rank_tasks(tasks)
    if not ranked:
        return None
    top = ranked[0]
    return dict(top, reason=reason_for(top))
