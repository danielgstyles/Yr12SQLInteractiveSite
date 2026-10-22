// Differential test: the practice-site engine vs real SQLite (Python sqlite3).
// For every query: (1) engine result == SQLite result of the engine's "sqlite" rendering, and
// (2) the engine's "hsc" rendering, run back through the engine, gives the same result.
const { execFileSync } = require("child_process");
const path = require("path");
const E = require("../src/engine.js"), DB = require("../src/data.js");
const eng = E.create(DB);
const Q = require("./queries.js");

function sqliteRun(list) {
  const out = execFileSync("python3", ["-I", path.join(__dirname, "ref_sqlite.py")], { input: JSON.stringify({ db: DB, queries: list }), maxBuffer: 1 << 26 });
  return JSON.parse(out);
}
function norm(rows, ordered) {
  const r = rows.map(row => JSON.stringify(row.map(v => typeof v === "number" ? Number(v.toPrecision(12)) : v)));
  return ordered ? r : r.slice().sort();
}
let fails = 0, n = 0;
const sqlites = [], engineRes = [], hscRes = [];
Q.forEach(q => {
  let r; try { r = eng.run(q); } catch (e) { r = { err: e.message }; }
  engineRes.push(r);
  if (r.err) { sqlites.push("SELECT 1"); hscRes.push(null); return; }
  sqlites.push(eng.print(r.ast, "sqlite"));
  let h; try { h = eng.run(eng.print(r.ast, "hsc")); } catch (e) { h = { err: e.message }; }
  hscRes.push(h);
});
const ref = sqliteRun(sqlites);
Q.forEach((q, i) => {
  n++;
  const r = engineRes[i];
  if (r.err) { console.log("ENGINE ERROR  ", JSON.stringify(q), "->", r.err); fails++; return; }
  const ordered = /ORDER BY/i.test(q);
  const rf = ref[i];
  if (!rf.ok) { console.log("SQLITE REJECTS rendering of", JSON.stringify(q), "\n   ", sqlites[i].replace(/\n/g, " "), "\n   ", rf.err); fails++; return; }
  if (rf.rows.length !== r.rows.length || JSON.stringify(norm(rf.rows, ordered)) !== JSON.stringify(norm(r.rows, ordered))) {
    console.log("MISMATCH vs SQLite", JSON.stringify(q), "\n   engine:", JSON.stringify(r.rows.slice(0, 4)), "\n   sqlite:", JSON.stringify(rf.rows.slice(0, 4)), r.rows.length, rf.rows.length); fails++; return;
  }
  const h = hscRes[i];
  if (h.err) { console.log("HSC RENDERING FAILS", JSON.stringify(q), "\n   ", eng.print(r.ast, "hsc").replace(/\n/g, " "), "\n   ", h.err); fails++; return; }
  if (JSON.stringify(norm(h.rows, ordered)) !== JSON.stringify(norm(r.rows, ordered))) { console.log("HSC RENDERING DIFFERS", JSON.stringify(q)); fails++; return; }
});
// queries real SQLite must reject / engine must reject with a friendly message
(require("./errors.js")).forEach(([q, re]) => {
  n++;
  try { eng.run(q); console.log("EXPECTED ERROR but ran:", q); fails++; }
  catch (e) { if (!e.friendly || !re.test(e.message)) { console.log("BAD ERROR for", q, "->", e.message); fails++; } }
});
console.log(`${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
