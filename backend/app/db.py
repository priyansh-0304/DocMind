import psycopg2
from psycopg2.extras import RealDictCursor
from app.config import settings


def get_db_connection():
    conn = psycopg2.connect(settings.database_url, cursor_factory=RealDictCursor)
    return conn


def init_db():
    """Create all tables and enable pgvector extension."""
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            hashed_password VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        );
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            filename VARCHAR(255) NOT NULL,
            file_size INTEGER,
            chunk_count INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW()
        );
    """)

    # Cached TL;DR and suggested questions, generated once per document (added after
    # the first release, so applied as migrations for databases that already have the table).
    cur.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS summary TEXT;")
    cur.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS suggestions TEXT;")

    cur.execute("""
        CREATE TABLE IF NOT EXISTS chunks (
            id SERIAL PRIMARY KEY,
            doc_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
            chunk_index INTEGER NOT NULL,
            text TEXT NOT NULL,
            embedding vector(384),
            created_at TIMESTAMP DEFAULT NOW()
        );
    """)

    # Retrieval always filters by document, so a plain btree on doc_id plus an
    # exact distance sort is both fast and complete at this scale. The previous
    # ivfflat index (lists=100, built on an empty table, default probes=1) could
    # return no rows at all for small collections because the filter is applied
    # after the approximate index scan.
    cur.execute("""
        CREATE INDEX IF NOT EXISTS chunks_doc_id_idx
        ON chunks (doc_id);
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS chat_messages (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            doc_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
            role VARCHAR(20) NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        );
    """)

    # ── Tags ──────────────────────────────────────────────────────────────────
    cur.execute("""
        CREATE TABLE IF NOT EXISTS tags (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(50) NOT NULL,
            color VARCHAR(20) DEFAULT '#7c6af7',
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(user_id, name)
        );
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS document_tags (
            doc_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
            tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
            PRIMARY KEY (doc_id, tag_id)
        );
    """)

    conn.commit()
    cur.close()
    conn.close()
    print("Database initialized successfully.")