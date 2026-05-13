"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecureGameStorage = exports.secureStorage = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
class SecureGameStorage {
    constructor(appDataPath) {
        // Use AppData/Local or similar directory for game saves
        const baseDir = appDataPath ||
            (process.env.APPDATA ||
                (process.platform === 'darwin' ? path.join(process.env.HOME || '', 'Library', 'Application Support') :
                    path.join(process.env.HOME || '', '.local', 'share')));
        const gameDir = path.join(baseDir, 'NexoraGotham', 'Saves');
        // Ensure directory exists
        if (!fs.existsSync(gameDir)) {
            fs.mkdirSync(gameDir, { recursive: true });
        }
        this.gameFilePath = path.join(gameDir, SecureGameStorage.GAME_FILE_NAME);
        // Derive encryption key from machine-specific data
        this.encryptionKey = this.deriveEncryptionKey();
    }
    deriveEncryptionKey() {
        // Use machine-specific identifiers to derive a unique key
        const machineId = [
            process.platform,
            process.arch,
            process.env.USERNAME || process.env.USER || 'unknown',
            process.env.COMPUTERNAME || 'unknown',
            SecureGameStorage.SALT
        ].join('|');
        return crypto.pbkdf2Sync(machineId, SecureGameStorage.SALT, 100000, 32, 'sha256');
    }
    encrypt(data) {
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
        const plaintext = JSON.stringify(data);
        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();
        return {
            encrypted,
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex')
        };
    }
    decrypt(encrypted, iv, authTag) {
        const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, Buffer.from(iv, 'hex'));
        decipher.setAuthTag(Buffer.from(authTag, 'hex'));
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return JSON.parse(decrypted);
    }
    createGameSaveData(credentials) {
        const { encrypted, iv, authTag } = this.encrypt(credentials);
        // Create realistic-looking game save data
        return {
            version: '2.4.1',
            gameTitle: SecureGameStorage.GAME_TITLE,
            playerLevel: Math.floor(Math.random() * 50) + 1,
            playerXP: Math.floor(Math.random() * 1000000),
            achievements: [
                'First Steps',
                'Network Pioneer',
                'Secure Protocol',
                'Data Guardian',
                'Cipher Master'
            ].slice(0, Math.floor(Math.random() * 5) + 1),
            settings: {
                volume: Math.floor(Math.random() * 100),
                graphics: ['Low', 'Medium', 'High', 'Ultra'][Math.floor(Math.random() * 4)],
                language: 'en-US'
            },
            encryptedPayload: encrypted,
            iv,
            authTag
        };
    }
    extractCredentials(gameData) {
        return this.decrypt(gameData.encryptedPayload, gameData.iv, gameData.authTag);
    }
    saveCredentials(credentials) {
        try {
            const gameSaveData = this.createGameSaveData(credentials);
            const content = JSON.stringify(gameSaveData, null, 2);
            fs.writeFileSync(this.gameFilePath, content, 'utf8');
        }
        catch (error) {
            console.error('Failed to save credentials to game file:', error);
            throw new Error('Failed to save credentials');
        }
    }
    loadCredentials() {
        try {
            if (!fs.existsSync(this.gameFilePath)) {
                return null;
            }
            const content = fs.readFileSync(this.gameFilePath, 'utf8');
            const gameData = JSON.parse(content);
            // Verify this is our game file
            if (gameData.gameTitle !== SecureGameStorage.GAME_TITLE) {
                return null;
            }
            return this.extractCredentials(gameData);
        }
        catch (error) {
            console.error('Failed to load credentials from game file:', error);
            return null;
        }
    }
    deleteCredentials() {
        try {
            if (fs.existsSync(this.gameFilePath)) {
                fs.unlinkSync(this.gameFilePath);
            }
        }
        catch (error) {
            console.error('Failed to delete game file:', error);
        }
    }
    clearExpiredCredentials() {
        const credentials = this.loadCredentials();
        if (credentials && credentials.expiresAt) {
            const expiresAt = new Date(credentials.expiresAt);
            if (new Date() > expiresAt) {
                this.deleteCredentials();
            }
        }
    }
    getFilePath() {
        return this.gameFilePath;
    }
}
exports.SecureGameStorage = SecureGameStorage;
SecureGameStorage.GAME_FILE_NAME = 'nexus_gotham_save.dat';
SecureGameStorage.GAME_TITLE = 'NEXORA GOTHAM - Secure Protocol';
SecureGameStorage.SALT = 'nexus-gotham-secure-storage-v1';
// Export singleton instance
exports.secureStorage = new SecureGameStorage();
