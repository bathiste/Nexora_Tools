import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';

const execAsync = promisify(exec);

export interface OllamaStatus {
    installed: boolean;
    running: boolean;
    modelInstalled: boolean;
    error?: string;
}

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export class AIAssistant {
    private ollamaProcess: any = null;
    private chatHistory: ChatMessage[] = [];

    async checkOllamaStatus(): Promise<OllamaStatus> {
        try {
            // Check if ollama command exists
            await execAsync('ollama --version');
            
            // Check if ollama server is running
            let running = false;
            try {
                await axios.get('http://localhost:11434/api/tags', { timeout: 2000 });
                running = true;
            } catch {
                running = false;
            }

            // Check if dolphin-llama3 is installed
            let modelInstalled = false;
            if (running) {
                try {
                    const response = await axios.get('http://localhost:11434/api/tags', { timeout: 2000 });
                    const models = response.data.models || [];
                    modelInstalled = models.some((m: any) => m.name.includes('dolphin-llama3'));
                } catch {
                    modelInstalled = false;
                }
            }

            return { installed: true, running, modelInstalled };
        } catch (error) {
            return { 
                installed: false, 
                running: false, 
                modelInstalled: false,
                error: 'Ollama not found'
            };
        }
    }

    async startOllamaServer(): Promise<boolean> {
        try {
            // Check if already running
            try {
                await axios.get('http://localhost:11434/api/tags', { timeout: 1000 });
                return true; // Already running
            } catch {
                // Not running, start it
            }

            // Start ollama serve
            this.ollamaProcess = spawn('ollama', ['serve'], {
                detached: true,
                windowsHide: true
            });

            // Wait a moment for server to start
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Verify it's running
            try {
                await axios.get('http://localhost:11434/api/tags', { timeout: 2000 });
                return true;
            } catch {
                return false;
            }
        } catch (error) {
            console.error('Failed to start Ollama:', error);
            return false;
        }
    }

    async installModel(): Promise<{ success: boolean; message: string }> {
        try {
            const { stdout, stderr } = await execAsync('ollama pull dolphin-llama3:8b', { timeout: 300000 });
            return { 
                success: true, 
                message: 'Model installed successfully' 
            };
        } catch (error: any) {
            return { 
                success: false, 
                message: error?.stderr || error?.message || 'Failed to install model' 
            };
        }
    }

    async sendMessage(message: string): Promise<string> {
        try {
            const response = await axios.post('http://localhost:11434/api/generate', {
                model: 'dolphin-llama3:8b',
                prompt: message,
                stream: false
            }, { timeout: 60000 });

            const reply = response.data.response || 'No response from AI';
            
            // Save to chat history
            this.chatHistory.push(
                { role: 'user', content: message, timestamp: new Date() },
                { role: 'assistant', content: reply, timestamp: new Date() }
            );

            return reply;
        } catch (error: any) {
            throw new Error(error?.message || 'Failed to get AI response');
        }
    }

    getChatHistory(): ChatMessage[] {
        return this.chatHistory;
    }

    clearChat(): void {
        this.chatHistory = [];
    }

    stopServer(): void {
        if (this.ollamaProcess) {
            this.ollamaProcess.kill();
            this.ollamaProcess = null;
        }
    }
}

export const aiAssistant = new AIAssistant();
