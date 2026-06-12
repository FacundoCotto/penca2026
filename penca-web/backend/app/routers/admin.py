"""Endpoints exclusivos del panel de administracion."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select

from .. import models, schemas, auth
from ..database import get_db
from ..scoring import calculate_points, POINTS_EXACT

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[schemas.AdminUserRow])
def list_users(
    db: Session = Depends(get_db),
    _admin: models.User = Depends(auth.require_admin),
):
    """Lista todos los usuarios registrados con sus estadisticas de actividad.

    Carga usuarios + pronosticos + partidos en 3 queries fijas
    (selectinload), independiente de la cantidad de usuarios.
    """
    users = db.execute(
        select(models.User)
        .options(selectinload(models.User.predictions).selectinload(models.Prediction.match))
        .order_by(models.User.created_at)
    ).scalars().all()

    rows = []
    for u in users:
        total = exact = 0
        last = None
        for p in u.predictions:
            pts = calculate_points(p.home_goals, p.away_goals, p.match.home_goals, p.match.away_goals)
            total += pts
            if pts == POINTS_EXACT:
                exact += 1
            if last is None or p.updated_at > last:
                last = p.updated_at
        rows.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "is_admin": u.is_admin,
            "created_at": u.created_at,
            "predictions_count": len(u.predictions),
            "total_points": total,
            "exact_hits": exact,
            "last_prediction_at": last,
        })
    return rows
