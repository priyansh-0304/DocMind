from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordRequestForm

from app.db import get_db_connection
from app.models.schemas import UserCreate, UserOut, Token
from app.auth.utils import (
    hash_password,
    verify_password,
    create_access_token,
)

router = APIRouter(tags=["Auth"])


@router.post("/register", response_model=UserOut, status_code=201)
def register(user: UserCreate):

    # DEBUGGING
    print("EMAIL:", user.email)
    print("PASSWORD:", user.password)
    print("TYPE:", type(user.password))
    print("LENGTH:", len(user.password))

    # Prevent bcrypt crash
    if len(user.password.encode("utf-8")) > 72:
        raise HTTPException(
            status_code=400,
            detail="Password too long (max 72 bytes)"
        )

    conn = get_db_connection()
    cur = conn.cursor()

    # Check existing user
    cur.execute(
        "SELECT id FROM users WHERE email = %s",
        (user.email,)
    )

    if cur.fetchone():
        cur.close()
        conn.close()

        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    # Hash password
    hashed = hash_password(user.password)

    # Insert user
    cur.execute(
        """
        INSERT INTO users (email, hashed_password)
        VALUES (%s, %s)
        RETURNING *
        """,
        (user.email, hashed),
    )

    new_user = cur.fetchone()

    conn.commit()
    cur.close()
    conn.close()

    return new_user


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends()):

    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute(
        "SELECT * FROM users WHERE email = %s",
        (form_data.username,)
    )

    user = cur.fetchone()

    cur.close()
    conn.close()

    if not user or not verify_password(
        form_data.password,
        user["hashed_password"]
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    token = create_access_token(
        {"sub": str(user["id"])}
    )

    return {
        "access_token": token,
        "token_type": "bearer"
    }