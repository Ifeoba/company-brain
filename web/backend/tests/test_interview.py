from unittest.mock import MagicMock, patch


def test_get_interview_state(authed_client):
    authed_client.post("/api/brains", json={"name": "Interview Brain"})
    resp = authed_client.get("/api/brains/interview-brain/interview")
    assert resp.status_code == 200
    data = resp.json()
    assert data["current_step"] == 1
    assert data["current_question_index"] == 0
    assert len(data["steps"]) == 6


def test_save_answer(authed_client):
    authed_client.post("/api/brains", json={"name": "Answer Brain"})
    resp = authed_client.post(
        "/api/brains/answer-brain/interview/answer",
        json={"step": 1, "question_key": "service_description", "answer_text": "A billing support agent"},
    )
    assert resp.status_code == 200
    assert resp.json()["answers"]["1"]["service_description"] == "A billing support agent"


def test_update_progress(authed_client):
    authed_client.post("/api/brains", json={"name": "Progress Brain"})
    resp = authed_client.put(
        "/api/brains/progress-brain/interview",
        json={"current_step": 3, "current_question_index": 1},
    )
    assert resp.status_code == 200
    assert resp.json()["current_step"] == 3


def test_generate_no_key(authed_client):
    authed_client.post("/api/brains", json={"name": "Gen Brain"})
    resp = authed_client.post(
        "/api/brains/gen-brain/interview/generate",
        json={"step": 1, "filename": "01-service-definition.md"},
    )
    assert resp.status_code in (400, 422, 500)


def test_generate_with_mock_claude(authed_client, db_session):
    from backend.crypto import encrypt_key
    user = authed_client._user
    user.encrypted_anthropic_key = encrypt_key("sk-ant-test")
    db_session.commit()

    authed_client.post("/api/brains", json={"name": "Claude Brain"})
    authed_client.post(
        "/api/brains/claude-brain/interview/answer",
        json={"step": 1, "question_key": "service_description", "answer_text": "A test service"},
    )

    mock_response = MagicMock()
    mock_response.content = [MagicMock(text="# Generated content\n\nReal output here.")]

    with patch("backend.routes.interview.get_client") as mock_client:
        mock_client.return_value.messages.create.return_value = mock_response
        resp = authed_client.post(
            "/api/brains/claude-brain/interview/generate",
            json={"step": 1, "filename": "01-service-definition.md"},
        )

    assert resp.status_code == 200
    assert "Generated content" in resp.json()["content"]
