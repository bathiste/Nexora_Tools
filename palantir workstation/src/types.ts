export interface ProxyConfig {
  type: 'socks4' | 'socks5' | 'http' | 'https';
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export interface AttackConfig {
  target: string;
  duration: number;
  threads: number;
  rateLimit: number;
  method: 'GET' | 'POST' | 'HEAD' | 'PUT' | 'DELETE';
  proxies: ProxyConfig[];
  userAgents: string[];
  headers?: Record<string, string>;
  payload?: string;
}

export interface Authorization {
  clientId: string;
  targetUrl: string;
  authorizedBy: string;
  authorizationDate: Date;
  scope: string;
  validUntil: Date;
}

export interface AttackStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  startTime: Date;
  endTime?: Date;
  bytesSent: number;
  bytesReceived: number;
}

export interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  message: string;
  proxy?: string;
  userAgent?: string;
  responseCode?: number;
  error?: string;
}
