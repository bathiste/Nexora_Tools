"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProxyManager = void 0;
const socks_proxy_agent_1 = require("socks-proxy-agent");
const http_proxy_agent_1 = require("http-proxy-agent");
const https_proxy_agent_1 = require("https-proxy-agent");
class ProxyManager {
    constructor(proxies = [], autoLoadPath = 'data/proxies.txt') {
        this.currentIndex = 0;
        this.failedProxies = new Set();
        this.proxies = proxies;
        // Auto-load from default path if file exists and no proxies provided
        if (this.proxies.length === 0) {
            try {
                const fs = require('fs');
                if (fs.existsSync(autoLoadPath)) {
                    this.loadFromFile(autoLoadPath);
                }
            }
            catch (e) {
                // Silently fail if file doesn't exist
            }
        }
    }
    addProxy(proxy) {
        this.proxies.push(proxy);
    }
    loadFromFile(filePath) {
        const fs = require('fs');
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n').map((line) => line.trim()).filter((line) => line);
        for (const line of lines) {
            const parsed = this.parseProxyString(line);
            if (parsed) {
                this.proxies.push(parsed);
            }
        }
    }
    parseProxyString(proxyString) {
        // Format: type://host:port or type://username:password@host:port
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
    getNext() {
        const availableProxies = this.proxies.filter((_, index) => !this.failedProxies.has(index));
        if (availableProxies.length === 0) {
            return null;
        }
        const proxy = availableProxies[this.currentIndex % availableProxies.length];
        this.currentIndex = (this.currentIndex + 1) % availableProxies.length;
        return proxy;
    }
    getRandom() {
        const availableProxies = this.proxies.filter((_, index) => !this.failedProxies.has(index));
        if (availableProxies.length === 0) {
            return null;
        }
        return availableProxies[Math.floor(Math.random() * availableProxies.length)];
    }
    markFailed(proxy) {
        const index = this.proxies.findIndex(p => p.host === proxy.host && p.port === proxy.port && p.type === proxy.type);
        if (index !== -1) {
            this.failedProxies.add(index);
        }
    }
    createAgent(proxy) {
        const auth = proxy.username && proxy.password
            ? `${proxy.username}:${proxy.password}@`
            : '';
        switch (proxy.type) {
            case 'socks4':
                return new socks_proxy_agent_1.SocksProxyAgent(`socks4://${auth}${proxy.host}:${proxy.port}`);
            case 'socks5':
                return new socks_proxy_agent_1.SocksProxyAgent(`socks5://${auth}${proxy.host}:${proxy.port}`);
            case 'http':
                return new http_proxy_agent_1.HttpProxyAgent(`http://${auth}${proxy.host}:${proxy.port}`);
            case 'https':
                return new https_proxy_agent_1.HttpsProxyAgent(`https://${auth}${proxy.host}:${proxy.port}`);
            default:
                throw new Error(`Unsupported proxy type: ${proxy.type}`);
        }
    }
    getProxyCount() {
        return this.proxies.length;
    }
    getActiveProxyCount() {
        return this.proxies.length - this.failedProxies.size;
    }
}
exports.ProxyManager = ProxyManager;
