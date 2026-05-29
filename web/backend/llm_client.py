from __future__ import annotations
from typing import TYPE_CHECKING, Any

import anthropic
from openai import OpenAI

from .crypto import decrypt_key

if TYPE_CHECKING:
    from .models import User

PROVIDERS: dict[str, dict[str, Any]] = {
    "anthropic": {
        "name": "Claude (Anthropic)",
        "default_model": "claude-haiku-4-5-20251001",
        "key_hint": "sk-ant-...",
        "key_url": "https://console.anthropic.com/",
    },
    "openai": {
        "name": "ChatGPT (OpenAI)",
        "default_model": "gpt-4o-mini",
        "key_hint": "sk-...",
        "key_url": "https://platform.openai.com/api-keys",
    },
    "gemini": {
        "name": "Gemini (Google)",
        "default_model": "gemini-2.0-flash",
        "key_hint": "AIza...",
        "key_url": "https://aistudio.google.com/app/apikey",
    },
    "groq": {
        "name": "Groq",
        "default_model": "llama-3.3-70b-versatile",
        "key_hint": "gsk_...",
        "key_url": "https://console.groq.com/keys",
    },
}

_OPENAI_BASE_URLS: dict[str, str] = {
    "gemini": "https://generativelanguage.googleapis.com/v1beta/openai/",
    "groq": "https://api.groq.com/openai/v1",
}


def call_llm(user: "User", system: str, messages: list[dict], max_tokens: int = 2048) -> str:
    """Call the user's configured LLM provider and return the response text."""
    if not user.encrypted_anthropic_key:
        raise ValueError("No API key configured. Add one in Settings.")

    api_key = decrypt_key(user.encrypted_anthropic_key)
    provider = user.llm_provider or "anthropic"
    model = PROVIDERS.get(provider, PROVIDERS["anthropic"])["default_model"]

    if provider == "anthropic":
        client = anthropic.Anthropic(api_key=api_key)
        resp = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system,
            messages=messages,
        )
        return resp.content[0].text

    # OpenAI-compatible providers (openai, gemini, groq)
    kwargs: dict[str, Any] = {"api_key": api_key}
    if provider in _OPENAI_BASE_URLS:
        kwargs["base_url"] = _OPENAI_BASE_URLS[provider]
    client = OpenAI(**kwargs)
    oai_messages = [{"role": "system", "content": system}] + messages
    resp = client.chat.completions.create(
        model=model,
        max_tokens=max_tokens,
        messages=oai_messages,  # type: ignore[arg-type]
    )
    return resp.choices[0].message.content or ""
