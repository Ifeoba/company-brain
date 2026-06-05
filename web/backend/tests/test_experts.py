from unittest.mock import patch


def _create_brain_and_collab(client):
    client.post("/api/brains", json={"name": "Expert Brain"})
    resp = client.post(
        "/api/brains/expert-brain/collaborators",
        json={"name": "Olamide Adeyemi", "email": "olamide@example.com"},
    )
    return resp.json()["id"]


def test_add_collaborator(authed_client):
    authed_client.post("/api/brains", json={"name": "Collab Brain"})
    resp = authed_client.post(
        "/api/brains/collab-brain/collaborators",
        json={"name": "Olamide Adeyemi", "email": "olamide@example.com"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Olamide Adeyemi"
    assert data["initials"] == "OA"


def test_list_collaborators(authed_client):
    authed_client.post("/api/brains", json={"name": "List Collab Brain"})
    authed_client.post(
        "/api/brains/list-collab-brain/collaborators",
        json={"name": "Test User", "email": "test@example.com"},
    )
    resp = authed_client.get("/api/brains/list-collab-brain/collaborators")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_ask_expert_sends_email(authed_client):
    collab_id = _create_brain_and_collab(authed_client)

    with patch("backend.routes.experts.send_expert_question_email") as mock_send:
        resp = authed_client.post(
            "/api/brains/expert-brain/ask-expert",
            json={
                "collaborator_id": collab_id,
                "step": 2,
                "question_key": "workflow",
                "question_text": "Walk me through how billing support actually works?",
                "context_text": "Hi Olamide — I'm building an AI tool.",
            },
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "pending"
    assert data["token"]


def test_public_get_expert_question(authed_client, client):
    collab_id = _create_brain_and_collab(authed_client)

    with patch("backend.routes.experts.send_expert_question_email"):
        ask_resp = authed_client.post(
            "/api/brains/expert-brain/ask-expert",
            json={
                "collaborator_id": collab_id,
                "step": 2,
                "question_key": "workflow",
                "question_text": "How does it work?",
            },
        )
    token = ask_resp.json()["token"]

    resp = client.get(f"/api/expert/{token}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["question_text"] == "How does it work?"
    assert data["already_answered"] is False


def test_public_submit_answer(authed_client, client):
    collab_id = _create_brain_and_collab(authed_client)

    with patch("backend.routes.experts.send_expert_question_email"):
        ask_resp = authed_client.post(
            "/api/brains/expert-brain/ask-expert",
            json={
                "collaborator_id": collab_id,
                "step": 2,
                "question_key": "workflow",
                "question_text": "How does billing work?",
            },
        )
    token = ask_resp.json()["token"]

    resp = client.post(f"/api/expert/{token}/answer", json={"answer_text": "It works like this: ..."})
    assert resp.status_code == 200

    resp2 = client.get(f"/api/expert/{token}")
    assert resp2.json()["already_answered"] is True
    assert "It works like this" in resp2.json()["existing_answer"]


def test_expert_questions_list(authed_client):
    collab_id = _create_brain_and_collab(authed_client)

    with patch("backend.routes.experts.send_expert_question_email"):
        authed_client.post(
            "/api/brains/expert-brain/ask-expert",
            json={
                "collaborator_id": collab_id,
                "step": 2,
                "question_key": "workflow",
                "question_text": "How?",
            },
        )

    resp = authed_client.get("/api/brains/expert-brain/expert-questions")
    assert resp.status_code == 200
    assert len(resp.json()) == 1
