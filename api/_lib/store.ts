import type { OrderStatus } from "./constants";

// Persistência do processamento de webhooks (idempotência).
// Padrão: memória local (ok para testes; serverless pode perder estado entre
// instâncias — em produção configure Upstash Redis via env).
// Formato Upstash REST: POST {url}/set/{key}/{value} e GET {url}/get/{key}
// com header Authorization: Bearer {token}.

interface ProcessedStore {
  has(key: string): Promise<boolean>;
  add(key: string, ttlSeconds: number): Promise<void>;
}

class MemoryStore implements ProcessedStore {
  private map = new Map<string, number>();
  async has(key: string): Promise<boolean> {
    const exp = this.map.get(key);
    if (!exp) return false;
    if (Date.now() > exp) {
      this.map.delete(key);
      return false;
    }
    return true;
  }
  async add(key: string, ttlSeconds: number): Promise<void> {
    this.map.set(key, Date.now() + ttlSeconds * 1000);
  }
}

class UpstashStore implements ProcessedStore {
  constructor(private url: string, private token: string) {}
  private async call(path: string): Promise<Response> {
    return fetch(`${this.url}${path}`, { headers: { Authorization: `Bearer ${this.token}` } });
  }
  async has(key: string): Promise<boolean> {
    try {
      const res = await this.call(`/get/${encodeURIComponent(key)}`);
      if (!res.ok) return false;
      const data = (await res.json()) as { result?: string | null };
      return data.result !== null && data.result !== undefined;
    } catch {
      return false;
    }
  }
  async add(key: string, ttlSeconds: number): Promise<void> {
    await this.call(`/set/${encodeURIComponent(key)}/1/EX/${ttlSeconds}`).catch(() => undefined);
  }
}

let instance: ProcessedStore | null = null;

export function getStore(): ProcessedStore {
  if (instance) return instance;
  const url = (process.env.UPSTASH_REDIS_REST_URL || "").replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || "";
  instance = url && token ? new UpstashStore(url, token) : new MemoryStore();
  return instance;
}

export interface OrderRecord {
  status: OrderStatus;
  updatedAt: string;
}

// Cache simples de status consultado (fonte oficial continua sendo o Mercado Pago).
const statusCache = new Map<string, OrderRecord>();

export function cacheStatus(orderId: string, status: OrderStatus): void {
  statusCache.set(orderId, { status, updatedAt: new Date().toISOString() });
}

export function cachedStatus(orderId: string): OrderRecord | undefined {
  return statusCache.get(orderId);
}
