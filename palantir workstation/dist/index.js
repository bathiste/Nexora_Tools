#!/usr/bin/env node
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
const commander_1 = require("commander");
const attackEngine_1 = require("./attackEngine");
const proxyManager_1 = require("./proxyManager");
const userAgents_1 = require("./userAgents");
const fs = __importStar(require("fs"));
const program = new commander_1.Command();
program
    .name('pentest-beam')
    .description('Authorized penetration testing platform')
    .version('1.0.0');
program
    .command('attack')
    .description('Start a load test against authorized target')
    .requiredOption('-t, --target <url>', 'Target URL')
    .option('-d, --duration <seconds>', 'Test duration in seconds', '60')
    .option('--threads <count>', 'Number of concurrent threads', '10')
    .option('--rate <rps>', 'Requests per second per thread (0 = unlimited)', '0')
    .option('-m, --method <method>', 'HTTP method', 'GET')
    .option('--proxy-file <path>', 'File containing proxy list', 'data/proxies.txt')
    .option('--ua-file <path>', 'File containing user agent list', 'data/uas.txt')
    .option('--header <header>', 'Custom header (can be used multiple times)', collect, [])
    .option('--payload <data>', 'Request body for POST/PUT')
    .option('--client-id <id>', 'Client ID for authorization')
    .option('--authorized-by <name>', 'Name of person authorizing the test')
    .option('--auth-file <path>', 'JSON file with authorization details')
    .action(async (options) => {
    try {
        // Build proxy list
        const proxyManager = new proxyManager_1.ProxyManager();
        if (options.proxyFile) {
            if (!fs.existsSync(options.proxyFile)) {
                console.error(`Proxy file not found: ${options.proxyFile}`);
                process.exit(1);
            }
            proxyManager.loadFromFile(options.proxyFile);
            console.log(`Loaded ${proxyManager.getProxyCount()} proxies`);
        }
        // Build user agent list
        const uaRotator = new userAgents_1.UserAgentRotator(userAgents_1.DEFAULT_USER_AGENTS);
        if (options.uaFile) {
            if (!fs.existsSync(options.uaFile)) {
                console.error(`User agent file not found: ${options.uaFile}`);
                process.exit(1);
            }
            uaRotator.loadFromFile(options.uaFile);
            console.log(`Loaded custom user agents from ${options.uaFile}`);
        }
        // Parse headers
        const headers = {};
        for (const header of options.header) {
            const [key, value] = header.split(':').map((s) => s.trim());
            if (key && value) {
                headers[key] = value;
            }
        }
        // Load authorization
        let authorization = null;
        if (options.authFile) {
            const authData = JSON.parse(fs.readFileSync(options.authFile, 'utf-8'));
            authorization = {
                clientId: authData.clientId,
                targetUrl: authData.targetUrl,
                authorizedBy: authData.authorizedBy,
                authorizationDate: new Date(authData.authorizationDate),
                scope: authData.scope,
                validUntil: new Date(authData.validUntil)
            };
        }
        else if (options.clientId && options.authorizedBy) {
            authorization = {
                clientId: options.clientId,
                targetUrl: options.target,
                authorizedBy: options.authorizedBy,
                authorizationDate: new Date(),
                scope: 'load-testing',
                validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
            };
        }
        if (!authorization) {
            console.error('Authorization required. Use --client-id and --authorized-by or --auth-file');
            process.exit(1);
        }
        // Check authorization validity
        if (new Date() > authorization.validUntil) {
            console.error('Authorization has expired');
            process.exit(1);
        }
        if (authorization.targetUrl !== options.target) {
            console.warn(`Warning: Target URL (${options.target}) does not match authorized URL (${authorization.targetUrl})`);
        }
        // Build attack config
        const config = {
            target: options.target,
            duration: parseInt(options.duration, 10),
            threads: parseInt(options.threads, 10),
            rateLimit: parseInt(options.rate, 10),
            method: options.method.toUpperCase(),
            proxies: [], // Managed by ProxyManager internally
            userAgents: userAgents_1.DEFAULT_USER_AGENTS,
            headers,
            payload: options.payload
        };
        // Copy proxies from manager
        // Note: We need to get proxies back from the manager
        // This is a workaround - we should refactor to pass the proxyManager directly
        if (options.proxyFile) {
            const proxyContent = fs.readFileSync(options.proxyFile, 'utf-8');
            const lines = proxyContent.split('\n').map((line) => line.trim()).filter((line) => line);
            for (const line of lines) {
                const parsed = parseProxyString(line);
                if (parsed)
                    config.proxies.push(parsed);
            }
        }
        console.log('\n=== PENTEST BEAM - Authorized Load Test ===');
        console.log(`Target: ${config.target}`);
        console.log(`Duration: ${config.duration}s`);
        console.log(`Threads: ${config.threads}`);
        console.log(`Method: ${config.method}`);
        console.log(`Proxies: ${config.proxies.length}`);
        console.log(`Client: ${authorization.clientId}`);
        console.log(`Authorized By: ${authorization.authorizedBy}`);
        console.log('========================================\n');
        const engine = new attackEngine_1.AttackEngine(config, authorization);
        engine.on('request', (data) => {
            process.stdout.write(`[${data.status}] ${data.proxy} - ${data.duration}ms\r`);
        });
        engine.on('stop', (stats) => {
            console.log('\n\n=== Test Complete ===');
            console.log(`Total Requests: ${stats.totalRequests}`);
            console.log(`Successful: ${stats.successfulRequests}`);
            console.log(`Failed: ${stats.failedRequests}`);
            console.log(`Duration: ${((stats.endTime - stats.startTime) / 1000).toFixed(2)}s`);
            console.log(`RPS: ${(stats.totalRequests / ((stats.endTime - stats.startTime) / 1000)).toFixed(2)}`);
            console.log(`Bytes Sent: ${formatBytes(stats.bytesSent)}`);
            console.log(`Bytes Received: ${formatBytes(stats.bytesReceived)}`);
            console.log('===================\n');
        });
        // Handle graceful shutdown
        process.on('SIGINT', () => {
            console.log('\n\nReceived SIGINT, stopping test...');
            engine.stop();
        });
        await engine.start();
    }
    catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
program
    .command('validate-proxies')
    .description('Test proxy connectivity')
    .requiredOption('-f, --file <path>', 'Proxy list file')
    .option('-t, --test-url <url>', 'URL to test against', 'http://httpbin.org/ip')
    .action(async (options) => {
    const proxyManager = new proxyManager_1.ProxyManager();
    proxyManager.loadFromFile(options.file);
    console.log(`Testing ${proxyManager.getProxyCount()} proxies against ${options.testUrl}...\n`);
    // Test implementation would go here
    console.log('Proxy validation not yet implemented');
});
function collect(value, previous) {
    return previous.concat([value]);
}
function parseProxyString(proxyString) {
    const regex = /^(socks4|socks5|http|https):\/\/(?:([^:]+):([^@]+)@)?([^:]+):(\d+)$/;
    const match = proxyString.match(regex);
    if (!match)
        return null;
    const [, type, username, password, host, port] = match;
    return {
        type: type,
        host,
        port: parseInt(port, 10),
        username,
        password
    };
}
function formatBytes(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0)
        return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}
program.parse();
