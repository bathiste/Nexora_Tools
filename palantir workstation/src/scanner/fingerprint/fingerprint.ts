/**
 * Fingerprinting Module
 * HTTP fingerprinting and technology detection
 */

import { EventEmitter } from 'events';
import axios, { AxiosResponse } from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { HttpProxyAgent } from 'http-proxy-agent';
import {
  ScanConfig,
  HttpFingerprint,
  DetectedTechnology,
  HttpFingerprintConfig,
} from '../types';

export class FingerprintModule extends EventEmitter {
  private cancelled = false;

  cancel(): void {
    this.cancelled = true;
  }

  reset(): void {
    this.cancelled = false;
  }

  /**
   * Scan HTTP services and fingerprint technologies
   */
  async scanHttp(
    hosts: Array<{ host: string; port: number; https: boolean }>,
    config: ScanConfig
  ): Promise<HttpFingerprint[]> {
    this.reset();
    const fingerprints: HttpFingerprint[] = [];

    this.emit('progress', {
      phase: 'fingerprint.http',
      message: `Fingerprinting ${hosts.length} web services`,
    });

    for (const { host, port, https } of hosts) {
      if (this.cancelled) break;

      try {
        const url = `${https ? 'https' : 'http'}://${host}:${port}`;
        const fp = await this.fingerprintUrl(url, config);
        
        if (fp) {
          fingerprints.push(fp);
          this.emit('progress', {
            phase: 'fingerprint.http',
            message: `Fingerprinted ${url}: ${fp.technologies?.length || 0} technologies`,
          });
        }
      } catch (error) {
        console.error(`Failed to fingerprint ${host}:${port}:`, error);
      }
    }

    return fingerprints;
  }

  /**
   * Fingerprint a single URL
   */
  private async fingerprintUrl(
    url: string,
    config: ScanConfig
  ): Promise<HttpFingerprint | null> {
    try {
      const response = await this.makeRequest(url, config);
      if (!response) return null;

      const headers = response.headers as Record<string, string>;
      const html = response.data as string;

      // Extract technologies
      const technologies = this.detectTechnologies(headers, html, response);

      // Detect WAF
      const wafDetection = this.detectWAF(headers, html);

      return {
        targetId: '', // Set by caller
        url,
        statusCode: response.status,
        title: this.extractTitle(html),
        headers,
        technologies,
        server: headers['server'],
        contentType: headers['content-type'],
        contentLength: parseInt(headers['content-length'] || '0'),
        redirectsTo: response.request?.res?.responseUrl ||
                   (response.request?._redirectCount > 0 ? response.request._currentUrl : undefined),
        isHttps: url.startsWith('https'),
        hasWaf: wafDetection.detected,
        wafName: wafDetection.name,
        fingerprintedAt: new Date(),
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Make HTTP request with proper configuration
   */
  private async makeRequest(
    url: string,
    config: ScanConfig
  ): Promise<AxiosResponse | null> {
    const timeout = config.options?.timeout || 10000;
    
    try {
      const response = await axios.get(url, {
        timeout,
        maxRedirects: 5,
        validateStatus: () => true, // Accept all status codes
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
        },
        // Ignore SSL certificate errors for scanning
        httpsAgent: new (require('https').Agent)({
          rejectUnauthorized: false,
        }),
      });

      return response;
    } catch (error) {
      // Try with http if https fails
      if (url.startsWith('https')) {
        try {
          return await axios.get(url.replace('https', 'http'), {
            timeout,
            validateStatus: () => true,
          });
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  /**
   * Detect technologies from headers and HTML
   */
  private detectTechnologies(
    headers: Record<string, string>,
    html: string,
    response: AxiosResponse
  ): DetectedTechnology[] {
    const technologies: DetectedTechnology[] = [];

    // Server header
    if (headers['server']) {
      const server = headers['server'];
      const match = server.match(/^(\w+)(?:\/([\d.]+))?/);
      if (match) {
        technologies.push({
          name: match[1],
          version: match[2],
          confidence: 95,
          detectionMethod: 'header',
        });
      }
    }

    // X-Powered-By header
    if (headers['x-powered-by']) {
      const powered = headers['x-powered-by'];
      const match = powered.match(/^(\w+)(?:\/([\d.]+))?/);
      if (match) {
        technologies.push({
          name: match[1],
          version: match[2],
          confidence: 90,
          detectionMethod: 'header',
        });
      }
    }

    // Detect from HTML
    const htmlDetections: Array<{ name: string; pattern: RegExp; category: string }> = [
      { name: 'WordPress', pattern: /wp-content|wp-includes|wordpress/i, category: 'cms' },
      { name: 'Drupal', pattern: /drupal|sites\/default\/files/i, category: 'cms' },
      { name: 'Joomla', pattern: /joomla|\/media\/jui/i, category: 'cms' },
      { name: 'React', pattern: /react|__REACT|data-react/i, category: 'framework' },
      { name: 'Angular', pattern: /angular|ng-|data-ng-/i, category: 'framework' },
      { name: 'Vue.js', pattern: /vue\.js|data-v-/i, category: 'framework' },
      { name: 'jQuery', pattern: /jquery[/-]([\d.]+)/i, category: 'library' },
      { name: 'Bootstrap', pattern: /bootstrap[/-]([\d.]+)/i, category: 'library' },
      { name: 'PHP', pattern: /\.php\?|phpinfo|laravel|symfony/i, category: 'language' },
      { name: 'ASP.NET', pattern: /asp\.net|__VIEWSTATE|\.aspx/i, category: 'framework' },
      { name: 'Django', pattern: /django|csrfmiddlewaretoken/i, category: 'framework' },
      { name: 'Ruby on Rails', pattern: /rails|ruby/i, category: 'framework' },
      { name: 'Shopify', pattern: /shopify|myshopify/i, category: 'ecommerce' },
      { name: 'Magento', pattern: /magento|mage-/i, category: 'ecommerce' },
      { name: 'WooCommerce', pattern: /woocommerce|wc-/i, category: 'ecommerce' },
      { name: 'Google Analytics', pattern: /google-analytics|ga\(|gtag/i, category: 'analytics' },
      { name: 'Cloudflare', pattern: /cloudflare|__cfduid|cf-ray/i, category: 'cdn' },
      { name: 'AWS', pattern: /amazonaws|s3\.amazonaws/i, category: 'cloud' },
      { name: 'Nginx', pattern: /nginx/i, category: 'web-server' },
      { name: 'Apache', pattern: /apache/i, category: 'web-server' },
      { name: 'IIS', pattern: /iis|microsoft-iis/i, category: 'web-server' },
    ];

    for (const detection of htmlDetections) {
      if (detection.pattern.test(html)) {
        const versionMatch = html.match(detection.pattern);
        const version = versionMatch?.[1] || versionMatch?.[2];
        
        // Check if already detected from headers
        const existing = technologies.find(t => 
          t.name.toLowerCase() === detection.name.toLowerCase()
        );
        
        if (!existing) {
          technologies.push({
            name: detection.name,
            version,
            confidence: version ? 90 : 75,
            detectionMethod: 'body',
          });
        }
      }
    }

    // Cookies
    const cookies = headers['set-cookie'] || [];
    for (const cookie of Array.isArray(cookies) ? cookies : [cookies]) {
      if (/session|php/.test(cookie)) {
        const hasPHP = technologies.some(t => t.name === 'PHP');
        if (!hasPHP) {
          technologies.push({
            name: 'PHP',
            confidence: 60,
            detectionMethod: 'cookie',
          });
        }
      }
      if (/csrf|django/.test(cookie)) {
        const hasDjango = technologies.some(t => t.name === 'Django');
        if (!hasDjango) {
          technologies.push({
            name: 'Django',
            confidence: 70,
            detectionMethod: 'cookie',
          });
        }
      }
    }

    return technologies;
  }

  /**
   * Detect WAF from headers and response
   */
  private detectWAF(
    headers: Record<string, string>,
    html: string
  ): { detected: boolean; name?: string } {
    const wafSignatures: Array<{ name: string; pattern: RegExp }> = [
      { name: 'Cloudflare', pattern: /cloudflare|__cfduid|cf-ray|cf-request-id/i },
      { name: 'AWS WAF', pattern: /awselb|awsalb|x-amzn-/i },
      { name: 'Akamai', pattern: /akamai|akamai-edge/i },
      { name: 'Incapsula', pattern: /incapsula|visid_incap/i },
      { name: 'Sucuri', pattern: /sucuri|x-sucuri-/i },
      { name: 'ModSecurity', pattern: /mod_security|modsecurity/i },
      { name: 'F5 BIG-IP', pattern: /f5|bigip|big-ip/i },
      { name: 'Imperva', pattern: /imperva|incapsula/i },
      { name: 'Barracuda', pattern: /barracuda|bnmsg/i },
      { name: 'Fortinet', pattern: /fortinet|fortigate/i },
      { name: 'Citrix', pattern: /citrix|netscaler/i },
    ];

    const headerString = JSON.stringify(headers).toLowerCase();

    for (const waf of wafSignatures) {
      if (waf.pattern.test(headerString) || waf.pattern.test(html)) {
        return { detected: true, name: waf.name };
      }
    }

    return { detected: false };
  }

  /**
   * Extract page title from HTML
   */
  private extractTitle(html: string): string | undefined {
    const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    return match?.[1]?.trim() || undefined;
  }
}

export default FingerprintModule;
