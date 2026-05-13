/**
 * CVE Matcher Module
 * Matches detected technologies against CVE database
 */

import { EventEmitter } from 'events';
import { Pool } from 'pg';
import {
  ScanConfig,
  ScanResult,
  CVEMatchingConfig,
  CVE,
} from '../types';

export class CVEMatcher extends EventEmitter {
  private db: Pool;
  private cancelled = false;

  constructor(db: Pool) {
    super();
    this.db = db;
  }

  cancel(): void {
    this.cancelled = true;
  }

  reset(): void {
    this.cancelled = false;
  }

  /**
   * Match detected technologies against CVE database
   */
  async match(
    scanId: string,
    technologies: Array<{
      name: string;
      version?: string;
      host: string;
      port?: number;
    }>,
    config: ScanConfig
  ): Promise<ScanResult[]> {
    this.reset();
    const results: ScanResult[] = [];
    const minSeverity = config.options?.cveMatching?.minSeverity || 'medium';

    this.emit('progress', {
      phase: 'matcher.cve',
      message: `Matching ${technologies.length} technologies against CVE database`,
    });

    // Get unique technologies
    const uniqueTechs = this.deduplicateTechnologies(technologies);

    for (const tech of uniqueTechs) {
      if (this.cancelled) break;

      try {
        // Find CVEs for this technology
        const cves = await this.findCVEsForTechnology(tech.name, tech.version);

        for (const cve of cves) {
          // Check severity threshold
          if (!this.meetsSeverityThreshold(cve.severity, minSeverity)) {
            continue;
          }

          // Check version is affected
          if (tech.version && cve.affectedVersions) {
            if (!this.isVersionAffected(tech.version, cve.affectedVersions)) {
              continue;
            }
          }

          const result: ScanResult = {
            scanId,
            targetId: '', // Will be set by caller
            cveId: cve.id,
            severity: cve.severity || 'medium',
            confidence: this.calculateConfidence(tech.version, cve),
            matchedTechnology: tech.name,
            detectedVersion: tech.version,
            pocAvailable: cve.pocAvailable,
            pocPath: cve.pocPath,
            nucleiMatch: false,
            nucleiTemplateUsed: cve.nucleiTemplate,
            verified: false,
            falsePositive: false,
            discoveredAt: new Date(),
          };

          results.push(result);

          this.emit('finding', {
            type: 'cve',
            severity: result.severity,
            cveId: cve.id,
            technology: tech.name,
            version: tech.version,
          });
        }

        this.emit('progress', {
          phase: 'matcher.cve',
          message: `Checked ${tech.name} ${tech.version || ''}: ${cves.length} CVEs`,
        });
      } catch (error) {
        console.error(`Failed to match CVEs for ${tech.name}:`, error);
      }
    }

    this.emit('progress', {
      phase: 'matcher.cve',
      message: `Found ${results.length} potential CVE matches`,
    });

    return results;
  }

  /**
   * Find CVEs for a specific technology
   */
  private async findCVEsForTechnology(
    technology: string,
    version?: string
  ): Promise<CVE[]> {
    const cves: CVE[] = [];

    // Query database for CVEs matching this technology
    const result = await this.db.query(
      `SELECT c.* FROM gotham.cves c
       JOIN gotham.cve_tech_mappings m ON c.id = m.cve_id
       WHERE LOWER(m.technology) = LOWER($1)
       OR LOWER(c.product) LIKE '%' || LOWER($1) || '%'
       OR LOWER(c.vendor) LIKE '%' || LOWER($1) || '%'
       ORDER BY c.cvss_score DESC NULLS LAST
       LIMIT 50`,
      [technology]
    );

    for (const row of result.rows) {
      cves.push({
        id: row.id,
        summary: row.summary,
        description: row.description,
        severity: row.severity,
        cvssScore: row.cvss_score,
        cvssVector: row.cvss_vector,
        cweId: row.cwe_id,
        publishedAt: row.published_at,
        modifiedAt: row.modified_at,
        vendor: row.vendor,
        product: row.product,
        affectedVersions: row.affected_versions,
        pocAvailable: row.poc_available,
        pocPath: row.poc_path,
        nucleiTemplate: row.nuclei_template,
        epssScore: row.epss_score,
        exploitsInWild: row.exploits_in_wild,
        data: row.data,
      });
    }

    return cves;
  }

  /**
   * Deduplicate technologies list
   */
  private deduplicateTechnologies(
    technologies: Array<{ name: string; version?: string; host: string; port?: number }>
  ): Array<{ name: string; version?: string; hosts: string[] }> {
    const techMap = new Map<string, { name: string; version?: string; hosts: Set<string> }>();

    for (const tech of technologies) {
      const key = `${tech.name}:${tech.version || 'unknown'}`;
      
      if (!techMap.has(key)) {
        techMap.set(key, {
          name: tech.name,
          version: tech.version,
          hosts: new Set(),
        });
      }
      
      techMap.get(key)!.hosts.add(`${tech.host}:${tech.port || '80'}`);
    }

    return Array.from(techMap.values()).map(t => ({
      name: t.name,
      version: t.version,
      hosts: Array.from(t.hosts),
    }));
  }

  /**
   * Check if severity meets threshold
   */
  private meetsSeverityThreshold(
    severity: string | undefined,
    threshold: string
  ): boolean {
    const levels: Record<string, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
      info: 0,
    };

    const sevLevel = levels[severity || 'info'];
    const thresholdLevel = levels[threshold];

    return sevLevel >= thresholdLevel;
  }

  /**
   * Check if version is affected
   */
  private isVersionAffected(
    detectedVersion: string,
    affectedRange: string
  ): boolean {
    // Simplified version checking
    // In production, use proper semver comparison
    
    // Common patterns:
    // "< 2.5.0" - less than
    // ">= 1.0.0, < 2.0.0" - range
    // "1.0.0 - 2.5.0" - range
    // "2.5.0" - exact

    const normalized = affectedRange.toLowerCase().trim();
    
    // Extract version numbers from both strings
    const detectedMatch = detectedVersion.match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
    if (!detectedMatch) return true; // Can't determine, assume affected

    const detected = detectedMatch[0];

    // Check for exact match
    if (normalized.includes(detected)) {
      return true;
    }

    // Check for less than
    const ltMatch = normalized.match(/[<≤]\s*(\d+(?:\.\d+)*)/);
    if (ltMatch) {
      return this.compareVersions(detected, ltMatch[1]) < 0;
    }

    // Check for less than or equal
    const lteMatch = normalized.match(/<=\s*(\d+(?:\.\d+)*)/);
    if (lteMatch) {
      return this.compareVersions(detected, lteMatch[1]) <= 0;
    }

    // Check for greater than
    const gtMatch = normalized.match(/[>≥]\s*(\d+(?:\.\d+)*)/);
    if (gtMatch) {
      return this.compareVersions(detected, gtMatch[1]) > 0;
    }

    // Check for range
    const rangeMatch = normalized.match(/(\d+(?:\.\d+)*)\s*-\s*(\d+(?:\.\d+)*)/);
    if (rangeMatch) {
      return (
        this.compareVersions(detected, rangeMatch[1]) >= 0 &&
        this.compareVersions(detected, rangeMatch[2]) <= 0
      );
    }

    // Default: assume affected if we can't parse
    return true;
  }

  /**
   * Compare two version strings
   * Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    const maxLen = Math.max(parts1.length, parts2.length);

    for (let i = 0; i < maxLen; i++) {
      const a = parts1[i] || 0;
      const b = parts2[i] || 0;
      
      if (a < b) return -1;
      if (a > b) return 1;
    }

    return 0;
  }

  /**
   * Calculate confidence score for match
   */
  private calculateConfidence(
    detectedVersion: string | undefined,
    cve: CVE
  ): number {
    let confidence = 70; // Base confidence

    // Increase if we have version info
    if (detectedVersion) {
      confidence += 15;
    }

    // Increase if we have affected version info
    if (cve.affectedVersions) {
      confidence += 10;
    }

    // Decrease if very old CVE
    if (cve.publishedAt) {
      const age = Date.now() - new Date(cve.publishedAt).getTime();
      const years = age / (1000 * 60 * 60 * 24 * 365);
      if (years > 5) {
        confidence -= 5; // Slightly less confident for old CVEs
      }
    }

    return Math.min(100, confidence);
  }

  /**
   * Get CVE statistics
   */
  async getStats(): Promise<{
    total: number;
    bySeverity: Record<string, number>;
    withPoc: number;
  }> {
    const result = await this.db.query('SELECT * FROM gotham.cve_stats');
    
    if (result.rows.length === 0) {
      return { total: 0, bySeverity: {}, withPoc: 0 };
    }

    const stats = result.rows[0];
    return {
      total: stats.count || 0,
      bySeverity: {
        [stats.severity]: stats.count,
      },
      withPoc: stats.with_poc || 0,
    };
  }
}

export default CVEMatcher;
