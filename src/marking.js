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

  /* Work out WHY a result is wrong by comparing the shape of the student's query with the reference answer's, so the
     message can teach instead of only counting rows. */
  function walkN(n, fn) { if (!n) return; fn(n); ["l", "r", "e", "lo", "hi", "arg"].forEach(function (k) { if (n[k]) walkN(n[k], fn); }); }
  function aggFns(ast) { var s = []; ast.items.forEach(function (i) { walkN(i.expr, function (x) { if (x.k === "agg" && s.indexOf(x.fn) === -1) s.push(x.fn); }); }); return s; }
  function keysLinked(ast) {
    var f = false;
    [ast.where].concat(ast.joinOn).forEach(function (e) { walkN(e, function (x) { if (x.k === "cmp" && x.op === "=" && x.l.k === "col" && x.r.k === "col" && x.l.src !== x.r.src) f = true; }); });
    return f;
  }
  var NAMES = { COUNT: "COUNT (counts the rows)", SUM: "SUM (adds the values)", AVG: "AVG (the average)", MAX: "MAX (the largest value)", MIN: "MIN (the smallest value)" };
  function diagnose(exp, res, query, more) {
    var e = exp.ast, s = res.ast, out = [];
    var eAgg = aggFns(e), sAgg = aggFns(s);
    if (e.group.length && !s.group.length)
      out.push(s.items.length && sAgg.length && res.rows.length === 1
        ? "You have a calculation (" + sAgg.join(", ") + ") but no GROUP BY, so SQL worked it out once for the whole table. This task wants one row for each group, so add GROUP BY followed by the field to group by."
        : "This task needs one row for each group, so add a GROUP BY line followed by the field to group by.");
    var missing = eAgg.filter(function (f) { return sAgg.indexOf(f) === -1; });
    if (missing.length) out.push("This task needs the " + missing.map(function (f) { return NAMES[f]; }).join(" and ") + " function. Put it in the SELECT line.");
    if (e.from.length > 1 && s.from.length < e.from.length)
      out.push("This task needs data from " + e.from.length + " tables. List all of them after FROM, then match each foreign key to its primary key in WHERE.");
    else if (e.from.length > 1 && !keysLinked(s))
      out.push("The tables are not matched up. Add a WHERE condition that matches each foreign key to the primary key it points to.");
    if (e.where && !s.where && !s.joinOn.length && !e.group.length && e.from.length === 1) out.push("Your query has no WHERE, so it returns every row. This task only wants some of the rows, so add a WHERE condition.");
    if (!out.length) {
      if (more === "more") out.push("You have too many rows, so your conditions are letting extra rows through. Check whether a condition is missing, whether OR should be AND, and whether brackets are needed.");
      else if (more === "fewer") out.push("You have too few rows, so your conditions are too strict. Check whether AND should be OR, and whether a boundary needs >= or <= instead of > or < (words like 'on or after' and 'at least' include the value itself).");
      else out.push("Check each condition: the field name, the operator, and that text and dates are in single quotes (dates year first).");
    }
    return out.join(" ");
  }

  function normalise(q) { return q.replace(/\s+/g, " ").trim().toUpperCase(); }

  function checkTask(eng, cfg, query, res) {
    var exp = expectedFor(eng, cfg), n = exp.cols.length;
    if (res.cols.length !== n)
      return { ok: false, msg: "Your result has " + res.cols.length + " column" + (res.cols.length === 1 ? "" : "s") + ", but this task needs " + n + (cfg.alias ? " (" + cfg.alias.filter(Boolean).join(", ") + ")" : "") + ". The columns are the fields and calculated values you list after SELECT, so check which ones the task asks for." };
    if (res.rows.length !== exp.rows.length)
      return { ok: false, msg: "Your query returned " + res.rows.length + " row" + (res.rows.length === 1 ? "" : "s") + ", but this task needs " + exp.rows.length + ". " + diagnose(exp, res, query, res.rows.length > exp.rows.length ? "more" : "fewer") + (cfg.rowHint ? " " + cfg.rowHint : "") + (cfg.hintIf ? " " + cfg.hintIf(query) : "") };
    var want = sortedKeys(eng, exp.rows), perm = null, aligned = res.rows;
    if (!sameMultiset(sortedKeys(eng, res.rows), want)) {
      var found = null;
      if (n <= 6) permutations(n).some(function (p) {
        if (sameMultiset(sortedKeys(eng, res.rows.map(function (r) { return pick(r, p); })), want)) { found = p; return true; }
        return false;
      });
      if (!found) return { ok: false, msg: "The right number of rows, but they are not the right rows. " + diagnose(exp, res, query, "same") + (cfg.rowHint ? " " + cfg.rowHint : "") + (cfg.hintIf ? " " + cfg.hintIf(query) : "") };
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
    if (areq) return { ok: false, msg: areq.msg + (areq.how ? " How to do it: " + areq.how : "") };
    if (cfg.mode) {
      var a = eng.analyse(res.ast);
      if (cfg.mode === "toHsc") {
        if (a.usesSymbols) return { ok: false, msg: "Same result, but it still uses SQLite symbols (" + a.symbols.join(", ") + "). This exercise practises the Specifications' operator words. Symbols are fine in a normal answer, but here write them as words." };
        if (a.usesJoinOn) return { ok: false, msg: "Same result, but it still uses JOIN ... ON. The Specifications' example lists the tables after FROM, separated by commas, and puts the matching condition in WHERE. Write it that way here." };
      }
      if (cfg.mode === "toSqlite") {
        if (a.usesWords) return { ok: false, msg: "Same result here, but a real SQLite database would reject the words (" + a.words.join(", ") + "). Use symbols or LIKE instead." };
      }
    }
    return { ok: true, msg: cfg.success || "Correct, task complete!" };
  }

  return { check: checkTask, expected: expectedFor };
});
