import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function loadTsExports(path) {
  const source = fs.readFileSync(path, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });

  const sandbox = { exports: {}, module: { exports: {} } };
  vm.runInNewContext(compiled.outputText, sandbox);
  return sandbox.exports;
}

const { priceForTennisPlayer } = loadTsExports("src/lib/tennis-odds-mapping.ts");
const { priceForFootballOutcome, pointForFootballOutcome } = loadTsExports("src/lib/football-odds-mapping.ts");

const reversedTennisApiOrder = [
  { name: "Novak Djokovic", price: 1.18 },
  { name: "Roman Safiullin", price: 5.68 },
];

assert.equal(priceForTennisPlayer(reversedTennisApiOrder, "Roman Safiullin"), 5.68);
assert.equal(priceForTennisPlayer(reversedTennisApiOrder, "Novak Djokovic"), 1.18);
assert.equal(priceForTennisPlayer(reversedTennisApiOrder, "Missing Player"), null);

const accentedTennisNames = [{ name: "Novak Djokovi\u0107", price: 1.22 }];
assert.equal(priceForTennisPlayer(accentedTennisNames, "Novak Djokovic"), 1.22);

const shuffledFootballApiOrder = [
  { name: "Draw", price: 3.78 },
  { name: "Norway", price: 4.71 },
  { name: "Brazil", price: 1.79 },
];

assert.equal(priceForFootballOutcome(shuffledFootballApiOrder, "Brazil"), 1.79);
assert.equal(priceForFootballOutcome(shuffledFootballApiOrder, "Draw"), 3.78);
assert.equal(priceForFootballOutcome(shuffledFootballApiOrder, "Norway"), 4.71);
assert.equal(priceForFootballOutcome(shuffledFootballApiOrder, "Missing Team"), null);

const totals = [
  { name: "Under", price: 1.97, point: 2.75 },
  { name: "Over", price: 1.92, point: 2.75 },
];

assert.equal(priceForFootballOutcome(totals, "Over"), 1.92);
assert.equal(priceForFootballOutcome(totals, "Under"), 1.97);
assert.equal(pointForFootballOutcome(totals, "Over", 2.5), 2.75);
assert.equal(pointForFootballOutcome(totals, "Missing", 2.5), 2.5);

console.log("Odds mapping regression tests passed.");
