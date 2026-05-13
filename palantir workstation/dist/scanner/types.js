"use strict";
/**
 * CVE Scanner Types
 * Type definitions for the vulnerability scanner pipeline
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScanCancelledError = exports.ToolNotFoundError = exports.ScannerError = void 0;
// Error types
class ScannerError extends Error {
    constructor(message, code, phase, originalError) {
        super(message);
        this.code = code;
        this.phase = phase;
        this.originalError = originalError;
        this.name = 'ScannerError';
    }
}
exports.ScannerError = ScannerError;
class ToolNotFoundError extends ScannerError {
    constructor(tool) {
        super(`Required tool not found: ${tool}`, 'TOOL_NOT_FOUND');
        this.name = 'ToolNotFoundError';
    }
}
exports.ToolNotFoundError = ToolNotFoundError;
class ScanCancelledError extends ScannerError {
    constructor(scanId) {
        super(`Scan ${scanId} was cancelled`, 'SCAN_CANCELLED');
        this.name = 'ScanCancelledError';
    }
}
exports.ScanCancelledError = ScanCancelledError;
// All types are exported individually above
// Use: import { ScanTarget, CVE, ... } from './types'
