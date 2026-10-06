import type { VercelRequest, VercelResponse } from "./vercel";

const MAX_BODY_BYTES = 64 * 1024;

export function methodNotAllowed(res: VercelResponse, allow: string): void {
  res.setHeader("Allow", allow);
  res.status(405).json({ error: "method_not_allowed" });
}

// Lê JSON com limite de tamanho e Content-Type estrito. Rejeita o resto (fail closed).
export async function readJsonBody(req: VercelRequest): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  const ctype = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
  if (ctype !== "application/json") return { ok: false, error: "invalid_content_type" };
  const body = req.body;
  if (typeof body === "object" && body !== null) return { ok: true, data: body };
  if (typeof body !== "string") return { ok: false, error: "invalid_body" };
  if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) return { ok: false, error: "body_too_large" };
  try {
    return { ok: true, data: JSON.parse(body) };
  } catch {
    return { ok: false, error: "invalid_json" };
  }
}

export function header(req: VercelRequest, name: string): string | undefined {
  const v = req.headers[name.toLowerCase()];
  if (Array.isArray(v)) return v[0];
  return v;
}

export function clientIp(req: VercelRequest): string {
  const fwd = header(req, "x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim().slice(0, 64);
  const real = header(req, "x-real-ip");
  return (real || "unknown").slice(0, 64);
}

// Origem permitida: mesma origem do site (sem wildcard). Usado nos POSTs.
export function sameOrigin(req: VercelRequest, siteUrl: string): boolean {
  if (!siteUrl) return false;
  const origin = header(req, "origin") || header(req, "referer") || "";
  return origin.startsWith(siteUrl);
}

export function badRequest(res: VercelResponse, code: string): void {
  res.status(400).json({ error: code });
}

export function serverError(res: VercelResponse): void {
  res.status(500).json({ error: "internal_error" });
}
