# Deck - AI Task Planner (web version)

A small Flask app + frontend on top of the same scoring logic from the
original CLI planner.

## Run it

```bash
pip install -r requirements.txt
python app.py (if this doesnt work then try - python3 app.py)
```

Then open **http://localhost:5000** in your browser.

## How it's organized

- `planner.py` - core logic: scoring, persistence (`tasks.json`), add/complete/delete.
  No framework code lives here, so it could be reused by a CLI, a bot, etc.
- `app.py` - Flask server. Exposes a small JSON API and serves the frontend.
- `templates/index.html` - page markup.
- `static/style.css` - visual design.
- `static/app.js` - talks to the API and renders the queue.

## API

| Method | Route                        | Does |
|--------|-------------------------------|------|
| GET    | `/api/tasks`                  | Returns `{ open: [...], done: [...] }`, open list pre-ranked by score |
| POST   | `/api/tasks`                  | Add a task: `{ title, priority, deadline, effort_hours }` |
| POST   | `/api/tasks/<id>/complete`    | Mark a task done |
| POST   | `/api/tasks/<id>/reopen`      | Move a completed task back to the queue |
| DELETE | `/api/tasks/<id>`             | Remove a task |
| GET    | `/api/suggest`                | Returns the single top-ranked task with a reason string |

Data is stored in `tasks.json` next to `planner.py` — no database needed.

## Notes

- This uses Flask's built-in dev server (`app.run(debug=True)`), which is fine
  for local use but not for production. For a real deployment, run it behind
  something like gunicorn and turn `debug` off.
- There's no auth or multi-user support — everyone hitting the server shares
  one task list. Fine for personal use; would need accounts/sessions to go further.
