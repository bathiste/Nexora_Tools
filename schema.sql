-- Nexora Gotham Platform Database Schema
-- PostgreSQL 16 - CVE Scanner Edition

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create schema
CREATE SCHEMA IF NOT EXISTS gotham;

-- Set search path
SET search_path TO gotham, public;

-- ==================== CORE TABLES ====================

-- Scans table - tracks all scan operations
CREATE TABLE IF NOT EXISTS scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target VARCHAR(255) NOT NULL,
    scan_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    results JSONB,
    error_message TEXT,
    created_by VARCHAR(100),
    config JSONB
);

-- Targets table - discovered assets
CREATE TABLE IF NOT EXISTS targets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    ip_address INET,
    domain VARCHAR(255),
    description TEXT,
    tags TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_scan_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB
);

-- Subdomains discovered during recon
CREATE TABLE IF NOT EXISTS subdomains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target_id UUID REFERENCES targets(id) ON DELETE CASCADE,
    subdomain VARCHAR(255) NOT NULL,
    ip_address INET,
    is_alive BOOLEAN DEFAULT false,
    ports INTEGER[],
    discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source VARCHAR(50), -- subfinder, amass, etc.
    UNIQUE(target_id, subdomain)
);

-- Port scan results
CREATE TABLE IF NOT EXISTS port_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target_id UUID REFERENCES targets(id) ON DELETE CASCADE,
    subdomain_id UUID REFERENCES subdomains(id) ON DELETE CASCADE,
    port INTEGER NOT NULL,
    protocol VARCHAR(10) DEFAULT 'tcp',
    state VARCHAR(20) NOT NULL, -- open, closed, filtered
    service VARCHAR(100),
    version VARCHAR(255),
    banner TEXT,
    scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- HTTP fingerprinting results
CREATE TABLE IF NOT EXISTS http_fingerprints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target_id UUID REFERENCES targets(id) ON DELETE CASCADE,
    subdomain_id UUID REFERENCES subdomains(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    status_code INTEGER,
    title VARCHAR(500),
    headers JSONB,
    technologies JSONB,
    server VARCHAR(255),
    content_type VARCHAR(100),
    content_length INTEGER,
    redirects_to TEXT,
    is_https BOOLEAN DEFAULT false,
    has_waf BOOLEAN DEFAULT false,
    waf_name VARCHAR(100),
    fingerprinted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== CVE SCANNER TABLES ====================

-- CVE Database - local cache of CVE information
CREATE TABLE IF NOT EXISTS cves (
    id VARCHAR(50) PRIMARY KEY, -- CVE-YYYY-NNNNN
    summary TEXT,
    description TEXT,
    severity VARCHAR(20), -- critical, high, medium, low, info
    cvss_score DECIMAL(3,1),
    cvss_vector VARCHAR(100),
    cwe_id VARCHAR(20),
    published_at TIMESTAMP,
    modified_at TIMESTAMP,
    vendor VARCHAR(255),
    product VARCHAR(255),
    affected_versions TEXT,
    poc_available BOOLEAN DEFAULT false,
    poc_path TEXT,
    nuclei_template TEXT,
    epss_score DECIMAL(5,4), -- Exploit Prediction Scoring System
    exploits_in_wild BOOLEAN DEFAULT false,
    data JSONB
);

-- Technology fingerprints for detection
CREATE TABLE IF NOT EXISTS tech_fingerprints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    technology VARCHAR(100) NOT NULL,
    category VARCHAR(50), -- web-server, cms, framework, etc.
    detection_method VARCHAR(50), -- header, body, favicon, meta, etc.
    fingerprint TEXT NOT NULL, -- regex pattern or hash
    version_extraction VARCHAR(255), -- regex for version
    confidence INTEGER DEFAULT 80,
    is_active BOOLEAN DEFAULT true
);

-- CVE to Technology mappings
CREATE TABLE IF NOT EXISTS cve_tech_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cve_id VARCHAR(50) REFERENCES cves(id) ON DELETE CASCADE,
    technology VARCHAR(100) NOT NULL,
    affected_versions TEXT, -- version range syntax
    patched_versions TEXT,
    UNIQUE(cve_id, technology)
);

-- Scan results - CVE findings
CREATE TABLE IF NOT EXISTS scan_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id UUID REFERENCES scans(id) ON DELETE CASCADE,
    target_id UUID REFERENCES targets(id) ON DELETE CASCADE,
    subdomain_id UUID REFERENCES subdomains(id) ON DELETE CASCADE,
    port_scan_id UUID REFERENCES port_scans(id) ON DELETE CASCADE,
    cve_id VARCHAR(50) REFERENCES cves(id),
    severity VARCHAR(20) NOT NULL,
    confidence INTEGER DEFAULT 80, -- 0-100
    matched_technology VARCHAR(100),
    detected_version VARCHAR(100),
    nuclei_match BOOLEAN DEFAULT false,
    nuclei_template_used TEXT,
    poc_available BOOLEAN DEFAULT false,
    poc_path TEXT,
    verified BOOLEAN DEFAULT false,
    false_positive BOOLEAN DEFAULT false,
    notes TEXT,
    discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP
);

-- PoC (Proof of Concept) storage
CREATE TABLE IF NOT EXISTS pocs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cve_id VARCHAR(50) REFERENCES cves(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50), -- python, ruby, go, binary, etc.
    path TEXT NOT NULL,
    verified BOOLEAN DEFAULT false,
    tags TEXT[],
    source VARCHAR(100), -- github, exploit-db, etc.
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_verified_at TIMESTAMP
);

-- Nuclei templates tracking
CREATE TABLE IF NOT EXISTS nuclei_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255),
    path TEXT NOT NULL,
    severity VARCHAR(20),
    tags TEXT[],
    cve_id VARCHAR(50) REFERENCES cves(id),
    is_custom BOOLEAN DEFAULT false,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== AI ASSISTANT TABLES ====================

-- AI Chat History
CREATE TABLE IF NOT EXISTS chat_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    context JSONB
);

-- ==================== UTILITY TABLES ====================

-- Attack Graph Nodes (for Neo4j sync)
CREATE TABLE IF NOT EXISTS attack_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_type VARCHAR(50) NOT NULL,
    properties JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Attack Graph Edges
CREATE TABLE IF NOT EXISTS attack_edges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID REFERENCES attack_nodes(id) ON DELETE CASCADE,
    target_id UUID REFERENCES attack_nodes(id) ON DELETE CASCADE,
    edge_type VARCHAR(50) NOT NULL,
    properties JSONB
);

-- Scanner queue for async processing
CREATE TABLE IF NOT EXISTS scanner_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id UUID REFERENCES scans(id) ON DELETE CASCADE,
    task_type VARCHAR(50) NOT NULL,
    target TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    priority INTEGER DEFAULT 5,
    result JSONB,
    error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- ==================== INDEXES ====================

-- Core indexes
CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at);
CREATE INDEX IF NOT EXISTS idx_scans_target ON scans(target);

-- Subdomain indexes
CREATE INDEX IF NOT EXISTS idx_subdomains_target ON subdomains(target_id);
CREATE INDEX IF NOT EXISTS idx_subdomains_alive ON subdomains(is_alive) WHERE is_alive = true;

-- Port scan indexes
CREATE INDEX IF NOT EXISTS idx_port_scans_target ON port_scans(target_id);
CREATE INDEX IF NOT EXISTS idx_port_scans_open ON port_scans(state) WHERE state = 'open';

-- HTTP fingerprint indexes
CREATE INDEX IF NOT EXISTS idx_http_fingerprints_tech ON http_fingerprints USING GIN(technologies);
CREATE INDEX IF NOT EXISTS idx_http_fingerprints_target ON http_fingerprints(target_id);

-- CVE indexes
CREATE INDEX IF NOT EXISTS idx_cves_severity ON cves(severity);
CREATE INDEX IF NOT EXISTS idx_cves_cvss ON cves(cvss_score);
CREATE INDEX IF NOT EXISTS idx_cves_vendor ON cves(vendor);
CREATE INDEX IF NOT EXISTS idx_cves_product ON cves(product);
CREATE INDEX IF NOT EXISTS idx_cves_published ON cves(published_at);

-- Scan result indexes
CREATE INDEX IF NOT EXISTS idx_scan_results_scan ON scan_results(scan_id);
CREATE INDEX IF NOT EXISTS idx_scan_results_cve ON scan_results(cve_id);
CREATE INDEX IF NOT EXISTS idx_scan_results_severity ON scan_results(severity);
CREATE INDEX IF NOT EXISTS idx_scan_results_verified ON scan_results(verified);

-- Tech fingerprint indexes
CREATE INDEX IF NOT EXISTS idx_tech_fingerprints_name ON tech_fingerprints(technology);
CREATE INDEX IF NOT EXISTS idx_tech_fingerprints_cat ON tech_fingerprints(category);

-- Other indexes
CREATE INDEX IF NOT EXISTS idx_targets_ip ON targets(ip_address);
CREATE INDEX IF NOT EXISTS idx_targets_domain ON targets(domain);
CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_history(session_id);
CREATE INDEX IF NOT EXISTS idx_scanner_queue_status ON scanner_queue(status);
CREATE INDEX IF NOT EXISTS idx_cve_mappings_cve ON cve_tech_mappings(cve_id);
CREATE INDEX IF NOT EXISTS idx_cve_mappings_tech ON cve_tech_mappings(technology);

-- ==================== VIEWS ====================

-- Scan summary view
CREATE OR REPLACE VIEW scan_summary AS
SELECT 
    s.id,
    s.target,
    s.scan_type,
    s.status,
    s.created_at,
    COUNT(sr.id) as finding_count,
    COUNT(CASE WHEN sr.severity = 'critical' THEN 1 END) as critical_count,
    COUNT(CASE WHEN sr.severity = 'high' THEN 1 END) as high_count,
    COUNT(CASE WHEN sr.severity = 'medium' THEN 1 END) as medium_count,
    COUNT(CASE WHEN sr.severity = 'low' THEN 1 END) as low_count
FROM scans s
LEFT JOIN scan_results sr ON s.id = sr.scan_id
GROUP BY s.id, s.target, s.scan_type, s.status, s.created_at;

-- CVE statistics view
CREATE OR REPLACE VIEW cve_stats AS
SELECT 
    severity,
    COUNT(*) as count,
    COUNT(CASE WHEN poc_available THEN 1 END) as with_poc,
    AVG(cvss_score) as avg_cvss
FROM cves
GROUP BY severity;

-- Asset inventory view
CREATE OR REPLACE VIEW asset_inventory AS
SELECT 
    t.id,
    t.name,
    t.domain,
    t.ip_address,
    COUNT(DISTINCT s.id) as subdomain_count,
    COUNT(DISTINCT ps.port) as open_port_count,
    COUNT(DISTINCT hf.id) as web_service_count,
    t.last_scan_at
FROM targets t
LEFT JOIN subdomains s ON t.id = s.target_id AND s.is_alive = true
LEFT JOIN port_scans ps ON t.id = ps.target_id AND ps.state = 'open'
LEFT JOIN http_fingerprints hf ON t.id = hf.target_id
GROUP BY t.id, t.name, t.domain, t.ip_address, t.last_scan_at;

-- ==================== DEFAULT DATA ====================

-- Insert default target
INSERT INTO targets (name, domain, description) VALUES 
    ('localhost', 'localhost', 'Local development target')
ON CONFLICT DO NOTHING;

-- Insert sample tech fingerprints
INSERT INTO tech_fingerprints (technology, category, detection_method, fingerprint, version_extraction, confidence) VALUES
    ('Apache', 'web-server', 'header', 'Apache/?([0-9.]+)?', 'Apache/([0-9.]+)', 90),
    ('nginx', 'web-server', 'header', 'nginx/?([0-9.]+)?', 'nginx/([0-9.]+)', 90),
    ('WordPress', 'cms', 'body', 'wp-content|wordpress', 'WordPress ([0-9.]+)', 85),
    ('PHP', 'language', 'header', 'PHP/?([0-9.]+)?', 'PHP/([0-9.]+)', 90),
    ('OpenSSH', 'service', 'banner', 'OpenSSH_([0-9.]+)', 'OpenSSH_([0-9.]+)', 95),
    ('MySQL', 'database', 'banner', 'mysql|MySQL', '([0-9.]+)-MariaDB|([0-9.]+)', 85),
    ('React', 'framework', 'body', 'react|reactjs', '([0-9.]+)', 75),
    ('jQuery', 'library', 'body', 'jquery[/-]([0-9.]+)', '([0-9.]+)', 80)
ON CONFLICT DO NOTHING;

-- ==================== PERMISSIONS ====================

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA gotham TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA gotham TO postgres;

-- Comment
COMMENT ON DATABASE gotham IS 'Nexora Gotham Platform - CVE Scanner Database';
