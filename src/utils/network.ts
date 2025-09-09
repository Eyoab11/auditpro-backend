import dns from 'dns/promises';

export interface UrlPreflightResult {
  reachable: boolean;
  reason?: string;
  hostname: string;
}

// Lightweight DNS reachability check to avoid wasting Puppeteer launches on invalid domains
export async function preflightUrlReachability(rawUrl: string, timeoutMs = 5000): Promise<UrlPreflightResult> {
  let hostname = '';
  try {
    const u = new URL(rawUrl);
    hostname = u.hostname;
  } catch {
    return { reachable: false, reason: 'Invalid URL format', hostname: '' };
  }

  try {
    const timer = setTimeout(() => {
      // dns.lookup has no native abort signal; rely on timeout fallthrough
      // We just let it continue; if it later resolves we ignore
    }, timeoutMs).unref?.();
    await dns.lookup(hostname, { all: false });
    if (timer) clearTimeout(timer as any);
    return { reachable: true, hostname };
  } catch (err: any) {
    if (['ENOTFOUND', 'EAI_AGAIN'].includes(err?.code)) {
      return { reachable: false, reason: `DNS resolution failed (${err.code})`, hostname };
    }
    return { reachable: false, reason: `DNS lookup error: ${err.message || 'unknown error'}`, hostname };
  }
}
