import { ProxyConfig } from './types';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';

export class ProxyManager {
  private proxies: ProxyConfig[];
  private currentIndex: number = 0;
  private failedProxies: Set<number> = new Set();

  constructor(proxies: ProxyConfig[] = [], autoLoadPath: string = 'data/proxies.txt') {
    this.proxies = proxies;
    // Auto-load from default path if file exists and no proxies provided
    if (this.proxies.length === 0) {
      try {
        const fs = require('fs');
        if (fs.existsSync(autoLoadPath)) {
          this.loadFromFile(autoLoadPath);
        }
      } catch (e) {
        // Silently fail if file doesn't exist
      }
    }
  }

  addProxy(proxy: ProxyConfig): void {
    this.proxies.push(proxy);
  }

  loadFromFile(filePath: string): void {
    const fs = require('fs');
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').map((line: string) => line.trim()).filter((line: string) => line);
    
    for (const line of lines) {
      const parsed = this.parseProxyString(line);
      if (parsed) {
        this.proxies.push(parsed);
      }
    }
  }

  private parseProxyString(proxyString: string): ProxyConfig | null {
    // Format: type://host:port or type://username:password@host:port
    const regex = /^(socks4|socks5|http|https):\/\/(?:([^:]+):([^@]+)@)?([^:]+):(\d+)$/;
    const match = proxyString.match(regex);
    
    if (!match) return null;
    
    const [, type, username, password, host, port] = match;
    
    return {
      type: type as 'socks4' | 'socks5' | 'http' | 'https',
      host,
      port: parseInt(port, 10),
      username,
      password
    };
  }

  getNext(): ProxyConfig | null {
    const availableProxies = this.proxies.filter((_, index) => !this.failedProxies.has(index));
    
    if (availableProxies.length === 0) {
      return null;
    }
    
    const proxy = availableProxies[this.currentIndex % availableProxies.length];
    this.currentIndex = (this.currentIndex + 1) % availableProxies.length;
    return proxy;
  }

  getRandom(): ProxyConfig | null {
    const availableProxies = this.proxies.filter((_, index) => !this.failedProxies.has(index));
    
    if (availableProxies.length === 0) {
      return null;
    }
    
    return availableProxies[Math.floor(Math.random() * availableProxies.length)];
  }

  markFailed(proxy: ProxyConfig): void {
    const index = this.proxies.findIndex(p => 
      p.host === proxy.host && p.port === proxy.port && p.type === proxy.type
    );
    if (index !== -1) {
      this.failedProxies.add(index);
    }
  }

  createAgent(proxy: ProxyConfig) {
    const auth = proxy.username && proxy.password 
      ? `${proxy.username}:${proxy.password}@` 
      : '';

    switch (proxy.type) {
      case 'socks4':
        return new SocksProxyAgent(`socks4://${auth}${proxy.host}:${proxy.port}`);
      
      case 'socks5':
        return new SocksProxyAgent(`socks5://${auth}${proxy.host}:${proxy.port}`);
      
      case 'http':
        return new HttpProxyAgent(`http://${auth}${proxy.host}:${proxy.port}`);
      
      case 'https':
        return new HttpsProxyAgent(`https://${auth}${proxy.host}:${proxy.port}`);
      
      default:
        throw new Error(`Unsupported proxy type: ${proxy.type}`);
    }
  }

  getProxyCount(): number {
    return this.proxies.length;
  }

  getActiveProxyCount(): number {
    return this.proxies.length - this.failedProxies.size;
  }
}
