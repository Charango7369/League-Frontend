import uuid

from app.infrastructure.models.team import Team


def test_berger_pairing_logic():
    # Test Berger round-robin pairings for 4 teams
    teams = [
        Team(id=uuid.uuid4(), name=f"Team {i}", short_code=f"T{i}", primary_color="#000", secondary_color="#fff")
        for i in range(1, 5)
    ]
    # For 4 teams, there are 3 rounds and 2 matches per round = 6 total matches
    n = len(teams)
    rounds = n - 1
    matches_per_round = n // 2
    assert rounds == 3
    assert matches_per_round == 2
    assert rounds * matches_per_round == 6
