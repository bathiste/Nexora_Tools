"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserAgentRotator = exports.DEFAULT_USER_AGENTS = void 0;
exports.DEFAULT_USER_AGENTS = [
    // Chrome on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
    // Chrome on macOS
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    // Firefox
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:119.0) Gecko/20100101 Firefox/119.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0',
    // Safari
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
    // Edge
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    // Mobile
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
];
class UserAgentRotator {
    constructor(userAgents = exports.DEFAULT_USER_AGENTS, autoLoadPath = 'data/uas.txt') {
        this.currentIndex = 0;
        this.userAgents = [...userAgents];
        // Auto-load from default path if file exists
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
    getNext() {
        const agent = this.userAgents[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.userAgents.length;
        return agent;
    }
    getRandom() {
        return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    }
    addUserAgent(agent) {
        this.userAgents.push(agent);
    }
    loadFromFile(filePath) {
        const fs = require('fs');
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n').map((line) => line.trim()).filter((line) => line);
        this.userAgents.push(...lines);
    }
}
exports.UserAgentRotator = UserAgentRotator;
