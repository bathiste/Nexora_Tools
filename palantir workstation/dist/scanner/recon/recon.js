"use strict";
/**
 * Reconnaissance Module
 * Handles subdomain discovery and port scanning
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReconModule = void 0;
const events_1 = require("events");
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class ReconModule extends events_1.EventEmitter {
    constructor() {
        super(...arguments);
        this.cancelled = false;
    }
    cancel() {
        this.cancelled = true;
    }
    reset() {
        this.cancelled = false;
    }
    /**
     * Discover subdomains for a target
     */
    async discoverSubdomains(target, config) {
        this.reset();
        const subdomains = [];
        const domain = target.domain;
        if (!domain) {
            return subdomains;
        }
        this.emit('progress', { phase: 'recon.subdomains', message: `Discovering subdomains for ${domain}` });
        try {
            // Try subfinder first
            const subfinderResults = await this.runSubfinder(domain);
            subdomains.push(...subfinderResults.map((sub) => ({
                targetId: target.id,
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
                        targetId: target.id,
                        subdomain: sub,
                        isAlive: true,
                        source: 'brute',
                        discoveredAt: new Date(),
                    });
                }
            }
            // Check which subdomains are alive
            for (const sub of subdomains) {
                if (this.cancelled)
                    break;
                sub.isAlive = await this.isHostAlive(sub.subdomain);
            }
            this.emit('progress', {
                phase: 'recon.subdomains',
                message: `Found ${subdomains.length} subdomains (${subdomains.filter(s => s.isAlive).length} alive)`
            });
            return subdomains;
        }
        catch (error) {
            console.error('Subdomain discovery failed:', error);
            return subdomains;
        }
    }
    /**
     * Run port scans on discovered hosts
     */
    async scanPorts(hosts, config) {
        this.reset();
        const ports = [];
        const portRange = config.options?.portRange || 'top-1000';
        this.emit('progress', {
            phase: 'recon.ports',
            message: `Scanning ${hosts.length} hosts for open ports`
        });
        for (const host of hosts) {
            if (this.cancelled)
                break;
            try {
                // Use nmap for port scanning
                const nmapResults = await this.runNmap(host, portRange);
                ports.push(...nmapResults);
                this.emit('progress', {
                    phase: 'recon.ports',
                    message: `Scanned ${host}: ${nmapResults.filter(p => p.state === 'open').length} open ports`
                });
            }
            catch (error) {
                console.error(`Port scan failed for ${host}:`, error);
            }
        }
        return ports;
    }
    /**
     * Run subfinder tool
     */
    async runSubfinder(domain) {
        try {
            const { stdout } = await execAsync(`subfinder -d ${domain} -silent 2>/dev/null || echo ""`, {
                timeout: 120000, // 2 minutes
            });
            return stdout
                .split('\n')
                .map((line) => line.trim())
                .filter((line) => line && line.includes('.'));
        }
        catch {
            // Fallback to basic DNS enumeration
            return this.basicDNSEnumeration(domain);
        }
    }
    /**
     * Basic DNS enumeration as fallback
     */
    async basicDNSEnumeration(domain) {
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
        const found = [];
        for (const sub of commonSubdomains) {
            if (this.cancelled)
                break;
            const subdomain = `${sub}.${domain}`;
            try {
                await execAsync(`nslookup ${subdomain} 2>/dev/null || dig +short ${subdomain} 2>/dev/null || ping -c 1 ${subdomain} 2>/dev/null`, {
                    timeout: 5000,
                });
                found.push(subdomain);
            }
            catch {
                // Subdomain doesn't exist
            }
        }
        return found;
    }
    /**
     * Brute force subdomains with wordlist
     */
    async bruteForceSubdomains(domain) {
        // Simplified brute force - in production, use a comprehensive wordlist
        return this.basicDNSEnumeration(domain);
    }
    /**
     * Check if host is alive (responds to ping or HTTP)
     */
    async isHostAlive(host) {
        try {
            // Try ping first
            await execAsync(`ping -n 1 -w 3000 ${host} 2>nul || ping -c 1 -W 3 ${host} 2>/dev/null`, {
                timeout: 5000,
            });
            return true;
        }
        catch {
            // Fallback to HTTP check
            try {
                await execAsync(`curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://${host} 2>/dev/null || powershell -Command "try { (Invoke-WebRequest -Uri 'http://${host}' -TimeoutSec 5 -UseBasicParsing).StatusCode } catch { }"`, {
                    timeout: 10000,
                });
                return true;
            }
            catch {
                return false;
            }
        }
    }
    /**
     * Run nmap port scan
     */
    async runNmap(host, portRange) {
        const ports = [];
        try {
            let portArg = '';
            if (portRange === 'top-100') {
                portArg = '--top-ports 100';
            }
            else if (portRange === 'top-1000') {
                portArg = '--top-ports 1000';
            }
            else if (portRange.includes('-')) {
                portArg = `-p ${portRange}`;
            }
            else {
                portArg = `--top-ports 1000`;
            }
            const { stdout } = await execAsync(`nmap -sS -sV -O --open ${portArg} -T4 --max-retries 2 --max-rtt-timeout 2s ${host} -oX - 2>/dev/null || echo ""`, { timeout: 300000 } // 5 minutes
            );
            // Parse nmap XML output
            if (stdout.includes('<port ')) {
                const portRegex = /<port protocol="(\w+)" portid="(\d+)">.*?<state state="(\w+)".*?\/>.*?(<service name="([^"]*)".*?version="([^"]*)".*?\/>)?/gs;
                let match;
                while ((match = portRegex.exec(stdout)) !== null) {
                    ports.push({
                        targetId: '', // Will be set by caller
                        port: parseInt(match[2], 10),
                        protocol: match[1],
                        state: match[3],
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
        }
        catch {
            return this.simplePortCheck(host);
        }
    }
    /**
     * Simple TCP port check as fallback
     */
    async simplePortCheck(host) {
        const commonPorts = [80, 443, 21, 22, 25, 53, 110, 143, 3306, 3389, 5432, 8080, 8443];
        const ports = [];
        for (const port of commonPorts) {
            if (this.cancelled)
                break;
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
            }
            catch {
                // Port is closed or filtered
            }
        }
        return ports;
    }
}
exports.ReconModule = ReconModule;
exports.default = ReconModule;
