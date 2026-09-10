export type ServiceId = "reports" | "scenarios" | "data_quality" | "instances";

export interface Criterion {
  id: string;
  label: string;
  weight: number;
  direction: "higher" | "lower";
}

export interface TerritoryInput {
  id: string;
  name: string;
  values: Record<string, number | null>;
}

export interface ScenarioInput {
  criteria: Criterion[];
  territories: TerritoryInput[];
}

export interface ScenarioResult {
  id: string;
  name: string;
  score: number | null;
  completeness: number;
  contributions: Record<string, number | null>;
}

export function evaluateScenario(input: ScenarioInput): ScenarioResult[] {
  if (input.criteria.length === 0) throw new Error("Au moins un critère est requis.");
  if (input.territories.length < 2) throw new Error("Au moins deux territoires sont requis.");

  const totalWeight = input.criteria.reduce((sum, criterion) => {
    if (!Number.isFinite(criterion.weight) || criterion.weight < 0) {
      throw new Error(`Poids invalide pour ${criterion.id}.`);
    }
    return sum + criterion.weight;
  }, 0);
  if (totalWeight <= 0) throw new Error("La somme des poids doit être positive.");

  const ranges = new Map<string, { min: number; max: number }>();
  for (const criterion of input.criteria) {
    const values = input.territories
      .map((territory) => territory.values[criterion.id])
      .filter((value): value is number => value !== null && Number.isFinite(value));
    if (values.length) ranges.set(criterion.id, { min: Math.min(...values), max: Math.max(...values) });
  }

  const results = input.territories.map((territory) => {
    let weightedScore = 0;
    let availableWeight = 0;
    const contributions: Record<string, number | null> = {};
    for (const criterion of input.criteria) {
      const value = territory.values[criterion.id];
      const range = ranges.get(criterion.id);
      if (value === null || value === undefined || !Number.isFinite(value) || !range) {
        contributions[criterion.id] = null;
        continue;
      }
      const spread = range.max - range.min;
      const normalized = spread === 0 ? 0.5 : (value - range.min) / spread;
      const directed = criterion.direction === "higher" ? normalized : 1 - normalized;
      const contribution = directed * criterion.weight;
      contributions[criterion.id] = round(contribution);
      weightedScore += contribution;
      availableWeight += criterion.weight;
    }
    return {
      id: territory.id,
      name: territory.name,
      score: availableWeight > 0 ? round((weightedScore / availableWeight) * 100) : null,
      completeness: round((availableWeight / totalWeight) * 100),
      contributions,
    };
  });

  return results.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}

export interface AuditIssue {
  severity: "major" | "minor";
  code: string;
  column?: string;
  message: string;
  count: number;
}

export interface AuditResult {
  rowCount: number;
  columnCount: number;
  completeness: number;
  duplicateRows: number;
  issues: AuditIssue[];
}

export function auditRows(rows: Array<Record<string, unknown>>, requiredColumns: string[] = []): AuditResult {
  if (rows.length === 0) throw new Error("Le jeu de données est vide.");
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const issues: AuditIssue[] = [];

  for (const column of requiredColumns) {
    if (!columns.includes(column)) {
      issues.push({ severity: "major", code: "missing_required_column", column, message: `Colonne obligatoire absente : ${column}`, count: 1 });
    }
  }

  let present = 0;
  let cells = 0;
  for (const column of columns) {
    let missing = 0;
    const types = new Set<string>();
    for (const row of rows) {
      cells += 1;
      const value = row[column];
      if (value === null || value === undefined || value === "") missing += 1;
      else {
        present += 1;
        types.add(typeof value);
      }
    }
    if (missing) issues.push({ severity: "minor", code: "missing_values", column, message: `${missing} valeur(s) manquante(s).`, count: missing });
    if (types.size > 1) issues.push({ severity: "major", code: "mixed_types", column, message: "Plusieurs types de valeurs sont mélangés.", count: types.size });
  }

  const fingerprints = rows.map((row) => stableStringify(row));
  const duplicateRows = fingerprints.length - new Set(fingerprints).size;
  if (duplicateRows) issues.push({ severity: "major", code: "duplicate_rows", message: `${duplicateRows} ligne(s) dupliquée(s).`, count: duplicateRows });

  return {
    rowCount: rows.length,
    columnCount: columns.length,
    completeness: cells ? round((present / cells) * 100) : 0,
    duplicateRows,
    issues,
  };
}

function stableStringify(value: Record<string, unknown>): string {
  const sorted = Object.keys(value).sort().reduce<Record<string, unknown>>((result, key) => {
    result[key] = value[key];
    return result;
  }, {});
  return JSON.stringify(sorted);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
