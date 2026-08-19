/**
 * CVE Scanner Pipeline
 * Orchestrates the full scanning workflow from recon to reporting
 */

import { EventEmitter } from 'events';
import { Pool } from 'pg';
import {
  ScanConfig,
  ScanProgress,
  PipelineContext,
  ScanEvent,
  ScanEventType,
  ScanResult,
  ScannerError,
  ScanCancelledError,
  ScanTarget,
} from './types';
import { ReconModule } from './recon/recon';
import { FingerprintModule } from './fingerprint/fingerprint';
import { CVEMatcher } from './matcher/cveMatcher';
import { PoCMapper } from './poc_mapper/pocMapper';

export class ScannerPipeline extends EventEmitter {
  private db: Pool;
  private activeScans: Map<string, boolean> = new Map();
  private recon: ReconModule;
  private fingerprint: FingerprintModule;
  private cveMatcher: CVEMatcher;
  private pocMapper: PoCMapper;

  constructor(db: Pool) {
    super();
    this.db = db;
    this.recon = new ReconModule();
    this.fingerprint = new FingerprintModule();
    this.cveMatcher = new CVEMatcher(db);
    this.pocMapper = new PoCMapper();

    // Forward events from modules
    this.setupEventForwarding();
  }

  private setupEventForwarding() {
    [this.recon, this.fingerprint, this.cveMatcher, this.pocMapper].forEach(
      (module) => {
        module.on('progress', (data: any) => this.emit('progress', data));
        module.on('finding', (data: any) => this.emit('finding', data));
        module.on('error', (data: any) => this.emit('error', data));
      }
    );
  }

  /**
   * Execute a full scan pipeline
   */
  async execute(scanId: string, config: ScanConfig): Promise<void> {
    const target = await this.getTarget(config.targetId);
    if (!target) {
      throw new ScannerError(`Target ${config.targetId} not found`, 'TARGET_NOT_FOUND');
    }

    this.activeScans.set(scanId, true);

    const context: PipelineContext = {
      scanId,
      target,
      config,
      results: {},
      metadata: new Map(),
    };

    try {
      await this.updateScanStatus(scanId, 'running', 'Initializing scan');
      this.emitEvent('scan.started', scanId, { target: target.name });

      // Phase 1: Subdomain Discovery
      if (config.options?.subdomainDiscovery !== false) {
        await this.runPhase(scanId, 'recon.subdomains', context, async () => {
          context.results.subdomains = await this.recon.discoverSubdomains(target, config);
          if (context.results.subdomains && context.results.subdomains.length > 0) {
            await this.saveSubdomains(context.results.subdomains);
          }
        });
      }

      // Phase 2: Port Scanning
      if (config.options?.portScan !== false) {
        await this.runPhase(scanId, 'recon.ports', context, async () => {
          const hosts = this.getHostsForScanning(context);
          context.results.ports = await this.recon.scanPorts(hosts, config);
          if (context.results.ports && context.results.ports.length > 0) {
            await this.savePortScans(context.results.ports);
          }
        });
      }

      // Phase 3: HTTP Fingerprinting
      if (config.options?.httpFingerprint !== false) {
        await this.runPhase(scanId, 'fingerprint.http', context, async () => {
          const webHosts = this.getWebHosts(context);
          context.results.fingerprints = await this.fingerprint.scanHttp(webHosts, config);
          if (context.results.fingerprints && context.results.fingerprints.length > 0) {
            await this.saveFingerprints(context.results.fingerprints);
          }
        });
      }

      // Phase 4: CVE Matching
      if (config.options?.cveMatching?.enabled !== false) {
        await this.runPhase(scanId, 'matcher.cve', context, async () => {
          const technologies = this.extractTechnologies(context);
          context.results.cves = await this.cveMatcher.match(context.scanId, technologies, config);
          if (context.results.cves && context.results.cves.length > 0) {
            await this.saveScanResults(context.results.cves);
          }
        });
      }

      // Phase 5: PoC Mapping
      if (config.options?.pocMapping !== false) {
        await this.runPhase(scanId, 'poc.mapping', context, async () => {
          const cveIds = (context.results.cves?.map((r) => r.cveId).filter((id): id is string => !!id)) || [];
          context.results.pocs = await this.pocMapper.map(cveIds);
        });
      }

      // Phase 6: Nuclei Verification (if enabled)
      if (config.options?.nucleiScan) {
        await this.runPhase(scanId, 'nuclei.scan', context, async () => {
          await this.runNucleiScan(context);
        });
      }

      await this.updateScanStatus(scanId, 'completed', 'Scan completed successfully');
      this.emitEvent('scan.completed', scanId, { 
        stats: this.generateStats(context),
        phases: Object.keys(context.results),
      });

    } catch (error) {
      if (error instanceof ScanCancelledError) {
        await this.updateScanStatus(scanId, 'cancelled', 'Scan was cancelled');
        this.emitEvent('scan.cancelled', scanId, {});
      } else {
        const message = error instanceof Error ? error.message : 'Unknown error';
        await this.updateScanStatus(scanId, 'failed', message);
        this.emitEvent('scan.failed', scanId, { error: message });
        throw error;
      }
    } finally {
      this.activeScans.delete(scanId);
    }
  }

  /**
   * Cancel an active scan
   */
  cancel(scanId: string): void {
    if (this.activeScans.has(scanId)) {
      this.activeScans.set(scanId, false);
      this.recon.cancel();
      this.fingerprint.cancel();
      this.cveMatcher.cancel();
      this.pocMapper.cancel();
    }
  }

  /**
   * Check if scan is still active
   */
  private isActive(scanId: string): boolean {
    return !!this.activeScans.get(scanId);
  }

  /**
   * Run a pipeline phase with error handling
   */
  private async runPhase(
    scanId: string,
    phase: string,
    context: PipelineContext,
    fn: () => Promise<void>
  ): Promise<void> {
    if (!this.isActive(scanId)) {
      throw new ScanCancelledError(scanId);
    }

    this.emitEvent('scan.phase.started', scanId, { phase });
    await this.updateScanStatus(scanId, 'running', `Running: ${phase}`);

    try {
      await fn();
      this.emitEvent('scan.phase.completed', scanId, { phase });
    } catch (error) {
      console.error(`Phase ${phase} failed:`, error);
      // Continue with other phases even if one fails
    }
  }

  /**
   * Get target details from database
   */
  private async getTarget(targetId: string): Promise<ScanTarget | null> {
    const result = await this.db.query(
      'SELECT * FROM gotham.targets WHERE id = $1',
      [targetId]
    );
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      domain: row.domain,
      ipAddress: row.ip_address,
      description: row.description,
      tags: row.tags,
      metadata: row.metadata,
    };
  }

  /**
   * Update scan status in database
   */
  private async updateScanStatus(
    scanId: string,
    status: string,
    message?: string
  ): Promise<void> {
    const updates: string[] = ['status = $2'];
    const params: any[] = [scanId, status];
    let paramIndex = 3;

    if (status === 'running' && message) {
      updates.push(`started_at = COALESCE(started_at, CURRENT_TIMESTAMP)`);
    }
    
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      updates.push(`completed_at = CURRENT_TIMESTAMP`);
    }

    if (message) {
      updates.push(`results = COALESCE(results, '{}'::jsonb) || $${paramIndex}::jsonb`);
      params.push(JSON.stringify({ lastMessage: message, timestamp: new Date().toISOString() }));
    }

    await this.db.query(
      `UPDATE gotham.scans SET ${updates.join(', ')} WHERE id = $1`,
      params
    );
  }

  /**
   * Get list of hosts to scan (target + subdomains)
   */
  private getHostsForScanning(context: PipelineContext): string[] {
    const hosts: string[] = [];
    
    if (context.target.domain) {
      hosts.push(context.target.domain);
    }
    if (context.target.ipAddress) {
      hosts.push(context.target.ipAddress);
    }

    if (context.results.subdomains) {
      hosts.push(...context.results.subdomains.map((s) => s.subdomain));
    }

    return [...new Set(hosts)];
  }

  /**
   * Get web hosts (those with open HTTP/HTTPS ports)
   */
  private getWebHosts(context: PipelineContext): Array<{ host: string; port: number; https: boolean }> {
    const webPorts = [80, 443, 8080, 8443, 3000, 8000, 8008, 8888, 9000];
    const hosts: Array<{ host: string; port: number; https: boolean }> = [];

    // Add from port scan results
    if (context.results.ports) {
      for (const port of context.results.ports) {
        if (port.state === 'open' && webPorts.includes(port.port)) {
          // Find the subdomain or target this port belongs to
          const subdomain = context.results.subdomains?.find((s) => s.id === port.subdomainId);
          const host = subdomain?.subdomain || context.target.domain || context.target.ipAddress;
          
          if (host) {
            hosts.push({
              host,
              port: port.port,
              https: port.port === 443 || port.port === 8443 || (port.service?.includes('https') ?? false),
            });
          }
        }
      }
    }

    // If no port scan, add default web ports for all hosts
    if (hosts.length === 0) {
      const allHosts = this.getHostsForScanning(context);
      for (const host of allHosts) {
        hosts.push({ host, port: 80, https: false });
        hosts.push({ host, port: 443, https: true });
      }
    }

    return hosts;
  }

  /**
   * Extract all detected technologies from fingerprints
   */
  private extractTechnologies(context: PipelineContext): Array<{
    name: string;
    version?: string;
    host: string;
    port?: number;
  }> {
    const techs: Array<{ name: string; version?: string; host: string; port?: number }> = [];

    if (context.results.fingerprints) {
      for (const fp of context.results.fingerprints) {
        if (fp.technologies) {
          for (const tech of fp.technologies) {
            techs.push({
              name: tech.name,
              version: tech.version,
              host: fp.url,
              port: fp.isHttps ? 443 : 80,
            });
          }
        }

        // Add server from headers if present
        if (fp.server) {
          techs.push({
            name: fp.server.split('/')[0],
            version: fp.server.includes('/') ? fp.server.split('/')[1] : undefined,
            host: fp.url,
            port: fp.isHttps ? 443 : 80,
          });
        }
      }
    }

    // Add from port scan service detection
    if (context.results.ports) {
      for (const port of context.results.ports) {
        if (port.service && port.state === 'open') {
          const host = context.results.subdomains?.find((s) => s.id === port.subdomainId)?.subdomain ||
                       context.target.domain ||
                       context.target.ipAddress;
          
          if (host) {
            techs.push({
              name: port.service,
              version: port.version,
              host,
              port: port.port,
            });
          }
        }
      }
    }

    return techs;
  }

  /**
   * Save discovered subdomains to database
   */
  private async saveSubdomains(subdomains: any[]): Promise<void> {
    for (const sub of subdomains) {
      await this.db.query(
        `INSERT INTO gotham.subdomains (target_id, subdomain, ip_address, is_alive, source)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (target_id, subdomain) DO UPDATE SET
           ip_address = EXCLUDED.ip_address,
           is_alive = EXCLUDED.is_alive`,
        [sub.targetId, sub.subdomain, sub.ipAddress, sub.isAlive, sub.source]
      );
    }
  }

  /**
   * Save port scan results to database
   */
  private async savePortScans(ports: any[]): Promise<void> {
    for (const port of ports) {
      await this.db.query(
        `INSERT INTO gotham.port_scans 
         (target_id, subdomain_id, port, protocol, state, service, version, banner)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          port.targetId,
          port.subdomainId,
          port.port,
          port.protocol,
          port.state,
          port.service,
          port.version,
          port.banner,
        ]
      );
    }
  }

  /**
   * Save HTTP fingerprints to database
   */
  private async saveFingerprints(fingerprints: any[]): Promise<void> {
    for (const fp of fingerprints) {
      await this.db.query(
        `INSERT INTO gotham.http_fingerprints 
         (target_id, subdomain_id, url, status_code, title, headers, technologies, 
          server, content_type, content_length, redirects_to, is_https, has_waf, waf_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          fp.targetId,
          fp.subdomainId,
          fp.url,
          fp.statusCode,
          fp.title,
          JSON.stringify(fp.headers),
          JSON.stringify(fp.technologies),
          fp.server,
          fp.contentType,
          fp.contentLength,
          fp.redirectsTo,
          fp.isHttps,
          fp.hasWaf,
          fp.wafName,
        ]
      );
    }
  }

  /**
   * Save CVE scan results to database
   */
  private async saveScanResults(results: ScanResult[]): Promise<void> {
    for (const result of results) {
      await this.db.query(
        `INSERT INTO gotham.scan_results 
         (scan_id, target_id, subdomain_id, cve_id, severity, confidence, 
          matched_technology, detected_version, poc_available, nuclei_match)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          result.scanId,
          result.targetId,
          result.subdomainId,
          result.cveId,
          result.severity,
          result.confidence,
          result.matchedTechnology,
          result.detectedVersion,
          result.pocAvailable,
          result.nucleiMatch,
        ]
      );
    }
  }

  /**
   * Run Nuclei verification scan
   */
  private async runNucleiScan(context: PipelineContext): Promise<void> {
    // Implementation would call nuclei binary
    // For now, this is a placeholder
    console.log('Nuclei scan would run here with context:', context.scanId);
  }

  /**
   * Generate scan statistics
   */
  private generateStats(context: PipelineContext): any {
    return {
      subdomainsFound: context.results.subdomains?.length || 0,
      openPorts: context.results.ports?.filter((p) => p.state === 'open').length || 0,
      webServices: context.results.fingerprints?.length || 0,
      cvesFound: context.results.cves?.length || 0,
      withPoc: context.results.cves?.filter((c) => c.pocAvailable).length || 0,
    };
  }

  /**
   * Emit scan event
   */
  private emitEvent(type: ScanEventType, scanId: string, data: any): void {
    const event: ScanEvent = {
      type,
      scanId,
      timestamp: new Date(),
      data,
    };
    this.emit('event', event);
  }

  /**
   * Get scan progress
   */
  async getProgress(scanId: string): Promise<ScanProgress | null> {
    const result = await this.db.query(
      'SELECT * FROM gotham.scans WHERE id = $1',
      [scanId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      scanId: row.id,
      status: row.status,
      phase: row.results?.lastMessage || 'Unknown',
      progress: row.status === 'completed' ? 100 : row.status === 'running' ? 50 : 0,
      totalTasks: 0,
      completedTasks: 0,
      message: row.results?.lastMessage,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      error: row.error_message,
    };
  }
}

export default ScannerPipeline;
