import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { isHandledEvent, mapYampiStatus, parseYampiBody, signYampiBody, verifyYampiSignature } from "../api/_lib/yampi.js";
import webhook from "../api/webhooks/yampi.js";

const SECRET = "wh_test_dummy_secret";

function mockReq(raw: Buffer, signature: string | undefined) {
  const headers: Record<string, string> = {};
  if (signature !== undefined) headers["x-yampi-hmac-sha256"] = signature;
  async function* stream() {
    yield raw;
  }
  return { method: "POST", headers, query: {}, [Symbol.asyncIterator]: stream } as never;
}

function mockRes() {
  const calls: { code: number; data: unknown }[] = [];
  const res = {
    status: (code: number) => { calls.push({ code, data: undefined }); return res; },
    json: (data: unknown) => { calls[calls.length - 1].data = data; },
    setHeader: () => undefined,
  } as never;
  return { res, calls };
}

function signedPayload(event: string, orderId: number, alias: string) {
  const body = { event, resource: { id: orderId, status: { data: { alias } } } };
  const raw = Buffer.from(JSON.stringify(body));
  return { raw, sig: signYampiBody(raw, SECRET) };
}

let saved: string | undefined;
beforeEach(() => {
  saved = process.env.YAMPI_WEBHOOK_SECRET;
  process.env.YAMPI_WEBHOOK_SECRET = SECRET;
});
afterEach(() => {
  if (saved === undefined) delete process.env.YAMPI_WEBHOOK_SECRET;
  else process.env.YAMPI_WEBHOOK_SECRET = saved;
});

describe("assinatura Yampi (HMAC-SHA256 base64 do corpo bruto)", () => {
  it("válida passa; adulterada ou ausente falha", () => {
    const raw = Buffer.from('{"event":"order.paid"}');
    const good = signYampiBody(raw, SECRET);
    assert.equal(verifyYampiSignature(raw, good, SECRET), true);
    assert.equal(verifyYampiSignature(Buffer.from('{"event":"x"}'), good, SECRET), false);
    assert.equal(verifyYampiSignature(raw, undefined, SECRET), false);
    assert.equal(verifyYampiSignature(raw, good, ""), false);
  });
  it("confere com HMAC independente", () => {
    const raw = Buffer.from("teste");
    const expected = createHmac("sha256", SECRET).update(raw).digest("base64");
    assert.equal(signYampiBody(raw, SECRET), expected);
  });
});

describe("eventos e status Yampi", () => {
  it("só order.paid e order.status.updated são tratados", () => {
    assert.equal(isHandledEvent("order.paid"), true);
    assert.equal(isHandledEvent("order.status.updated"), true);
    assert.equal(isHandledEvent("customer.created"), false);
  });
  it("status vem de resource.status.data.alias; desconhecido nunca aprova", () => {
    assert.equal(mapYampiStatus("paid"), "approved");
    assert.equal(mapYampiStatus("waiting_payment"), "pending");
    assert.equal(mapYampiStatus("refused"), "rejected");
    assert.equal(mapYampiStatus("whatever"), "unknown");
    const parsed = parseYampiBody({ event: "order.paid", resource: { id: 1, status: { data: { alias: "paid" } } } });
    assert.equal(parsed && parsed.resourceId, "1");
    assert.equal(parseYampiBody({ event: "x" }), null);
  });
});

describe("handler /api/webhooks/yampi", () => {
  it("assinatura inválida => 401", async () => {
    const { raw } = signedPayload("order.paid", 111, "paid");
    const { res, calls } = mockRes();
    await webhook(mockReq(raw, "assinatura-errada"), res);
    assert.equal(calls[0].code, 401);
  });
  it("evento desconhecido => 200 sem processar", async () => {
    const { raw, sig } = signedPayload("customer.created", 222, "paid");
    const { res, calls } = mockRes();
    await webhook(mockReq(raw, sig), res);
    assert.equal(calls[0].code, 200);
    assert.deepEqual(calls[0].data, { received: true, processed: false });
  });
  it("pagamento aprovado => 200 processed:true e repetição não reprocessa", async () => {
    const orderId = 300000 + (Date.now() % 100000);
    const { raw, sig } = signedPayload("order.paid", orderId, "paid");
    const first = mockRes();
    await webhook(mockReq(raw, sig), first.res);
    assert.equal(first.calls[0].code, 200);
    assert.deepEqual(first.calls[0].data, { received: true, processed: true, status: "approved" });
    const second = mockRes();
    await webhook(mockReq(raw, sig), second.res);
    assert.equal(second.calls[0].code, 200);
    assert.deepEqual(second.calls[0].data, { received: true, processed: false });
  });
});
