import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PRICE_OFFERS, offerById } from "../src/catalog.ts";

describe("catalogue tarifaire", () => {
  it("contient exactement une offre initiale par service", () => {
    assert.equal(PRICE_OFFERS.length, 4);
    assert.deepEqual(new Set(PRICE_OFFERS.map((offer) => offer.service)), new Set(["reports", "scenarios", "data_quality", "instances"]));
  });

  it("sépare les paiements uniques des abonnements", () => {
    assert.equal(offerById("reports-custom")?.cadence, "once");
    assert.equal(offerById("data-quality-complete")?.cadence, "once");
    assert.equal(offerById("scenarios-team")?.cadence, "month");
    assert.equal(offerById("instances-organization")?.cadence, "month");
  });
});
