"""
Sistema de puntaje de la penca:
- Resultado exacto: 5 puntos
- Ganador correcto + diferencia exacta: 3 puntos
- Solo ganador correcto: 1 punto
- Sin acierto: 0 puntos
"""

POINTS_EXACT = 5
POINTS_WINNER_DIFF = 3
POINTS_WINNER_ONLY = 1


def calculate_points(
    pred_home: int, pred_away: int,
    real_home: int | None, real_away: int | None,
) -> int:
    if real_home is None or real_away is None:
        return 0
    # Exacto
    if pred_home == real_home and pred_away == real_away:
        return POINTS_EXACT
    pred_sign = (pred_home > pred_away) - (pred_home < pred_away)
    real_sign = (real_home > real_away) - (real_home < real_away)
    if pred_sign != real_sign:
        return 0
    # Mismo ganador (o ambos empate) + diferencia exacta
    if (pred_home - pred_away) == (real_home - real_away):
        return POINTS_WINNER_DIFF
    return POINTS_WINNER_ONLY
