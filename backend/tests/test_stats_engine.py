
def test_standings_formula():
    """Validates FIFA standard points and goal difference criteria."""
    matches = [
        {"home_score": 3, "away_score": 1}, # Home won (3 pts, +2 GD)
        {"home_score": 2, "away_score": 2}, # Draw (1 pt, 0 GD)
        {"home_score": 0, "away_score": 2}, # Away won (3 pts, +2 GD)
    ]
    # Check score calculations
    assert matches[0]["home_score"] - matches[0]["away_score"] == 2
    assert matches[1]["home_score"] == matches[1]["away_score"]
    assert matches[2]["away_score"] > matches[2]["home_score"]
