/* Marking: compares a student's result with the reference answer's result (not the query text),
   so any correct phrasing passes. Shared by the page and the Node tests. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SQLMarking = factory();
})(this, function () {
  "use strict";

  function keyRow(eng, row) { return JSON.stringify(row.map(function (v) { return eng.fmt(v); })); }
  function sortedKeys(eng, rows) { return rows.map(function (r) { return keyRow(eng, r); }).sort(); }
  function sameMultiset(a, b) { return a.length === b.length && a.every(function (v, i) { return v === b[i]; }); }
  function permutations(n) {
    var out = [];
    (function rec(cur, rest) { if (!rest.length) { out.push(cur); return; } rest.forEach(function (v, i) { rec(cur.concat([v]), rest.slice(0, i).concat(rest.slice(i + 1))); }); })([], Array.apply(null, { length: n }).map(function (_, i) { return i; }));
    return out;
  }
  function pick(row, perm) { return perm.map(function (i) { return row[i]; }); }

  var cache = {};
  function expectedFor(eng, cfg) {
    if (!cache[cfg.key]) cache[cfg.key] = eng.run(cfg.sol);
    return cache[cfg.key];
  }

  function normalise(q) { return q.replace(/\s+/g, " ").trim().toUpperCase(); }

  function checkTask(eng, cfg, query, res) {
    var exp = expectedFor(eng, cfg), n = exp.cols.length;
    if (res.cols.length !== n)
      return { ok: false, msg: "Your result has " + res.cols.length + " column" + (res.cols.length === 1 ? "" : "s") + ", but this task needs " + n + (cfg.alias ? " (" + cfg.alias.filter(Boolean).join(", ") + ")" : "") + "." };
    if (res.rows.length !== exp.rows.length)
      return { ok: false, msg: "Your query returned " + res.rows.length + " row" + (res.rows.length === 1 ? "" : "s") + ", but this task needs " + exp.rows.length + ". " + (cfg.rowHint || "") + (cfg.hintIf ? " " + cfg.hintIf(query) : "") };
    var want = sortedKeys(eng, exp.rows), perm = null, aligned = res.rows;
    if (!sameMultiset(sortedKeys(eng, res.rows), want)) {
      var found = null;
      if (n <= 6) permutations(n).some(function (p) {
        if (sameMultiset(sortedKeys(eng, res.rows.map(function (r) { return pick(r, p); })), want)) { found = p; return true; }
        return false;
      });
      if (!found) return { ok: false, msg: "The right number of rows, but some of the values aren't right. Check your conditions (and any text in quotes). " + (cfg.rowHint || "") + (cfg.hintIf ? " " + cfg.hintIf(query) : "") };
      if (cfg.colOrder) return { ok: false, msg: "Right data, but the columns are in a different order. This task wants them in the order the question lists them." };
      perm = found; aligned = res.rows.map(function (r) { return pick(r, found); });
    }
    if (cfg.alias) {
      var heads = perm ? perm.map(function (i) { return res.cols[i]; }) : res.cols;
      var okAlias = cfg.alias.every(function (a, i) { return a === null || String(heads[i]).toLowerCase() === a; });
      if (!okAlias) return { ok: false, msg: "The data is right. Now use AS to give the columns these headings: " + cfg.alias.filter(Boolean).join(", ") + "." };
    }
    if (cfg.ordered) {
      var oc = cfg.orderCols || exp.cols.map(function (_, i) { return i; });
      var inOrder = aligned.every(function (r, i) { return oc.every(function (c) { return exp.fmt(r[c]) === exp.fmt(exp.rows[i][c]); }); });
      if (!inOrder) return { ok: false, msg: cfg.orderHint || "The right rows, but not in the right order. Check your ORDER BY (and ASC or DESC)." };
    }
    var q = normalise(query);
    var req = (cfg.requires || []).filter(function (r) { return !r.re.test(q); })[0];
    if (req) return { ok: false, msg: req.msg };
    var areq = (cfg.astRequires || []).filter(function (r) { return !r.test(res.ast); })[0];
    if (areq) return { ok: false, msg: areq.msg };
    if (cfg.mode) {
      var a = eng.analyse(res.ast);
      if (cfg.mode === "toHsc") {
        if (a.usesSymbols) return { ok: false, msg: "Same result, but it still uses SQLite symbols (" + a.symbols.join(", ") + "). This exercise practises the Specifications' operator words. Symbols are fine in a normal answer, but here write them as words." };
        if (a.usesJoinOn) return { ok: false, msg: "Same result, but it still uses JOIN ... ON. The Specifications' example lists the tables after FROM, separated by commas, and puts the matching condition in WHERE. Write it that way here." };
      }
      if (cfg.mode === "toSqlite") {
        if (a.usesWords) return { ok: false, msg: "Same result here, but a real SQLite database would reject the words (" + a.words.join(", ") + "). Use symbols or LIKE instead." };
        if (a.toSqlite.length) return { ok: false, msg: "Same result here, but SQLite compares dates as text, so write dates as YYYY-MM-DD, like '2023-06-30'." };
      }
    }
    return { ok: true, msg: cfg.success || "Correct, task complete!" };
  }

  return { check: checkTask, expected: expectedFor };
});
