import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { AttackEngine } from './attackEngine';
import { ProxyManager } from './proxyManager';
import { UserAgentRotator, DEFAULT_USER_AGENTS } from './userAgents';
import { AttackConfig, Authorization, AttackStats } from './types';
import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import crypto from 'crypto';

const app = express();
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'gotham',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Serve dashboard static files
app.use('/dashboard', express.static(path.join(__dirname, '../dashboard')));

// Redirect root to dashboard
app.get('/', (req: Request, res: Response) => {
  res.redirect('/dashboard');
});

// Store active attacks
interface ActiveAttack {
  engine: AttackEngine;
  config: AttackConfig;
  authorization: Authorization;
  startTime: Date;
  status: 'running' | 'stopped' | 'completed';
}

const activeAttacks = new Map<string, ActiveAttack>();

// Middleware for basic auth/API key validation
const validateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'];
  // In production, validate against a database
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }
  next();
};

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get available proxies
app.get('/proxies', (req: Request, res: Response) => {
  try {
    const proxyManager = new ProxyManager();
    const proxyFile = process.env.PROXY_FILE || 'data/proxies.txt';
    
    if (fs.existsSync(proxyFile)) {
      proxyManager.loadFromFile(proxyFile);
    }

    res.json({
      count: proxyManager.getProxyCount(),
      active: proxyManager.getActiveProxyCount(),
      source: proxyFile
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Get available user agents
app.get('/user-agents', (req: Request, res: Response) => {
  try {
    const uaFile = process.env.UA_FILE || 'data/uas.txt';
    let userAgents = [...DEFAULT_USER_AGENTS];
    
    if (fs.existsSync(uaFile)) {
      const content = fs.readFileSync(uaFile, 'utf-8');
      const customUAs = content.split('\n').map(l => l.trim()).filter(l => l);
      userAgents = [...userAgents, ...customUAs];
    }

    res.json({
      count: userAgents.length,
      agents: userAgents
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Start a new attack
interface StartAttackRequest {
  target: string;
  duration: number;
  threads?: number;
  rateLimit?: number;
  method?: 'GET' | 'POST' | 'HEAD' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  payload?: string;
  authorization: {
    clientId: string;
    authorizedBy: string;
    scope?: string;
    validUntil?: string;
  };
  proxyFile?: string;
  uaFile?: string;
}

app.post('/attacks', validateApiKey, async (req: Request, res: Response) => {
  try {
    const body: StartAttackRequest = req.body;

    // Validate required fields
    if (!body.target || !body.duration || !body.authorization) {
      return res.status(400).json({
        error: 'Missing required fields: target, duration, authorization'
      });
    }

    // Validate authorization
    const auth: Authorization = {
      clientId: body.authorization.clientId,
      targetUrl: body.target,
      authorizedBy: body.authorization.authorizedBy,
      authorizationDate: new Date(),
      scope: body.authorization.scope || 'load-testing',
      validUntil: body.authorization.validUntil 
        ? new Date(body.authorization.validUntil)
        : new Date(Date.now() + 24 * 60 * 60 * 1000)
    };

    if (new Date() > auth.validUntil) {
      return res.status(403).json({ error: 'Authorization has expired' });
    }

    // Load proxies
    const proxyFile = body.proxyFile || process.env.PROXY_FILE || 'data/proxies.txt';
    const proxies: any[] = [];
    
    if (fs.existsSync(proxyFile)) {
      const content = fs.readFileSync(proxyFile, 'utf-8');
      const lines = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
      
      for (const line of lines) {
        const parsed = parseProxyString(line);
        if (parsed) proxies.push(parsed);
      }
    }

    // Load user agents
    const uaFile = body.uaFile || process.env.UA_FILE || 'data/uas.txt';
    let userAgents = [...DEFAULT_USER_AGENTS];
    
    if (fs.existsSync(uaFile)) {
      const content = fs.readFileSync(uaFile, 'utf-8');
      const customUAs = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
      userAgents = [...userAgents, ...customUAs];
    }

    // Build config
    const config: AttackConfig = {
      target: body.target,
      duration: body.duration,
      threads: body.threads || 10,
      rateLimit: body.rateLimit || 0,
      method: body.method || 'GET',
      proxies,
      userAgents,
      headers: body.headers,
      payload: body.payload
    };

    // Create attack
    const attackId = `attack-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const engine = new AttackEngine(config, auth);

    const attack: ActiveAttack = {
      engine,
      config,
      authorization: auth,
      startTime: new Date(),
      status: 'running'
    };

    activeAttacks.set(attackId, attack);

    // Handle engine events
    engine.on('stop', () => {
      attack.status = 'stopped';
    });

    // Start the attack
    engine.start().then(() => {
      attack.status = 'stopped';
    }).catch(() => {
      attack.status = 'stopped';
    });

    res.status(201).json({
      attackId,
      status: 'started',
      config: {
        target: config.target,
        duration: config.duration,
        threads: config.threads,
        method: config.method
      },
      authorization: {
        clientId: auth.clientId,
        authorizedBy: auth.authorizedBy
      }
    });

  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// List all attacks
app.get('/attacks', validateApiKey, (req: Request, res: Response) => {
  const attacks = Array.from(activeAttacks.entries()).map(([id, attack]) => ({
    attackId: id,
    status: attack.status,
    target: attack.config.target,
    startTime: attack.startTime,
    stats: attack.engine.getStats()
  }));

  res.json({ attacks, count: attacks.length });
});

// Get specific attack details
app.get('/attacks/:attackId', validateApiKey, (req: Request, res: Response) => {
  const attack = activeAttacks.get(req.params.attackId);
  
  if (!attack) {
    return res.status(404).json({ error: 'Attack not found' });
  }

  res.json({
    attackId: req.params.attackId,
    status: attack.status,
    config: attack.config,
    authorization: attack.authorization,
    startTime: attack.startTime,
    stats: attack.engine.getStats()
  });
});

// Stop an attack
app.delete('/attacks/:attackId', validateApiKey, (req: Request, res: Response) => {
  const attack = activeAttacks.get(req.params.attackId);
  
  if (!attack) {
    return res.status(404).json({ error: 'Attack not found' });
  }

  attack.engine.stop();
  attack.status = 'stopped';

  res.json({
    attackId: req.params.attackId,
    status: 'stopped',
    finalStats: attack.engine.getStats()
  });
});

// Get attack statistics
app.get('/attacks/:attackId/stats', validateApiKey, (req: Request, res: Response) => {
  const attack = activeAttacks.get(req.params.attackId);
  
  if (!attack) {
    return res.status(404).json({ error: 'Attack not found' });
  }

  const stats = attack.engine.getStats();
  const duration = stats.endTime 
    ? (stats.endTime.getTime() - stats.startTime.getTime()) / 1000
    : (Date.now() - stats.startTime.getTime()) / 1000;

  res.json({
    attackId: req.params.attackId,
    status: attack.status,
    stats: {
      ...stats,
      startTime: stats.startTime.toISOString(),
      endTime: stats.endTime?.toISOString(),
      duration: Math.round(duration * 100) / 100,
      rps: duration > 0 ? Math.round((stats.totalRequests / duration) * 100) / 100 : 0
    }
  });
});

// Proxy validation endpoint
app.post('/validate-proxies', validateApiKey, async (req: Request, res: Response) => {
  const { proxyFile, testUrl = 'http://httpbin.org/ip' } = req.body;
  
  try {
    const file = proxyFile || 'data/proxies.txt';
    const proxyManager = new ProxyManager();
    
    if (fs.existsSync(file)) {
      proxyManager.loadFromFile(file);
    }

    // Return proxy count for now - full validation would require async testing
    res.json({
      proxyFile: file,
      totalProxies: proxyManager.getProxyCount(),
      message: 'Proxy validation endpoint - implement async testing as needed'
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

function parseProxyString(proxyString: string) {
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

// AI Assistant endpoints
import { aiAssistant } from './ai-assistant';

// Check Ollama status
app.get('/ai/status', async (req: Request, res: Response) => {
  try {
    const status = await aiAssistant.checkOllamaStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ 
      installed: false, 
      running: false, 
      modelInstalled: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Start Ollama server
app.post('/ai/start', async (req: Request, res: Response) => {
  try {
    const success = await aiAssistant.startOllamaServer();
    res.json({ success, message: success ? 'Ollama server started' : 'Failed to start server' });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Failed to start server'
    });
  }
});

// Install dolphin-llama3 model
app.post('/ai/install-model', async (req: Request, res: Response) => {
  try {
    const result = await aiAssistant.installModel();
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Failed to install model'
    });
  }
});

// Chat with AI
app.post('/ai/chat', async (req: Request, res: Response) => {
  const { message } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const reply = await aiAssistant.sendMessage(message);
    res.json({ reply, success: true });
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to get AI response',
      success: false
    });
  }
});

// Get chat history
app.get('/ai/history', (req: Request, res: Response) => {
  const history = aiAssistant.getChatHistory();
  res.json({ history });
});

// Clear chat history
app.post('/ai/clear', (req: Request, res: Response) => {
  aiAssistant.clearChat();
  res.json({ success: true, message: 'Chat history cleared' });
});

// ==================== CVE Scanner API ====================
import { ScannerPipeline } from './scanner/pipeline';
import { ScanConfig } from './scanner/types';

const scannerPipeline = new ScannerPipeline(pool);

// Create a new scan
app.post('/scanner/scans', async (req: Request, res: Response) => {
  try {
    const { targetId, scanType, options } = req.body;

    if (!targetId || !scanType) {
      return res.status(400).json({ error: 'targetId and scanType are required' });
    }

    // Create scan record
    const result = await pool.query(
      `INSERT INTO gotham.scans (target, scan_type, status, config)
       VALUES ($1, $2, 'pending', $3)
       RETURNING id`,
      [targetId, scanType, JSON.stringify(options || {})]
    );

    const scanId = result.rows[0].id;

    // Start scan asynchronously
    const config: ScanConfig = {
      targetId,
      scanType,
      options,
    };

    // Run scan in background
    scannerPipeline.execute(scanId, config).catch(error => {
      console.error(`Scan ${scanId} failed:`, error);
    });

    res.json({
      success: true,
      scanId,
      message: 'Scan started successfully',
    });
  } catch (error) {
    console.error('Create scan error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create scan' });
  }
});

// Get all scans
app.get('/scanner/scans', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT s.*, t.name as target_name
       FROM gotham.scans s
       LEFT JOIN gotham.targets t ON s.target = t.id::text
       ORDER BY s.created_at DESC
       LIMIT 100`
    );

    res.json({ scans: result.rows });
  } catch (error) {
    console.error('Get scans error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get scans' });
  }
});

// Get scan by ID
app.get('/scanner/scans/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT s.*, t.name as target_name
       FROM gotham.scans s
       LEFT JOIN gotham.targets t ON s.target = t.id::text
       WHERE s.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    res.json({ scan: result.rows[0] });
  } catch (error) {
    console.error('Get scan error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get scan' });
  }
});

// Get scan progress
app.get('/scanner/scans/:id/progress', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const progress = await scannerPipeline.getProgress(id);

    if (!progress) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    res.json(progress);
  } catch (error) {
    console.error('Get scan progress error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get progress' });
  }
});

// Cancel scan
app.post('/scanner/scans/:id/cancel', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    scannerPipeline.cancel(id);

    await pool.query(
      "UPDATE gotham.scans SET status = 'cancelled' WHERE id = $1",
      [id]
    );

    res.json({ success: true, message: 'Scan cancelled' });
  } catch (error) {
    console.error('Cancel scan error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to cancel scan' });
  }
});

// Get scan results
app.get('/scanner/scans/:id/results', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT sr.*, c.summary as cve_summary, c.cvss_score
       FROM gotham.scan_results sr
       LEFT JOIN gotham.cves c ON sr.cve_id = c.id
       WHERE sr.scan_id = $1
       ORDER BY 
         CASE sr.severity 
           WHEN 'critical' THEN 1 
           WHEN 'high' THEN 2 
           WHEN 'medium' THEN 3 
           WHEN 'low' THEN 4 
           ELSE 5 
         END,
         sr.confidence DESC`,
      [id]
    );

    res.json({ results: result.rows });
  } catch (error) {
    console.error('Get scan results error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get results' });
  }
});

// Get subdomains for a scan
app.get('/scanner/scans/:id/subdomains', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT s.* 
       FROM gotham.subdomains s
       JOIN gotham.scans sc ON s.target_id = sc.target
       WHERE sc.id = $1
       ORDER BY s.discovered_at DESC`,
      [id]
    );

    res.json({ subdomains: result.rows });
  } catch (error) {
    console.error('Get subdomains error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get subdomains' });
  }
});

// Get port scans for a scan
app.get('/scanner/scans/:id/ports', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT ps.* 
       FROM gotham.port_scans ps
       JOIN gotham.scans s ON ps.target_id = s.target
       WHERE s.id = $1 AND ps.state = 'open'
       ORDER BY ps.port ASC`,
      [id]
    );

    res.json({ ports: result.rows });
  } catch (error) {
    console.error('Get ports error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get ports' });
  }
});

// Targets management
app.get('/scanner/targets', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM gotham.targets ORDER BY created_at DESC'
    );
    res.json({ targets: result.rows });
  } catch (error) {
    console.error('Get targets error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get targets' });
  }
});

app.post('/scanner/targets', async (req: Request, res: Response) => {
  try {
    const { name, domain, ipAddress, description, tags } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await pool.query(
      `INSERT INTO gotham.targets (name, domain, ip_address, description, tags)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, domain, ipAddress, description, tags]
    );

    res.json({ success: true, target: result.rows[0] });
  } catch (error) {
    console.error('Create target error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create target' });
  }
});

// CVE database endpoints
app.get('/scanner/cves', async (req: Request, res: Response) => {
  try {
    const { severity, search, limit = 50 } = req.query;

    let query = 'SELECT * FROM gotham.cves WHERE 1=1';
    const params: any[] = [];

    if (severity) {
      query += ' AND severity = $' + (params.length + 1);
      params.push(severity);
    }

    if (search) {
      query += ' AND (id ILIKE $' + (params.length + 1) + 
               ' OR summary ILIKE $' + (params.length + 1) +
               ' OR description ILIKE $' + (params.length + 1) + ')';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY cvss_score DESC NULLS LAST LIMIT $' + (params.length + 1);
    params.push(parseInt(limit as string));

    const result = await pool.query(query, params);
    res.json({ cves: result.rows });
  } catch (error) {
    console.error('Get CVEs error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get CVEs' });
  }
});

app.get('/scanner/cves/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM gotham.cves WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'CVE not found' });
    }

    // Get PoCs for this CVE
    const pocs = await pool.query(
      'SELECT * FROM gotham.pocs WHERE cve_id = $1',
      [id]
    );

    // Get Nuclei templates
    const templates = await pool.query(
      'SELECT * FROM gotham.nuclei_templates WHERE cve_id = $1',
      [id]
    );

    res.json({
      cve: result.rows[0],
      pocs: pocs.rows,
      nucleiTemplates: templates.rows,
    });
  } catch (error) {
    console.error('Get CVE error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get CVE' });
  }
});

// Scanner stats
app.get('/scanner/stats', async (req: Request, res: Response) => {
  try {
    // Get scan counts
    const scanStats = await pool.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'running' THEN 1 END) as running,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
       FROM gotham.scans`
    );

    // Get vulnerability counts
    const vulnStats = await pool.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical,
        COUNT(CASE WHEN severity = 'high' THEN 1 END) as high,
        COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium,
        COUNT(CASE WHEN severity = 'low' THEN 1 END) as low,
        COUNT(CASE WHEN verified THEN 1 END) as verified,
        COUNT(CASE WHEN poc_available THEN 1 END) as with_poc
       FROM gotham.scan_results`
    );

    // Get target count
    const targetCount = await pool.query(
      'SELECT COUNT(*) as count FROM gotham.targets'
    );

    res.json({
      scans: scanStats.rows[0],
      vulnerabilities: vulnStats.rows[0],
      targets: targetCount.rows[0].count,
    });
  } catch (error) {
    console.error('Get scanner stats error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get stats' });
  }
});

// Cleanup old attacks every hour
setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  
  for (const [id, attack] of activeAttacks.entries()) {
    if ((attack.status === 'completed') || (attack.status === 'stopped') ||
        ((now - attack.startTime.getTime()) > maxAge)) {
      activeAttacks.delete(id);
    }
  }
}, 60 * 60 * 1000); // Run every hour

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Pentest Beam API running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

export { app };
