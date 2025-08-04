from base64 import b64decode

from core.settings import settings
from Crypto.Cipher import AES


def decrypt(encoded):
    raw = b64decode(encoded)
    nonce = raw[:12]
    ciphertext = raw[12:]
    cipher = AES.new(settings.API_KEY.encode('utf-8'), AES.MODE_GCM, nonce=nonce)
    decrypted = cipher.decrypt_and_verify(ciphertext[:-16], ciphertext[-16:])
    return decrypted.decode()