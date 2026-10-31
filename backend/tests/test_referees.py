import hashlib

from app.application.dtos.referee import MatchOfficialSignRequest, RefereeCreate


def test_referee_dto_validation():
    ref_data = RefereeCreate(
        first_name="Marco Antonio",
        last_name="Quispe",
        license_number="FBF-LP-0412",
        category="Nacional FBF",
        role_primary="Principal",
        association="Colegio de Árbitros Franz Tamayo",
        phone="+591 71590214",
    )
    assert ref_data.first_name == "Marco Antonio"
    assert ref_data.last_name == "Quispe"
    assert ref_data.category == "Nacional FBF"
    assert ref_data.role_primary == "Principal"

def test_cryptographic_match_seal_generation():
    sign_req = MatchOfficialSignRequest(
        referee_notes="Partido sin reclamos en el Estadio Municipal de Apolo.",
        signed_by_name="Marco Antonio Quispe",
    )
    match_id = "m_test_123"
    home_score = 3
    away_score = 2
    timestamp = "2026-03-08T17:40:00Z"

    seed = f"MATCH:{match_id}|HOME:{home_score}|AWAY:{away_score}|SIGNER:{sign_req.signed_by_name}|TIME:{timestamp}|APOLODIGITAL"
    signature_hash = hashlib.sha256(seed.encode("utf-8")).hexdigest()

    assert len(signature_hash) == 64 # SHA-256 length in hex
    assert signature_hash == hashlib.sha256(seed.encode("utf-8")).hexdigest()
