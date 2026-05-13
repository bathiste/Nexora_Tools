"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiAssistant = exports.AIAssistant = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const axios_1 = __importDefault(require("axios"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class AIAssistant {
    constructor() {
        this.ollamaProcess = null;
        this.chatHistory = [];
    }
    async checkOllamaStatus() {
        try {
            // Check if ollama command exists
            await execAsync('ollama --version');
            // Check if ollama server is running
            let running = false;
            try {
                await axios_1.default.get('http://localhost:11434/api/tags', { timeout: 2000 });
                running = true;
            }
            catch {
                running = false;
            }
            // Check if dolphin-llama3 is installed
            let modelInstalled = false;
            if (running) {
                try {
                    const response = await axios_1.default.get('http://localhost:11434/api/tags', { timeout: 2000 });
                    const models = response.data.models || [];
                    modelInstalled = models.some((m) => m.name.includes('dolphin-llama3'));
                }
                catch {
                    modelInstalled = false;
                }
            }
            return { installed: true, running, modelInstalled };
        }
        catch (error) {
            return {
                installed: false,
                running: false,
                modelInstalled: false,
                error: 'Ollama not found'
            };
        }
    }
    async startOllamaServer() {
        try {
            // Check if already running
            try {
                await axios_1.default.get('http://localhost:11434/api/tags', { timeout: 1000 });
                return true; // Already running
            }
            catch {
                // Not running, start it
            }
            // Start ollama serve
            this.ollamaProcess = (0, child_process_1.spawn)('ollama', ['serve'], {
                detached: true,
                windowsHide: true
            });
            // Wait a moment for server to start
            await new Promise(resolve => setTimeout(resolve, 3000));
            // Verify it's running
            try {
                await axios_1.default.get('http://localhost:11434/api/tags', { timeout: 2000 });
                return true;
            }
            catch {
                return false;
            }
        }
        catch (error) {
            console.error('Failed to start Ollama:', error);
            return false;
        }
    }
    async installModel() {
        try {
            const { stdout, stderr } = await execAsync('ollama pull dolphin-llama3:8b', { timeout: 300000 });
            return {
                success: true,
                message: 'Model installed successfully'
            };
        }
        catch (error) {
            return {
                success: false,
                message: error?.stderr || error?.message || 'Failed to install model'
            };
        }
    }
    async sendMessage(message) {
        try {
            const response = await axios_1.default.post('http://localhost:11434/api/generate', {
                model: 'dolphin-llama3:8b',
                prompt: message,
                stream: false
            }, { timeout: 60000 });
            const reply = response.data.response || 'No response from AI';
            // Save to chat history
            this.chatHistory.push({ role: 'user', content: message, timestamp: new Date() }, { role: 'assistant', content: reply, timestamp: new Date() });
            return reply;
        }
        catch (error) {
            throw new Error(error?.message || 'Failed to get AI response');
        }
    }
    getChatHistory() {
        return this.chatHistory;
    }
    clearChat() {
        this.chatHistory = [];
    }
    stopServer() {
        if (this.ollamaProcess) {
            this.ollamaProcess.kill();
            this.ollamaProcess = null;
        }
    }
}
exports.AIAssistant = AIAssistant;
exports.aiAssistant = new AIAssistant();
