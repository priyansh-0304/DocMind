"""Background preparation of each document's TL;DR and suggested questions.

After an upload, one worker thread generates the summary and the suggested questions for
documents one at a time, with a pause between them, so Groq's free-plan token limit is not
exceeded and users do not meet a "retry" box. It works from the database (documents that
still lack a summary or suggestions), so it also catches up after a server restart.

The worker is the only code that calls the model for summaries and suggestions. When someone
opens a document the worker has not reached yet, the routes in documents.py and chat.py call
prioritize() so it goes next, then wait for the stored result. Two producers sharing one token
budget fought each other and produced "retry" boxes, so there is deliberately just one.
"""
import json
import logging
import re
import threading
import time

from app.db import get_db_connection
from app.rag.pipeline import (
    BACKGROUND_LOCK,
    BACKGROUND_MODEL,
    generate_answer_stream,
    generate_summary_stream,
)

logger = logging.getLogger("uvicorn.error")  # shows up in the uvicorn terminal

# A TL;DR only needs the opening of the document. Six full chunks was 4-5K tokens per request,
# more than half of the free plan's 8K-per-minute budget for a single summary.
SUMMARY_WORDS = 1200

# Fixed on the server: suggestions are stored per document, so the prompt must not
# depend on what a client sends.
SUGGEST_PROMPT = (
    'Generate exactly 3 short questions (max 8 words each) someone might ask about this document. '
    'Return ONLY a JSON array of strings. Example: ["What is X?", "How does Y work?", "What are the Z?"]'
)

PAUSE_SECONDS = 25          # between documents: about 3K tokens each, so ~7K of an 8K minute
IDLE_SECONDS = 20           # how often an idle worker looks for new work
PREP_WAIT_SECONDS = 150     # how long a route waits for the worker before giving up
MAX_ATTEMPTS = 5            # per document, per server run
MAX_RATE_LIMIT_WAIT = 90    # never sleep longer than this for one rate-limit wait

# Only these column names are ever put into SQL.
COLUMNS = ("summary", "suggestions")


def parse_questions(text: str) -> list[str]:
    """Pull the first JSON array of strings out of the model output (max 3)."""
    match = re.search(r"\[.*?\]", text, re.S)
    if not match:
        return []
    try:
        data = json.loads(match.group(0))
    except Exception:
        return []
    return [q.strip() for q in data if isinstance(q, str) and q.strip()][:3]


# ── Generation ────────────────────────────────────────────────────────────────

def _fetch_chunks(doc_id: int, limit: int) -> list[str]:
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT text FROM chunks WHERE doc_id = %s ORDER BY chunk_index ASC LIMIT %s",
        (doc_id, limit),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [r["text"] for r in rows]


def generate_summary(doc_id: int) -> str:
    chunks = _fetch_chunks(doc_id, 3)
    if not chunks:
        return ""
    text = " ".join(" ".join(chunks).split()[:SUMMARY_WORDS])
    with BACKGROUND_LOCK:
        return "".join(generate_summary_stream([text])).strip()


def generate_suggestions(doc_id: int) -> list[str]:
    chunks = _fetch_chunks(doc_id, 1)
    if not chunks:
        return []
    with BACKGROUND_LOCK:
        text = "".join(
            generate_answer_stream(
                SUGGEST_PROMPT, chunks, [], model=BACKGROUND_MODEL, max_retries=0
            )
        )
    return parse_questions(text)


# ── Database state ────────────────────────────────────────────────────────────

def pending_documents() -> list[dict]:
    """Documents that are fully indexed but still lack a summary or suggestions."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, filename,
               COALESCE(summary, '') = '' AS need_summary,
               COALESCE(suggestions, '') = '' AS need_suggestions
        FROM documents
        WHERE chunk_count > 0
          AND (COALESCE(summary, '') = '' OR COALESCE(suggestions, '') = '')
        ORDER BY id
        """
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows


def still_needed(doc_id: int, column: str) -> bool:
    assert column in COLUMNS
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(f"SELECT COALESCE({column}, '') = '' AS needed FROM documents WHERE id = %s", (doc_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return bool(row and row["needed"])


def read_prepared(doc_id: int, column: str):
    """(exists, value) for a stored summary or suggestions; value is '' until the worker stores it."""
    assert column in COLUMNS
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(f"SELECT COALESCE({column}, '') AS value FROM documents WHERE id = %s", (doc_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    if row is None:
        return False, ""
    return True, row["value"]


def save(doc_id: int, column: str, value: str) -> None:
    """Store a result unless a route already stored one in the meantime."""
    assert column in COLUMNS
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        f"UPDATE documents SET {column} = %s WHERE id = %s AND COALESCE({column}, '') = ''",
        (value, doc_id),
    )
    conn.commit()
    cur.close()
    conn.close()


# ── Rate limits ───────────────────────────────────────────────────────────────

def rate_limit_wait(exc: Exception):
    """Seconds Groq asks us to wait if this error is a rate limit, otherwise None."""
    if getattr(exc, "status_code", None) != 429:
        return None
    resp = getattr(exc, "response", None)
    try:
        return float(resp.headers.get("retry-after"))
    except Exception:
        pass
    m = re.search(r"try again in ([0-9.]+)\s*(ms|s)", str(exc))
    if m:
        value = float(m.group(1))
        return value / 1000 if m.group(2) == "ms" else value
    return 30.0


def _attempt(doc_id: int, label: str, fn):
    """Run one generation job, waiting out up to two rate limits. The lock is never held while waiting."""
    for attempt in range(3):
        try:
            return fn(doc_id)
        except Exception as e:
            wait = rate_limit_wait(e)
            if wait is None or attempt == 2:
                raise
            wait = min(wait + 1, MAX_RATE_LIMIT_WAIT)
            logger.info("Rate limited preparing %s for document %s; waiting %.0fs", label, doc_id, wait)
            time.sleep(wait)


# ── Worker ────────────────────────────────────────────────────────────────────

_attempts: dict[int, int] = {}     # doc_id -> failed attempts in this server run
_retry_at: dict[int, float] = {}   # doc_id -> do not retry before this time
_priority: list[int] = []          # documents a user is waiting on, oldest request first
_priority_guard = threading.Lock()


def prioritize(doc_id: int) -> None:
    """A user opened this document: prepare it next, with a fresh attempt if it had failed."""
    with _priority_guard:
        if doc_id not in _priority:
            _priority.append(doc_id)
    _attempts.pop(doc_id, None)
    _retry_at.pop(doc_id, None)
    ensure_worker()


def process_next() -> str:
    """Prepare one pending document. Returns 'idle', 'done' or 'failed'."""
    now = time.time()
    pending = pending_documents()
    with _priority_guard:
        # forget requests for documents that are already done (or gone)
        _priority[:] = [i for i in _priority if any(d["id"] == i for d in pending)]
        order = {doc_id: n for n, doc_id in enumerate(_priority)}
    # documents a user is waiting on go first, in the order they asked; the rest by id
    pending.sort(key=lambda d: (order.get(d["id"], len(order)), d["id"]))
    for doc in pending:
        if _attempts.get(doc["id"], 0) >= MAX_ATTEMPTS or _retry_at.get(doc["id"], 0) > now:
            continue
        break
    else:
        return "idle"

    doc_id = doc["id"]
    ok = True
    jobs = (
        ("summary", doc["need_summary"], generate_summary),
        ("suggestions", doc["need_suggestions"], generate_suggestions),
    )
    for column, needed, fn in jobs:
        # A route may have stored it since the list was read; do not spend tokens twice.
        if not needed or not still_needed(doc_id, column):
            continue
        try:
            value = _attempt(doc_id, column, fn)
        except Exception:
            logger.exception("Preparing %s for document %s failed", column, doc_id)
            ok = False
            continue
        if value:
            save(doc_id, column, value if isinstance(value, str) else json.dumps(value))
            logger.info("Prepared %s for document %s (%s)", column, doc_id, doc["filename"])
        else:
            logger.warning("No usable %s came back for document %s", column, doc_id)
            ok = False

    with _priority_guard:
        if doc_id in _priority:
            _priority.remove(doc_id)
    if ok:
        _attempts.pop(doc_id, None)
        _retry_at.pop(doc_id, None)
        return "done"
    failures = _attempts.get(doc_id, 0) + 1
    _attempts[doc_id] = failures
    _retry_at[doc_id] = time.time() + min(300, 60 * failures)
    return "failed"


_wake = threading.Event()
_worker = None
_worker_guard = threading.Lock()


_next_allowed = 0.0   # earliest time the next document may start


def _loop() -> None:
    global _next_allowed
    while True:
        wait = _next_allowed - time.time()
        if wait > 0:
            time.sleep(wait)
        try:
            result = process_next()
        except Exception:
            logger.exception("Background preparation loop error")
            result = "failed"
        if result == "idle":
            _wake.wait(timeout=IDLE_SECONDS)
            _wake.clear()
        else:
            _next_allowed = time.time() + PAUSE_SECONDS


def ensure_worker() -> None:
    """Start the worker thread if it is not running, and tell it to look for work now."""
    global _worker
    with _worker_guard:
        if _worker is None or not _worker.is_alive():
            _worker = threading.Thread(target=_loop, name="doc-prep", daemon=True)
            _worker.start()
            logger.info("Background document preparation started")
    _wake.set()