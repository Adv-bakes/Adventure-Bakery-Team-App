// The net-weight check, weighed at packing (FRM-520 v2, FSQM-020 v4, FSQM-021 v2; owner's decision,
// 2026-10-12). Three finished packs are weighed by the person packing and written on the lot
// record with the net weight on the label, the weight of the empty packaging and the unit. Until
// then the SQF Practitioner weighed them at release and wrote them only on FRM-701.
//
//  - The three weights are measured and typed by a person. Nothing here suggests or fills one.
//  - The app only does the sum (releaseAssist.netWeight: the empty packaging off, the average at
//    or above the label) and says the result at once, so a short weight is found on the table.
//  - A short weight is a true record: it is saved, and the person is told to stop and hold the
//    lot. It is never refused (owner).
//  - The field ids are FRM-701's own, so the release helper carries the same figures across.
//
// Relative imports only, so it can be tested in Node.

import { netWeight, type NetWeight } from "./releaseAssist";

export const PACK_WEIGHTS = {
  form: "FRM-520",
  section: "packing",
  declared: "net_weight_declared",
  tare: "packaging_tare",
  unit: "net_weight_unit",
  weights: ["pack_weight_1", "pack_weight_2", "pack_weight_3"],
  /** The result line is shown under this field. */
  after: "pack_weight_3",
} as const;

export type WeightState = "incomplete" | "ok" | "below" | "unreadable";

export interface WeightResult {
  state: WeightState;
  /** The sum, when it can be done. */
  net: NetWeight | null;
  /** One plain sentence for the form (English, like the form). */
  text: string;
}

const str = (v: unknown) => (v == null ? "" : String(v).trim());

/** All three pack weights are on the record. */
export function packsWeighed(values: Record<string, unknown> | null | undefined): boolean {
  return PACK_WEIGHTS.weights.every(k => str(values?.[k]) !== "");
}

export function packWeights(values: Record<string, unknown>): WeightResult {
  const all = [PACK_WEIGHTS.declared, PACK_WEIGHTS.tare, PACK_WEIGHTS.unit, ...PACK_WEIGHTS.weights];
  if (all.some(k => str(values[k]) === "")) {
    return { state: "incomplete", net: null, text: "Enter the net weight on the label, the empty packaging weight, the unit and the three pack weights, and the app works out the average net weight." };
  }
  const net = netWeight(values as Record<string, any>);
  if (!net) {
    return { state: "unreadable", net: null, text: `The net weight cannot be worked out: "${str(values[PACK_WEIGHTS.declared])}" must be one figure with its unit (for example 4 oz), and each weight a number above zero.` };
  }
  return net.ok
    ? { state: "ok", net, text: `Average net weight ${net.average} ${net.unit}, at or above the ${net.declared} ${net.unit} on the label.` }
    : { state: "below", net, text: `Average net weight ${net.average} ${net.unit} is BELOW the ${net.declared} ${net.unit} on the label. Stop packing, hold the lot on FRM-702 and tell the SQF Practitioner.` };
}

/** Does this revision of the form have the fields the weighing writes? */
export function packWeightsReady(schema: { sections?: { id?: string; fields?: { id?: string }[] }[] } | null | undefined): boolean {
  const ids = new Set(((schema?.sections ?? []).find(s => s.id === PACK_WEIGHTS.section)?.fields ?? []).map(f => f.id));
  return [PACK_WEIGHTS.declared, PACK_WEIGHTS.tare, PACK_WEIGHTS.unit, ...PACK_WEIGHTS.weights].every(id => ids.has(id));
}
