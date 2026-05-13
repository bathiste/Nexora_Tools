/**
 * Shared utility helpers for the Gotham API.
 */

import { Response } from 'express';
import * as fs from 'fs';
import { ProxyManager } from './proxyManager';
import { DEFAULT_USER_AGENTS } from './userAgents';
import { ProxyConfig } from './types';

/**
 * Sends a consistent 500 error response.
 */
export function sendError(res: Response, error: unknown, fallbackMessage = 'Internal server error') {
  const message = error instanceof Error ? error.message : fallbackMessage;
  res.status(500).json({ error: message });
}

/**
 * Loads proxy configs from a file path. Returns empty array if the file does not exist.
 */
export function loadProxies(proxyFile: string): ProxyConfig[] {
  const proxies: ProxyConfig[] = [];
  if (!fs.existsSync(proxyFile)) return proxies;

  const content = fs.readFileSync(proxyFile, 'utf-8');
  const lines = content.split('\n').map((l: string) => l.trim()).filter((l: string) => l && !l.startsWith('#'));
  // Re-use ProxyManager's built-in parser
  const mgr = new ProxyManager();
  for (const line of lines) {
    const parsed = mgr['parseProxyString'](line);
    if (parsed) proxies.push(parsed);
  }
  return proxies;
}

/**
 * Loads user-agent strings from a file path, merging with defaults.
 */
export function loadUserAgents(uaFile: string): string[] {
  let agents = [...DEFAULT_USER_AGENTS];
  if (!fs.existsSync(uaFile)) return agents;

  const content = fs.readFileSync(uaFile, 'utf-8');
  const custom = content.split('\n').map((l: string) => l.trim()).filter((l: string) => l && !l.startsWith('#'));
  agents = [...agents, ...custom];
  return agents;
}