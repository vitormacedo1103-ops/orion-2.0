import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sameOrigin } from "../api/_lib/http.js";
import { classifyMpError, mpStatusOf } from "../api/_lib/mp.js";
import createOrder from "../api/create-order.js";
import orderStatus from "../api/order-status.js";
import webhook from "../api/webhooks/mercadopago.js";
import config from "../api/config.js";

function mockReq(method: string, headers: Record<string, string> = {}, query: Record<string, string> = {}, body: unknown = undefined) {
  return { method, headers, query, body } as never;
}

function mockRes() {
  const calls: { code: number; data: unknown }[] = [];
  const headers: Record<string, string> = {};
  const res = {
    status: (code: number) => { calls.push({ code, data: undefined }); return res; },
    json: (data: unknown) => { calls[calls.length - 1].data = data; },
    setHeader: (n: string, v: string) => { headers[n] = v; },
  } as never;
  return { res, calls };
}

const ENV_KEYS = ["MERCADOPAGO_ACCESS_TOKEN", "MERCADOPAGO_WEBHOOK_SECRET", "MERCADOPAGO_PUBLIC_KEY", "PUBLIC_SITE_URL", "MP_ENV"] as const;
let savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  savedEnv = {};
  for (const k of ENV_KEYS) {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

function testEnv() {
  process.env.MERCADOPAGO_ACCESS_TOKEN = "APP_USR-test-dummy-token-123456";
  process.env.MERCADOPAGO_WEBHOOK_SECRET = "dummy-secret";
  process.env.MERCADOPAGO_PUBLIC_KEY = "TEST-dummy";
  process.env.PUBLIC_SITE_URL = "http://test.local";
  process.env.MP_ENV = "test";
}

describe("fail closed sem configuração", () => {
  it("create-order sem env => 503 (sem rede)", async () => {
    const { res, calls } = mockRes();
    await createOrder(mockReq("POST", { "content-type": "application/json" }, {}, {}), res);
    assert.equal(calls[0].code, 503);
  });
  it("order-status sem env => 503 (sem rede)", async () => {
    const { res, calls } = mockRes();
    await orderStatus(mockReq("GET", {}, { id: "ORD123" }), res);
    assert.equal(calls[0].code, 503);
  });
  it("webhook sem env => 503 (sem rede)", async () => {
    const { res, calls } = mockRes();
    await webhook(mockReq("POST", {}, {}), res);
    assert.equal(calls[0].code, 503);
  });
  it("config sem public key => 503", async () => {
    const { res, calls } = mockRes();
    await config(mockReq("GET"), res);
    assert.equal(calls[0].code, 503);
  });
});

describe("webhook sem assinatura válida => 401 (sem rede)", () => {
  it("assinatura ausente é rejeitada antes de qualquer fetch", async () => {
    testEnv();
    const { res, calls } = mockRes();
    await webhook(mockReq("POST", {}, { "data.id": "ORD123" }), res);
    assert.equal(calls[0].code, 401);
  });
});

describe("sameOrigin exato (anti sufixo de domínio)", () => {
  const site = "https://www.orionnexofficial.com";
  it("Origin exata passa", () => {
    assert.equal(sameOrigin(mockReq("POST", { origin: site }), site), true);
  });
  it("sufixo malicioso falha", () => {
    assert.equal(sameOrigin(mockReq("POST", { origin: `${site}.evil.com` }), site), false);
  });
  it("Referer com path passa; ausente falha", () => {
    assert.equal(sameOrigin(mockReq("POST", { referer: `${site}/checkout` }), site), true);
    assert.equal(sameOrigin(mockReq("POST", {}), site), false);
  });
});

describe("classificação de erro do Mercado Pago", () => {
  it("400/422 => invalid; 401/403 => config; resto => upstream", () => {
    assert.equal(classifyMpError(400), "invalid");
    assert.equal(classifyMpError(422), "invalid");
    assert.equal(classifyMpError(401), "config");
    assert.equal(classifyMpError(403), "config");
    assert.equal(classifyMpError(500), "upstream");
    assert.equal(classifyMpError(0), "upstream");
  });
  it("mpStatusOf extrai código do sufixo da mensagem", () => {
    assert.equal(mpStatusOf(new Error("mp_create_pix_failed:422")), 422);
    assert.equal(mpStatusOf(new Error("timeout")), null);
  });
});

describe("referência estática do checkout", () => {
  it("checkout/index.html aponta para /checkout/checkout.js absoluto", () => {
    const root = join(__dirname, "..", "..");
    const html = readFileSync(join(root, "checkout", "index.html"), "utf8");
    assert.match(html, /<script src="\/checkout\/checkout\.js"/);
    assert.doesNotMatch(html, /<script src="checkout\.js"/);
  });
});
