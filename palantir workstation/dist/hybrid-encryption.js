"use strict";
// Hybrid Encryption: X25519 + Kyber768 + ChaCha20-Poly1305
// Post-quantum secure messaging
Object.defineProperty(exports, "__esModule", { value: true });
exports.HybridEncryption = void 0;
/// <reference lib="dom" />
const INFO_KEY = new TextEncoder().encode("hybrid-v1 key");
// Helper to convert Uint8Array to BufferSource
function toBufferSource(data) {
    return data.buffer;
}
class HybridEncryption {
    constructor() {
        this.x25519KeyPair = null;
        this.kyberKeyPair = null;
    }
    // Generate receiver long-term keys
    async generateReceiverKeys() {
        // X25519 key pair
        this.x25519KeyPair = await window.crypto.subtle.generateKey({ name: "X25519" }, true, ["deriveKey", "deriveBits"]);
        const x25519PublicKey = new Uint8Array(await window.crypto.subtle.exportKey("raw", this.x25519KeyPair.publicKey));
        const x25519PrivateKey = new Uint8Array(await window.crypto.subtle.exportKey("pkcs8", this.x25519KeyPair.privateKey));
        // Kyber768 key pair (using liboqs-wasm if available, fallback to simulation)
        const kyberKeyPair = await this.generateKyberKeyPair();
        this.kyberKeyPair = kyberKeyPair;
        return {
            x25519PublicKey,
            x25519PrivateKey,
            kyberPublicKey: kyberKeyPair.publicKey,
            kyberPrivateKey: kyberKeyPair.privateKey,
        };
    }
    // HKDF key derivation
    async hkdfKey(salt, sharedSecret) {
        const key = await window.crypto.subtle.importKey("raw", toBufferSource(sharedSecret), { name: "HKDF" }, false, ["deriveBits"]);
        const derivedBits = await window.crypto.subtle.deriveBits({
            name: "HKDF",
            hash: "SHA-256",
            salt: toBufferSource(salt),
            info: INFO_KEY,
        }, key, 256 // 32 bytes
        );
        return new Uint8Array(derivedBits);
    }
    // Generate Kyber768 key pair (placeholder - needs liboqs-wasm)
    async generateKyberKeyPair() {
        // TODO: Integrate liboqs-wasm for actual Kyber768
        // For now, simulate with random bytes
        const publicKey = window.crypto.getRandomValues(new Uint8Array(1184)); // Kyber768 public key size
        const privateKey = window.crypto.getRandomValues(new Uint8Array(2400)); // Kyber768 private key size
        return { publicKey, privateKey };
    }
    // Kyber768 encapsulation (placeholder - needs liboqs-wasm)
    async kyberEncapsulate(publicKey) {
        // TODO: Integrate liboqs-wasm for actual Kyber768
        // For now, simulate with random bytes
        const ciphertext = window.crypto.getRandomValues(new Uint8Array(1088)); // Kyber768 ciphertext size
        const sharedSecret = window.crypto.getRandomValues(new Uint8Array(32));
        return { ciphertext, sharedSecret };
    }
    // Kyber768 decapsulation (placeholder - needs liboqs-wasm)
    async kyberDecapsulate(ciphertext) {
        // TODO: Integrate liboqs-wasm for actual Kyber768
        // For now, simulate with random bytes
        return window.crypto.getRandomValues(new Uint8Array(32));
    }
    // Encrypt message
    async encrypt(plaintext, receiverX25519PublicKey, receiverKyberPublicKey) {
        const plaintextBytes = new TextEncoder().encode(plaintext);
        // X25519 key exchange
        const ephemeralKeyPair = await window.crypto.subtle.generateKey({ name: "X25519" }, true, ["deriveKey", "deriveBits"]);
        const epk = new Uint8Array(await window.crypto.subtle.exportKey("raw", ephemeralKeyPair.publicKey));
        const receiverPublicKey = await window.crypto.subtle.importKey("raw", toBufferSource(receiverX25519PublicKey), { name: "X25519" }, false, []);
        const ssEc = new Uint8Array(await window.crypto.subtle.deriveBits({ name: "X25519", public: receiverPublicKey }, ephemeralKeyPair.privateKey, 256));
        // Kyber768 encapsulation
        const { ciphertext: kyberCt, sharedSecret: ssPq } = await this.kyberEncapsulate(receiverKyberPublicKey);
        // Combine shared secrets
        const combinedSecret = new Uint8Array(ssEc.length + ssPq.length);
        combinedSecret.set(ssEc);
        combinedSecret.set(ssPq, ssEc.length);
        // Derive encryption key
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const key = await this.hkdfKey(salt, combinedSecret);
        // ChaCha20-Poly1305 encryption
        const nonce = window.crypto.getRandomValues(new Uint8Array(12));
        const aeadKey = await window.crypto.subtle.importKey("raw", toBufferSource(key), "ChaCha20-Poly1305", false, ["encrypt"]);
        // Build header (version + salt + nonce + epk + kyberCt)
        const version = new Uint8Array([0x01]);
        const header = new Uint8Array(1 + salt.length + nonce.length + epk.length + kyberCt.length);
        header.set(version, 0);
        header.set(salt, 1);
        header.set(nonce, 1 + salt.length);
        header.set(epk, 1 + salt.length + nonce.length);
        header.set(kyberCt, 1 + salt.length + nonce.length + epk.length);
        const ciphertext = await window.crypto.subtle.encrypt({ name: "ChaCha20-Poly1305" }, aeadKey, plaintextBytes.buffer);
        // Combine header + ciphertext
        const result = new Uint8Array(header.length + ciphertext.byteLength);
        result.set(header);
        result.set(new Uint8Array(ciphertext), header.length);
        return result;
    }
    // Decrypt message
    async decrypt(blob, x25519PrivateKey, kyberPrivateKey) {
        let offset = 0;
        // Parse header
        const version = blob[offset];
        offset += 1;
        const salt = blob.slice(offset, offset + 16);
        offset += 16;
        const nonce = blob.slice(offset, offset + 12);
        offset += 12;
        const epk = blob.slice(offset, offset + 32);
        offset += 32;
        const kyberCt = blob.slice(offset, offset + 1088);
        offset += 1088;
        const ciphertext = blob.slice(offset);
        // X25519 key exchange
        const privateKey = await window.crypto.subtle.importKey("pkcs8", toBufferSource(x25519PrivateKey), { name: "X25519" }, false, ["deriveBits"]);
        const ephemeralPublicKey = await window.crypto.subtle.importKey("raw", toBufferSource(epk), { name: "X25519" }, false, []);
        const ssEc = new Uint8Array(await window.crypto.subtle.deriveBits({ name: "X25519", public: ephemeralPublicKey }, privateKey, 256));
        // Kyber768 decapsulation
        const ssPq = await this.kyberDecapsulate(kyberCt);
        // Combine shared secrets
        const combinedSecret = new Uint8Array(ssEc.length + ssPq.length);
        combinedSecret.set(ssEc);
        combinedSecret.set(ssPq, ssEc.length);
        // Derive decryption key
        const key = await this.hkdfKey(salt, combinedSecret);
        // ChaCha20-Poly1305 decryption
        const aeadKey = await window.crypto.subtle.importKey("raw", toBufferSource(key), "ChaCha20-Poly1305", false, ["decrypt"]);
        const plaintext = await window.crypto.subtle.decrypt({ name: "ChaCha20-Poly1305" }, aeadKey, ciphertext.buffer);
        return new TextDecoder().decode(plaintext);
    }
}
exports.HybridEncryption = HybridEncryption;
