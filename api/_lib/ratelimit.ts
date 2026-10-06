// Rate limiting em memória (por instância serverless).
// Documentado: protege contra abuso casual; para produção com tráfego real,
// usar firewall/rate limit da Vercel ou Redis. Nunca é a única defesa.
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  b.count += 1;
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.resetAt <= now) buckets.delete(k);
      if (buckets.size <= 4000) break;
    }
  }
  return b.count <= limit;
}
