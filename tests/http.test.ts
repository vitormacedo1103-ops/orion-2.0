import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readJsonBody } from "../api/_lib/http.js";
import { rateLimit } from "../api/_lib/ratelimit.js";
import { getStore } from "../api/_lib/store.js";

function req(headers: Record<string, string>, body: unknown) {
  return { method: "POST", headers, query: {}, body } as never;
}

describe("TESTE 10: JSON inválido e Content-Type rejeitados", () => {
  it("rejeita content-type errado", async () => {
    const out = await readJsonBody(req({ "content-type": "text/plain" }, "{}"));
    assert.equal(out.ok, false);
  });
  it("rejeita JSON malformado", async () => {
    const out = await readJsonBody(req({ "content-type": "application/json" }, "{invalido"));
    assert.equal(out.ok, false);
  });
  it("aceita objeto já parseado", async () => {
    const out = await readJsonBody(req({ "content-type": "application/json" }, { a: 1 }));
    assert.equal(out.ok, true);
  });
});

describe("TESTE 6: webhook duplicado não reprocessa (store)", () => {
  it("has/add com TTL", async () => {
    const store = getStore();
    const key = `test-${Date.now()}`;
    assert.equal(await store.has(key), false);
    await store.add(key, 60);
    assert.equal(await store.has(key), true);
  });
});

describe("rate limit", () => {
  it("bloqueia após o limite", () => {
    const key = `rl-${Date.now()}`;
    assert.equal(rateLimit(key, 2, 60_000), true);
    assert.equal(rateLimit(key, 2, 60_000), true);
    assert.equal(rateLimit(key, 2, 60_000), false);
  });
});
