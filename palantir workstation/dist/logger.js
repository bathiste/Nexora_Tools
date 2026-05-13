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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogger = void 0;
const winston_1 = __importDefault(require("winston"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class AuditLogger {
    constructor(attackId, logDir = './logs') {
        this.attackId = attackId;
        this.logDir = logDir;
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        this.logger = winston_1.default.createLogger({
            level: 'info',
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
            transports: [
                new winston_1.default.transports.File({
                    filename: path.join(logDir, `attack-${attackId}.log`),
                }),
                new winston_1.default.transports.Console({
                    format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple())
                })
            ]
        });
    }
    log(entry) {
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
    logAuthorization(clientId, target, authorizedBy) {
        this.logger.info('AUTHORIZATION_RECORD', {
            clientId,
            target,
            authorizedBy,
            timestamp: new Date().toISOString()
        });
    }
    logAttackStart(config) {
        this.logger.info('ATTACK_START', {
            attackId: this.attackId,
            config,
            timestamp: new Date().toISOString()
        });
    }
    logAttackEnd(stats) {
        this.logger.info('ATTACK_END', {
            attackId: this.attackId,
            stats,
            timestamp: new Date().toISOString()
        });
    }
    logRequest(proxy, userAgent, statusCode, error) {
        const entry = {
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
exports.AuditLogger = AuditLogger;
