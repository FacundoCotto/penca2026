from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/matches", tags=["matches"])


@router.get("", response_model=list[schemas.MatchOut])
def list_matches(db: Session = Depends(get_db)):
    rows = db.execute(select(models.Match).order_by(models.Match.match_date)).scalars().all()
    return rows


@router.post("", response_model=schemas.MatchOut, status_code=201)
def create_match(
    data: schemas.MatchCreate,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(auth.require_admin),
):
    m = models.Match(**data.model_dump())
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


@router.put("/{match_id}/result", response_model=schemas.MatchOut)
def set_result(
    match_id: int,
    data: schemas.MatchResult,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(auth.require_admin),
):
    m = db.get(models.Match, match_id)
    if not m:
        raise HTTPException(404, "Partido no encontrado")
    m.home_goals = data.home_goals
    m.away_goals = data.away_goals
    db.commit()
    db.refresh(m)
    return m


@router.delete("/{match_id}", status_code=204)
def delete_match(
    match_id: int,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(auth.require_admin),
):
    m = db.get(models.Match, match_id)
    if not m:
        raise HTTPException(404, "Partido no encontrado")
    db.delete(m)
    db.commit()
