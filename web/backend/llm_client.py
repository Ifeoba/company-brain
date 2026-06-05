from __future__ import annotations
from typing import TYPE_CHECKING, Any, Optional

from .crypto import decrypt_key

if TYPE_CHECKING:
    from sqlalchemy.orm import Session
    from .models import User


def _litellm():
    """Lazy-load litellm to avoid ~150MB import cost at server startup."""
    import litellm as _ll
    _ll.drop_params = True
    return _ll

PROVIDERS: dict[str, dict[str, Any]] = {
    "anthropic": {
        "name": "Claude (Anthropic)",
        "litellm_model": "anthropic/claude-haiku-4-5-20251001",
        "key_hint": "sk-ant-…",
        "key_url": "https://console.anthropic.com/",
    },
    "openai": {
        "name": "ChatGPT (OpenAI)",
        "litellm_model": "gpt-4o-mini",
        "key_hint": "sk-…",
        "key_url": "https://platform.openai.com/api-keys",
    },
    "gemini": {
        "name": "Gemini (Google)",
        "litellm_model": "gemini/gemini-2.0-flash",
        "key_hint": "AIza…",
        "key_url": "https://aistudio.google.com/app/apikey",
    },
    "groq": {
        "name": "Groq",
        "litellm_model": "groq/llama-3.3-70b-versatile",
        "key_hint": "gsk_…",
        "key_url": "https://console.groq.com/keys",
    },
}


def user_has_active_llm_credential(db: "Session", user: "User") -> bool:
    """Return True if the user has any usable LLM credential (legacy or new table)."""
    if user.encrypted_anthropic_key:
        return True
    from .models import UserLLMCredential
    return db.query(UserLLMCredential).filter_by(user_id=user.id, is_active=True).first() is not None


def _get_api_key(db: "Session", user: "User", provider: str) -> Optional[str]:
    """Return decrypted API key for the given provider, or None."""
    from .models import UserLLMCredential
    cred = db.query(UserLLMCredential).filter_by(user_id=user.id, provider=provider).first()
    if cred:
        return decrypt_key(cred.encrypted_api_key).decode()
    # Fallback to legacy field for anthropic
    if provider == "anthropic" and user.encrypted_anthropic_key:
        return decrypt_key(user.encrypted_anthropic_key).decode()
    return None


def test_credential(api_key: str, provider: str) -> dict:
    """Test an API key without persisting it. Returns {ok, content?, error?}."""
    info = PROVIDERS.get(provider)
    if not info:
        return {"ok": False, "error": "Unknown provider: {}".format(provider)}
    try:
        resp = _litellm().completion(
            model=info["litellm_model"],
            messages=[{"role": "user", "content": "Reply with just: ok"}],
            max_tokens=5,
            api_key=api_key,
        )
        return {"ok": True, "content": resp.choices[0].message.content or ""}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def call_llm(
    db: "Session",
    user: "User",
    system: str,
    messages: list[dict],
    tools: Optional[list[dict]] = None,
    max_tokens: int = 4096,
) -> dict:
    """
    Call the user's active LLM provider via LiteLLM.

    Returns:
        {
            content: str,
            tool_calls: list[dict],  # OpenAI-format tool calls
            finish_reason: str,
            usage: {prompt_tokens, completion_tokens},
            provider: str,
            model: str,
        }
    """
    provider = user.llm_provider or "anthropic"
    info = PROVIDERS.get(provider, PROVIDERS["anthropic"])
    model = info["litellm_model"]

    api_key = _get_api_key(db, user, provider)
    if not api_key:
        raise ValueError("No API key for {}. Add one in Settings.".format(info["name"]))

    full_messages: list[dict] = []
    if system:
        full_messages.append({"role": "system", "content": system})
    full_messages.extend(messages)

    kwargs: dict[str, Any] = {
        "model": model,
        "messages": full_messages,
        "max_tokens": max_tokens,
        "api_key": api_key,
    }
    if tools:
        kwargs["tools"] = tools

    resp = _litellm().completion(**kwargs)

    choice = resp.choices[0]
    msg = choice.message
    content = msg.content or ""

    raw_tool_calls = getattr(msg, "tool_calls", None) or []
    tool_calls = []
    for tc in raw_tool_calls:
        tool_calls.append({
            "id": tc.id,
            "type": "function",
            "function": {
                "name": tc.function.name,
                "arguments": tc.function.arguments,
            },
        })

    usage = resp.usage or {}
    prompt_tokens = getattr(usage, "prompt_tokens", 0) or 0
    completion_tokens = getattr(usage, "completion_tokens", 0) or 0

    return {
        "content": content,
        "tool_calls": tool_calls,
        "finish_reason": choice.finish_reason or "stop",
        "usage": {"prompt_tokens": prompt_tokens, "completion_tokens": completion_tokens},
        "provider": provider,
        "model": model,
    }
