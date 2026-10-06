// Validação server-side (frontend valida também, mas o servidor NÃO confia).
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,}$/;
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ORDER_ID_RE = /^[A-Za-z0-9-]{4,64}$/;

export function isEmail(v: unknown): v is string {
  return typeof v === "string" && v.length <= 120 && EMAIL_RE.test(v.trim());
}

export function isUuidV4(v: unknown): v is string {
  return typeof v === "string" && UUID_V4_RE.test(v);
}

export function isOrderId(v: unknown): v is string {
  return typeof v === "string" && ORDER_ID_RE.test(v);
}

function onlyDigits(v: string): string {
  return v.replace(/\D/g, "");
}

// CPF com dígitos verificadores (algoritmo oficial).
export function isCpf(v: unknown): boolean {
  if (typeof v !== "string") return false;
  const d = onlyDigits(v);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(d[i]) * (10 - i);
  let mod = (sum * 10) % 11;
  if (mod === 10) mod = 0;
  if (mod !== Number(d[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(d[i]) * (11 - i);
  mod = (sum * 10) % 11;
  if (mod === 10) mod = 0;
  return mod === Number(d[10]);
}

// WhatsApp BR: 10 ou 11 dígitos.
export function isPhoneBr(v: unknown): boolean {
  if (typeof v !== "string") return false;
  const d = onlyDigits(v);
  return d.length === 10 || d.length === 11;
}

export function isName(v: unknown): v is string {
  return typeof v === "string" && v.trim().length >= 3 && v.trim().length <= 80;
}

export type PaymentMethod = "pix" | "card";

export function isPaymentMethod(v: unknown): v is PaymentMethod {
  return v === "pix" || v === "card";
}

// Mascara CPF para logs: 123.456.***-**
export function maskCpf(v: string): string {
  const d = onlyDigits(v);
  if (d.length !== 11) return "***";
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.***-**`;
}

export function maskEmail(v: string): string {
  const [user, domain] = v.split("@");
  if (!domain) return "***";
  return `${(user || "").slice(0, 2)}***@${domain}`;
}
