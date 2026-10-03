import net from 'node:net';
import dns from 'node:dns/promises';

export interface SafeFetchOptions extends RequestInit {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  allowedHosts?: Set<string>;
}

export const DEFAULT_MAX_TEXT_BYTES = 5 * 1024 * 1024; // 5 MB
export const DEFAULT_MAX_JSON_BYTES = 2 * 1024 * 1024; // 2 MB
export const DEFAULT_MAX_MEDIA_BYTES = 25 * 1024 * 1024; // 25 MB

/**
 * Checks whether an IP string belongs to a private, loopback, link-local,
 * multicast, carrier-grade NAT, or cloud metadata network.
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  const cleanIp = ip.replace(/^::ffff:/i, '');
  if (net.isIPv4(cleanIp)) {
    const parts = cleanIp.split('.').map(Number);
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return true;
    if (parts[0] === 0 || parts[0] === 10 || parts[0] === 127) return true; // 0.0.0.0/8, 10.0.0.0/8, 127.0.0.0/8
    if (parts[0] === 169 && parts[1] === 254) return true; // 169.254.0.0/16 Link-Local / Cloud Metadata
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // 172.16.0.0/12 Private
    if (parts[0] === 192 && parts[1] === 168) return true; // 192.168.0.0/16 Private
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true; // 100.64.0.0/10 CGNAT
    if (parts[0] === 192 && parts[1] === 0 && parts[2] === 2) return true; // TEST-NET-1
    if (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19)) return true; // Benchmarking
    if (parts[0] === 198 && parts[1] === 51 && parts[2] === 100) return true; // TEST-NET-2
    if (parts[0] === 203 && parts[1] === 0 && parts[2] === 113) return true; // TEST-NET-3
    if (parts[0] >= 224) return true; // 224.0.0.0/4 Multicast + Future use
    return false;
  }
  if (net.isIPv6(cleanIp)) {
    const lower = cleanIp.toLowerCase();
    if (
      lower === '::1' ||
      lower === '::' ||
      lower.startsWith('fe80:') ||
      lower.startsWith('fc') ||
      lower.startsWith('fd')
    ) {
      return true;
    }
    return false;
  }
  return true;
}

/**
 * Validates a target URL before fetching to protect against SSRF and cloud metadata access.
 */
export async function isSafePublicUrl(rawUrl: string, allowedHosts?: Set<string>): Promise<boolean> {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    if (parsed.username || parsed.password) return false;

    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname === 'metadata.google.internal' ||
      hostname === 'metadata'
    ) {
      return false;
    }

    if (allowedHosts && allowedHosts.size > 0 && !allowedHosts.has(hostname)) {
      return false;
    }

    if (net.isIP(hostname)) {
      return !isPrivateOrReservedIp(hostname);
    }

    const records = await dns.lookup(hostname, { all: true });
    if (!records || records.length === 0) return false;
    return records.every((r) => !isPrivateOrReservedIp(r.address));
  } catch {
    return false;
  }
}

/**
 * Reads a fetch response stream up to a hard byte limit, aborting if the limit is exceeded.
 */
export async function readResponseWithLimit(
  res: Response,
  maxBytes: number = DEFAULT_MAX_TEXT_BYTES
): Promise<Buffer> {
  const contentLength = res.headers.get('content-length');
  if (contentLength) {
    const parsedLen = parseInt(contentLength, 10);
    if (!isNaN(parsedLen) && parsedLen > maxBytes) {
      throw new Error(`Response size (${parsedLen} bytes) exceeds limit of ${maxBytes} bytes.`);
    }
  }

  if (!res.body) {
    return Buffer.alloc(0);
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  const reader = res.body.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.length;
        if (totalBytes > maxBytes) {
          reader.cancel('Max byte limit exceeded');
          throw new Error(`Response stream exceeded maximum allowed size of ${maxBytes} bytes.`);
        }
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks);
}

/**
 * SSRF-safe fetch with per-hop redirect validation and response size limits.
 */
export async function safeFetch(
  initialUrl: string,
  options: SafeFetchOptions = {}
): Promise<Response> {
  const {
    timeoutMs = 12000,
    maxRedirects = 5,
    allowedHosts,
    headers,
    ...fetchRest
  } = options;

  let currentUrl = initialUrl;
  let redirectsCount = 0;

  while (true) {
    const isSafe = await isSafePublicUrl(currentUrl, allowedHosts);
    if (!isSafe) {
      throw new Error(`Target destination is restricted or invalid: ${currentUrl}`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(currentUrl, {
        ...fetchRest,
        headers,
        redirect: 'manual',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle redirect status codes (301, 302, 303, 307, 308)
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        redirectsCount++;
        if (redirectsCount > maxRedirects) {
          throw new Error(`Too many redirects (exceeded ${maxRedirects} hops).`);
        }

        const location = res.headers.get('location');
        if (!location) {
          throw new Error(`Redirect response (${res.status}) missing Location header.`);
        }

        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      return res;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`Request timed out after ${timeoutMs}ms.`);
      }
      throw err;
    }
  }
}

/**
 * Fetch and return text with strict SSRF and size ceiling enforcement.
 */
export async function safeFetchText(
  url: string,
  maxBytes: number = DEFAULT_MAX_TEXT_BYTES,
  options: SafeFetchOptions = {}
): Promise<string> {
  const res = await safeFetch(url, { ...options, maxBytes });
  if (!res.ok) {
    throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
  }
  const buf = await readResponseWithLimit(res, maxBytes);
  return buf.toString('utf-8');
}

/**
 * Fetch and parse JSON with strict SSRF and size ceiling enforcement.
 */
export async function safeFetchJson<T>(
  url: string,
  maxBytes: number = DEFAULT_MAX_JSON_BYTES,
  options: SafeFetchOptions = {}
): Promise<T> {
  const text = await safeFetchText(url, maxBytes, {
    ...options,
    headers: { Accept: 'application/json', ...(options.headers || {}) },
  });
  return JSON.parse(text) as T;
}
