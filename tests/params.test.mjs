// Run with: npm test   (node --test, no extra dependencies)
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseParam, rangeStatus, readingsFor, isInexact, formatTypical, PARAM_META } from "../lib/params.js";

const pick = (s) => {
  const { value, qualifier, isRange } = parseParam(s);
  return { value, qualifier, isRange };
};

test("plain numbers", () => {
  assert.deepEqual(pick("0.25"), { value: 0.25, qualifier: null, isRange: false });
  assert.deepEqual(pick("7"), { value: 7, qualifier: null, isRange: false });
  assert.deepEqual(pick(" 6.8 "), { value: 6.8, qualifier: null, isRange: false });
  assert.deepEqual(pick(".5"), { value: 0.5, qualifier: null, isRange: false });
  assert.deepEqual(pick(15), { value: 15, qualifier: null, isRange: false });
  assert.equal(parseParam("0").value, 0);
});

test("blank and unreadable values keep raw text", () => {
  for (const s of ["", "   ", null, undefined]) {
    assert.equal(parseParam(s).value, null);
    assert.equal(parseParam(s).qualifier, null);
  }
  const bad = parseParam("high?? test strip smudged");
  assert.equal(bad.value, null);
  assert.equal(bad.raw, "high?? test strip smudged");
  assert.equal(parseParam("n/a").value, null);
  assert.equal(parseParam("-").value, null);
});

test("qualifiers", () => {
  assert.deepEqual(pick("<5"), { value: 5, qualifier: "<", isRange: false });
  assert.deepEqual(pick("< 0.25"), { value: 0.25, qualifier: "<", isRange: false });
  assert.deepEqual(pick("≤5"), { value: 5, qualifier: "<", isRange: false });
  assert.deepEqual(pick("<=5"), { value: 5, qualifier: "<", isRange: false });
  assert.deepEqual(pick(">80"), { value: 80, qualifier: ">", isRange: false });
  assert.deepEqual(pick("80+"), { value: 80, qualifier: ">", isRange: false });
  assert.deepEqual(pick("~7"), { value: 7, qualifier: "~", isRange: false });
  assert.deepEqual(pick("≈7.2"), { value: 7.2, qualifier: "~", isRange: false });
  assert.deepEqual(pick("approx 7"), { value: 7, qualifier: "~", isRange: false });
  assert.deepEqual(pick("7?"), { value: 7, qualifier: "~", isRange: false });
});

test("ranges plot at the midpoint and are flagged", () => {
  const r = parseParam("7.0-7.2");
  assert.equal(r.value, 7.1);
  assert.equal(r.isRange, true);
  assert.deepEqual(r.range, [7, 7.2]);
  assert.equal(parseParam("10 – 20").value, 15);
  assert.equal(parseParam("10 to 20 ppm").value, 15);
  assert.deepEqual(parseParam("20-10").range, [10, 20]);
  const same = parseParam("7-7");
  assert.equal(same.value, 7);
  assert.equal(same.isRange, false);
  assert.ok(isInexact(r));
  assert.ok(isInexact(parseParam("<5")));
  assert.ok(!isInexact(parseParam("5")));
});

test("units and decimal commas", () => {
  assert.equal(parseParam("15 ppm").value, 15);
  assert.equal(parseParam("15ppm").value, 15);
  assert.equal(parseParam("77°F").value, 77);
  assert.equal(parseParam("77 F").value, 77);
  assert.equal(parseParam("6 dGH").value, 6);
  assert.equal(parseParam("4°dH").value, 4);
  assert.equal(parseParam("3 dKH").value, 3);
  assert.equal(parseParam("7,2").value, 7.2);
  assert.equal(parseParam("<5 ppm").qualifier, "<");
  assert.equal(parseParam("<5 ppm").value, 5);
});

test("range status against typical guidance", () => {
  assert.equal(rangeStatus("ammonia", parseParam("0")), null);
  assert.equal(rangeStatus("ammonia", parseParam("0.25")), "high");
  assert.equal(rangeStatus("ammonia", parseParam("<0.25")), null);
  assert.equal(rangeStatus("nitrate", parseParam("<5")), null);
  assert.equal(rangeStatus("nitrate", parseParam("50")), "high");
  assert.equal(rangeStatus("nitrate", parseParam(">40")), "high");
  assert.equal(rangeStatus("nitrate", parseParam("<50")), null);
  assert.equal(rangeStatus("ph", parseParam("5.5")), "low");
  assert.equal(rangeStatus("ph", parseParam("6.8")), null);
  assert.equal(rangeStatus("temp", parseParam("84")), "high");
  assert.equal(rangeStatus("ph", parseParam("")), null);
});

test("readingsFor sorts oldest first and skips blanks/unparseable", () => {
  const entries = [
    { id: 3, type: "parameters", date: "2026-03-10", time: "20:00", data: { ph: "6.8" } },
    { id: 2, type: "parameters", date: "2026-03-01", time: "19:00", data: { ph: "" } },
    { id: 1, type: "parameters", date: "2026-02-20", time: "19:00", data: { ph: "~7" } },
    { id: 4, type: "co2", date: "2026-03-11", time: "10:00", data: { ph: "6.5" } },
    { id: 5, type: "parameters", date: "2026-03-12", time: "10:00", data: { ph: "smudged" } },
  ];
  const r = readingsFor(entries, "ph");
  assert.deepEqual(r.map((x) => x.entry.id), [1, 3]);
  assert.equal(r[0].qualifier, "~");
});

test("metadata covers every journal parameter", () => {
  assert.deepEqual(PARAM_META.map((m) => m.key), ["temp", "ph", "ammonia", "nitrite", "nitrate", "gh", "kh"]);
  assert.equal(formatTypical(PARAM_META.find((m) => m.key === "nitrate")), "under 40 ppm");
  assert.equal(formatTypical(PARAM_META.find((m) => m.key === "ph")), "6.0–8.0");
});
