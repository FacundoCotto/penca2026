from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from .. import models, schemas, auth
from ..database import get_db
from ..scoring import calculate_points

router = APIRouter(prefix="/predictions", tags=["predictions"])


@router.post("", response_model=schemas.PredictionOut)
def upsert_prediction(
    data: schemas.PredictionIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(auth.get_current_user),
):
    match = db.get(models.Match, data.match_id)
    if not match:
        raise HTTPException(404, "Partido no encontrado")
    if match.is_finished:
        raise HTTPException(400, "El partido ya finalizó: no se pueden cargar pronósticos")

    existing = db.execute(
        select(models.Prediction).where(
            models.Prediction.user_id == user.id,
            models.Prediction.match_id == data.match_id,
        )
    ).scalar_one_or_none()

    if existing:
        existing.home_goals = data.home_goals
        existing.away_goals = data.away_goals
        db.commit()
        db.refresh(existing)
        return existing

    pred = models.Prediction(
        user_id=user.id,
        match_id=data.match_id,
        home_goals=data.home_goals,
        away_goals=data.away_goals,
    )
    db.add(pred)
    db.commit()
    db.refresh(pred)
    return pred


@router.get("/me", response_model=list[schemas.PredictionWithMatch])
def my_predictions(
    db: Session = Depends(get_db),
    user: models.User = Depends(auth.get_current_user),
):
    rows = db.execute(
        select(models.Prediction)
        .where(models.Prediction.user_id == user.id)
        .order_by(models.Prediction.match_id)
    ).scalars().all()

    out = []
    for p in rows:
        out.append({
            "match": p.match,
            "home_goals": p.home_goals,
            "away_goals": p.away_goals,
            "points": calculate_points(
                p.home_goals, p.away_goals,
                p.match.home_goals, p.match.away_goals,
            ),
        })
    return out


@router.get("/history/{user_id}", response_model=list[schemas.PredictionWithMatch])
def history(
    user_id: int,
    db: Session = Depends(get_db),
    _user: models.User = Depends(auth.get_current_user),
):
    target = db.get(models.User, user_id)
    if not target:
        raise HTTPException(404, "Usuario no encontrado")
    rows = db.execute(
        select(models.Prediction)
        .where(models.Prediction.user_id == user_id)
        .order_by(models.Prediction.match_id)
    ).scalars().all()
    return [{
        "match": p.match,
        "home_goals": p.home_goals,
        "away_goals": p.away_goals,
        "points": calculate_points(p.home_goals, p.away_goals, p.match.home_goals, p.match.away_goals),
    } for p in rows]
