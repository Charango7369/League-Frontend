import uuid

from pydantic import BaseModel


class SportsChronicleRequest(BaseModel):
    match_id: uuid.UUID
    narrative_style: str = "LATIN_SPORTS_JOURNALIST" # LATIN_SPORTS_JOURNALIST, FORMAL_PRESS, RADIO_COMMENTARY
    include_quotes: bool = True

class SportsChronicleResponse(BaseModel):
    match_id: uuid.UUID
    headline: str
    subheading: str
    body_text: str
    mvp_player: str | None
    tactical_highlight: str
    generated_at: str
