import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { EngramAdapter } from "./types.js";
import { LocalEngramAdapter } from "./local.js";
import { CloudEngramAdapter } from "./cloud.js";
import { CompositeEngramAdapter } from "./composite.js";

export interface ResolvedEngramConfig {
  cloudUrl?: string;
  localUrl?: string;
  token?: string;
}

export interface EngramTuiOptionsInput {
  cloudUrl?: string;
  baseUrl?: string;
  token?: string;
  enabled?: boolean;
  project?: string;
  pollInterval?: number;
}

function extractAttachHost(argv: string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? "";
    if (arg === "attach" || arg.endsWith("/attach")) {
      const next = argv[i + 1]?.trim();
      if (next) {
        const match = next.match(/^(?:https?:?\/?)?([^:\/\s]+)(?::\d+)?$/i);
        if (match && match[1]) {
          const host = match[1];
          if (host !== "localhost" && host !== "127.0.0.1" && host !== "0.0.0.0") {
            const protocol = /^https/i.test(next) ? "https:" : "http:";
            return `${protocol}//${host}:7437`;
          }
        }
      }
    }
    const ipMatch = arg.match(/(?:https?:?\/?)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/i);
    if (ipMatch && ipMatch[1] && ipMatch[1] !== "127.0.0.1" && ipMatch[1] !== "0.0.0.0") {
      const protocol = /^https/i.test(arg) ? "https:" : "http:";
      return `${protocol}//${ipMatch[1]}:7437`;
    }
  }
  return undefined;
}

export function loadEngramConfig(options?: EngramTuiOptionsInput): ResolvedEngramConfig {
  let cloudUrl = options?.cloudUrl ?? process.env.ENGRAM_CLOUD_URL;
  let localUrl = options?.baseUrl ?? process.env.ENGRAM_URL ?? process.env.ENGRAM_BASE_URL;
  let token = options?.token ?? process.env.ENGRAM_CLOUD_TOKEN ?? process.env.ENGRAM_TOKEN;

  if (!localUrl) {
    localUrl = extractAttachHost(process.argv);
  }

  if (!cloudUrl || !token) {
    try {
      const configPath = path.join(os.homedir(), ".engram", "cloud.json");
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, "utf-8");
        const parsed = JSON.parse(raw);
        if (typeof parsed.server_url === "string" && !cloudUrl) {
          cloudUrl = parsed.server_url;
        } else if (typeof parsed.url === "string" && !cloudUrl) {
          cloudUrl = parsed.url;
        } else if (typeof parsed.baseUrl === "string" && !cloudUrl) {
          cloudUrl = parsed.baseUrl;
        }
        if (typeof parsed.token === "string" && !token) {
          token = parsed.token;
        }
      }
    } catch {
      // Ignore file reading errors, fallback to local defaults
    }
  }

  return { cloudUrl, localUrl, token };
}

export function createConfiguredAdapter(options?: EngramTuiOptionsInput): EngramAdapter {
  const config = loadEngramConfig(options);
  const localAdapter = new LocalEngramAdapter({ baseUrl: config.localUrl });

  if (config.cloudUrl) {
    const cloudAdapter = new CloudEngramAdapter({
      baseUrl: config.cloudUrl,
      token: config.token,
    });
    return new CompositeEngramAdapter([localAdapter, cloudAdapter]);
  }

  return localAdapter;
}
