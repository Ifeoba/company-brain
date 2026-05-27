from cryptography.fernet import Fernet
from .config import settings


def _fernet() -> Fernet:
    key = settings.fernet_key
    if not key:
        raise ValueError("FERNET_KEY is not set. Run: python3 -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\"")
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_key(plaintext: str) -> bytes:
    return _fernet().encrypt(plaintext.encode())


def decrypt_key(ciphertext: bytes) -> str:
    return _fernet().decrypt(ciphertext).decode()
