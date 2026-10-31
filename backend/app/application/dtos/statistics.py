import uuid

from pydantic import BaseModel, ConfigDict


class StandingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    position: int
    team_id: uuid.UUID
    team_name: str
    team_short: str
    team_color: str
    team_logo: str | None
    played: int
    won: int
    drawn: int
    lost: int
    goals_for: int
    goals_against: int
    goal_difference: int
    points: int
    form: str

class TournamentStatsSummary(BaseModel):
    total_matches: int
    finished_matches: int
    total_goals: int
    average_goals_per_match: float
    total_yellow_cards: int
    total_red_cards: int
    best_attack_team: str | None
    best_defense_team: str | None
