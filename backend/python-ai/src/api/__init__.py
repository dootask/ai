from base64 import b64decode, b64encode
from typing import Annotated

from core import settings
from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer


async def verify_bearer(
    http_auth: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(
            HTTPBearer(
                description="Please provide AUTH_SECRET api key.", auto_error=False
            )
        ),
    ],
) -> None:
    if not settings.AUTH_SECRET:
        return
    auth_secret = settings.AUTH_SECRET.get_secret_value()
    if not http_auth or http_auth.credentials != auth_secret:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

def is_from_swagger(referer: str) -> bool:
    return "/docs" in referer or "/swagger" in referer

def encrypt(plain_text):
    nonce = get_random_bytes(12)  # GCM 推荐12字节随机 nonce
    cipher = AES.new(settings.API_KEY.encode('utf-8'), AES.MODE_GCM, nonce=nonce)
    ciphertext, tag = cipher.encrypt_and_digest(plain_text.encode())
    return b64encode(nonce + ciphertext + tag).decode()