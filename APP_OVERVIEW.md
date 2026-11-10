# DocMind

DocMind is an AI-powered PDF question-answering application. Users upload one or more documents, then chat with their contents through answers grounded in retrieved source passages.

## What users can do

- Create an account and securely access their own document workspace.
- Upload PDFs by file picker or drag and drop.
- Ask questions about one document or search across multiple documents.
- Receive streamed answers with source chunks and similarity-based confidence indicators.
- Generate document summaries and suggested follow-up questions.
- Organize documents with tags, rename them, and search across the document library.
- Pin useful answers, regenerate responses, and export a chat as a PDF report.
- Review document, message, chunk, activity, and storage usage on the dashboard.

## How it works

```text
PDF upload
  -> text extraction (PyMuPDF)
  -> 500-word chunks with 50-word overlap
  -> all-MiniLM-L6-v2 embeddings
  -> PostgreSQL + pgvector storage

Question
  -> query embedding
  -> cosine-similarity retrieval
  -> relevant chunks supplied to Llama 3.1 on Groq
  -> streamed answer in the React interface
```

## Technology

| Area | Implementation |
| --- | --- |
| Client | React, Vite, Tailwind CSS, Zustand, Framer Motion |
| API | FastAPI and Python 3.11 |
| Retrieval | sentence-transformers (`all-MiniLM-L6-v2`) and pgvector |
| Generation | `llama-3.1-8b-instant` through the Groq API |
| Database | PostgreSQL 16 |
| Authentication | JWT with bcrypt password hashing |
| Containers | Docker Compose |

## Run locally

### Prerequisites

- Python 3.11 or later
- Node.js 18 or later
- Docker Desktop
- A Groq API key

### Configure the backend

Copy the example environment file and provide values for `GROQ_API_KEY`, `DATABASE_URL`, and `SECRET_KEY`.

```bash
cp backend/.env.example backend/.env
```

### Start the services

```bash
# Database
docker-compose up db -d

# Backend (new terminal)
cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open the application at `http://localhost:5173`. The interactive API documentation is available at `http://localhost:8000/docs`.

To run all services as containers, use:

```bash
docker-compose up --build
```

## Main API groups

| Prefix | Purpose |
| --- | --- |
| `/auth` | Account registration and JWT login |
| `/docs` | Uploading, listing, renaming, tagging, summarizing, searching, and deleting documents |
| `/chat` | Document chat, streamed responses, multi-document chat, history, suggestions, activity, and stats |
| `/health` | API health check |

## Repository layout

```text
backend/
  app/
    auth/       # JWT helpers and authenticated-user dependency
    rag/        # extraction, chunking, embeddings, retrieval, generation
    routers/    # auth, documents, and chat API endpoints
frontend/
  src/
    components/ # chat, document sidebar, and shared UI
    pages/      # landing, auth, app, and dashboard pages
    store/      # Zustand application state
docker-compose.yml
```

## Data isolation

Each document, tag, chat message, and search result is associated with the authenticated user. Retrieval queries are scoped to that user's documents so one account cannot access another account's content.

## Notes for deployment

- Keep `GROQ_API_KEY` and `SECRET_KEY` in the hosting provider's secret store; never commit them.
- Use a persistent PostgreSQL volume or managed PostgreSQL database in production.
- Configure the frontend API base URL and backend CORS origins for the deployed frontend domain.
