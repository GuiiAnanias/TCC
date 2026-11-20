import test from "node:test";
import assert from "node:assert/strict";
import { todayBusinessDate, currentBusinessMonth } from "../src/utils/datasEmpresa.js";

test("a data de negócio segue São Paulo após 21h e na virada do mês e do ano", () => {
  for (const [instant, expected] of [
    ["2026-11-04T23:59:59Z", "2026-11-04"],
    ["2026-11-05T00:00:00Z", "2026-11-04"],
    ["2026-11-05T02:59:59Z", "2026-11-04"],
    ["2026-11-05T03:00:00Z", "2026-11-05"],
    ["2026-12-01T01:00:00Z", "2026-11-30"],
    ["2027-01-01T02:59:59Z", "2026-12-31"],
    ["2027-01-01T03:00:00Z", "2027-01-01"],
  ]) {
    assert.equal(todayBusinessDate(new Date(instant)), expected);
    assert.equal(currentBusinessMonth(new Date(instant)), expected.slice(0, 7));
  }
});
