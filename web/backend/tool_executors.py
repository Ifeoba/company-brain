"""
Built-in tool executors for the tools framework.

Each public function takes (db, tool_call, tool_model, workspace_id) and
returns a result dict, or raises on failure. The Celery task calls these
inside session_scope so the vault reads are properly audited.
"""
from __future__ import annotations

import json
from typing import Any

import httpx


# ── Schema registry ───────────────────────────────────────────────────────────
# Maps tool name → Anthropic tool definition. Used when building LLM prompts.

TOOL_SCHEMAS: dict[str, dict] = {
    "send_slack_message": {
        "description": "Post a message to a Slack channel. Use for alerts and notifications.",
        "input_schema": {
            "type": "object",
            "properties": {
                "channel": {
                    "type": "string",
                    "description": "Channel name (e.g. #alerts) or Slack channel ID",
                },
                "text": {
                    "type": "string",
                    "description": "Message content (Slack mrkdwn supported)",
                },
            },
            "required": ["channel", "text"],
        },
    },
    "send_email": {
        "description": "Send an email notification via Resend.",
        "input_schema": {
            "type": "object",
            "properties": {
                "to": {"type": "string", "description": "Recipient email address"},
                "subject": {"type": "string", "description": "Email subject line"},
                "body": {"type": "string", "description": "Email body (plain text)"},
            },
            "required": ["to", "subject", "body"],
        },
    },
    "http_get": {
        "description": "Make an HTTP GET request to an external URL and return the response.",
        "input_schema": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "Full URL to fetch"},
                "params": {
                    "type": "object",
                    "description": "Optional query string parameters",
                },
            },
            "required": ["url"],
        },
    },
}

# ── Built-in catalog ──────────────────────────────────────────────────────────
# Shown in the UI when users browse tools to add to a brain.

BUILTIN_CATALOG = [
    {
        "name": "send_slack_message",
        "description": "Send a Slack message to any channel. Save your Slack bot token or webhook URL as SLACK_BOT_TOKEN under Credentials first.",
        "category": "messaging",
        "risk": "confirm",
        "config_template": {
            "vault_key": "SLACK_BOT_TOKEN",
            "default_channel": "#general",
        },
    },
    {
        "name": "send_email",
        "description": "Send an email to anyone. Works out of the box if you've connected Resend.",
        "category": "email",
        "risk": "confirm",
        "config_template": {
            "from_name": "Company Brain",
            "from_email": "",
        },
    },
    {
        "name": "http_get",
        "description": "Fetch data from any URL — useful for looking things up before making a decision.",
        "category": "http",
        "risk": "safe",
        "config_template": {
            "base_url": "",
            "vault_key": "",
        },
    },
]


# ── Dispatch ──────────────────────────────────────────────────────────────────

def execute_tool(db, tool_call, tool_model, workspace_id: str) -> dict[str, Any]:
    """Dispatch a ToolCall to the right executor. Called from inside a Celery task."""
    config = json.loads(tool_model.config or "{}")
    args = json.loads(tool_call.arguments or "{}")

    if tool_model.name == "send_slack_message":
        return _send_slack_message(db, workspace_id, config, args)
    if tool_model.name == "send_email":
        return _send_email(db, workspace_id, config, args)
    if tool_model.name == "http_get":
        return _http_get(db, workspace_id, config, args)
    raise ValueError("Unknown built-in tool: {}".format(tool_model.name))


# ── Executors ─────────────────────────────────────────────────────────────────

def _send_slack_message(db, workspace_id: str, config: dict, args: dict) -> dict:
    from . import vault as vault_module

    channel = args.get("channel") or config.get("default_channel", "#general")
    text = args["text"]
    vault_key = config.get("vault_key", "SLACK_BOT_TOKEN")

    credential = vault_module.get_plaintext(db, workspace_id, vault_key)
    if not credential:
        raise ValueError(
            "Slack credential not found in Vault. Add secret '{}' via the Vault manager.".format(vault_key)
        )

    if credential.startswith("https://hooks.slack.com/"):
        # Incoming webhook — channel comes from the webhook config, but we pass it anyway
        resp = httpx.post(
            credential,
            json={"text": text, "channel": channel},
            timeout=10,
        )
        resp.raise_for_status()
        return {"ok": True, "method": "webhook", "channel": channel}

    # Bot token (xoxb-…)
    resp = httpx.post(
        "https://slack.com/api/chat.postMessage",
        headers={"Authorization": "Bearer {}".format(credential)},
        json={"channel": channel, "text": text},
        timeout=10,
    )
    data = resp.json()
    if not data.get("ok"):
        raise ValueError("Slack API error: {}".format(data.get("error", "unknown")))
    return {"ok": True, "ts": data.get("ts"), "channel": data.get("channel")}


def _send_email(db, workspace_id: str, config: dict, args: dict) -> dict:
    from .config import settings

    to = args["to"]
    subject = args["subject"]
    body = args["body"]
    from_name = config.get("from_name", "Company Brain")
    from_email = config.get("from_email") or settings.resend_from_email

    if not settings.resend_api_key:
        raise ValueError("RESEND_API_KEY is not configured in environment settings.")

    import resend
    resend.api_key = settings.resend_api_key
    result = resend.Emails.send({
        "from": "{} <{}>".format(from_name, from_email),
        "to": [to],
        "subject": subject,
        "text": body,
    })
    return {"id": result.get("id"), "to": to, "subject": subject}


def _http_get(db, workspace_id: str, config: dict, args: dict) -> dict:
    from . import vault as vault_module

    base_url = config.get("base_url", "").rstrip("/")
    vault_key = config.get("vault_key", "")
    url = args["url"]
    params = args.get("params", {})

    if base_url and not url.startswith("http"):
        url = base_url + "/" + url.lstrip("/")

    headers: dict[str, str] = {}
    if vault_key:
        token = vault_module.get_plaintext(db, workspace_id, vault_key)
        if token:
            headers["Authorization"] = "Bearer {}".format(token)

    resp = httpx.get(url, params=params, headers=headers, timeout=15)
    resp.raise_for_status()

    try:
        return {"status": resp.status_code, "data": resp.json()}
    except Exception:
        return {"status": resp.status_code, "text": resp.text[:4000]}
