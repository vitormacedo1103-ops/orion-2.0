import { createHmac, timingSafeEqual } from "node:crypto";

// Validação da assinatura oficial do Mercado Pago (docs: checkout-api-orders/notifications).
// Manifest: "id:{data.id_lower};request-id:{x-request-id};ts:{ts};" (omite ausentes).
// HMAC-SHA256 hex com o Webhook Secret; compara com v1 do header x-signature.

export interface ParsedSignature {
  ts: string;
  v1: string;
}

export function parseSignature(header: string | undefined): ParsedSignature | null {
  if (!header || typeof header !== "string") return null;
  const parts = header.split(",").map((p) => p.trim().split("="));
  let ts = "";
  let v1 = "";
  for (const [k, v] of parts) {
    if (k === "ts") ts = v || "";
    if (k === "v1") v1 = v || "";
  }
  if (!ts || !v1 || !/^[0-9a-fA-F]+$/.test(v1)) return null;
  return { ts, v1 };
}

export function buildManifest(dataId: string | undefined, requestId: string | undefined, ts: string): string {
  let manifest = "";
  if (dataId) manifest += `id:${dataId.toLowerCase()};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;
  return manifest;
}

export function signManifest(manifest: string, secret: string): string {
  return createHmac("sha256", secret).update(manifest).digest("hex");
}

export function verifySignature(opts: {
  xSignature: string | undefined;
  xRequestId: string | undefined;
  dataId: string | undefined;
  secret: string;
}): boolean {
  const { xSignature, xRequestId, dataId, secret } = opts;
  if (!secret) return false; // sem secret configurado => rejeita (fail closed)
  const parsed = parseSignature(xSignature);
  if (!parsed) return false;
  const expected = signManifest(buildManifest(dataId, xRequestId, parsed.ts), secret);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(parsed.v1, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
