/**
 * CVE Scanner Types
 * Type definitions for the vulnerability scanner pipeline
 */

export interface ScanTarget {
  id?: string;
  name: string;
  domain?: string;
  ipAddress?: string;
  description?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface Subdomain {
  id?: string;
  targetId: string;
  subdomain: string;
  ipAddress?: string;
  isAlive: boolean;
  ports?: number[];
  source?: string;
  discoveredAt?: Date;
}

export interface PortScanResult {
  id?: string;
  targetId: string;
  subdomainId?: string;
  port: number;
  protocol: 'tcp' | 'udp';
  state: 'open' | 'closed' | 'filtered';
  service?: string;
  version?: string;
  banner?: string;
  scannedAt?: Date;
}

export interface HttpFingerprint {
  id?: string;
  targetId: string;
  subdomainId?: string;
  url: string;
  statusCode?: number;
  title?: string;
  headers?: Record<string, string>;
  technologies?: DetectedTechnology[];
  server?: string;
  contentType?: string;
  contentLength?: number;
  redirectsTo?: string;
  isHttps: boolean;
  hasWaf: boolean;
  wafName?: string;
  fingerprintedAt?: Date;
}

export interface DetectedTechnology {
  name: string;
  category?: string;
  version?: string;
  confidence: number;
  detectionMethod: string;
}

export interface CVE {
  id: string;
  summary?: string;
  description?: string;
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
  cvssScore?: number;
  cvssVector?: string;
  cweId?: string;
  publishedAt?: Date;
  modifiedAt?: Date;
  vendor?: string;
  product?: string;
  affectedVersions?: string;
  pocAvailable: boolean;
  pocPath?: string;
  nucleiTemplate?: string;
  epssScore?: number;
  exploitsInWild: boolean;
  data?: Record<string, any>;
}

export interface CVETechnologyMapping {
  cveId: string;
  technology: string;
  affectedVersions?: string;
  patchedVersions?: string;
}

export interface ScanResult {
  id?: string;
  scanId: string;
  targetId: string;
  subdomainId?: string;
  portScanId?: string;
  cveId?: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  confidence: number;
  matchedTechnology?: string;
  detectedVersion?: string;
  nucleiMatch: boolean;
  nucleiTemplateUsed?: string;
  pocAvailable: boolean;
  pocPath?: string;
  verified: boolean;
  falsePositive: boolean;
  notes?: string;
  discoveredAt?: Date;
  verifiedAt?: Date;
}

export interface PoC {
  id?: string;
  cveId: string;
  name: string;
  description?: string;
  type: 'python' | 'ruby' | 'go' | 'binary' | 'javascript' | 'other';
  path: string;
  verified: boolean;
  tags?: string[];
  source?: string;
  addedAt?: Date;
  lastVerifiedAt?: Date;
}

export interface NucleiTemplate {
  id?: string;
  templateId: string;
  name?: string;
  path: string;
  severity?: string;
  tags?: string[];
  cveId?: string;
  isCustom: boolean;
  lastUpdated?: Date;
}

export interface ScanConfig {
  targetId: string;
  scanType: 'full' | 'recon' | 'portscan' | 'fingerprint' | 'cve' | 'nuclei';
  options?: {
    subdomainDiscovery?: boolean;
    portScan?: boolean;
    portRange?: string;
    httpFingerprint?: boolean;
    cveMatching?: {
      enabled?: boolean;
      minSeverity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
      cvssThreshold?: number;
      useNuclei?: boolean;
    };
    nucleiScan?: boolean;
    pocMapping?: boolean;
    customNucleiTemplates?: string[];
    rateLimit?: number;
    timeout?: number;
    threads?: number;
  };
}

export interface ScanProgress {
  scanId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  phase: string;
  progress: number;
  totalTasks: number;
  completedTasks: number;
  message?: string;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface ScannerQueueItem {
  id?: string;
  scanId: string;
  taskType: string;
  target: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  priority: number;
  result?: any;
  error?: string;
  createdAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface TechnologyFingerprint {
  id?: string;
  technology: string;
  category?: string;
  detectionMethod: 'header' | 'body' | 'favicon' | 'meta' | 'script' | 'css' | 'cookie' | 'other';
  fingerprint: string;
  versionExtraction?: string;
  confidence: number;
  isActive: boolean;
}

export interface VersionRange {
  min?: string;
  max?: string;
  exact?: string;
  vulnerable?: string;
  patched?: string;
}

export interface ScanStatistics {
  totalHosts: number;
  subdomainsFound: number;
  openPorts: number;
  webServices: number;
  technologies: Map<string, number>;
  cvesFound: number;
  bySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  withPoC: number;
  nucleiMatches: number;
}

export interface ReconResult {
  subdomains: Subdomain[];
  totalFound: number;
  aliveCount: number;
  sources: string[];
}

export interface FingerprintResult {
  httpServices: HttpFingerprint[];
  technologies: DetectedTechnology[];
  totalScanned: number;
  successful: number;
}

export interface CVEMatchResult {
  matches: ScanResult[];
  totalChecked: number;
  bySeverity: Record<string, number>;
  withExploits: number;
}

export interface PoCMapResult {
  cveId: string;
  pocAvailable: boolean;
  pocs: PoC[];
  nucleiTemplates: NucleiTemplate[];
}

export interface PipelineContext {
  scanId: string;
  target: ScanTarget;
  config: ScanConfig;
  results: {
    subdomains?: Subdomain[];
    ports?: PortScanResult[];
    fingerprints?: HttpFingerprint[];
    cves?: ScanResult[];
    pocs?: PoCMapResult[];
  };
  metadata: Map<string, any>;
}

export interface SubdomainDiscoveryConfig {
  tools: ('subfinder' | 'amass' | 'assetfinder' | 'chaos')[];
  wordlist?: string;
  bruteForce?: boolean;
  recursive?: boolean;
  timeout?: number;
}

export interface PortScanConfig {
  tools: ('naabu' | 'rustscan' | 'nmap' | 'masscan')[];
  topPorts?: number;
  portRange?: string;
  rateLimit?: number;
  timeout?: number;
  serviceDetection?: boolean;
  versionDetection?: boolean;
  scripts?: string[];
}

export interface HttpFingerprintConfig {
  tools: ('httpx' | 'wappalyzer' | 'custom')[];
  threads?: number;
  timeout?: number;
  followRedirects?: boolean;
  detectWaf?: boolean;
  extractTech?: boolean;
}

export interface CVEMatchingConfig {
  minSeverity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
  cvssThreshold?: number;
  epssThreshold?: number;
  checkPocAvailable?: boolean;
  checkExploitsInWild?: boolean;
  useNuclei?: boolean;
  customTemplates?: string[];
}

export interface PoCMapperConfig {
  sources: ('github' | 'exploitdb' | 'nuclei' | 'custom')[];
  autoDownload?: boolean;
  verifyPoCs?: boolean;
  sandboxPath?: string;
}

export interface NucleiScanConfig {
  templates: string[];
  severityFilter?: string[];
  rateLimit?: number;
  timeout?: number;
  concurrent?: number;
  silent?: boolean;
  jsonl?: boolean;
}

// Event types for scan progress
export type ScanEventType = 
  | 'scan.started'
  | 'scan.phase.started'
  | 'scan.phase.completed'
  | 'scan.progress'
  | 'scan.completed'
  | 'scan.failed'
  | 'scan.cancelled'
  | 'finding.discovered'
  | 'error';

export interface ScanEvent {
  type: ScanEventType;
  scanId: string;
  timestamp: Date;
  data?: any;
  message?: string;
}

export type ScanEventHandler = (event: ScanEvent) => void;

// Error types
export class ScannerError extends Error {
  constructor(
    message: string,
    public code: string,
    public phase?: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'ScannerError';
  }
}

export class ToolNotFoundError extends ScannerError {
  constructor(tool: string) {
    super(`Required tool not found: ${tool}`, 'TOOL_NOT_FOUND');
    this.name = 'ToolNotFoundError';
  }
}

export class ScanCancelledError extends ScannerError {
  constructor(scanId: string) {
    super(`Scan ${scanId} was cancelled`, 'SCAN_CANCELLED');
    this.name = 'ScanCancelledError';
  }
}

// All types are exported individually above
// Use: import { ScanTarget, CVE, ... } from './types'
