import anthropic
from .config import settings
from .crypto import decrypt_key


def get_client(encrypted_key: bytes | None) -> anthropic.Anthropic:
    if not encrypted_key:
        raise ValueError("No Anthropic API key configured. Add one in Settings.")
    api_key = decrypt_key(encrypted_key)
    return anthropic.Anthropic(api_key=api_key)
