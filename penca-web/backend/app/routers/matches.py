from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select

from .. import models, auth
from .. import schemas
from ..database import get_db
from ..fixtures import sync_matches

router = APIRouter(prefix="/matches", tags=["matches"])


@router.get("", response_model=list[schemas.MatchOut])
def list_matches(db: Session = Depends(get_db)):
    rows = db.execute(select(models.Match).order_by(models.Match.match_date)).scalars().all()
    return rows


@router.post("/sync", status_code=202)
def force_sync(_admin: models.User = Depends(auth.require_admin)):
    """Fuerza una sincronizacion inmediata con el feed oficial del Mundial 2026.

    Los partidos y resultados se actualizan automaticamente cada
    MATCH_SYNC_INTERVAL segundos; este endpoint existe solo para que el
    admin pueda adelantar esa actualizacion sin esperar al proximo ciclo.
    """
    sync_matches()
    return {"detail": "Sincronización ejecutada"}
