/**
 * Reconnaissance Module
 * Handles subdomain discovery and port scanning
 */

import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  ScanConfig,
  ScanTarget,
  Subdomain,
  PortScanResult,
  ReconResult,
  SubdomainDiscoveryConfig,
  PortScanConfig,
  ScannerError,
  ToolNotFoundError,
} from '../types';

const execAsync = promisify(exec);

export class ReconModule extends EventEmitter {
  private cancelled = false;

  cancel(): void {
    this.cancelled = true;
  }

  reset(): void {
    this.cancelled = false;
  }

  /**
   * Discover subdomains for a target
   */
  async discoverSubdomains(
    target: ScanTarget,
    config: ScanConfig
  ): Promise<Subdomain[]> {
    this.reset();
    const subdomains: Subdomain[] = [];
    const domain = target.domain;

    if (!domain) {
      return subdomains;
    }

    this.emit('progress', { phase: 'recon.subdomains', message: `Discovering subdomains for ${domain}` });

    try {
      // Try subfinder first
      const subfinderResults = await this.runSubfinder(domain);
      subdomains.push(...subfinderResults.map((sub) => ({
        targetId: target.id!,
        subdomain: sub,
        isAlive: false,
        source: 'subfinder',
        discoveredAt: new Date(),
      })));

      // Try DNS brute force with common subdomains
      const bruteResults = await this.bruteForceSubdomains(domain);
      for (const sub of bruteResults) {
        if (!subdomains.find((s) => s.subdomain === sub)) {
          subdomains.push({
            targetId: target.id!,
            subdomain: sub,
            isAlive: true,
            source: 'brute',
            discoveredAt: new Date(),
          });
        }
      }

      // Check which subdomains are alive
      for (const sub of subdomains) {
        if (this.cancelled) break;
        sub.isAlive = await this.isHostAlive(sub.subdomain);
      }

      this.emit('progress', { 
        phase: 'recon.subdomains', 
        message: `Found ${subdomains.length} subdomains (${subdomains.filter(s => s.isAlive).length} alive)` 
      });

      return subdomains;
    } catch (error) {
      console.error('Subdomain discovery failed:', error);
      return subdomains;
    }
  }

  /**
   * Run port scans on discovered hosts
   */
  async scanPorts(
    hosts: string[],
    config: ScanConfig
  ): Promise<PortScanResult[]> {
    this.reset();
    const ports: PortScanResult[] = [];
    
    const portRange = config.options?.portRange || 'top-1000';
    
    this.emit('progress', { 
      phase: 'recon.ports', 
      message: `Scanning ${hosts.length} hosts for open ports` 
    });

    for (const host of hosts) {
      if (this.cancelled) break;

      try {
        // Use nmap for port scanning
        const nmapResults = await this.runNmap(host, portRange);
        ports.push(...nmapResults);

        this.emit('progress', { 
          phase: 'recon.ports', 
          message: `Scanned ${host}: ${nmapResults.filter(p => p.state === 'open').length} open ports` 
        });
      } catch (error) {
        console.error(`Port scan failed for ${host}:`, error);
      }
    }

    return ports;
  }

  /**
   * Run subfinder tool
   */
  private async runSubfinder(domain: string): Promise<string[]> {
    try {
      const { stdout } = await execAsync(`subfinder -d ${domain} -silent 2>/dev/null || echo ""`, {
        timeout: 120000, // 2 minutes
      });
      
      return stdout
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && line.includes('.'));
    } catch {
      // Fallback to basic DNS enumeration
      return this.basicDNSEnumeration(domain);
    }
  }

  /**
   * Basic DNS enumeration as fallback
   */
  private async basicDNSEnumeration(domain: string): Promise<string[]> {
    const commonSubdomains = [
      'www', 'mail', 'ftp', 'admin', 'api', 'blog', 'shop', 'dev', 'test',
      'staging', 'app', 'portal', 'webmail', 'remote', 'vpn', 'ns1', 'ns2',
      'mx', 'smtp', 'pop', 'imap', 'cPanel', 'webdisk', 'whm', 'autodiscover',
      'autoconfig', 'm', 'mobile', 'sip', 'xmpp', 'chat', 'video', 'media',
      'cdn', 'static', 'assets', 'img', 'images', 'css', 'js', 'files',
      'download', 'downloads', 'docs', 'doc', 'support', 'help', 'kb',
      'wiki', 'forum', 'community', 'news', 'events', 'calendar', 'jobs',
      'careers', 'about', 'contact', 'info', 'legal', 'privacy', 'terms',
      'status', 'health', 'monitor', 'grafana', 'prometheus', 'kibana',
      'elasticsearch', 'elastic', 'logstash', 'kafka', 'redis', 'mysql',
      'postgres', 'mongodb', 'mongo', 'db', 'database', 'sql', 'phpmyadmin',
      'pma', 'adminer', 'pgadmin', 'jenkins', 'gitlab', 'github', 'bitbucket',
      'jira', 'confluence', 'wiki', 'bamboo', 'fisheye', 'crucible',
      'nexus', 'artifactory', 'docker', 'registry', 'k8s', 'kubernetes',
      'rancher', 'openshift', 'consul', 'vault', 'nomad', 'terraform',
      'ansible', 'puppet', 'chef', 'salt', 'github', 'raw', 'gist',
      'git', 'svn', 'cvs', 'hg', 'mercurial', 'bazaar', 'launchpad',
      'travis', 'ci', 'cd', 'build', 'deploy', 'release', 'artifact',
      'package', 'npm', 'pypi', 'maven', 'gradle', 'nuget', 'chocolatey',
      'brew', 'apt', 'yum', 'dnf', 'pacman', 'zypper', 'apk', 'portage',
      'slack', 'discord', 'teams', 'zoom', 'meet', 'webex', 'gotomeeting',
      'skype', 'lync', 'sip', 'xmpp', 'irc', 'mattermost', 'rocket',
      'zulip', 'keybase', 'matrix', 'riot', 'element', 'signal',
    ];

    const found: string[] = [];
    
    for (const sub of commonSubdomains) {
      if (this.cancelled) break;
      
      const subdomain = `${sub}.${domain}`;
      try {
        await execAsync(`nslookup ${subdomain} 2>/dev/null || dig +short ${subdomain} 2>/dev/null || ping -c 1 ${subdomain} 2>/dev/null`, {
          timeout: 5000,
        });
        found.push(subdomain);
      } catch {
        // Subdomain doesn't exist
      }
    }

    return found;
  }

  /**
   * Brute force subdomains with wordlist
   */
  private async bruteForceSubdomains(domain: string): Promise<string[]> {
    // Simplified brute force - in production, use a comprehensive wordlist
    return this.basicDNSEnumeration(domain);
  }

  /**
   * Check if host is alive (responds to ping or HTTP)
   */
  private async isHostAlive(host: string): Promise<boolean> {
    try {
      // Try ping first
      await execAsync(`ping -n 1 -w 3000 ${host} 2>nul || ping -c 1 -W 3 ${host} 2>/dev/null`, {
        timeout: 5000,
      });
      return true;
    } catch {
      // Fallback to HTTP check
      try {
        await execAsync(`curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://${host} 2>/dev/null || powershell -Command "try { (Invoke-WebRequest -Uri 'http://${host}' -TimeoutSec 5 -UseBasicParsing).StatusCode } catch { }"`, {
          timeout: 10000,
        });
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Run nmap port scan
   */
  private async runNmap(
    host: string,
    portRange: string
  ): Promise<PortScanResult[]> {
    const ports: PortScanResult[] = [];
    
    try {
      let portArg = '';
      if (portRange === 'top-100') {
        portArg = '--top-ports 100';
      } else if (portRange === 'top-1000') {
        portArg = '--top-ports 1000';
      } else if (portRange.includes('-')) {
        portArg = `-p ${portRange}`;
      } else {
        portArg = `--top-ports 1000`;
      }

      const { stdout } = await execAsync(
        `nmap -sS -sV -O --open ${portArg} -T4 --max-retries 2 --max-rtt-timeout 2s ${host} -oX - 2>/dev/null || echo ""`,
        { timeout: 300000 } // 5 minutes
      );

      // Parse nmap XML output
      if (stdout.includes('<port ')) {
        const portRegex = /<port protocol="(\w+)" portid="(\d+)">.*?<state state="(\w+)".*?\/>.*?(<service name="([^"]*)".*?version="([^"]*)".*?\/>)?/gs;
        let match;
        
        while ((match = portRegex.exec(stdout)) !== null) {
          ports.push({
            targetId: '', // Will be set by caller
            port: parseInt(match[2], 10),
            protocol: match[1] as 'tcp' | 'udp',
            state: match[3] as 'open' | 'closed' | 'filtered',
            service: match[5] || undefined,
            version: match[6] || undefined,
            scannedAt: new Date(),
          });
        }
      }

      // If nmap failed or no results, try simpler port check
      if (ports.length === 0) {
        return this.simplePortCheck(host);
      }

      return ports;
    } catch {
      return this.simplePortCheck(host);
    }
  }

  /**
   * Simple TCP port check as fallback
   */
  private async simplePortCheck(host: string): Promise<PortScanResult[]> {
    const commonPorts = [80, 443, 21, 22, 25, 53, 110, 143, 3306, 3389, 5432, 8080, 8443];
    const ports: PortScanResult[] = [];

    for (const port of commonPorts) {
      if (this.cancelled) break;
      
      try {
        // Try to connect using bash or PowerShell
        const cmd = process.platform === 'win32'
          ? `powershell -Command "$t = New-Object Net.Sockets.TcpClient; try { $t.Connect('${host}', ${port}); 'open' } catch { 'closed' } finally { $t.Close() }"`
          : `timeout 3 bash -c "</dev/tcp/${host}/${port} && echo open || echo closed" 2>/dev/null`;
        
        const { stdout } = await execAsync(cmd, { timeout: 5000 });
        
        if (stdout.includes('open')) {
          ports.push({
            targetId: '',
            port,
            protocol: 'tcp',
            state: 'open',
            scannedAt: new Date(),
          });
        }
      } catch {
        // Port is closed or filtered
      }
    }

    return ports;
  }
}

export default ReconModule;
