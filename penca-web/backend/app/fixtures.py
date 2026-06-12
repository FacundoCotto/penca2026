"""Sincronizacion de partidos del Mundial 2026 (USA, Mexico, Canada) desde internet."""
import logging
from datetime import datetime

import requests
from sqlalchemy import select

from . import models
from .database import SessionLocal

logger = logging.getLogger("penca.fixtures")

FEED_URL = "https://fixturedownload.com/feed/json/fifa-world-cup-2026"

# Traduccion de nombres de equipos al espanol
TEAM_NAMES_ES = {
    "Algeria": "Argelia",
    "Argentina": "Argentina",
    "Australia": "Australia",
    "Austria": "Austria",
    "Belgium": "Bélgica",
    "Bosnia and Herzegovina": "Bosnia y Herzegovina",
    "Brazil": "Brasil",
    "Cabo Verde": "Cabo Verde",
    "Canada": "Canadá",
    "Colombia": "Colombia",
    "Congo DR": "RD del Congo",
    "Croatia": "Croacia",
    "Curaçao": "Curazao",
    "Czechia": "Chequia",
    "Côte d'Ivoire": "Costa de Marfil",
    "Ecuador": "Ecuador",
    "Egypt": "Egipto",
    "England": "Inglaterra",
    "France": "Francia",
    "Germany": "Alemania",
    "Ghana": "Ghana",
    "Haiti": "Haití",
    "IR Iran": "Irán",
    "Iraq": "Irak",
    "Japan": "Japón",
    "Jordan": "Jordania",
    "Korea Republic": "Corea del Sur",
    "Mexico": "México",
    "Morocco": "Marruecos",
    "Netherlands": "Países Bajos",
    "New Zealand": "Nueva Zelanda",
    "Norway": "Noruega",
    "Panama": "Panamá",
    "Paraguay": "Paraguay",
    "Portugal": "Portugal",
    "Qatar": "Catar",
    "Saudi Arabia": "Arabia Saudita",
    "Scotland": "Escocia",
    "Senegal": "Senegal",
    "South Africa": "Sudáfrica",
    "Spain": "España",
    "Sweden": "Suecia",
    "Switzerland": "Suiza",
    "Tunisia": "Túnez",
    "Türkiye": "Turquía",
    "USA": "Estados Unidos",
    "Uruguay": "Uruguay",
    "Uzbekistan": "Uzbekistán",
    "To be announced": "A definir",
}

# RoundNumber del feed -> fase del torneo
ROUND_PHASES = {
    1: "Fase de Grupos",
    2: "Fase de Grupos",
    3: "Fase de Grupos",
    4: "Dieciseisavos",
    5: "Octavos",
    6: "Cuartos",
    7: "Semifinal",
}


def _phase(item: dict) -> str:
    rn = item["RoundNumber"]
    if rn in ROUND_PHASES:
        return ROUND_PHASES[rn]
    # Ronda 8: tercer puesto (partido 103) y final (104)
    return "Tercer Puesto" if item["MatchNumber"] == 103 else "Final"


def _team(name: str) -> str:
    return TEAM_NAMES_ES.get(name, name)


def _parse_date(value: str) -> datetime:
    # "2026-06-11 19:00:00Z" -> datetime UTC naive
    return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)


def fetch_fixtures() -> list[dict]:
    resp = requests.get(FEED_URL, headers={"User-Agent": "penca-web/1.0"}, timeout=30)
    resp.raise_for_status()
    return resp.json()


def sync_matches() -> None:
    """Descarga los partidos del Mundial 2026 y crea/actualiza la BD."""
    try:
        fixtures = fetch_fixtures()
    except Exception:
        logger.exception("No se pudieron descargar los partidos del Mundial 2026")
        return

    db = SessionLocal()
    try:
        existing = {
            m.external_id: m
            for m in db.execute(select(models.Match)).scalars()
            if m.external_id is not None
        }
        created = updated = 0
        for item in fixtures:
            group = item.get("Group")
            data = dict(
                match_date=_parse_date(item["DateUtc"]),
                phase=_phase(item),
                group_name=group.replace("Group ", "") if group else None,
                home_team=_team(item["HomeTeam"]),
                away_team=_team(item["AwayTeam"]),
                home_goals=item["HomeTeamScore"],
                away_goals=item["AwayTeamScore"],
            )
            match = existing.get(item["MatchNumber"])
            if match is None:
                db.add(models.Match(external_id=item["MatchNumber"], **data))
                created += 1
            else:
                changed = False
                for field, value in data.items():
                    if getattr(match, field) != value:
                        setattr(match, field, value)
                        changed = True
                if changed:
                    updated += 1
        db.commit()
        logger.info("Mundial 2026: %d partidos creados, %d actualizados", created, updated)
    except Exception:
        db.rollback()
        logger.exception("Error sincronizando partidos del Mundial 2026")
    finally:
        db.close()
