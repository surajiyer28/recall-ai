import os
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # PostgreSQL
    postgres_host: str = "localhost"
    postgres_port: int = 5433
    postgres_user: str = "recallai"
    postgres_password: str = "recallai_dev"
    postgres_db: str = "recallai"

    # ChromaDB
    chroma_host: str = "localhost"
    chroma_port: int = 8000

    # API Keys
    openai_api_key: str = ""
    google_cloud_project: str = ""
    google_cloud_location: str = "us-central1"
    anthropic_api_key: str = ""

    # Server
    app_host: str = "0.0.0.0"
    app_port: int = 8080
    debug: bool = True

    # File uploads
    upload_dir: str = "uploads"
    max_upload_size_mb: int = 500

    @property
    def postgres_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def postgres_url_sync(self) -> str:
        return (
            f"postgresql+psycopg2://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    google_application_credentials: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    # Propagate Google credentials path to the OS env so the SDK finds it
    if s.google_application_credentials and not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = s.google_application_credentials
    return s
