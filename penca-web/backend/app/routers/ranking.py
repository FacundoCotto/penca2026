from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select

from .. import models, schemas, auth
from ..database import get_db
from ..scoring import calculate_points, POINTS_EXACT

router = APIRouter(prefix="/ranking", tags=["ranking"])


@router.get("", response_model=list[schemas.RankingRow])
def get_ranking(
    db: Session = Depends(get_db),
    _user: models.User = Depends(auth.get_current_user),
):
    users = db.execute(select(models.User).order_by(models.User.id)).scalars().all()
    rows = []
    for u in users:
        preds = u.predictions
        total = 0
        exact = 0
        for p in preds:
            pts = calculate_points(p.home_goals, p.away_goals, p.match.home_goals, p.match.away_goals)
            total += pts
            if pts == POINTS_EXACT:
                exact += 1
        rows.append({
            "user_id": u.id,
            "username": u.username,
            "total_points": total,
            "predictions_count": len(preds),
            "exact_hits": exact,
        })
    rows.sort(key=lambda r: (-r["total_points"], -r["exact_hits"], r["username"]))
    for i, r in enumerate(rows, start=1):
        r["position"] = i
    return rows
