// Checks every task's reference answer: it must pass the marker, match real SQLite, and wrong/starting queries must not pass.
const { execFileSync } = require("child_process");
const path = require("path");
const E = require("../src/engine.js"), DB = require("../src/data.js"), M = require("../src/marking.js"), PAGES = require("../src/pages.js");
const eng = E.create(DB);
let fails = 0, n = 0;
function bad(m) { fails++; console.log("FAIL", m); }
function allTasks(p) {
  const t = [].concat(p.tasks || []);
  if (p.hpge && p.hpge.task) t.push(p.hpge.task);
  (p.blocks || []).forEach(b => { if (b.task) t.push(b.task); });
  return t;
}
function allMcqs(p) {
  let m = [].concat(p.checks || []);
  (p.blocks || []).forEach(b => { if (b.checks) m = m.concat(b.checks); });
  return m;
}
const tasks = [], keys = {};
PAGES.forEach(p => allTasks(p).forEach(t => { if (keys[t.key]) bad("duplicate key " + t.key); keys[t.key] = 1; tasks.push([p, t]); }));
PAGES.forEach(p => allMcqs(p).forEach(m => {
  if (keys[m.key]) bad("duplicate key " + m.key); keys[m.key] = 1;
  if (m.options.filter(o => o.ok).length !== 1) bad("MCQ " + m.key + " needs exactly one correct option");
}));
// reference answers vs real SQLite
const sqliteQs = tasks.map(([p, t]) => eng.print(eng.run(t.sol).ast, "sqlite"));
const ref = JSON.parse(execFileSync("python3", ["-I", path.join(__dirname, "ref_sqlite.py")], { input: JSON.stringify({ db: DB, queries: sqliteQs }), maxBuffer: 1 << 26 }));
tasks.forEach(([p, t], i) => {
  n++;
  const ans = t.answer || t.sol;
  let res; try { res = eng.run(ans); } catch (e) { bad(t.key + " answer errors: " + e.message); return; }
  const v = M.check(eng, t, ans, res);
  if (!v.ok) bad(t.key + " reference answer does not pass marking: " + v.msg);
  if (!ref[i].ok) bad(t.key + " sol fails in real SQLite: " + ref[i].err);
  else {
    const ex = eng.run(t.sol);
    const a = JSON.stringify(ex.rows.map(r => r.map(x => typeof x === "number" ? Number(x.toPrecision(12)) : x)));
    const b = JSON.stringify(ref[i].rows.map(r => r.map(x => typeof x === "number" ? Number(x.toPrecision(12)) : x)));
    const proj = (j) => t.orderCols ? JSON.stringify(JSON.parse(j).map(r => t.orderCols.map(c => r[c]))) : j;
    if (t.ordered ? (proj(a) !== proj(b) || JSON.stringify(JSON.parse(a).map(JSON.stringify).sort()) !== JSON.stringify(JSON.parse(b).map(JSON.stringify).sort())) : JSON.stringify(JSON.parse(a).map(JSON.stringify).sort()) !== JSON.stringify(JSON.parse(b).map(JSON.stringify).sort())) bad(t.key + " engine differs from SQLite");
  }
  if (!ex_ok(t)) return;
  // prefilled query should not already pass (except the very first run-it task)
  if (t.q && t.key !== "p1t1") {
    try { const r0 = eng.run(t.q); const v0 = M.check(eng, t, t.q, r0); if (v0.ok) bad(t.key + " prefilled query already passes"); } catch (e) { /* an error is fine */ }
  }
});
function ex_ok() { return true; }
// negative checks
function mustFail(key, q, why) {
  const t = tasks.find(([p, t]) => t.key === key)[1];
  n++;
  let res; try { res = eng.run(q); } catch (e) { bad(key + " negative query errored: " + q); return; }
  const v = M.check(eng, t, q, res);
  if (v.ok) bad(key + " wrongly passes (" + why + "): " + q);
}
function mustPass(key, q, why) {
  const t = tasks.find(([p, t]) => t.key === key)[1];
  n++;
  let res; try { res = eng.run(q); } catch (e) { bad(key + " alternative errored: " + q + " " + e.message); return; }
  const v = M.check(eng, t, q, res);
  if (!v.ok) bad(key + " should pass (" + why + "): " + q + " -> " + v.msg);
}
mustFail("p4t4", "SELECT Name, Cost, Publisher_ID FROM Games WHERE Publisher_ID = 1 OR Publisher_ID = 2 AND Cost < 30", "no brackets");
mustPass("p3t1", "SELECT Cost, Name FROM Games WHERE Cost EQUALS 20", "column order swap allowed, words");
mustFail("p2t3", "SELECT Name, Cost - 5 FROM Games", "alias missing");
mustPass("p5t2", "SELECT Name, Cost FROM Games ORDER BY Cost", "default ASC, ties flexible");
mustFail("p5t3", "SELECT Name, Cost FROM Games ORDER BY Cost DESC", "no tie-break (ties exist)");
mustFail("p6t4", "SELECT Publisher_ID, COUNT(ID) AS Games_published FROM Games", "missing GROUP BY");
mustPass("p6t4", "SELECT Publisher_ID, COUNT(ID) AS Games_published FROM Games GROUP BY Publisher_ID", "ok");
mustFail("p7t1", "SELECT Games.Name, Publishers.Name AS Publisher FROM Games, Publishers", "cartesian");
mustPass("p7t5", "SELECT Developers.First_name, Developers.Last_name, SUM (Games.Cost) AS Totalcost FROM Games JOIN Publishers ON Publishers.Publisher_ID = Games.Publisher_ID JOIN Developers ON Developers.Developer_ID = Games.Developer_ID WHERE Publishers.Name = 'Games Inc' GROUP BY Developers.Developer_ID ORDER BY Developers.Last_name DESC", "JOIN ON form");
mustPass("p4t2", "SELECT Name, Release_date FROM Games WHERE Release_date BETWEEN '01/01/2023' AND '31/12/2023'", "BETWEEN + dmy dates");
mustFail("p8x1", "SELECT Name, Cost FROM Games WHERE Cost >= 25 AND Publisher_ID <> 3 ORDER BY Name ASC", "translation not done (symbols)");
mustFail("p8x2", "SELECT Games.Name, Publishers.Name FROM Games JOIN Publishers ON Games.Publisher_ID = Publishers.Publisher_ID WHERE Games.Name CONTAINS 'Star'", "still JOIN ON");
mustFail("p8x3", "SELECT Name FROM Games WHERE Cost GREATER THAN 30 AND Name DOES NOT CONTAIN 'a'", "still words");
mustPass("p8x3", "SELECT Name FROM Games WHERE Cost > 30 AND Name NOT LIKE '%a%'", "ok");
mustPass("p8t5", "SELECT Name FROM Games WHERE Release_date GREATER THAN '30/06/2023' AND Publisher_ID NOT EQUAL TO 1 ORDER BY Release_date DESC", "HSC words + HSC date");
mustPass("p8t4", "SELECT Developers.First_name, Developers.Last_name, SUM(Games.Cost) AS Totalcost FROM Games, Developers WHERE Games.Release_date >= '2023-01-01' AND Games.Release_date <= '2023-12-31' AND Developers.Developer_ID = Games.Developer_ID GROUP BY Developers.Developer_ID ORDER BY Totalcost DESC, Developers.Last_name", "ties on total OK");

mustFail("p6t1", "SELECT MAX(ID) AS Total_games FROM Games", "wrong function");
mustFail("p6t6", "SELECT Developer_ID, MAX(Cost) AS Total FROM Games GROUP BY Developer_ID ORDER BY Total DESC", "wrong function");
mustFail("p4t5", "SELECT Name, Publisher_ID FROM Games WHERE Publisher_ID NOT EQUAL TO 1 AND Publisher_ID NOT EQUAL TO 2", "no logical NOT");
mustFail("p4t5", "SELECT Name, Publisher_ID FROM Games WHERE Publisher_ID > 2 -- NOT", "NOT only in a comment");
mustPass("p4t5", "SELECT Name, Publisher_ID FROM Games WHERE NOT Publisher_ID = 1 AND NOT Publisher_ID = 2", "real NOT");
mustFail("p6t4", "SELECT Publisher_ID, COUNT(ID) AS Games_published FROM Games -- GROUP BY", "GROUP BY only in a comment");
mustFail("p3t4", "SELECT Name, Release_date FROM Games WHERE Release_date >= 2024", "unquoted number");
mustPass("p8t3", "SELECT Publishers.Name AS Publisher, COUNT(*) AS Games_published FROM Games, Publishers WHERE Games.Publisher_ID = Publishers.Publisher_ID GROUP BY Publishers.Publisher_ID", "free heading for the name");
mustFail("p5h1", "SELECT Name, Release_date FROM Games ORDER BY Release_date DESC", "no tie-break");
mustFail("p2t4", "SELECT Release_date AS Released, Name AS Game FROM Games", "order of listed fields");
// facts quoted in the text
function val(sql) { return eng.run(sql).rows; }
function eq(name, got, want) { n++; if (JSON.stringify(got) !== JSON.stringify(want)) bad("fact " + name + ": got " + JSON.stringify(got) + " want " + JSON.stringify(want)); }
eq("17 games", val("SELECT COUNT(ID) FROM Games"), [[17]]);
eq("games >40", val("SELECT COUNT(ID) FROM Games WHERE Cost > 40"), [[4]]);
eq("cartesian", val("SELECT * FROM Games, Publishers").length, 68);
eq("p8c1", val("SELECT Name FROM Games WHERE Cost = 15 ORDER BY Name DESC"), [["Tiny Tides"], ["Garden Gnomes"]]);
eq("p8c2", val("SELECT Publisher_ID, COUNT(ID) FROM Games WHERE Cost > 40 GROUP BY Publisher_ID"), [[1, 3], [2, 1]]);
eq("p8c3", val("SELECT MAX(Cost) FROM Games WHERE Publisher_ID = 2"), [[45]]);
eq("pub2 costs", val("SELECT Cost FROM Games WHERE Publisher_ID = 2").map(r => r[0]).sort(), [15, 25, 30, 45]);
eq(">40 costs", val("SELECT Cost FROM Games WHERE Cost > 40").map(r => r[0]).sort(), [45, 50, 55, 60]);
eq("Finn has no games", val("SELECT Developer_ID FROM Games WHERE Developer_ID = 6"), []);
eq("p3t2 rows", val("SELECT Name FROM Games WHERE Name LIKE '%er%'").length >= 2, true);
eq("spec ex1 rows", val("SELECT Name FROM Games WHERE Release_date >= '2022-03-01' AND Release_date <= '2023-03-31'").length, 9);
eq("spec ex2", val("SELECT Developers.Last_name, SUM (Games.Cost) AS Totalcost FROM Games, Publishers, Developers WHERE Publishers.Name = 'Games Inc' AND Publishers.Publisher_ID = Games.Publisher_ID AND Developers.Developer_ID = Games.Developer_ID GROUP BY Developers.Developer_ID ORDER BY Developers.Last_name DESC"), [["Patel", 110], ["Martin", 120], ["Chen", 80]]);
// claim made on page 5: the Specifications' query run in real SQLite returns all 17 rows (not 9)
const specQ = "SELECT Name, Release_date FROM Games WHERE Release_date >= '01/03/2022' AND Release_date <= '31/03/2023' ORDER BY Name ASC";
const specRef = JSON.parse(execFileSync("python3", ["-I", path.join(__dirname, "ref_sqlite.py")], { input: JSON.stringify({ db: DB, queries: [specQ] }) }));
eq("spec query in real SQLite", specRef[0].rows.length, 17);
eq("spec query in the site engine", eng.run(specQ).rows.length, 9);
console.log(`${n - fails}/${n} checks ok, ${tasks.length} tasks, ${PAGES.reduce((a, p) => a + allMcqs(p).length, 0)} MCQs`);
process.exit(fails ? 1 : 0);
