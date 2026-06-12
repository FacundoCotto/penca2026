from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, ConfigDict


# ---------- Auth ----------
class UserRegister(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=6, max_length=72)


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    email: EmailStr
    is_admin: bool
    created_at: datetime


Token.model_rebuild()


# ---------- Matches ----------
class MatchBase(BaseModel):
    match_date: datetime
    phase: str
    group_name: str | None = None
    home_team: str
    away_team: str


class MatchOut(MatchBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    home_goals: int | None
    away_goals: int | None
    is_finished: bool


# ---------- Predictions ----------
class PredictionIn(BaseModel):
    match_id: int
    home_goals: int = Field(ge=0, le=30)
    away_goals: int = Field(ge=0, le=30)


class PredictionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    match_id: int
    home_goals: int
    away_goals: int
    updated_at: datetime


class PredictionWithMatch(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    match: MatchOut
    home_goals: int
    away_goals: int
    points: int


# ---------- Ranking ----------
class RankingRow(BaseModel):
    position: int
    user_id: int
    username: str
    total_points: int
    predictions_count: int
    exact_hits: int


# ---------- Admin ----------
class AdminUserRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    email: EmailStr
    is_admin: bool
    created_at: datetime
    predictions_count: int
    total_points: int
    exact_hits: int
    last_prediction_at: datetime | None
