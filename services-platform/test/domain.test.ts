import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { auditRows, evaluateScenario } from "../src/domain.ts";

describe("evaluateScenario", () => {
  it("classe les territoires et conserve la complétude", () => {
    const result = evaluateScenario({
      criteria: [
        { id: "population", label: "Population", weight: 2, direction: "higher" },
        { id: "distance", label: "Distance", weight: 1, direction: "lower" },
      ],
      territories: [
        { id: "A", name: "A", values: { population: 100, distance: 40 } },
        { id: "B", name: "B", values: { population: 200, distance: 10 } },
        { id: "C", name: "C", values: { population: null, distance: 20 } },
      ],
    });
    assert.equal(result[0]?.id, "B");
    assert.equal(result[0]?.score, 100);
    assert.equal(result.find((row) => row.id === "C")?.completeness, 33.33);
  });

  it("refuse un scénario sans poids utile", () => {
    assert.throws(() => evaluateScenario({
      criteria: [{ id: "x", label: "X", weight: 0, direction: "higher" }],
      territories: [
        { id: "A", name: "A", values: { x: 1 } },
        { id: "B", name: "B", values: { x: 2 } },
      ],
    }), /somme des poids/);
  });
});

describe("auditRows", () => {
  it("détecte doublons, valeurs manquantes et types mixtes", () => {
    const result = auditRows([
      { pcode: "HT01", valeur: 10 },
      { pcode: "HT01", valeur: 10 },
      { pcode: "HT02", valeur: "inconnue" },
      { pcode: "HT03", valeur: null },
    ], ["pcode", "source"]);
    assert.equal(result.duplicateRows, 1);
    assert.equal(result.issues.some((issue) => issue.code === "missing_required_column" && issue.column === "source"), true);
    assert.equal(result.issues.some((issue) => issue.code === "mixed_types" && issue.column === "valeur"), true);
  });
});
