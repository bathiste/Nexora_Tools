/**
 * Recon Engine - Backend for Reconnaissance Dashboard
 * Handles all recon/scanning operations with real tool integrations
 */

import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import * as dns from 'dns';
import { Pool } from 'pg';

const execAsync = promisify(exec);
const dnsResolve = promisify(dns.resolve);
const dnsResolve4 = promisify(dns.resolve4);
const dnsResolve6 = promisify(dns.resolve6);
const dnsResolveMx = promisify(dns.resolveMx);
const dnsResolveNs = promisify(dns.resolveNs);
const dnsResolveTxt = promisify(dns.resolveTxt);
const dnsResolveCname = promisify(dns.resolveCname);

export interface ReconResult {
  scanId: string;
  tool: string;
  target: string;
  status: 'running' | 'completed' | 'failed' | 'stopped';
  progress: number;
  results: any[];
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

export interface IntegrationStatus {
  name: string;
  installed: boolean;
  version?: string;
  path?: string;
}

export class ReconEngine extends EventEmitter {
  private db: Pool;
  private activeScans: Map<string, ReconResult> = new Map();
  private scanHistory: ReconResult[] = [];
  private integrationsCache: IntegrationStatus[] | null = null;
  private integrationsCacheTime: number = 0;

  constructor(db: Pool) {
    super();
    this.db = db;
  }

  // ==================== Integration Detection ====================

  /**
   * Check which recon tools are installed on the system
   */
  async checkIntegrations(): Promise<IntegrationStatus[]> {
    // Return cached result if within 60 seconds
    if (this.integrationsCache && (Date.now() - this.integrationsCacheTime) < 60000) {
      return this.integrationsCache;
    }

    const tools = [
      { name: 'nmap', check: 'nmap --version 2>&1', versionExtract: /Nmap version ([0-9.]+)/ },
      { name: 'amass', check: 'amass -version 2>&1', versionExtract: /([0-9]+\.[0-9]+)/ },
      { name: 'subfinder', check: 'subfinder -version 2>&1', versionExtract: /([0-9]+\.[0-9]+\.[0-9]+)/ },
      { name: 'httpx', check: 'httpx -version 2>&1', versionExtract: /([0-9]+\.[0-9]+\.[0-9]+)/ },
      { name: 'nuclei', check: 'nuclei -version 2>&1', versionExtract: /([0-9]+\.[0-9]+\.[0-9]+)/ },
      { name: 'rustscan', check: 'rustscan --version 2>&1', versionExtract: /([0-9]+\.[0-9]+\.[0-9]+)/ },
      { name: 'naabu', check: 'naabu -version 2>&1', versionExtract: /([0-9]+\.[0-9]+\.[0-9]+)/ },
      { name: 'masscan', check: 'masscan --version 2>&1', versionExtract: /Masscan version ([0-9.]+)/ },
      { name: 'dig', check: 'dig -v 2>&1', versionExtract: /([0-9]+\.[0-9]+)/ },
      { name: 'whois', check: 'whois --version 2>&1', versionExtract: /([0-9]+\.[0-9]+)/ },
      { name: 'curl', check: 'curl --version 2>&1', versionExtract: /curl ([0-9]+\.[0-9]+\.[0-9]+)/ },
      { name: 'wget', check: 'wget --version 2>&1', versionExtract: /([0-9]+\.[0-9]+)/ },
    ];

    const results: IntegrationStatus[] = [];

    for (const tool of tools) {
      try {
        const { stdout } = await execAsync(tool.check, { timeout: 5000 });
        const versionMatch = tool.versionExtract.exec(stdout);
        results.push({
          name: tool.name,
          installed: true,
          version: versionMatch ? versionMatch[1] : 'installed',
          path: '', // Could use `which` or `where` to find path
        });
      } catch {
        results.push({
          name: tool.name,
          installed: false,
        });
      }
    }

    this.integrationsCache = results;
    this.integrationsCacheTime = Date.now();

    return results;
  }

  /**
   * Get status of integrations needed for a specific tool
   */
  async getIntegrationStatusForTool(toolName: string): Promise<{
    connected: IntegrationStatus[];
    missing: string[];
    allConnected: boolean;
  }> {
    const integrations = await this.checkIntegrations();
    const requiredMap: Record<string, string[]> = {
      'asset-discovery': ['nmap', 'amass', 'subfinder', 'dig', 'curl'],
      'subdomain-enum': ['subfinder', 'amass', 'dig'],
      'dns-whois': ['dig', 'whois'],
      'port-scan': ['nmap', 'rustscan', 'naabu'],
      'web-crawler': ['httpx', 'curl', 'wget'],
      'api-mapper': ['httpx', 'curl'],
      'http-fingerprint': ['httpx', 'curl'],
      'tls-analysis': ['nmap', 'curl'],
      'tech-detection': ['httpx', 'curl'],
      'screenshot': ['curl', 'wget'],
      'cve-enrichment': ['nuclei'],
      'diff-snapshots': [],
    };

    const required = requiredMap[toolName] || [];
    const connected: IntegrationStatus[] = [];
    const missing: string[] = [];

    for (const name of required) {
      const integration = integrations.find(i => i.name === name);
      if (integration && integration.installed) {
        connected.push(integration);
      } else {
        missing.push(name);
      }
    }

    return {
      connected,
      missing,
      allConnected: missing.length === 0,
    };
  }

  // ==================== Scan History ====================

  getScanHistory(): ReconResult[] {
    return this.scanHistory.slice(-50); // Last 50 scans
  }

  getActiveScans(): ReconResult[] {
    return Array.from(this.activeScans.values());
  }

  getScanById(scanId: string): ReconResult | undefined {
    return this.activeScans.get(scanId) || this.scanHistory.find(s => s.scanId === scanId);
  }

  // ==================== Core Scan Methods ====================

  /**
   * Start an asset discovery scan
   */
  async startAssetDiscovery(target: string): Promise<string> {
    const scanId = `recon-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
    
    const result: ReconResult = {
      scanId,
      tool: 'asset-discovery',
      target,
      status: 'running',
      progress: 0,
      results: [],
      startedAt: new Date(),
    };

    this.activeScans.set(scanId, result);
    this.emit('scan.started', { scanId, tool: 'asset-discovery', target });

    // Run asynchronously
    this.runAssetDiscovery(scanId, target).catch(err => {
      result.status = 'failed';
      result.error = err.message;
      result.completedAt = new Date();
      this.emit('scan.error', { scanId, error: err.message });
    });

    return scanId;
  }

  private async runAssetDiscovery(scanId: string, target: string): Promise<void> {
    const result = this.activeScans.get(scanId)!;
    const findings: any[] = [];

    // Phase 1: DNS Resolution
    this.updateProgress(scanId, 10, 'Resolving DNS records...');
    try {
      const ips = await this.resolveHostname(target);
      for (const ip of ips) {
        findings.push({
          type: 'ip_address',
          value: ip,
          source: 'dns',
          timestamp: new Date().toISOString(),
        });
      }
      this.emit('finding', { scanId, findings: ips.map(ip => ({ type: 'ip', value: ip })) });
    } catch (err: any) {
      findings.push({ type: 'error', message: `DNS resolution failed: ${err.message}` });
    }

    // Phase 2: Subdomain discovery via subfinder
    this.updateProgress(scanId, 25, 'Discovering subdomains...');
    try {
      const { stdout } = await execAsync(
        `subfinder -d ${target} -silent -max-time 30 2>/dev/null || echo ""`,
        { timeout: 45000 }
      );
      const subdomains = stdout.split('\n')
        .map(s => s.trim())
        .filter(s => s && s.includes('.'));
      
      for (const sub of subdomains) {
        findings.push({
          type: 'subdomain',
          value: sub,
          source: 'subfinder',
          timestamp: new Date().toISOString(),
        });
      }
      this.emit('finding', { scanId, findings: subdomains.map(s => ({ type: 'subdomain', value: s })) });
    } catch {
      // Fallback: basic DNS enumeration
      const fallbackSubs = await this.basicDNSEnumeration(target);
      for (const sub of fallbackSubs) {
        findings.push({
          type: 'subdomain',
          value: sub,
          source: 'dns-brute',
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Phase 3: Port scanning top-100
    this.updateProgress(scanId, 50, 'Scanning top ports...');
    try {
      const { stdout } = await execAsync(
        `nmap --top-ports 100 -T4 --open ${target} -oG - 2>/dev/null || echo ""`,
        { timeout: 120000 }
      );
      const portLines = stdout.split('\n').filter(l => l.includes('/open/'));
      for (const line of portLines) {
        const parts = line.split('\t');
        const portInfo = parts[1] || line;
        const portMatch = portInfo.match(/(\d+)\/open\/(\w+)/);
        if (portMatch) {
          findings.push({
            type: 'open_port',
            port: parseInt(portMatch[1]),
            protocol: portMatch[2],
            source: 'nmap',
            timestamp: new Date().toISOString(),
          });
        }
      }
    } catch {
      // Fallback: simple port check
      const ports = await this.simplePortCheck(target);
      for (const p of ports) {
        findings.push({
          type: 'open_port',
          port: p,
          protocol: 'tcp',
          source: 'tcp-check',
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Phase 4: HTTP service discovery
    this.updateProgress(scanId, 75, 'Discovering HTTP services...');
    try {
      const { stdout } = await execAsync(
        `httpx -l <(echo "${target}") -silent -status-code -title -tech-detect -json 2>/dev/null || echo ""`,
        { timeout: 30000 }
      );
      if (stdout.trim()) {
        try {
          const httpResult = JSON.parse(stdout.trim());
          findings.push({
            type: 'http_service',
            url: httpResult.url || `http://${target}`,
            status_code: httpResult.status_code,
            title: httpResult.title,
            technologies: httpResult.tech || [],
            source: 'httpx',
            timestamp: new Date().toISOString(),
          });
        } catch {
          // Non-JSON output, just note the service exists
          findings.push({
            type: 'http_service',
            url: `http://${target}`,
            source: 'httpx',
            timestamp: new Date().toISOString(),
          });
        }
      }
    } catch {
      // HTTP discovery failed, try basic curl
      try {
        const { stdout } = await execAsync(
          `curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://${target} 2>/dev/null || echo "failed"`,
          { timeout: 10000 }
        );
        if (stdout !== 'failed') {
          findings.push({
            type: 'http_service',
            url: `http://${target}`,
            status_code: parseInt(stdout),
            source: 'curl',
            timestamp: new Date().toISOString(),
          });
        }
      } catch {
        // HTTP check failed
      }
    }

    // Finalize
    result.results = findings;
    result.status = 'completed';
    result.progress = 100;
    result.completedAt = new Date();

    // Save to database
    await this.saveScanToDb(scanId, 'asset-discovery', target, findings);

    // Move from active to history
    this.activeScans.delete(scanId);
    this.scanHistory.push(result);

    this.emit('scan.completed', { scanId, findings: findings.length });
  }

  /**
   * Start subdomain enumeration
   */
  async startSubdomainEnum(target: string): Promise<string> {
    const scanId = `recon-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
    
    const result: ReconResult = {
      scanId,
      tool: 'subdomain-enum',
      target,
      status: 'running',
      progress: 0,
      results: [],
      startedAt: new Date(),
    };

    this.activeScans.set(scanId, result);
    this.emit('scan.started', { scanId, tool: 'subdomain-enum', target });

    this.runSubdomainEnum(scanId, target).catch(err => {
      result.status = 'failed';
      result.error = err.message;
      result.completedAt = new Date();
    });

    return scanId;
  }

  private async runSubdomainEnum(scanId: string, target: string): Promise<void> {
    const result = this.activeScans.get(scanId)!;
    const subdomains: any[] = [];

    // Try subfinder
    this.updateProgress(scanId, 20, 'Running subfinder...');
    try {
      const { stdout } = await execAsync(
        `subfinder -d ${target} -silent -max-time 60 2>/dev/null || echo ""`,
        { timeout: 75000 }
      );
      const subs = stdout.split('\n').map(s => s.trim()).filter(s => s && s.includes('.'));
      for (const sub of subs) {
        subdomains.push({
          subdomain: sub,
          source: 'subfinder',
          isAlive: false,
        });
      }
    } catch {
      // subfinder not available
    }

    // Try amass
    this.updateProgress(scanId, 40, 'Running amass...');
    try {
      const { stdout } = await execAsync(
        `amass enum -d ${target} -timeout 5 -silent 2>/dev/null || echo ""`,
        { timeout: 60000 }
      );
      const subs = stdout.split('\n').map(s => s.trim()).filter(s => s && s.includes('.'));
      for (const sub of subs) {
        if (!subdomains.find(s => s.subdomain === sub)) {
          subdomains.push({
            subdomain: sub,
            source: 'amass',
            isAlive: false,
          });
        }
      }
    } catch {
      // amass not available
    }

    // DNS brute force fallback
    this.updateProgress(scanId, 60, 'DNS brute forcing...');
    const bruteSubs = await this.basicDNSEnumeration(target);
    for (const sub of bruteSubs) {
      if (!subdomains.find(s => s.subdomain === sub)) {
        subdomains.push({
          subdomain: sub,
          source: 'dns-brute',
          isAlive: false,
        });
      }
    }

    // Check which ones are alive
    this.updateProgress(scanId, 80, 'Checking alive subdomains...');
    const aliveCheckPromises = subdomains.map(async (sub) => {
      try {
        await execAsync(`ping -n 1 -w 2000 ${sub.subdomain} 2>nul || ping -c 1 -W 2 ${sub.subdomain} 2>/dev/null`, { timeout: 3000 });
        sub.isAlive = true;
      } catch {
        try {
          await execAsync(`curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://${sub.subdomain} 2>/dev/null || powershell -Command "try { (Invoke-WebRequest -Uri 'http://${sub.subdomain}' -TimeoutSec 3 -UseBasicParsing).StatusCode } catch { }" 2>/dev/null`, { timeout: 5000 });
          sub.isAlive = true;
        } catch {
          sub.isAlive = false;
        }
      }
    });
    await Promise.allSettled(aliveCheckPromises);

    result.results = subdomains;
    result.status = 'completed';
    result.progress = 100;
    result.completedAt = new Date();

    await this.saveScanToDb(scanId, 'subdomain-enum', target, subdomains);

    this.activeScans.delete(scanId);
    this.scanHistory.push(result);
    this.emit('scan.completed', { scanId, subdomains: subdomains.length, alive: subdomains.filter(s => s.isAlive).length });
  }

  /**
   * Start DNS/WHOIS lookup
   */
  async startDNSWhois(target: string): Promise<string> {
    const scanId = `recon-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
    
    const result: ReconResult = {
      scanId,
      tool: 'dns-whois',
      target,
      status: 'running',
      progress: 0,
      results: [],
      startedAt: new Date(),
    };

    this.activeScans.set(scanId, result);
    this.emit('scan.started', { scanId, tool: 'dns-whois', target });

    this.runDNSWhois(scanId, target).catch(err => {
      result.status = 'failed';
      result.error = err.message;
      result.completedAt = new Date();
    });

    return scanId;
  }

  private async runDNSWhois(scanId: string, target: string): Promise<void> {
    const result = this.activeScans.get(scanId)!;
    const records: any[] = [];

    // A records
    this.updateProgress(scanId, 10, 'Resolving A records...');
    try {
      const a = await dnsResolve4(target);
      records.push({ type: 'A', value: a.join(', '), ttl: 'standard' });
    } catch { records.push({ type: 'A', value: 'No records found' }); }

    // AAAA records
    this.updateProgress(scanId, 20, 'Resolving AAAA records...');
    try {
      const aaaa = await dnsResolve6(target);
      records.push({ type: 'AAAA', value: aaaa.join(', '), ttl: 'standard' });
    } catch { records.push({ type: 'AAAA', value: 'No records found' }); }

    // MX records
    this.updateProgress(scanId, 30, 'Resolving MX records...');
    try {
      const mx = await dnsResolveMx(target);
      records.push({ type: 'MX', value: mx.map(m => `${m.exchange} (priority: ${m.priority})`).join(', ') });
    } catch { records.push({ type: 'MX', value: 'No records found' }); }

    // NS records
    this.updateProgress(scanId, 40, 'Resolving NS records...');
    try {
      const ns = await dnsResolveNs(target);
      records.push({ type: 'NS', value: ns.join(', ') });
    } catch { records.push({ type: 'NS', value: 'No records found' }); }

    // TXT records
    this.updateProgress(scanId, 50, 'Resolving TXT records...');
    try {
      const txt = await dnsResolveTxt(target);
      records.push({ type: 'TXT', value: txt.map(t => t.join(' ')).join('; ') });
    } catch { records.push({ type: 'TXT', value: 'No records found' }); }

    // CNAME records
    this.updateProgress(scanId, 60, 'Resolving CNAME records...');
    try {
      const cname = await dnsResolveCname(target);
      records.push({ type: 'CNAME', value: cname.join(', ') });
    } catch { records.push({ type: 'CNAME', value: 'No records found' }); }

    // WHOIS lookup
    this.updateProgress(scanId, 75, 'Performing WHOIS lookup...');
    try {
      const { stdout } = await execAsync(
        `whois ${target} 2>/dev/null || echo "WHOIS lookup failed"`,
        { timeout: 30000 }
      );
      // Extract key WHOIS fields
      const whoisLines = stdout.split('\n').filter(l => l.trim());
      const whoisFields: Record<string, string> = {};
      const fields = ['Domain Name:', ' Registrar:', ' Creation Date:', ' Registry Expiry Date:', ' Name Server:'];
      for (const field of fields) {
        const match = stdout.match(new RegExp(`${field}\\s*(.*)`, 'i'));
        if (match) {
          whoisFields[field.trim().replace(':', '')] = match[1].trim();
        }
      }
      records.push({ type: 'WHOIS', value: whoisFields });
    } catch {
      records.push({ type: 'WHOIS', value: 'WHOIS lookup failed (client not available)' });
    }

    result.results = records;
    result.status = 'completed';
    result.progress = 100;
    result.completedAt = new Date();

    await this.saveScanToDb(scanId, 'dns-whois', target, records);
    this.activeScans.delete(scanId);
    this.scanHistory.push(result);
    this.emit('scan.completed', { scanId });
  }

  /**
   * Start port scan
   */
  async startPortScan(target: string, portRange: string = 'top-1000'): Promise<string> {
    const scanId = `recon-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
    
    const result: ReconResult = {
      scanId,
      tool: 'port-scan',
      target,
      status: 'running',
      progress: 0,
      results: [],
      startedAt: new Date(),
    };

    this.activeScans.set(scanId, result);
    this.emit('scan.started', { scanId, tool: 'port-scan', target });

    this.runPortScan(scanId, target, portRange).catch(err => {
      result.status = 'failed';
      result.error = err.message;
      result.completedAt = new Date();
    });

    return scanId;
  }

  private async runPortScan(scanId: string, target: string, portRange: string): Promise<void> {
    const result = this.activeScans.get(scanId)!;
    const ports: any[] = [];

    this.updateProgress(scanId, 10, 'Starting port scan...');

    // Try nmap first
    try {
      let portArg = '--top-ports 1000';
      if (portRange === 'top-100') portArg = '--top-ports 100';
      else if (portRange === 'top-1000') portArg = '--top-ports 1000';
      else if (portRange.includes('-') || portRange.includes(',')) portArg = `-p ${portRange}`;

      this.updateProgress(scanId, 30, `Running nmap ${portArg}...`);
      
      const { stdout } = await execAsync(
        `nmap -sS -sV --open ${portArg} -T4 --max-retries 2 --max-rtt-timeout 2s ${target} -oG - 2>/dev/null || echo ""`,
        { timeout: 300000 }
      );

      const lines = stdout.split('\n');
      for (const line of lines) {
        if (line.includes('/open/')) {
          const match = line.match(/(\d+)\/open\/(\w+)\/\/\/([^/]*)\/?\/?([^/]*)?/);
          if (match) {
            ports.push({
              port: parseInt(match[1]),
              protocol: match[2],
              state: 'open',
              service: match[3]?.trim() || 'unknown',
              version: match[4]?.trim() || '',
              source: 'nmap',
            });
          }
        }
      }
    } catch {
      // nmap failed, try naabu
      try {
        this.updateProgress(scanId, 50, 'Nmap unavailable, trying naabu...');
        const { stdout } = await execAsync(
          `naabu -host ${target} -silent -json 2>/dev/null || echo ""`,
          { timeout: 60000 }
        );
        const lines = stdout.split('\n').filter(l => l.trim());
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            ports.push({
              port: data.port,
              protocol: 'tcp',
              state: 'open',
              service: data.service || 'unknown',
              source: 'naabu',
            });
          } catch {}
        }
      } catch {
        // Fallback to simple TCP check
        this.updateProgress(scanId, 70, 'Running fallback TCP check...');
        const fallbackPorts = await this.simplePortCheck(target);
        for (const p of fallbackPorts) {
          ports.push({ port: p, protocol: 'tcp', state: 'open', service: 'unknown', source: 'tcp-check' });
        }
      }
    }

    result.results = ports;
    result.status = 'completed';
    result.progress = 100;
    result.completedAt = new Date();

    await this.saveScanToDb(scanId, 'port-scan', target, ports);
    this.activeScans.delete(scanId);
    this.scanHistory.push(result);
    this.emit('scan.completed', { scanId, openPorts: ports.length });
  }

  /**
   * Start HTTP fingerprinting
   */
  async startHttpFingerprint(target: string): Promise<string> {
    const scanId = `recon-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
    
    const result: ReconResult = {
      scanId,
      tool: 'http-fingerprint',
      target,
      status: 'running',
      progress: 0,
      results: [],
      startedAt: new Date(),
    };

    this.activeScans.set(scanId, result);
    this.emit('scan.started', { scanId, tool: 'http-fingerprint', target });

    this.runHttpFingerprint(scanId, target).catch(err => {
      result.status = 'failed';
      result.error = err.message;
      result.completedAt = new Date();
    });

    return scanId;
  }

  private async runHttpFingerprint(scanId: string, target: string): Promise<void> {
    const result = this.activeScans.get(scanId)!;
    const fingerprints: any[] = [];

    // Try httpx
    this.updateProgress(scanId, 20, 'Running httpx fingerprinting...');
    try {
      const { stdout } = await execAsync(
        `httpx -u http://${target} -u https://${target} -silent -status-code -title -tech-detect -content-type -server -json -follow-redirects 2>/dev/null || echo ""`,
        { timeout: 30000 }
      );
      const lines = stdout.split('\n').filter(l => l.trim());
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          fingerprints.push({
            url: data.url,
            statusCode: data.status_code,
            title: data.title,
            technologies: data.tech || [],
            server: data.webserver || data.server || '',
            contentType: data.content_type || '',
            contentLength: data.content_length || 0,
            isHttps: data.url?.startsWith('https') || false,
          });
        } catch {}
      }
    } catch {
      // httpx failed, try curl for headers
      this.updateProgress(scanId, 50, 'httpx unavailable, fetching headers with curl...');
      for (const proto of ['http', 'https']) {
        try {
          const { stdout } = await execAsync(
            `curl -s -I -L --max-time 10 ${proto}://${target} 2>/dev/null || echo ""`,
            { timeout: 15000 }
          );
          const headers: Record<string, string> = {};
          let statusCode = 0;
          const lines = stdout.split('\n');
          for (const line of lines) {
            if (line.startsWith('HTTP/')) {
              const match = line.match(/\s(\d{3})/);
              if (match) statusCode = parseInt(match[1]);
            } else if (line.includes(':')) {
              const colonIdx = line.indexOf(':');
              const key = line.substring(0, colonIdx).trim();
              const value = line.substring(colonIdx + 1).trim();
              if (key) headers[key.toLowerCase()] = value;
            }
          }
          fingerprints.push({
            url: `${proto}://${target}`,
            statusCode,
            headers,
            server: headers['server'] || '',
            contentType: headers['content-type'] || '',
            isHttps: proto === 'https',
          });
        } catch {}
      }
    }

    result.results = fingerprints;
    result.status = 'completed';
    result.progress = 100;
    result.completedAt = new Date();

    await this.saveScanToDb(scanId, 'http-fingerprint', target, fingerprints);
    this.activeScans.delete(scanId);
    this.scanHistory.push(result);
    this.emit('scan.completed', { scanId, fingerprints: fingerprints.length });
  }

  /**
   * Start TLS analysis
   */
  async startTLSAnalysis(target: string): Promise<string> {
    const scanId = `recon-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
    
    const result: ReconResult = {
      scanId,
      tool: 'tls-analysis',
      target,
      status: 'running',
      progress: 0,
      results: [],
      startedAt: new Date(),
    };

    this.activeScans.set(scanId, result);
    this.emit('scan.started', { scanId, tool: 'tls-analysis', target });

    this.runTLSAnalysis(scanId, target).catch(err => {
      result.status = 'failed';
      result.error = err.message;
      result.completedAt = new Date();
    });

    return scanId;
  }

  private async runTLSAnalysis(scanId: string, target: string): Promise<void> {
    const result = this.activeScans.get(scanId)!;
    const analysis: any[] = [];

    this.updateProgress(scanId, 10, 'Connecting to target...');

    // Certificate inspection via openssl
    this.updateProgress(scanId, 30, 'Inspecting SSL/TLS certificate...');
    try {
      const { stdout } = await execAsync(
        `echo | openssl s_client -connect ${target}:443 -servername ${target} 2>/dev/null | openssl x509 -text -noout 2>/dev/null || echo ""`,
        { timeout: 15000 }
      );
      
      const certInfo: Record<string, string> = {};
      
      const subjectMatch = stdout.match(/Subject:\s*(.+)/);
      if (subjectMatch) certInfo.subject = subjectMatch[1].trim();

      const issuerMatch = stdout.match(/Issuer:\s*(.+)/);
      if (issuerMatch) certInfo.issuer = issuerMatch[1].trim();

      const validFrom = stdout.match(/Not Before:\s*(.+)/);
      if (validFrom) certInfo.validFrom = validFrom[1].trim();

      const validTo = stdout.match(/Not After\s*:\s*(.+)/);
      if (validTo) certInfo.validTo = validTo[1].trim();

      const serialMatch = stdout.match(/Serial Number:\s*(.+)/);
      if (serialMatch) certInfo.serialNumber = serialMatch[1].trim();

      const sanMatch = stdout.match(/Subject Alternative Name:\s*(.+?)(?:\n|$)/s);
      if (sanMatch) certInfo.subjectAltNames = sanMatch[1].trim();

      const algoMatch = stdout.match(/Public Key Algorithm:\s*(.+)/);
      if (algoMatch) certInfo.publicKeyAlgorithm = algoMatch[1].trim();

      const sigAlgoMatch = stdout.match(/Signature Algorithm:\s*(.+)/);
      if (sigAlgoMatch) certInfo.signatureAlgorithm = sigAlgoMatch[1].trim();

      analysis.push({ type: 'certificate', data: certInfo });

      // Check for expiration
      if (certInfo.validTo) {
        const expiryDate = new Date(certInfo.validTo);
        const now = new Date();
        const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        analysis.push({ type: 'expiry', daysRemaining: daysUntilExpiry, expires: certInfo.validTo });
      }
    } catch {
      analysis.push({ type: 'certificate', error: 'Failed to retrieve certificate (SSL may not be enabled)' });
    }

    // Protocol versions via nmap
    this.updateProgress(scanId, 60, 'Checking TLS protocol versions...');
    try {
      const { stdout } = await execAsync(
        `nmap --script ssl-enum-ciphers -p 443 ${target} 2>/dev/null || echo ""`,
        { timeout: 60000 }
      );
      
      const protocols = stdout.match(/TLSv[0-9.]+/g);
      if (protocols) {
        const uniqueProtocols = [...new Set(protocols)];
        analysis.push({
          type: 'protocols',
          supported: uniqueProtocols,
          weakProtocols: uniqueProtocols.filter(p => p === 'TLSv1' || p === 'TLSv1.1' || p === 'SSLv3'),
        });
      }
    } catch {}

    result.results = analysis;
    result.status = 'completed';
    result.progress = 100;
    result.completedAt = new Date();

    await this.saveScanToDb(scanId, 'tls-analysis', target, analysis);
    this.activeScans.delete(scanId);
    this.scanHistory.push(result);
    this.emit('scan.completed', { scanId });
  }

  /**
   * Start technology detection
   */
  async startTechDetection(target: string): Promise<string> {
    const scanId = `recon-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
    
    const result: ReconResult = {
      scanId,
      tool: 'tech-detection',
      target,
      status: 'running',
      progress: 0,
      results: [],
      startedAt: new Date(),
    };

    this.activeScans.set(scanId, result);
    this.emit('scan.started', { scanId, tool: 'tech-detection', target });

    this.runTechDetection(scanId, target).catch(err => {
      result.status = 'failed';
      result.error = err.message;
      result.completedAt = new Date();
    });

    return scanId;
  }

  private async runTechDetection(scanId: string, target: string): Promise<void> {
    const result = this.activeScans.get(scanId)!;
    const technologies: any[] = [];

    // Try httpx with tech detection
    this.updateProgress(scanId, 30, 'Running technology detection...');
    try {
      const { stdout } = await execAsync(
        `httpx -u http://${target} -u https://${target} -silent -tech-detect -json 2>/dev/null || echo ""`,
        { timeout: 30000 }
      );
      const lines = stdout.split('\n').filter(l => l.trim());
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.tech && Array.isArray(data.tech)) {
            for (const tech of data.tech) {
              const existing = technologies.find(t => t.name === tech);
              if (!existing) {
                technologies.push({
                  name: tech,
                  url: data.url,
                  confidence: 90,
                  source: 'httpx',
                });
              }
            }
          }
        } catch {}
      }
    } catch {}

    // Header-based detection
    this.updateProgress(scanId, 60, 'Analyzing HTTP headers...');
    try {
      const { stdout } = await execAsync(
        `curl -s -I -L --max-time 10 http://${target} 2>/dev/null || echo ""`,
        { timeout: 15000 }
      );
      
      const headerTechs: Record<string, { name: string, version?: string }> = {
        'server': { name: 'Web Server' },
        'x-powered-by': { name: 'Power' },
        'x-generator': { name: 'CMS' },
        'x-drupal-cache': { name: 'Drupal' },
        'x-wordpress': { name: 'WordPress' },
        'x-vbulletin': { name: 'vBulletin' },
        'x-joomla': { name: 'Joomla' },
        'x-sharepoint': { name: 'SharePoint' },
        'x-aspnet': { name: 'ASP.NET' },
        'x-aspnet-version': { name: 'ASP.NET', version: '' },
        'x-nginx': { name: 'nginx' },
        'x-apache': { name: 'Apache' },
      };

      const lines = stdout.split('\n');
      for (const line of lines) {
        if (line.includes(':')) {
          const colonIdx = line.indexOf(':');
          const key = line.substring(0, colonIdx).trim().toLowerCase();
          const value = line.substring(colonIdx + 1).trim();
          
          if (key === 'server') {
            technologies.push({ name: value.split('/')[0], version: value.includes('/') ? value.split('/')[1] : '', source: 'header', confidence: 95 });
          } else if (key === 'x-powered-by') {
            technologies.push({ name: value.split('/')[0], version: value.includes('/') ? value.split('/')[1] : '', source: 'header', confidence: 90 });
          }
        }
      }
    } catch {}

    result.results = technologies;
    result.status = 'completed';
    result.progress = 100;
    result.completedAt = new Date();

    await this.saveScanToDb(scanId, 'tech-detection', target, technologies);
    this.activeScans.delete(scanId);
    this.scanHistory.push(result);
    this.emit('scan.completed', { scanId, technologies: technologies.length });
  }

  /**
   * Start CVE enrichment
   */
  async startCVEEnrichment(target: string, technologies?: string[]): Promise<string> {
    const scanId = `recon-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
    
    const result: ReconResult = {
      scanId,
      tool: 'cve-enrichment',
      target,
      status: 'running',
      progress: 0,
      results: [],
      startedAt: new Date(),
    };

    this.activeScans.set(scanId, result);
    this.emit('scan.started', { scanId, tool: 'cve-enrichment', target });

    this.runCVEEnrichment(scanId, target, technologies).catch(err => {
      result.status = 'failed';
      result.error = err.message;
      result.completedAt = new Date();
    });

    return scanId;
  }

  private async runCVEEnrichment(scanId: string, target: string, technologies?: string[]): Promise<void> {
    const result = this.activeScans.get(scanId)!;
    const cves: any[] = [];

    // If no technologies provided, run tech detection first
    if (!technologies || technologies.length === 0) {
      this.updateProgress(scanId, 10, 'Detecting technologies first...');
      // Try to get technologies from httpx
      try {
        const { stdout } = await execAsync(
          `httpx -u http://${target} -u https://${target} -silent -tech-detect -json 2>/dev/null || echo ""`,
          { timeout: 20000 }
        );
        const lines = stdout.split('\n').filter(l => l.trim());
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.tech) technologies = data.tech;
          } catch {}
        }
      } catch {}
    }

    // Query CVEs from database for detected technologies
    this.updateProgress(scanId, 40, 'Querying CVE database...');
    if (technologies && technologies.length > 0) {
      for (const tech of technologies) {
        try {
          const dbResult = await this.db.query(
            `SELECT c.id, c.summary, c.severity, c.cvss_score, c.poc_available, c.exploits_in_wild
             FROM gotham.cves c
             JOIN gotham.cve_tech_mappings ctm ON c.id = ctm.cve_id
             WHERE ctm.technology ILIKE $1
             ORDER BY c.cvss_score DESC NULLS LAST
             LIMIT 20`,
            [`%${tech}%`]
          );
          
          for (const row of dbResult.rows) {
            cves.push({
              cveId: row.id,
              summary: row.summary,
              severity: row.severity,
              cvssScore: row.cvss_score,
              pocAvailable: row.poc_available,
              exploitsInWild: row.exploits_in_wild,
              technology: tech,
              source: 'database',
            });
          }
        } catch {}
      }
    }

    // Try nuclei if available
    this.updateProgress(scanId, 70, 'Running nuclei scan...');
    try {
      let nucleiTargets = target;
      // Use nuclei for CVE scanning
      const { stdout } = await execAsync(
        `nuclei -u http://${target} -severity critical,high -silent -json 2>/dev/null || echo ""`,
        { timeout: 120000 }
      );
      const lines = stdout.split('\n').filter(l => l.trim());
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          const existing = cves.find(c => c.cveId === data.info?.name);
          if (!existing) {
            cves.push({
              cveId: data.info?.name || data.templateID,
              summary: data.info?.description || '',
              severity: data.info?.severity || 'unknown',
              cvssScore: data.info?.cvss_score || null,
              matchedTemplate: data.templateID,
              matchedUrl: data.matched || '',
              source: 'nuclei',
            });
          }
        } catch {}
      }
    } catch {}

    result.results = cves;
    result.status = 'completed';
    result.progress = 100;
    result.completedAt = new Date();

    await this.saveScanToDb(scanId, 'cve-enrichment', target, cves);
    this.activeScans.delete(scanId);
    this.scanHistory.push(result);
    this.emit('scan.completed', { scanId, cves: cves.length });
  }

  /**
   * Start web crawler
   */
  async startWebCrawler(target: string): Promise<string> {
    const scanId = `recon-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
    
    const result: ReconResult = {
      scanId,
      tool: 'web-crawler',
      target,
      status: 'running',
      progress: 0,
      results: [],
      startedAt: new Date(),
    };

    this.activeScans.set(scanId, result);
    this.emit('scan.started', { scanId, tool: 'web-crawler', target });

    this.runWebCrawler(scanId, target).catch(err => {
      result.status = 'failed';
      result.error = err.message;
      result.completedAt = new Date();
    });

    return scanId;
  }

  private async runWebCrawler(scanId: string, target: string): Promise<void> {
    const result = this.activeScans.get(scanId)!;
    const endpoints: any[] = [];

    this.updateProgress(scanId, 10, 'Starting web crawl...');

    // Fetch and parse sitemap.xml
    this.updateProgress(scanId, 20, 'Checking sitemap.xml...');
    try {
      const { stdout } = await execAsync(
        `curl -s --max-time 10 http://${target}/sitemap.xml 2>/dev/null || curl -s --max-time 10 https://${target}/sitemap.xml 2>/dev/null || echo ""`,
        { timeout: 15000 }
      );
      const urls = stdout.match(/<loc>(.*?)<\/loc>/g);
      if (urls) {
        for (const url of urls) {
          const cleanUrl = url.replace(/<\/?loc>/g, '');
          endpoints.push({
            url: cleanUrl,
            source: 'sitemap.xml',
            depth: 0,
          });
        }
      }
    } catch {}

    // Fetch robots.txt
    this.updateProgress(scanId, 30, 'Checking robots.txt...');
    try {
      const { stdout } = await execAsync(
        `curl -s --max-time 10 http://${target}/robots.txt 2>/dev/null || curl -s --max-time 10 https://${target}/robots.txt 2>/dev/null || echo ""`,
        { timeout: 15000 }
      );
      const paths = stdout.match(/(?:Allow|Disallow):\s*(\/.*)/g);
      if (paths) {
        for (const path of paths) {
          const cleanPath = path.replace(/^(Allow|Disallow):\s*/, '').trim();
          endpoints.push({
            url: `http://${target}${cleanPath}`,
            source: 'robots.txt',
            rule: path,
          });
        }
      }
    } catch {}

    // Common paths check
    this.updateProgress(scanId, 50, 'Checking common paths...');
    const commonPaths = [
      '/admin', '/login', '/wp-admin', '/api', '/v1', '/v2', '/graphql',
      '/.env', '/.git/config', '/config', '/backup', '/swagger', '/api-docs',
      '/swagger.json', '/openapi.json', '/health', '/status', '/metrics',
      '/.well-known/security.txt', '/sitemap.xml', '/robots.txt',
      '/crossdomain.xml', '/clientaccesspolicy.xml', '/README.md',
      '/phpinfo.php', '/info.php', '/test.php', '/server-status',
      '/console', '/manager', '/panel', '/dashboard', '/assets',
      '/static', '/uploads', '/files', '/download', '/docs', '/documentation',
    ];

    for (const path of commonPaths) {
      try {
        const { stdout } = await execAsync(
          `curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://${target}${path} 2>/dev/null || echo "000"`,
          { timeout: 5000 }
        );
        const statusCode = parseInt(stdout);
        if (statusCode >= 200 && statusCode < 500) {
          endpoints.push({
            url: `http://${target}${path}`,
            source: 'common-paths',
            statusCode,
            depth: 1,
          });
        }
      } catch {}
    }

    result.results = endpoints;
    result.status = 'completed';
    result.progress = 100;
    result.completedAt = new Date();

    await this.saveScanToDb(scanId, 'web-crawler', target, endpoints);
    this.activeScans.delete(scanId);
    this.scanHistory.push(result);
    this.emit('scan.completed', { scanId, endpoints: endpoints.length });
  }

  /**
   * Start API mapper
   */
  async startAPIMapper(target: string): Promise<string> {
    const scanId = `recon-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
    
    const result: ReconResult = {
      scanId,
      tool: 'api-mapper',
      target,
      status: 'running',
      progress: 0,
      results: [],
      startedAt: new Date(),
    };

    this.activeScans.set(scanId, result);
    this.emit('scan.started', { scanId, tool: 'api-mapper', target });

    this.runAPIMapper(scanId, target).catch(err => {
      result.status = 'failed';
      result.error = err.message;
      result.completedAt = new Date();
    });

    return scanId;
  }

  private async runAPIMapper(scanId: string, target: string): Promise<void> {
    const result = this.activeScans.get(scanId)!;
    const apis: any[] = [];

    // Check common API endpoints
    this.updateProgress(scanId, 30, 'Discovering API endpoints...');
    const apiPaths = [
      '/api', '/api/v1', '/api/v2', '/api/v3', '/rest', '/rest/v1',
      '/graphql', '/swagger', '/swagger.json', '/swagger/v1/swagger.json',
      '/api-docs', '/api/swagger.json', '/openapi.json', '/spec.json',
      '/api/spec', '/.well-known/openid-configuration',
      '/api/health', '/api/status', '/api/version',
      '/api/users', '/api/auth', '/api/login', '/api/register',
      '/api/data', '/api/search', '/api/query',
    ];

    for (const path of apiPaths) {
      try {
        const { stdout } = await execAsync(
          `curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://${target}${path} 2>/dev/null || echo "000"`,
          { timeout: 5000 }
        );
        const statusCode = parseInt(stdout);
        if ([200, 201, 204, 301, 302, 400, 401, 403, 405].includes(statusCode)) {
          // Try to get content type
          const { stdout: contentType } = await execAsync(
            `curl -s -I --max-time 3 http://${target}${path} 2>/dev/null | findstr /i "Content-Type:" || echo ""`,
            { timeout: 5000 }
          );
          
          apis.push({
            endpoint: `http://${target}${path}`,
            statusCode,
            contentType: contentType.replace('Content-Type:', '').trim() || 'unknown',
            source: 'discovery',
          });
        }
      } catch {}
    }

    // Try to parse swagger/openapi if found
    this.updateProgress(scanId, 60, 'Parsing API specifications...');
    for (const specPath of ['/swagger.json', '/api-docs', '/openapi.json', '/swagger/v1/swagger.json']) {
      try {
        const { stdout } = await execAsync(
          `curl -s --max-time 5 http://${target}${specPath} 2>/dev/null || echo ""`,
          { timeout: 10000 }
        );
        if (stdout.trim()) {
          try {
            const spec = JSON.parse(stdout);
            const paths = spec.paths || spec.api || {};
            for (const path in paths) {
              for (const method in paths[path]) {
                apis.push({
                  endpoint: path,
                  method: method.toUpperCase(),
                  summary: paths[path][method]?.summary || '',
                  parameters: paths[path][method]?.parameters?.length || 0,
                  source: specPath,
                });
              }
            }
          } catch {}
        }
      } catch {}
    }

    result.results = apis;
    result.status = 'completed';
    result.progress = 100;
    result.completedAt = new Date();

    await this.saveScanToDb(scanId, 'api-mapper', target, apis);
    this.activeScans.delete(scanId);
    this.scanHistory.push(result);
    this.emit('scan.completed', { scanId, apis: apis.length });
  }

  /**
   * Start screenshot capture
   */
  async startScreenshot(target: string): Promise<string> {
    const scanId = `recon-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
    
    const result: ReconResult = {
      scanId,
      tool: 'screenshot',
      target,
      status: 'running',
      progress: 0,
      results: [],
      startedAt: new Date(),
    };

    this.activeScans.set(scanId, result);
    this.emit('scan.started', { scanId, tool: 'screenshot', target });

    this.runScreenshot(scanId, target).catch(err => {
      result.status = 'failed';
      result.error = err.message;
      result.completedAt = new Date();
    });

    return scanId;
  }

  private async runScreenshot(scanId: string, target: string): Promise<void> {
    const result = this.activeScans.get(scanId)!;
    const screenshots: any[] = [];

    this.updateProgress(scanId, 30, 'Taking HTTP screenshot...');
    
    // Use curl to get the page content (as a proxy for screenshot)
    for (const proto of ['http', 'https']) {
      try {
        const { stdout } = await execAsync(
          `curl -s -L --max-time 10 ${proto}://${target} 2>/dev/null || echo ""`,
          { timeout: 15000 }
        );
        
        const titleMatch = stdout.match(/<title[^>]*>([^<]*)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : 'No title';
        const contentLength = stdout.length;
        const bodyStart = stdout.indexOf('<body');
        const hasBody = bodyStart >= 0;

        screenshots.push({
          url: `${proto}://${target}`,
          title,
          contentLength,
          hasBody,
          status: 'captured',
          timestamp: new Date().toISOString(),
        });
      } catch {
        screenshots.push({
          url: `${proto}://${target}`,
          status: 'failed',
          error: 'Could not fetch content',
        });
      }
    }

    result.results = screenshots;
    result.status = 'completed';
    result.progress = 100;
    result.completedAt = new Date();

    await this.saveScanToDb(scanId, 'screenshot', target, screenshots);
    this.activeScans.delete(scanId);
    this.scanHistory.push(result);
    this.emit('scan.completed', { scanId, screenshots: screenshots.length });
  }

  /**
   * Start diff snapshots
   */
  async startDiffSnapshot(target: string): Promise<string> {
    const scanId = `recon-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
    
    const result: ReconResult = {
      scanId,
      tool: 'diff-snapshots',
      target,
      status: 'running',
      progress: 0,
      results: [],
      startedAt: new Date(),
    };

    this.activeScans.set(scanId, result);
    this.emit('scan.started', { scanId, tool: 'diff-snapshots', target });

    this.runDiffSnapshot(scanId, target).catch(err => {
      result.status = 'failed';
      result.error = err.message;
      result.completedAt = new Date();
    });

    return scanId;
  }

  private async runDiffSnapshot(scanId: string, target: string): Promise<void> {
    const result = this.activeScans.get(scanId)!;
    const snapshots: any[] = [];

    // Get current snapshot
    this.updateProgress(scanId, 30, 'Taking current snapshot...');
    let currentContent = '';
    try {
      const { stdout } = await execAsync(
        `curl -s -L --max-time 10 http://${target} 2>/dev/null || echo ""`,
        { timeout: 15000 }
      );
      currentContent = stdout;
    } catch {}

    // Check scan_history.json for previous snapshots
    this.updateProgress(scanId, 60, 'Comparing with previous snapshots...');
    const snapshotDir = path.join(__dirname, '..');
    const snapshotFile = path.join(snapshotDir, 'scan_history.json');
    
    let previousSnapshots: any[] = [];
    if (fs.existsSync(snapshotFile)) {
      try {
        previousSnapshots = JSON.parse(fs.readFileSync(snapshotFile, 'utf-8'));
      } catch {}
    }

    // Compare with previous snapshot
    const previousSnapshot = previousSnapshots.find((s: any) => s.target === target);
    if (previousSnapshot && previousSnapshot.content) {
      // Simple comparison - check if content length changed
      const prevLength = previousSnapshot.content.length;
      const currLength = currentContent.length;
      const changed = prevLength !== currLength;

      snapshots.push({
        target,
        previousSize: prevLength,
        currentSize: currLength,
        changed,
        difference: currLength - prevLength,
        previousDate: previousSnapshot.date,
        currentDate: new Date().toISOString(),
      });

      if (changed) {
        snapshots.push({
          type: 'content_changed',
          detail: `Content size changed from ${prevLength} to ${currLength} bytes (${currLength - prevLength > 0 ? '+' : ''}${currLength - prevLength} bytes)`,
        });
      }
    } else {
      snapshots.push({
        target,
        currentSize: currentContent.length,
        previousSnapshots: 0,
        message: 'Initial snapshot - no previous data to compare',
        date: new Date().toISOString(),
      });
    }

    // Save current snapshot
    try {
      // Remove old entry for this target and add new one
      const filtered = previousSnapshots.filter((s: any) => s.target !== target);
      filtered.push({
        target,
        content: currentContent.substring(0, 100000), // Store first 100KB
        date: new Date().toISOString(),
      });
      // Keep only last 5 snapshots per target and trim history
      const trimmed = filtered.slice(-100);
      fs.writeFileSync(snapshotFile, JSON.stringify(trimmed, null, 2));
    } catch {}

    result.results = snapshots;
    result.status = 'completed';
    result.progress = 100;
    result.completedAt = new Date();

    await this.saveScanToDb(scanId, 'diff-snapshots', target, snapshots);
    this.activeScans.delete(scanId);
    this.scanHistory.push(result);
    this.emit('scan.completed', { scanId, snapshots: snapshots.length });
  }

  /**
   * Stop an active scan
   */
  stopScan(scanId: string): boolean {
    const scan = this.activeScans.get(scanId);
    if (!scan) return false;

    scan.status = 'stopped';
    scan.completedAt = new Date();
    this.scanHistory.push(scan);
    this.activeScans.delete(scanId);
    this.emit('scan.stopped', { scanId });
    return true;
  }

  // ==================== Utility Methods ====================

  private updateProgress(scanId: string, progress: number, message?: string): void {
    const scan = this.activeScans.get(scanId);
    if (scan) {
      scan.progress = progress;
      if (message) {
        this.emit('progress', { scanId, progress, message });
      }
    }
  }

  private async resolveHostname(hostname: string): Promise<string[]> {
    try {
      const addresses = await dnsResolve4(hostname);
      return addresses;
    } catch {
      try {
        const addresses = await dnsResolve6(hostname);
        return addresses;
      } catch {
        return [];
      }
    }
  }

  private async basicDNSEnumeration(domain: string): Promise<string[]> {
    const commonSubdomains = [
      'www', 'mail', 'ftp', 'admin', 'api', 'blog', 'shop', 'dev', 'test',
      'staging', 'app', 'portal', 'webmail', 'remote', 'vpn', 'ns1', 'ns2',
      'mx', 'smtp', 'pop', 'imap', 'cPanel', 'webdisk', 'whm', 'autodiscover',
      'autoconfig', 'm', 'mobile', 'sip', 'xmpp', 'chat', 'video', 'media',
      'cdn', 'static', 'assets', 'docs', 'doc', 'support', 'help', 'kb',
      'wiki', 'forum', 'community', 'news', 'status', 'health', 'monitor',
      'grafana', 'prometheus', 'kibana', 'elasticsearch', 'jenkins', 'gitlab',
      'jira', 'confluence', 'nexus', 'artifactory', 'docker', 'registry',
      'k8s', 'kubernetes', 'rancher', 'openshift', 'consul', 'vault',
      'ansible', 'puppet', 'chef', 'slack', 'discord', 'teams', 'zoom',
      'meet', 'webex', 'mattermost', 'rocket', 'zulip', 'keybase', 'matrix',
      'element', 'signal', 'github', 'git', 'svn', 'cvs', 'hg', 'mercurial',
      'travis', 'ci', 'cd', 'build', 'deploy', 'release', 'artifact',
      'package', 'npm', 'pypi', 'maven', 'gradle', 'nuget', 'chocolatey',
      'calendar', 'jobs', 'careers', 'about', 'contact', 'info', 'legal',
      'privacy', 'terms', 'phpmyadmin', 'pma', 'adminer', 'pgadmin',
    ];

    const found: string[] = [];
    
    for (const sub of commonSubdomains) {
      const subdomain = `${sub}.${domain}`;
      try {
        await dnsResolve4(subdomain);
        found.push(subdomain);
      } catch {
        // Subdomain doesn't exist
      }
    }

    return found;
  }

  private async simplePortCheck(host: string): Promise<number[]> {
    const commonPorts = [80, 443, 21, 22, 25, 53, 110, 143, 3306, 3389, 5432, 8080, 8443, 9200, 27017];
    const openPorts: number[] = [];

    for (const port of commonPorts) {
      try {
        const cmd = process.platform === 'win32'
          ? `powershell -Command "$t = New-Object Net.Sockets.TcpClient; try { $t.Connect('${host}', ${port}); 'open' } catch { 'closed' } finally { $t.Close() }"`
          : `timeout 2 bash -c "</dev/tcp/${host}/${port} && echo open || echo closed" 2>/dev/null`;
        
        const { stdout } = await execAsync(cmd, { timeout: 4000 });
        if (stdout.includes('open')) {
          openPorts.push(port);
        }
      } catch {}
    }

    return openPorts;
  }

  private async saveScanToDb(scanId: string, tool: string, target: string, results: any[]): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO gotham.scans (id, target, scan_type, status, results, completed_at)
         VALUES ($1, $2, $3, 'completed', $4::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET
           status = 'completed',
           results = $4::jsonb,
           completed_at = CURRENT_TIMESTAMP`,
        [scanId, target, tool, JSON.stringify(results)]
      );
    } catch (err) {
      console.error(`Failed to save scan ${scanId} to database:`, err);
    }
  }
}

export default ReconEngine;