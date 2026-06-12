import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from .database import Base, engine, SessionLocal
from . import models, auth
from .fixtures import sync_matches
from .routers import auth_router, matches, predictions, ranking, admin

logging.basicConfig(level=logging.INFO)

# Cada cuanto se actualizan los partidos desde internet (en segundos)
SYNC_INTERVAL_SECONDS = int(os.getenv("MATCH_SYNC_INTERVAL", "900"))

# Origenes permitidos para CORS (separados por coma). "*" solo en desarrollo.
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")]


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed_initial_data()
    sync_task = asyncio.create_task(sync_matches_loop())
    yield
    sync_task.cancel()


app = FastAPI(title="Penca del Mundial 2026 API", version="3.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(matches.router)
app.include_router(predictions.router)
app.include_router(ranking.router)
app.include_router(admin.router)


@app.get("/")
def root():
    return {"app": "Penca del Mundial 2026", "status": "ok"}


@app.get("/health")
def health():
    """Endpoint liviano para load balancers / monitoreo."""
    return {"status": "healthy"}


async def sync_matches_loop():
    """Actualiza los partidos del Mundial 2026 desde internet periodicamente."""
    while True:
        await asyncio.to_thread(sync_matches)
        await asyncio.sleep(SYNC_INTERVAL_SECONDS)


def seed_initial_data():
    """Crea el usuario admin si la BD esta vacia."""
    db = SessionLocal()
    try:
        if db.execute(select(models.User)).first():
            return

        admin_password = os.getenv("ADMIN_PASSWORD", "admin123")
        admin_user = models.User(
            username="admin",
            email="admin@penca.com",
            password_hash=auth.hash_password(admin_password),
            is_admin=True,
        )
        db.add(admin_user)
        db.commit()
    finally:
        db.close()
