import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("CTAs de compra apontam para a Yampi", () => {
  const YAMPI = "https://seguro.orionnexofficial.com/pay/YFEKMXMR2G";
  it("7 CTAs usam o link Yampi e nenhum aponta para checkout/", () => {
    const root = join(__dirname, "..", "..");
    const html = readFileSync(join(root, "index.html"), "utf8");
    const hrefs = html.match(new RegExp(`href="${YAMPI.replace(/[./]/g, (c) => `\\${c}`)}"`, "g")) || [];
    assert.equal(hrefs.length, 7);
    assert.doesNotMatch(html, /href="checkout\//);
  });
});

describe("demos funcionam com trailing slash", () => {
  it("vercel força barra final e demos usam paths relativos", () => {
    const root = join(__dirname, "..", "..");
    const vercel = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"));
    assert.equal(vercel.trailingSlash, true);
    const demos = ["clinica-essenza", "casa-sabor", "vetor-servicos", "marina-costa"];
    for (const d of demos) {
      const html = readFileSync(join(root, "demos", d, "index.html"), "utf8");
      assert.doesNotMatch(html, /(src|href)="\/(assets|image)\//);
    }
  });
});
