import winston from 'winston';
import { LogEntry } from './types';
import * as fs from 'fs';
import * as path from 'path';

export class AuditLogger {
  private logger: winston.Logger;
  private attackId: string;
  private logDir: string;

  constructor(attackId: string, logDir: string = './logs') {
    this.attackId = attackId;
    this.logDir = logDir;
    
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({
          filename: path.join(logDir, `attack-${attackId}.log`),
        }),
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });
  }

  log(entry: LogEntry): void {
    this.logger.log({
      level: entry.level,
      message: entry.message,
      timestamp: entry.timestamp,
      proxy: entry.proxy,
      userAgent: entry.userAgent,
      responseCode: entry.responseCode,
      error: entry.error
    });
  }

  logAuthorization(clientId: string, target: string, authorizedBy: string): void {
    this.logger.info('AUTHORIZATION_RECORD', {
      clientId,
      target,
      authorizedBy,
      timestamp: new Date().toISOString()
    });
  }

  logAttackStart(config: any): void {
    this.logger.info('ATTACK_START', {
      attackId: this.attackId,
      config,
      timestamp: new Date().toISOString()
    });
  }

  logAttackEnd(stats: any): void {
    this.logger.info('ATTACK_END', {
      attackId: this.attackId,
      stats,
      timestamp: new Date().toISOString()
    });
  }

  logRequest(proxy: string, userAgent: string, statusCode: number | null, error?: string): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level: error ? 'error' : 'info',
      message: error ? 'Request failed' : 'Request completed',
      proxy,
      userAgent,
      responseCode: statusCode || undefined,
      error
    };
    this.log(entry);
  }
}
