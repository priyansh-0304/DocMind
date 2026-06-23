from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    groq_api_key: str
    database_url: str
    secret_key: str
    hf_token: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    class Config:
        env_file = ".env"


settings = Settings()