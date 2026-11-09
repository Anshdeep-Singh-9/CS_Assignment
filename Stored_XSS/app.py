"""A local teaching demo for stored cross-site scripting."""

from pathlib import Path
import sqlite3

from flask import Flask, abort, g, redirect, render_template, request, url_for


ROOT = Path(__file__).resolve().parent
DATABASE = ROOT / "entries.sqlite3"
app = Flask(__name__)


def database():
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_database(_error=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def initialize_database():
    with sqlite3.connect(DATABASE) as db:
        db.execute(
            """CREATE TABLE IF NOT EXISTS entries (
                   id INTEGER PRIMARY KEY AUTOINCREMENT,
                   mode TEXT NOT NULL CHECK(mode IN ('vulnerable', 'fixed')),
                   author TEXT NOT NULL,
                   message TEXT NOT NULL
               )"""
        )


def page(mode):
    if mode not in ("vulnerable", "fixed"):
        abort(404)
    rows = database().execute(
        "SELECT author, message FROM entries WHERE mode = ? ORDER BY id DESC",
        (mode,),
    ).fetchall()
    return render_template(
        "board.html",
        mode=mode,
        vulnerable=(mode == "vulnerable"),
        entries=rows,
    )


@app.get("/")
def home():
    return render_template("home.html")


@app.get("/<mode>")
def show_board(mode):
    return page(mode)


@app.post("/<mode>/publish")
def publish(mode):
    if mode not in ("vulnerable", "fixed"):
        abort(404)
    author = request.form.get("author", "").strip()[:50]
    message = request.form.get("message", "").strip()[:500]
    if author and message:
        database().execute(
            "INSERT INTO entries(mode, author, message) VALUES (?, ?, ?)",
            (mode, author, message),
        )
        database().commit()
    return redirect(url_for("show_board", mode=mode))


@app.post("/<mode>/clear")
def clear_board(mode):
    if mode not in ("vulnerable", "fixed"):
        abort(404)
    database().execute("DELETE FROM entries WHERE mode = ?", (mode,))
    database().commit()
    return redirect(url_for("show_board", mode=mode))


if __name__ == "__main__":
    initialize_database()
    print("Stored XSS teaching lab: http://127.0.0.1:5002")
    app.run(host="127.0.0.1", port=5002, debug=False)
