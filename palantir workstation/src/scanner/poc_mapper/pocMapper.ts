/**
 * PoC Mapper Module
 * Maps CVEs to available Proof-of-Concept exploits and Nuclei templates
 */

import { EventEmitter } from 'events';
import { existsSync } from 'fs';
import { join } from 'path';
import {
  PoC,
  NucleiTemplate,
  PoCMapResult,
} from '../types';

export class PoCMapper extends EventEmitter {
  private pocBasePath: string;
  private nucleiBasePath: string;
  private cancelled = false;

  constructor(
    pocBasePath: string = './storage/pocs',
    nucleiBasePath: string = './storage/nuclei'
  ) {
    super();
    this.pocBasePath = pocBasePath;
    this.nucleiBasePath = nucleiBasePath;
  }

  cancel(): void {
    this.cancelled = true;
  }

  reset(): void {
    this.cancelled = false;
  }

  /**
   * Map CVE IDs to available PoCs and templates
   */
  async map(cveIds: string[]): Promise<PoCMapResult[]> {
    this.reset();
    const results: PoCMapResult[] = [];

    this.emit('progress', {
      phase: 'poc.mapping',
      message: `Mapping ${cveIds.length} CVEs to PoCs`,
    });

    for (const cveId of cveIds) {
      if (this.cancelled) break;

      const result = await this.mapSingleCVE(cveId);
      results.push(result);
    }

    this.emit('progress', {
      phase: 'poc.mapping',
      message: `Found PoCs for ${results.filter(r => r.pocAvailable).length} CVEs`,
    });

    return results;
  }

  /**
   * Map a single CVE to available PoCs
   */
  private async mapSingleCVE(cveId: string): Promise<PoCMapResult> {
    const pocs: PoC[] = [];
    const nucleiTemplates: NucleiTemplate[] = [];

    // Check for local PoCs
    const localPoCs = await this.findLocalPoCs(cveId);
    pocs.push(...localPoCs);

    // Check for Nuclei templates
    const templates = await this.findNucleiTemplates(cveId);
    nucleiTemplates.push(...templates);

    // Check for GitHub PoCs (placeholder for future implementation)
    const githubPoCs = await this.findGitHubPoCs(cveId);
    pocs.push(...githubPoCs);

    return {
      cveId,
      pocAvailable: pocs.length > 0 || nucleiTemplates.length > 0,
      pocs,
      nucleiTemplates,
    };
  }

  /**
   * Find local PoCs for a CVE
   */
  private async findLocalPoCs(cveId: string): Promise<PoC[]> {
    const pocs: PoC[] = [];
    const cvePath = join(this.pocBasePath, cveId);

    // Check if CVE directory exists
    if (!existsSync(cvePath)) {
      return pocs;
    }

    // Look for common exploit files
    const extensions = ['.py', '.rb', '.go', '.sh', '.exe', '.bin', '.js', '.pl', '.c'];
    
    for (const ext of extensions) {
      const files = await this.globFiles(cvePath, ext);
      
      for (const file of files) {
        const type = this.getExploitType(file);
        
        pocs.push({
          cveId,
          name: file.split('/').pop() || 'unknown',
          description: `Local PoC for ${cveId}`,
          type,
          path: file,
          verified: false,
          source: 'local',
          addedAt: new Date(),
        });
      }
    }

    return pocs;
  }

  /**
   * Find Nuclei templates for a CVE
   */
  private async findNucleiTemplates(cveId: string): Promise<NucleiTemplate[]> {
    const templates: NucleiTemplate[] = [];

    // Check if template exists in nuclei-templates repository
    const templatePath = join(this.nucleiBasePath, 'cves', cveId.replace('-', '/'));
    
    if (existsSync(templatePath + '.yaml')) {
      templates.push({
        templateId: cveId.toLowerCase(),
        name: `${cveId} Detection`,
        path: templatePath + '.yaml',
        severity: 'unknown',
        cveId,
        isCustom: false,
        lastUpdated: new Date(),
      });
    }

    // Also check in http/cves directory structure
    const year = cveId.match(/CVE-(\d{4})-/)?.[1];
    if (year) {
      const httpTemplatePath = join(
        this.nucleiBasePath,
        'http',
        'cves',
        year,
        cveId.toLowerCase() + '.yaml'
      );
      
      if (existsSync(httpTemplatePath)) {
        templates.push({
          templateId: cveId.toLowerCase(),
          name: `${cveId} HTTP Detection`,
          path: httpTemplatePath,
          severity: 'unknown',
          cveId,
          isCustom: false,
          lastUpdated: new Date(),
        });
      }
    }

    return templates;
  }

  /**
   * Find PoCs on GitHub
   * This is a placeholder - would integrate with GitHub API
   */
  private async findGitHubPoCs(cveId: string): Promise<PoC[]> {
    // Placeholder: In production, search GitHub for PoC repos
    // Example: search for "CVE-2021-XXXXX poc exploit"
    return [];
  }

  /**
   * Get exploit type from file extension
   */
  private getExploitType(filePath: string): PoC['type'] {
    const ext = filePath.split('.').pop()?.toLowerCase();
    
    switch (ext) {
      case 'py': return 'python';
      case 'rb': return 'ruby';
      case 'go': return 'go';
      case 'js': return 'javascript';
      case 'sh': return 'binary';
      case 'exe': return 'binary';
      case 'bin': return 'binary';
      case 'pl': return 'other';
      case 'c': return 'other';
      default: return 'other';
    }
  }

  /**
   * Glob files matching pattern (simplified)
   */
  private async globFiles(dir: string, pattern: string): Promise<string[]> {
    // Simplified implementation
    // In production, use proper glob library
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      const { stdout } = await execAsync(
        `find ${dir} -name "*${pattern}" 2>/dev/null || dir /s /b "${dir}\\*${pattern}" 2>nul`,
        { timeout: 10000 }
      );
      
      return stdout.split('\n').filter((f: string) => f.trim());
    } catch {
      return [];
    }
  }

  /**
   * Verify a PoC is working
   * This would run the PoC in a sandboxed environment
   */
  async verifyPoC(poc: PoC): Promise<boolean> {
    // Placeholder: In production, run in isolated environment
    // 1. Check syntax
    // 2. Test against known vulnerable target
    // 3. Verify it detects/exploits the vulnerability
    
    console.log(`Verifying PoC: ${poc.path}`);
    
    // For now, just check file exists
    return existsSync(poc.path);
  }

  /**
   * Download PoC from remote source
   */
  async downloadPoC(cveId: string, source: string): Promise<PoC | null> {
    // Placeholder: Download from GitHub or other sources
    console.log(`Downloading PoC for ${cveId} from ${source}`);
    return null;
  }

  /**
   * Get available PoC sources
   */
  getSources(): Array<{ name: string; enabled: boolean }> {
    return [
      { name: 'local', enabled: true },
      { name: 'nuclei', enabled: true },
      { name: 'github', enabled: false }, // Requires API integration
      { name: 'exploitdb', enabled: false },
    ];
  }
}

export default PoCMapper;
