

import { lookup as dnsLookup } from "node:dns/promises";
import https from "node:https";
import http from "node:http";

type Options = {
  headers?: Record<string, string>;
  timeoutMs?: number;
};

export async function fetchIpv4Json<T = unknown>(
  url: string,
  opts: Options = {}
): Promise<T> {
  const u = new URL(url);
  const isHttps = u.protocol === "https:";
  const port = u.port ? parseInt(u.port, 10) : isHttps ? 443 : 80;
  const timeoutMs = opts.timeoutMs ?? 12000;

  let ip: string;
  try {
    const r = await dnsLookup(u.hostname, { family: 4 });
    ip = r.address;
  } catch {
    ip = u.hostname;
  }

  return new Promise<T>((resolve, reject) => {
    const req = isHttps
      ? https.request({
          hostname: ip,
          port,
          path: u.pathname + u.search,
          method: "GET",
          headers: {
            "User-Agent": "HORUS-OSINT/6.2",
            Accept: "application/json",
            Host: u.hostname,
            ...(opts.headers ?? {}),
          },
          servername: u.hostname, // SNI
          timeout: timeoutMs,
        })
      : http.request({
          hostname: ip,
          port,
          path: u.pathname + u.search,
          method: "GET",
          headers: {
            "User-Agent": "HORUS-OSINT/6.2",
            Accept: "application/json",
            Host: u.hostname,
            ...(opts.headers ?? {}),
          },
          timeout: timeoutMs,
        });

    const timer = setTimeout(() => {
      req.destroy(new Error("timeout"));
    }, timeoutMs);

    req.on("response", (res) => {
      let body = "";
      res.on("data", (c: Buffer) => (body += c.toString()));
      res.on("end", () => {
        clearTimeout(timer);
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body) as T);
          } catch (e) {
            reject(
              new Error(
                `JSON parse failed: ${e instanceof Error ? e.message : "unknown"}`
              )
            );
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });

    req.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });

    req.end();
  });
}
