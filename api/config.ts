import type { Handler } from "./_lib/vercel.js";
import { getEnv } from "./_lib/constants.js";

// Expõe SOMENTE a Public Key (pública por natureza, usada pelo Brick).
// Access Token e Webhook Secret NUNCA saem do servidor.
const handler: Handler = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }
  const { publicKey } = getEnv();
  if (!publicKey) {
    res.status(503).json({ error: "checkout_unavailable" });
    return;
  }
  res.status(200).json({ publicKey });
};

export default handler;
