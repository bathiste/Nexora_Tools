import os
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305

# Kyber768 (pqcrypto)
from pqcrypto.kem.kyber768 import generate_keypair, encrypt as kyber_encaps

# --- receiver's public key (example generation) ---
kyber_pk, kyber_sk = generate_keypair()

# --- sender side ---
# KEM
kyber_ct, ss = kyber_encaps(kyber_pk)   # ss = shared secret (bytes)

# HKDF (derive AEAD key)
salt = os.urandom(16)
hkdf = HKDF(
    algorithm=hashes.SHA256(),
    length=32,                 # 256-bit key
    salt=salt,
    info=b"kyber768-chacha20poly1305-v1"
)
key = hkdf.derive(ss)

# AEAD encrypt
aead = ChaCha20Poly1305(key)
nonce = os.urandom(12)
aad = b"header"               # optional, must match on decrypt
plaintext = b"secret data"

ciphertext = aead.encrypt(nonce, plaintext, aad)

# send: ciphertext, nonce, kyber_ct, salt, aad
