import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Secure "Game File" Credential Storage
 * 
 * This module stores sensitive credentials in a file disguised as a game save file
 * to avoid detection by password stealers. The data is encrypted using AES-256-GCM.
 */

interface GameSaveData {
  version: string;
  gameTitle: string;
  playerLevel: number;
  playerXP: number;
  achievements: string[];
  settings: {
    volume: number;
    graphics: string;
    language: string;
  };
  // Encrypted payload containing actual credentials
  encryptedPayload: string;
  iv: string;
  authTag: string;
}

interface CredentialData {
  sessionToken?: string;
  userId?: string;
  email?: string;
  expiresAt?: string;
  publicKeyX25519?: string;
  publicKeyKyber?: string;
}

class SecureGameStorage {
  private gameFilePath: string;
  private encryptionKey: Buffer;
  private static readonly GAME_FILE_NAME = 'nexus_gotham_save.dat';
  private static readonly GAME_TITLE = 'NEXORA GOTHAM - Secure Protocol';
  private static readonly SALT = 'nexus-gotham-secure-storage-v1';

  constructor(appDataPath?: string) {
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

  private deriveEncryptionKey(): Buffer {
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

  private encrypt(data: CredentialData): { encrypted: string; iv: string; authTag: string } {
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

  private decrypt(encrypted: string, iv: string, authTag: string): CredentialData {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      Buffer.from(iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }

  private createGameSaveData(credentials: CredentialData): GameSaveData {
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

  private extractCredentials(gameData: GameSaveData): CredentialData {
    return this.decrypt(gameData.encryptedPayload, gameData.iv, gameData.authTag);
  }

  saveCredentials(credentials: CredentialData): void {
    try {
      const gameSaveData = this.createGameSaveData(credentials);
      const content = JSON.stringify(gameSaveData, null, 2);
      fs.writeFileSync(this.gameFilePath, content, 'utf8');
    } catch (error) {
      console.error('Failed to save credentials to game file:', error);
      throw new Error('Failed to save credentials');
    }
  }

  loadCredentials(): CredentialData | null {
    try {
      if (!fs.existsSync(this.gameFilePath)) {
        return null;
      }

      const content = fs.readFileSync(this.gameFilePath, 'utf8');
      const gameData: GameSaveData = JSON.parse(content);

      // Verify this is our game file
      if (gameData.gameTitle !== SecureGameStorage.GAME_TITLE) {
        return null;
      }

      return this.extractCredentials(gameData);
    } catch (error) {
      console.error('Failed to load credentials from game file:', error);
      return null;
    }
  }

  deleteCredentials(): void {
    try {
      if (fs.existsSync(this.gameFilePath)) {
        fs.unlinkSync(this.gameFilePath);
      }
    } catch (error) {
      console.error('Failed to delete game file:', error);
    }
  }

  clearExpiredCredentials(): void {
    const credentials = this.loadCredentials();
    if (credentials && credentials.expiresAt) {
      const expiresAt = new Date(credentials.expiresAt);
      if (new Date() > expiresAt) {
        this.deleteCredentials();
      }
    }
  }

  getFilePath(): string {
    return this.gameFilePath;
  }
}

// Export singleton instance
export const secureStorage = new SecureGameStorage();
export { SecureGameStorage, CredentialData };
