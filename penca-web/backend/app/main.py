import asyncio
import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from .database import Base, engine, SessionLocal
from . import models, auth
from .fixtures import sync_matches
from .routers import auth_router, matches, predictions, ranking

logging.basicConfig(level=logging.INFO)

# Cada cuanto se actualizan los partidos desde internet (en segundos)
SYNC_INTERVAL_SECONDS = int(os.getenv("MATCH_SYNC_INTERVAL", "900"))

app = FastAPI(title="Penca del Mundial 2026 API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(matches.router)
app.include_router(predictions.router)
app.include_router(ranking.router)


@app.get("/")
def root():
    return {"app": "Penca del Mundial 2026", "status": "ok"}


@app.on_event("startup")
async def on_startup():
    Base.metadata.create_all(bind=engine)
    seed_initial_data()
    asyncio.create_task(sync_matches_loop())


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

        admin = models.User(
            username="admin",
            email="admin@penca.com",
            password_hash=auth.hash_password("admin123"),
            is_admin=True,
        )
        db.add(admin)
        db.commit()
    finally:
        db.close()
