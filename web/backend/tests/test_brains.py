def test_list_brains_empty(authed_client):
    resp = authed_client.get("/api/brains")
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_brain(authed_client):
    resp = authed_client.post("/api/brains", json={"name": "Billing Support"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["slug"] == "billing-support"
    assert data["name"] == "Billing Support"
    assert data["readiness_score"] == 0


def test_create_brain_custom_slug(authed_client):
    resp = authed_client.post("/api/brains", json={"name": "My Brain", "slug": "custom-slug"})
    assert resp.status_code == 200
    assert resp.json()["slug"] == "custom-slug"


def test_create_brain_duplicate(authed_client):
    authed_client.post("/api/brains", json={"name": "Billing Support"})
    resp = authed_client.post("/api/brains", json={"name": "Billing Support"})
    assert resp.status_code == 409


def test_get_brain(authed_client):
    authed_client.post("/api/brains", json={"name": "Test Brain"})
    resp = authed_client.get("/api/brains/test-brain")
    assert resp.status_code == 200
    assert resp.json()["slug"] == "test-brain"


def test_get_brain_not_found(authed_client):
    resp = authed_client.get("/api/brains/nonexistent")
    assert resp.status_code == 404


def test_delete_brain(authed_client):
    authed_client.post("/api/brains", json={"name": "Delete Me"})
    resp = authed_client.delete("/api/brains/delete-me")
    assert resp.status_code == 200
    resp2 = authed_client.get("/api/brains/delete-me")
    assert resp2.status_code == 404


def test_update_file(authed_client):
    authed_client.post("/api/brains", json={"name": "File Brain"})
    resp = authed_client.put(
        "/api/brains/file-brain/files/01-service-definition.md",
        json={"content": "# Service Definition\n\nThis is the content."},
    )
    assert resp.status_code == 200
    assert "Service Definition" in resp.json()["content"]


def test_readiness_score_empty(authed_client):
    authed_client.post("/api/brains", json={"name": "Score Brain"})
    resp = authed_client.get("/api/brains/score-brain/readiness")
    assert resp.status_code == 200
    assert resp.json()["score"] == 0


def test_readiness_score_with_files(authed_client):
    authed_client.post("/api/brains", json={"name": "Score Brain 2"})
    authed_client.put(
        "/api/brains/score-brain-2/files/01-service-definition.md",
        json={"content": "# Filled content\n\nNo placeholders."},
    )
    resp = authed_client.get("/api/brains/score-brain-2/readiness")
    assert resp.json()["score"] >= 10
