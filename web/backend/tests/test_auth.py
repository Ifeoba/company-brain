def test_me_unauthenticated(client):
    resp = client.get("/api/me")
    assert resp.status_code == 401


def test_me_authenticated(authed_client):
    resp = authed_client.get("/api/me")
    assert resp.status_code == 200
    data = resp.json()
    assert data["github_username"] == "testuser"
    assert data["has_anthropic_key"] is False


def test_csrf_token(client):
    resp = client.get("/api/csrf-token")
    assert resp.status_code == 200
    assert "csrf_token" in resp.json()


def test_logout(authed_client):
    resp = authed_client.post("/api/auth/logout")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
