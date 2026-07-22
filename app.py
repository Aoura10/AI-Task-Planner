from flask import Flask, jsonify, request, render_template
import planner

app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/tasks", methods=["GET"])
def api_list_tasks():
    tasks = planner.load_tasks()
    ranked_open = planner.rank_tasks(tasks)
    done = [t for t in tasks if t["done"]]
    return jsonify({"open": ranked_open, "done": done})


@app.route("/api/tasks", methods=["POST"])
def api_add_task():
    data = request.get_json(force=True) or {}
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "Title is required."}), 400

    task = planner.add_task(
        title=title,
        priority=data.get("priority", "medium"),
        deadline=data.get("deadline", ""),
        effort_hours=data.get("effort_hours", 1),
    )
    return jsonify(task), 201


@app.route("/api/tasks/<int:task_id>/complete", methods=["POST"])
def api_complete_task(task_id):
    task = planner.complete_task(task_id)
    if not task:
        return jsonify({"error": "Task not found."}), 404
    return jsonify(task)


@app.route("/api/tasks/<int:task_id>/reopen", methods=["POST"])
def api_reopen_task(task_id):
    task = planner.reopen_task(task_id)
    if not task:
        return jsonify({"error": "Task not found."}), 404
    return jsonify(task)


@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
def api_delete_task(task_id):
    ok = planner.delete_task(task_id)
    if not ok:
        return jsonify({"error": "Task not found."}), 404
    return jsonify({"deleted": task_id})


@app.route("/api/suggest", methods=["GET"])
def api_suggest():
    suggestion = planner.get_suggestion()
    return jsonify(suggestion)


if __name__ == "__main__":
    app.run(debug=True, port=5000)
