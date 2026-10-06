import { maskCpf, maskEmail } from "./validation";

// Log seguro: nunca imprime secrets, tokens, cartão, CVV ou CPF completo.
export function logEvent(event: string, fields: Record<string, unknown> = {}): void {
  const safe: Record<string, unknown> = { event, at: new Date().toISOString() };
  for (const [k, v] of Object.entries(fields)) {
    const key = k.toLowerCase();
    if (key.includes("token") || key.includes("secret") || key.includes("key") && key.includes("api")) {
      safe[k] = "[redacted]";
    } else if (key === "cpf") {
      safe[k] = typeof v === "string" ? maskCpf(v) : "***";
    } else if (key === "email") {
      safe[k] = typeof v === "string" ? maskEmail(v) : "***";
    } else if (key.includes("card") || key.includes("cvv") || key.includes("pan")) {
      safe[k] = "[redacted]";
    } else {
      safe[k] = v;
    }
  }
  console.log(JSON.stringify(safe));
}
