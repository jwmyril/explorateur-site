import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PayhipError, payhipCheckout } from "../src/payhip.ts";

describe("paiement Payhip", () => {
  it("retourne le lien public configuré", () => {
    const env = { PAYHIP_URL_REPORTS: "https://payhip.com/b/rapport-atmart" } as Env;
    assert.deepEqual(payhipCheckout("reports-custom", env), {
      provider: "payhip",
      url: "https://payhip.com/b/rapport-atmart",
    });
  });

  it("refuse une offre Payhip non configurée", () => {
    const env = { PAYHIP_URL_REPORTS: "https://payhip.com/b/configure-reports" } as Env;
    assert.throws(() => payhipCheckout("reports-custom", env), PayhipError);
  });
});
