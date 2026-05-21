from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional


# ── Auth ──────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    user_id: Optional[int] = None


# ── Tags ──────────────────────────────────────────────────────────────────────

class TagCreate(BaseModel):
    name: str
    color: str = '#7c6af7'


class TagOut(BaseModel):
    id: int
    name: str
    color: str
    created_at: datetime


class TagAssign(BaseModel):
    tag_id: int


# ── Documents ─────────────────────────────────────────────────────────────────

class DocumentOut(BaseModel):
    id: int
    filename: str
    file_size: int
    chunk_count: int
    created_at: datetime
    tags: list[TagOut] = []


# ── Chat ──────────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    doc_id: int
    query: str
    history: list[ChatMessage] = []


class MultiChatRequest(BaseModel):
    doc_ids: list[int]
    query: str
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    answer: str
    sources: list[str]
    doc_id: int