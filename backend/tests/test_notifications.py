from fastapi.testclient import TestClient

from app.application.dtos.notification import (
    BulletinGenerateRequest,
)
from app.main import app

client = TestClient(app)

def test_bulletin_dto_validation():
    req = BulletinGenerateRequest(
        format_type="guion_radio",
        round_number=3,
        radio_station="Radio Apolo 98.5 FM",
    )
    assert req.format_type == "guion_radio"
    assert req.round_number == 3
    assert req.radio_station == "Radio Apolo 98.5 FM"

def test_get_recent_notifications_endpoint():
    response = client.get("/api/v1/notifications/recent")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 3
    # Check that categories exist
    categories = [item["category"] for item in data]
    assert "sancion" in categories or "boletin" in categories

def test_filter_notifications_by_category():
    response = client.get("/api/v1/notifications/recent?category=sancion")
    assert response.status_code == 200
    data = response.json()
    for item in data:
        assert item["category"] == "sancion"

def test_generate_radio_script_bulletin():
    payload = {
        "format_type": "guion_radio",
        "round_number": 3,
        "radio_station": "Radio Apolo 98.5 FM",
        "include_sponsors": True
    }
    response = client.post("/api/v1/notifications/bulletin/generate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["format_type"] == "guion_radio"
    assert "Radio Apolo 98.5 FM" in data["title"]
    assert "[CORTINILLA ENTRADA" in data["content"]
    assert "[LOCUTOR 1]" in data["content"]
    assert data["word_count"] > 50
    assert data["estimated_duration_seconds"] is not None

def test_generate_written_press_release():
    payload = {
        "format_type": "prensa_escrita",
        "round_number": 3,
    }
    response = client.post("/api/v1/notifications/bulletin/generate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["format_type"] == "prensa_escrita"
    assert "BOLETÍN DE PRENSA OFICIAL" in data["content"]
    assert "FRANZ TAMAYO" in data["content"]

def test_generate_captains_whatsapp_digest():
    payload = {
        "format_type": "capitanes",
        "round_number": 3,
    }
    response = client.post("/api/v1/notifications/bulletin/generate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["format_type"] == "capitanes"
    assert "LIGA PROVINCIAL DE FÚTBOL APOLO" in data["content"]
    assert "Resultados Oficiales" in data["content"]

def test_generate_delegates_circular():
    payload = {
        "format_type": "circular_delegados",
        "round_number": 3,
    }
    response = client.post("/api/v1/notifications/bulletin/generate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["format_type"] == "circular_delegados"
    assert "CIRCULAR OFICIAL" in data["content"]
    assert "REUNIÓN TÉCNICA ORDINARIA" in data["content"]

def test_broadcast_notification():
    payload = {
        "title": "Aviso Urgente: Cambio de Horario",
        "message": "Por condiciones climáticas en Apolo, los partidos inician a las 14:30.",
        "category": "comunicado",
        "priority": "alta",
        "channel": "all",
        "recipient_phones": ["+59171234567"]
    }
    response = client.post("/api/v1/notifications/broadcast", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["channel"] == "all"
    assert data["recipients_count"] == 1
    assert "notif-" in data["id"]

def test_mark_notification_read():
    # First get list
    res = client.get("/api/v1/notifications/recent")
    notif_id = res.json()[0]["id"]
    read_res = client.post(f"/api/v1/notifications/{notif_id}/read")
    assert read_res.status_code == 200
    assert read_res.json()["is_read"] is True
