import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync("src/lib/tennis-odds-mapping.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
});

const sandbox = { exports: {}, module: { exports: {} } };
vm.runInNewContext(compiled.outputText, sandbox);
const { priceForTennisPlayer } = sandbox.exports;

const reversedApiOrder = [
  { name: "Novak Djokovic", price: 1.18 },
  { name: "Roman Safiullin", price: 5.68 },
];

assert.equal(priceForTennisPlayer(reversedApiOrder, "Roman Safiullin"), 5.68);
assert.equal(priceForTennisPlayer(reversedApiOrder, "Novak Djokovic"), 1.18);
assert.equal(priceForTennisPlayer(reversedApiOrder, "Missing Player"), null);

const accentedNames = [{ name: "Novak Djoković", price: 1.22 }];
assert.equal(priceForTennisPlayer(accentedNames, "Novak Djokovic"), 1.22);

console.log("Tennis odds name mapping regression test passed.");
