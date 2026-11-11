
const ISP_IP_RANGES = [
  [24, 0, 0, 0], [50, 0, 0, 0], [68, 0, 0, 0], [71, 0, 0, 0], [73, 0, 0, 0], [75, 0, 0, 0], [98, 0, 0, 0], [99, 0, 0, 0],
  [81, 128, 0, 0], [86, 0, 0, 0],
  [80, 128, 0, 0], [84, 128, 0, 0],
  [80, 0, 0, 0], [81, 0, 0, 0],
  [60, 0, 0, 0], [61, 0, 0, 0], [110, 0, 0, 0], [118, 0, 0, 0], [126, 0, 0, 0],
  [49, 0, 0, 0], [103, 0, 0, 0], [157, 0, 0, 0],
  [1, 128, 0, 0], [58, 0, 0, 0], [110, 128, 0, 0],
  [177, 0, 0, 0], [189, 0, 0, 0], [200, 0, 0, 0],
];

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPad; CPU OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
];

function randomISPIP(): string {
  const range = ISP_IP_RANGES[Math.floor(Math.random() * ISP_IP_RANGES.length)];
  return `${range[0] + Math.floor(Math.random() * 16)}.${range[1] + Math.floor(Math.random() * 256)}.${range[2] + Math.floor(Math.random() * 256)}.${range[3] + Math.floor(Math.random() * 254) + 1}`;
}

function randomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export interface StealthFetchOptions extends RequestInit {
  timeout?: number; // ms, default 10000
  retries?: number; // default 1
  stealth?: boolean; // default true · inject random headers
}

const pendingRequests = new Map<string, Promise<Response>>();

export async function stealthFetch(url: string, options: StealthFetchOptions = {}): Promise<Response> {
  const { timeout = 10000, retries = 1, stealth = true, headers: customHeaders, ...rest } = options;

  const headers = new Headers(customHeaders);
  if (stealth) {
    if (!headers.has('User-Agent')) headers.set('User-Agent', randomUserAgent());
    if (!headers.has('X-Forwarded-For')) headers.set('X-Forwarded-For', randomISPIP());
    if (!headers.has('Accept-Language')) headers.set('Accept-Language', 'en-US,en;q=0.9');
  }

  const coalesceKey = `${rest.method || 'GET'}:${url}`;
  if (pendingRequests.has(coalesceKey)) {
    return pendingRequests.get(coalesceKey)!.then(r => r.clone());
  }

  const doFetch = async (attempt: number): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...rest,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (attempt < retries && (error.name === 'AbortError' || error.name === 'TypeError')) {
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        return doFetch(attempt + 1);
      }
      throw error;
    }
  };

  const promise = doFetch(0).finally(() => {
    pendingRequests.delete(coalesceKey);
  });

  pendingRequests.set(coalesceKey, promise);
  return promise.then(r => r.clone());
}

export async function stealthFetchJSON<T = any>(url: string, options: StealthFetchOptions = {}): Promise<T> {
  const response = await stealthFetch(url, {
    ...options,
    headers: {
      ...(options.headers as Record<string, string> || {}),
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}
