# DocMind — AI Document Q&A

> Upload any PDF. Ask anything. Get answers grounded in your document — not hallucinations.

![DocMind App Screenshot](./screenshots/app.png)

## What it does

DocMind is a full-stack RAG (Retrieval-Augmented Generation) application that lets you chat with your documents using AI. Upload a PDF, ask questions in natural language, and get accurate, cited answers streamed in real time — powered by vector embeddings and LLaMA 3.1.

---

## Features

### Core
- **Semantic search** — pgvector cosine similarity finds relevant content even with different phrasing
- **Streaming responses** — answers stream token by token via LLaMA 3.1 on Groq
- **Multi-document chat** — query across multiple PDFs simultaneously with a single question
- **Answer confidence indicator** — similarity scores shown per source chunk
- **Source citations** — every answer shows which chunks it was grounded in

### Productivity
- **Smart suggestions** — AI-generated questions appear after every upload and doc switch
- **Document summarization** — auto TL;DR generated on upload, shown above chat
- **Chat search** — Ctrl+F style search through current chat history
- **Pin messages** — star/bookmark key AI answers to reference later
- **Export chat as PDF** — download full Q&A session as a formatted report
- **Rename documents** — inline rename in the sidebar
- **Document tags** — color-coded labels to organize docs; filter sidebar by tag
- **Cross-document search** — semantic search across all indexed documents from the sidebar
- **Quick actions** — "Explain simpler" / "More detail" buttons on every response
- **Regenerate** — one-click regenerate on any assistant message

### UX & Polish
- **Resizable sidebar** — drag to resize, collapses to zero, persists across sessions
- **Mobile responsive** — full slide-in sidebar overlay on mobile
- **Framer Motion animations** — messages slide in, sidebar animates, thinking bubble waves
- **Dark/light mode** — persisted across sessions with smooth CSS variable transition
- **Keyboard shortcuts** — press `/` for full shortcuts panel
- **Message timestamps** — shown on hover, pulled from real DB timestamps
- **Upload progress** — animated checklist showing each indexing step
- **Drag-and-drop upload** — drop up to 10 files at once for parallel indexing
- **Tag manager portal** — tag assignment popup rendered via React portal, no overflow clipping
- **Dashboard highlight** — clicking a recent question navigates and highlights that message
- **Usage dashboard** — charts showing documents, messages, chunks, daily activity, storage

### Auth & Security
- **JWT authentication** — secure per-user document isolation
- **Per-user document storage** — your documents are private and only accessible to you

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Tailwind CSS, Framer Motion, Zustand |
| Backend | FastAPI, Python 3.11 |
| AI / LLM | LLaMA 3.1 via Groq API (free tier) |
| Embeddings | sentence-transformers `all-MiniLM-L6-v2` (384-dim) |
| Vector DB | PostgreSQL + pgvector |
| Auth | JWT (python-jose + bcrypt) |
| Containerization | Docker + docker-compose |
| Deployment | Render (backend) + Vercel (frontend) |

---

## Architecture

```
User uploads PDF
      ↓
Text Extraction (PyMuPDF)
      ↓
Chunking (500 words, 50-word overlap)
      ↓
Embeddings (sentence-transformers, 384-dim)
      ↓
Vector Store (pgvector)
      ↓
User asks question
      ↓
Query Embedding → Cosine Similarity Search → Top-4 chunks + similarity scores
      ↓
Prompt construction + LLaMA 3.1 (Groq) → Streaming SSE
      ↓
React frontend renders token by token with blinking cursor + confidence badges
```

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker Desktop

### 1. Clone and configure

```bash
git clone https://github.com/yourusername/docmind
cd docmind
cp backend/.env.example backend/.env
# Edit backend/.env — add your GROQ_API_KEY from console.groq.com (free)
```

### 2. Start the database

```bash
docker-compose up db -d
```

### 3. Run the backend

```bash
cd backend
python3.11 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API docs available at **http://localhost:8000/docs**

### 4. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**

### Daily workflow

```bash
# Terminal 1 — DB (run once, stays running)
docker-compose up db -d

# Terminal 2 — Backend
cd backend && source venv/bin/activate && uvicorn app.main:app --reload

# Terminal 3 — Frontend
cd frontend && npm run dev
```

---

## Project Structure

```
docmind/
├── docker-compose.yml
├── README.md
│
├── backend/
│   ├── .env.example
│   ├── requirements.txt
│   ├── Dockerfile
│   └── app/
│       ├── main.py                  # FastAPI app, CORS, startup
│       ├── config.py                # Settings from .env
│       ├── db.py                    # DB connection + table init (users, documents,
│       │                            #   chunks, chat_messages, tags, document_tags)
│       ├── models/
│       │   └── schemas.py           # Pydantic request/response models
│       ├── auth/
│       │   └── utils.py             # JWT creation, bcrypt, get_current_user
│       ├── rag/
│       │   └── pipeline.py          # Extract → chunk → embed → retrieve → generate
│       │                            # retrieve_chunks returns (text, similarity_score)
│       │                            # generate_answer_stream yields tokens
│       │                            # generate_summary_stream for doc summaries
│       └── routers/
│           ├── auth.py              # POST /auth/register, /auth/login
│           ├── documents.py         # /docs/* (upload, list, rename, tags, summary, search)
│           └── chat.py              # /chat/* (stream, multi, suggest, history, activity, stats)
│
└── frontend/
    └── src/
        ├── App.jsx                  # Routes: / /login /app /dashboard
        ├── main.jsx                 # Entry + Toaster
        ├── index.css                # Tailwind + CSS variables for dark/light theme
        ├── lib/
        │   └── api.js               # Axios + JWT interceptor + auto-logout on 401
        ├── store/
        │   └── useStore.js          # Zustand: theme, auth, documents, tags, chat
        ├── pages/
        │   ├── LandingPage.jsx      # Marketing landing page with animated demo chat
        │   ├── AuthPage.jsx         # Login / Register
        │   ├── AppPage.jsx          # Main chat interface + keyboard shortcuts
        │   └── DashboardPage.jsx    # Usage analytics with recharts
        └── components/
            ├── ui/
            │   ├── ProtectedRoute.jsx
            │   └── KeyboardShortcuts.jsx  # / to toggle, all shortcuts listed
            ├── documents/
            │   └── Sidebar.jsx      # Resizable, collapsible, mobile overlay
            │                        # Doc list, upload, tags, search, suggestions
            └── chat/
                ├── ChatMessage.jsx  # Markdown, copy, retry, confidence badges,
                │                    #   pin, simpler/detail actions, timestamps
                ├── ChatInput.jsx    # Auto-resize textarea, shake on empty
                └── ExportButton.jsx # jsPDF export with markdown stripping
```

---

## Database Schema

```sql
users          (id, email, hashed_password, created_at)
documents      (id, user_id, filename, file_size, chunk_count, created_at)
chunks         (id, doc_id, chunk_index, text, embedding vector(384), created_at)
chat_messages  (id, user_id, doc_id, role, content, created_at)
tags           (id, user_id, name, color, created_at)
document_tags  (doc_id, tag_id)  -- junction table
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Get JWT token |
| POST | `/docs/upload` | Upload + index document |
| GET | `/docs/` | List user's documents (with tags) |
| PATCH | `/docs/{id}/rename` | Rename document |
| DELETE | `/docs/{id}` | Delete document |
| GET | `/docs/{id}/summary` | Stream document summary (SSE) |
| GET | `/docs/search?q=` | Semantic search across all docs |
| GET | `/docs/tags` | List user's tags |
| POST | `/docs/tags` | Create tag |
| DELETE | `/docs/tags/{id}` | Delete tag (removes from all docs) |
| POST | `/docs/{id}/tags` | Assign tag to document |
| DELETE | `/docs/{id}/tags/{tag_id}` | Remove tag from document |
| POST | `/chat/stream` | Stream Q&A response — single doc (SSE) |
| POST | `/chat/stream/multi` | Stream Q&A across multiple docs (SSE) |
| POST | `/chat/suggest` | Generate suggested questions (no history saved) |
| GET | `/chat/history/{doc_id}` | Get chat history with timestamps |
| GET | `/chat/activity` | Daily question counts — last 7 days |
| GET | `/chat/stats` | Aggregate stats (avg response length etc.) |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `/` | Open shortcuts panel |
| `⌘K` | Focus chat input |
| `⌘L` | Toggle dark/light mode |
| `⌘D` | Go to dashboard |
| `⌘B` | Toggle sidebar collapse |
| `⌘Shift+C` | Clear chat |
| `⌘E` | Export chat as PDF |
| `Esc` | Close panel |

---

## Environment Variables

```env
GROQ_API_KEY=your_groq_key          # from console.groq.com (free)
DATABASE_URL=postgresql://...        # postgres connection string
SECRET_KEY=your_jwt_secret           # any random string, keep it secret
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
```

---

## Deployment

### Backend → Render
1. Push to GitHub
2. New Web Service on Render → connect repo → set root to `backend`
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add environment variables from `.env`
6. Add a Render PostgreSQL database and copy the connection string to `DATABASE_URL`

### Frontend → Vercel
1. New project on Vercel → connect repo → set root to `frontend`
2. Add env var: `VITE_API_URL=https://your-render-app.onrender.com`
3. Update CORS in `backend/app/main.py` to allow your Vercel URL
4. Deploy

---

## Resume Bullets

- Built a full-stack RAG pipeline ingesting PDFs via semantic chunking and pgvector embeddings, enabling sub-second Q&A with cosine similarity search and confidence scoring across large documents
- Implemented real-time streaming responses using Server-Sent Events with FastAPI and LLaMA 3.1 via Groq API, reducing perceived latency to near-zero
- Engineered cross-document semantic search enabling simultaneous RAG queries across multiple indexed PDFs
- Reduced hallucination by grounding all LLM responses in retrieved document context with source citation and similarity scores
- Built full authentication system with JWT, bcrypt, and per-user document isolation in PostgreSQL
- Deployed full-stack AI application with React, FastAPI, pgvector, and Docker on Render and Vercel

---

## Possible Future Features

- [ ] Real-time collaborative chat — multiple users on the same document
- [ ] Document version history — track changes across re-uploads
- [ ] Public share link — read-only shareable URL for a chat session
- [ ] Highlight source chunk in PDF viewer — show exact page/location
- [ ] Multi-turn memory summary — compress old context automatically
- [ ] Rate limiting per user — prevent API abuse in production
- [ ] Response caching — return cached answers for repeated questions
- [ ] Webhook notifications — alert when a long document finishes indexing
- [ ] CSV/Excel support — index spreadsheet data as searchable chunks
- [ ] OAuth login — Google / GitHub sign-in

---

## License

MIT — feel free to use this as a portfolio project or starting point.

---

*Built by Priyansh Arora · B.Tech IT, Jaypee Institute of Information Technology*