/* Mini SQL engine for the HSC SQL practice site.
   Runs the HSC Software Engineering SQL syntax (SELECT / FROM / WHERE / GROUP BY / ORDER BY, AS, aggregates,
   implicit joins) and accepts BOTH the HSC operator words (EQUALS, GREATER THAN, CONTAINS ...) and the SQLite
   symbols (=, >, LIKE ...). It can also print a parsed query back out in either style, which is how the site
   shows students "what this would look like in HSC form" after they succeed.
   It mimics SQLite behaviour for what it supports (checked against Python's sqlite3 in tests/). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SQLEngine = factory();
})(this, function () {
  "use strict";

  var KEYWORDS = ["SELECT", "DISTINCT", "FROM", "WHERE", "GROUP", "BY", "HAVING", "ORDER", "ASC", "DESC", "LIMIT",
    "OFFSET", "AS", "AND", "OR", "NOT", "JOIN", "INNER", "LEFT", "RIGHT", "FULL", "OUTER", "CROSS", "NATURAL", "ON",
    "USING", "LIKE", "BETWEEN", "IN", "IS", "NULL", "EQUALS", "CONTAINS", "UNION", "INSERT", "UPDATE", "DELETE",
    "CREATE", "DROP", "ALTER"];
  var AGGS = ["SUM", "AVG", "COUNT", "MAX", "MIN"];

  function fail(msg) { var e = new Error(msg); e.friendly = true; throw e; }
  function isKw(s) { return KEYWORDS.indexOf(String(s).toUpperCase()) !== -1; }

  function leven(a, b) {
    a = a.toLowerCase(); b = b.toLowerCase();
    var m = [], i, j;
    for (i = 0; i <= a.length; i++) m[i] = [i];
    for (j = 0; j <= b.length; j++) m[0][j] = j;
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++)
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return m[a.length][b.length];
  }
  function closest(word, list, max) {
    var best = null, bd = 99;
    list.forEach(function (c) { var d = leven(word, c); if (d < bd) { bd = d; best = c; } });
    return bd <= (max == null ? 2 : max) ? best : null;
  }

  /* ---------------- tokenizer ---------------- */
  function tokenize(src, notes) {
    var s = src.replace(/[‘’]/g, function () { notes.curly = true; return "'"; })
      .replace(/[“”]/g, function () { notes.curly = true; return '"'; });
    var toks = [], i = 0, n = s.length, c, j, m;
    while (i < n) {
      c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === "-" && s[i + 1] === "-") { while (i < n && s[i] !== "\n") i++; continue; }
      if (c === "/" && s[i + 1] === "*") { j = s.indexOf("*/", i + 2); i = j === -1 ? n : j + 2; continue; }
      if (c === "'") {
        j = i + 1; var str = "";
        while (true) {
          if (j >= n) fail("The text value starting at position " + (i + 1) + " is missing its closing single quote (').");
          if (s[j] === "'") { if (s[j + 1] === "'") { str += "'"; j += 2; continue; } break; }
          str += s[j++];
        }
        toks.push({ t: "str", v: str, pos: i, end: j + 1 }); i = j + 1; continue;
      }
      if (c === '"') {
        j = s.indexOf('"', i + 1);
        if (j === -1) fail("A double quote (\") is never closed. Text values use single quotes: 'like this'.");
        toks.push({ t: "dq", v: s.slice(i + 1, j), pos: i, end: j + 1 }); i = j + 1; continue;
      }
      if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(s[i + 1] || ""))) {
        m = /^[0-9]*\.?[0-9]+(e[+-]?[0-9]+)?|^[0-9]+\./i.exec(s.slice(i));
        toks.push({ t: "num", v: Number(m[0]), raw: m[0], pos: i, end: i + m[0].length }); i += m[0].length; continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i));
        toks.push({ t: "id", v: m[0], pos: i, end: i + m[0].length }); i += m[0].length; continue;
      }
      m = /^(<=|>=|<>|!=|==)/.exec(s.slice(i));
      if (m) { toks.push({ t: "sym", v: m[1] === "==" ? "=" : m[1], raw: m[1], pos: i, end: i + 2 }); i += 2; continue; }
      if ("=<>,()*+-/%.;".indexOf(c) !== -1) { toks.push({ t: "sym", v: c, raw: c, pos: i, end: i + 1 }); i++; continue; }
      fail("I don't recognise the character '" + c + "'.");
    }
    toks.push({ t: "eof", v: "", pos: n, end: n });
    return { toks: toks, src: s };
  }

  /* ---------------- parser ---------------- */
  function parse(src, notes) {
    var tk = tokenize(src, notes), toks = tk.toks, s = tk.src, p = 0;
    function peek(k) { return toks[Math.min(p + (k || 0), toks.length - 1)]; }
    function isK(t, kw) { return t && t.t === "id" && t.v.toUpperCase() === kw; }
    function isSym(t, v) { return t && t.t === "sym" && t.v === v; }
    function eatK(kw) { if (isK(peek(), kw)) { p++; return true; } return false; }
    function tokShow(t) { return t.t === "eof" ? "the end of the query" : "'" + s.slice(t.pos, t.end) + "'"; }
    function near(extra) {
      var t = peek(), h = "";
      if (t.t === "id") {
        var sg = t.v.length >= 3 ? closest(t.v, ["SELECT", "FROM", "WHERE", "GROUP", "ORDER", "HAVING", "LIMIT", "JOIN"], 2) : null;
        if (sg && sg !== t.v.toUpperCase()) h = " Did you mean " + sg + "?";
      }
      if (!extra && t.t === "id" && !isKw(t.v) && p > 0 && toks[p - 1].t === "id") extra = "If this is part of a text value, put the whole value in single quotes, like 'Pixel Quest'. If it is another field, a comma may be missing.";
      fail("Something isn't right near " + tokShow(t) + "." + (extra ? " " + extra : "") + h);
    }
    function unsupported(what) { fail(what + " isn't supported on this practice site (and it is not part of the HSC SQL syntax)."); }

    function parseStatement() {
      if (!isK(peek(), "SELECT")) {
        var f = peek();
        if (f.t === "id" && ["INSERT", "UPDATE", "DELETE", "CREATE", "DROP", "ALTER"].indexOf(f.v.toUpperCase()) !== -1)
          fail("This site only runs SELECT queries (the HSC SQL syntax is for reading data).");
        fail("A query starts with SELECT.");
      }
      p++;
      var q = { distinct: false, items: [], from: [], where: null, group: [], having: null, order: [], limit: null, offset: null, joinOn: [] };
      if (eatK("DISTINCT")) q.distinct = true;
      while (true) {
        var start = peek();
        if (isSym(start, "*")) { p++; q.items.push({ star: true }); }
        else if (start.t === "id" && isSym(peek(1), ".") && isSym(peek(2), "*")) {
          p += 3; q.items.push({ star: true, table: start.v });
        } else {
          if (start.t === "eof" || isK(start, "FROM")) near("The SELECT needs at least one field after it.");
          var e = parseExpr(), item = { expr: e, text: s.slice(start.pos, toks[p - 1].end) };
          if (eatK("AS")) {
            var a = peek();
            if (a.t !== "id" && a.t !== "dq" && a.t !== "str") near("AS must be followed by the new heading.");
            p++; item.alias = a.v;
          } else if (peek().t === "id" && !isKw(peek().v)) {
            near("Is a comma missing between two fields? (To rename a field, write AS first: Cost AS Price.)");
          }
          q.items.push(item);
        }
        if (isSym(peek(), ",")) { p++; continue; }
        break;
      }
      if (!isK(peek(), "FROM")) {
        if (peek().t === "eof") fail("A query needs a FROM line that says which table to use.");
        near("Is a comma missing between fields, or is FROM missing?");
      }
      p++;
      parseSource(q);
      while (true) {
        if (isSym(peek(), ",")) { p++; parseSource(q); continue; }
        var t = peek();
        if (isK(t, "JOIN") || (isK(t, "INNER") && isK(peek(1), "JOIN"))) {
          if (isK(t, "INNER")) p++;
          p++; parseSource(q);
          if (!eatK("ON")) fail("A JOIN needs an ON condition, for example ON Games.Publisher_ID = Publishers.Publisher_ID.");
          var on = parseExpr(); q.joinOn.push(on); q.from[q.from.length - 1].viaJoin = true; q.from[q.from.length - 1].on = on;
          continue;
        }
        if (t.t === "id" && ["LEFT", "RIGHT", "FULL", "OUTER", "CROSS", "NATURAL"].indexOf(t.v.toUpperCase()) !== -1) unsupported(t.v.toUpperCase() + " JOIN");
        break;
      }
      if (eatK("WHERE")) q.where = parseExpr();
      if (isK(peek(), "GROUP")) {
        p++; if (!eatK("BY")) near("It should be GROUP BY.");
        while (true) { q.group.push(parseExpr()); if (isSym(peek(), ",")) { p++; continue; } break; }
      }
      if (eatK("HAVING")) q.having = parseExpr();
      if (isK(peek(), "ORDER")) {
        p++; if (!eatK("BY")) near("It should be ORDER BY.");
        while (true) {
          var oe = parseExpr(), dir = "ASC";
          if (peek().t === "id" && /^(ASCEND|DESCEND)/i.test(peek().v)) fail("Use ASC or DESC after the field (not " + peek().v.toUpperCase() + ").");
          if (eatK("ASC")) dir = "ASC"; else if (eatK("DESC")) dir = "DESC";
          q.order.push({ expr: oe, dir: dir, dirWritten: isK(toks[p - 1], "ASC") || isK(toks[p - 1], "DESC") });
          if (isSym(peek(), ",")) { p++; continue; }
          break;
        }
      }
      if (eatK("LIMIT")) {
        var ln = peek(); if (ln.t !== "num") near("LIMIT needs a number.");
        p++; q.limit = ln.v;
        if (eatK("OFFSET")) { var on2 = peek(); if (on2.t !== "num") near("OFFSET needs a number."); p++; q.offset = on2.v; }
      }
      if (isSym(peek(), ";")) p++;
      if (peek().t !== "eof") near();
      return q;
    }

    function parseSource(q) {
      var t = peek();
      if (t.t !== "id" || isKw(t.v)) near("Name a table after FROM.");
      p++;
      var src = { table: t.v, alias: null };
      if (eatK("AS")) { var a = peek(); if (a.t !== "id") near(); p++; src.alias = a.v; }
      else if (peek().t === "id" && !isKw(peek().v)) {
        var cand = peek().v, typo = cand.length >= 4 ? closest(cand, ["WHERE", "GROUP", "ORDER", "HAVING", "LIMIT", "INNER", "FROM"], 2) : null;
        if (typo) fail("Something isn't right near '" + cand + "'. Did you mean " + typo + "?");
        src.alias = cand; p++;
      }
      q.from.push(src);
    }

    function parseExpr() { return parseOr(); }
    function parseOr() {
      var l = parseAnd();
      while (isK(peek(), "OR")) { p++; l = { k: "or", l: l, r: parseAnd() }; }
      return l;
    }
    function parseAnd() {
      var l = parseNot();
      while (isK(peek(), "AND")) { p++; l = { k: "and", l: l, r: parseNot() }; }
      return l;
    }
    function parseNot() {
      if (isK(peek(), "NOT")) { p++; return { k: "not", e: parseNot() }; }
      return parseCmp();
    }
    function parseCmp() {
      var l = parseAdd(), t = peek(), u;
      if (t.t === "sym" && ["=", "<>", "!=", "<", ">", "<=", ">="].indexOf(t.v) !== -1) {
        p++; return { k: "cmp", op: t.v === "!=" ? "<>" : t.v, l: l, r: parseAdd(), form: "sym" };
      }
      if (t.t !== "id") return l;
      u = t.v.toUpperCase();
      if (u === "EQUALS") { if (isK(peek(1), "TO")) fail("EQUALS doesn't need TO. Write Cost EQUALS 30."); p++; return { k: "cmp", op: "=", l: l, r: parseAdd(), form: "word" }; }
      if (u === "EQUAL") fail("The HSC operator is EQUALS (or NOT EQUAL TO). In SQLite you write = instead.");
      if (u === "GREATER" || u === "LESS") {
        var gt = u === "GREATER";
        if (!isK(peek(1), "THAN")) near("It should be " + u + " THAN.");
        p += 2;
        var orEq = false;
        if (isK(peek(), "OR") && isK(peek(1), "EQUAL") && isK(peek(2), "TO")) { orEq = true; p += 3; }
        else if (isK(peek(), "OR") && (isK(peek(1), "EQUAL") || isK(peek(1), "EQUALS"))) fail("It should be " + u + " THAN OR EQUAL TO (three words after THAN: OR EQUAL TO).");
        return { k: "cmp", op: gt ? (orEq ? ">=" : ">") : (orEq ? "<=" : "<"), l: l, r: parseAdd(), form: "word" };
      }
      if (u === "CONTAINS" || u === "CONTAIN") { p++; return { k: "like", neg: false, word: true, l: l, r: parseAdd() }; }
      if (u === "DOES") {
        if (isK(peek(1), "NOT") && (isK(peek(2), "CONTAIN") || isK(peek(2), "CONTAINS"))) {
          p += 3; return { k: "like", neg: true, word: true, l: l, r: parseAdd() };
        }
        near("It should be DOES NOT CONTAIN.");
      }
      if (u === "LIKE") { p++; return { k: "like", neg: false, word: false, l: l, r: parseAdd() }; }
      if (u === "BETWEEN") { p++; return parseBetween(l, false); }
      if (u === "NOT") {
        var n1 = peek(1);
        if (isK(n1, "LIKE")) { p += 2; return { k: "like", neg: true, word: false, l: l, r: parseAdd() }; }
        if (isK(n1, "BETWEEN")) { p += 2; return parseBetween(l, true); }
        if (isK(n1, "EQUAL") && isK(peek(2), "TO")) { p += 3; return { k: "cmp", op: "<>", l: l, r: parseAdd(), form: "word" }; }
        if (isK(n1, "IN")) unsupported("NOT IN");
        near("After NOT, the HSC operators are NOT EQUAL TO and DOES NOT CONTAIN.");
      }
      if (u === "IN") unsupported("IN (...)");
      if (u === "IS") { if (isK(peek(1), "EQUAL") || isK(peek(1), "EQUALS")) fail("The HSC operator is EQUALS (or = in SQLite). There is no IS."); unsupported("IS NULL"); }
      return l;
    }
    function parseBetween(l, neg) {
      var lo = parseAdd();
      if (!eatK("AND")) near("BETWEEN needs AND, like BETWEEN 1 AND 5.");
      return { k: "between", neg: neg, l: l, lo: lo, hi: parseAdd() };
    }
    function parseAdd() {
      var l = parseMul();
      while (isSym(peek(), "+") || isSym(peek(), "-")) { var o = peek().v; p++; l = { k: "bin", op: o, l: l, r: parseMul() }; }
      return l;
    }
    function parseMul() {
      var l = parseUnary();
      while (isSym(peek(), "*") || isSym(peek(), "/") || isSym(peek(), "%")) { var o = peek().v; p++; l = { k: "bin", op: o, l: l, r: parseUnary() }; }
      return l;
    }
    function parseUnary() {
      if (isSym(peek(), "-")) { p++; return { k: "neg", e: parseUnary() }; }
      if (isSym(peek(), "+")) { p++; return parseUnary(); }
      return parsePrimary();
    }
    function parsePrimary() {
      var t = peek();
      if (t.t === "num") { p++; return { k: "num", v: t.v, raw: t.raw }; }
      if (t.t === "str") { p++; return { k: "str", v: t.v }; }
      if (t.t === "dq") { p++; return { k: "col", table: null, name: t.v, raw: '"' + t.v + '"', dq: true }; }
      if (isSym(t, "(")) {
        p++; var e = parseExpr();
        if (!isSym(peek(), ")")) near("A bracket '(' is never closed.");
        p++; e.p = true; return e;
      }
      if (t.t === "id") {
        if (isSym(peek(1), "(")) {
          var fn = t.v.toUpperCase();
          if (AGGS.indexOf(fn) === -1) fail("I don't know a function called " + t.v + ". The HSC functions are SUM, AVG, COUNT, MAX and MIN.");
          p += 2;
          var arg = null, star = false;
          if (isSym(peek(), "*")) { if (fn !== "COUNT") fail(fn + "(*) isn't valid. Put a field name inside the brackets."); p++; star = true; }
          else {
            if (isK(peek(), "DISTINCT")) unsupported("DISTINCT inside " + fn + "()");
            arg = parseExpr();
          }
          if (!isSym(peek(), ")")) near("A bracket '(' after " + fn + " is never closed.");
          p++;
          return { k: "agg", fn: fn, arg: arg, star: star };
        }
        if (isKw(t.v)) near();
        p++;
        if (isSym(peek(), ".") && peek(1).t === "id") {
          var q2 = peek(1); p += 2;
          return { k: "col", table: t.v, name: q2.v, raw: t.v + "." + q2.v };
        }
        return { k: "col", table: null, name: t.v, raw: t.v };
      }
      near();
    }

    var q = parseStatement();
    q.src = s;
    return q;
  }

  /* ---------------- AST helpers ---------------- */
  function walk(n, fn) {
    if (!n) return;
    fn(n);
    ["l", "r", "e", "lo", "hi", "arg"].forEach(function (k) { if (n[k]) walk(n[k], fn); });
  }
  function hasAgg(n) { var f = false; walk(n, function (x) { if (x.k === "agg") f = true; }); return f; }
  function isNumStr(s) { return /^\s*[-+]?(\d+\.?\d*|\.\d+)\s*$/.test(s); }
  var DMY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
  function dmyToIso(v) { var m = DMY.exec(v); return m ? m[3] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[1]).slice(-2) : null; }
  function isoToDmy(v) { var m = ISO.exec(v); return m ? m[3] + "/" + m[2] + "/" + m[1] : null; }

  /* ---------------- engine ---------------- */
  function createEngine(db) {
    var tableNames = Object.keys(db);
    function findTable(name) {
      for (var i = 0; i < tableNames.length; i++) if (tableNames[i].toLowerCase() === name.toLowerCase()) return tableNames[i];
      return null;
    }
    function colDef(tname, cname) {
      var cols = db[tname].cols;
      for (var i = 0; i < cols.length; i++) if (cols[i].name.toLowerCase() === cname.toLowerCase()) return cols[i];
      return null;
    }

    function bind(q, notes) {
      var scope = q.from.map(function (src) {
        var t = findTable(src.table);
        if (!t) {
          var sg = closest(src.table, tableNames, 3);
          fail("There is no table called " + src.table + "." + (sg ? " Did you mean " + sg + "?" : " The tables are " + tableNames.join(", ") + "."));
        }
        return { alias: src.alias, tname: t, def: db[t] };
      });
      function resolveCol(n) {
        if (n.table) {
          var hit = null;
          scope.forEach(function (sc, i) {
            if ((sc.alias && sc.alias.toLowerCase() === n.table.toLowerCase()) || (!sc.alias && sc.tname.toLowerCase() === n.table.toLowerCase()))
              hit = hit || { i: i, sc: sc };
          });
          if (!hit) {
            var names = scope.map(function (sc) { return sc.alias || sc.tname; });
            fail("There is no table called " + n.table + " in this query's FROM line (it has " + names.join(", ") + ").");
          }
          var d = colDef(hit.sc.tname, n.name);
          if (!d) fail(hit.sc.tname + " has no column called " + n.name + ". Its columns are " + hit.sc.def.cols.map(function (c) { return c.name; }).join(", ") + ".");
          return { src: hit.i, cname: d.name, ctype: d.type };
        }
        var found = [];
        scope.forEach(function (sc, i) { var d = colDef(sc.tname, n.name); if (d) found.push({ src: i, cname: d.name, ctype: d.type, tname: sc.tname }); });
        if (found.length === 1) return found[0];
        if (found.length > 1) fail("The column name " + n.name + " is ambiguous: it is in " + found.map(function (f) { return f.tname; }).join(" and ") + ". Put the table name in front, like " + found[0].tname + "." + n.name + ".");
        var all = [];
        scope.forEach(function (sc) { sc.def.cols.forEach(function (c) { all.push(c.name); }); });
        var sg = closest(n.name, all, 2);
        fail("There is no column called " + n.name + "." + (sg ? " Did you mean " + sg + "?" : "") + " (Text values need single quotes, like 'this'.)");
      }

      var aliases = {};
      q.items.forEach(function (it) { if (it.alias) aliases[it.alias.toLowerCase()] = it; });

      function bindExpr(n, allowAgg, inAgg, aliasMode) {
        switch (n.k) {
          case "col":
            if (n.dq) {
              try { Object.assign(n, resolveCol(n)); } catch (e) { n.k = "str"; n.v = n.name; notes.doubleQuote = true; }
              return;
            }
            if (aliasMode === "first" && !n.table && aliases[n.name.toLowerCase()]) { n.aliasRef = aliases[n.name.toLowerCase()]; return; }
            if (aliasMode === "fallback" && !n.table && aliases[n.name.toLowerCase()]) {
              var ok = true; try { var r0 = resolveCol(n); Object.assign(n, r0); } catch (e) { ok = false; }
              if (!ok) {
                n.aliasRef = aliases[n.name.toLowerCase()];
                if (!allowAgg && hasAgg(n.aliasRef.expr)) fail("The heading " + n.name + " is a calculated total (COUNT, SUM ...). You can't use it in WHERE because WHERE happens before the totals are worked out.");
              }
              return;
            }
            Object.assign(n, resolveCol(n)); return;
          case "agg":
            if (!allowAgg) fail("The aggregate function " + n.fn + "() can't be used in WHERE. Use it in the SELECT list (with GROUP BY if you also show other fields).");
            if (inAgg) fail("You can't put one aggregate function inside another.");
            if (n.arg) bindExpr(n.arg, false, true);
            return;
          case "num": case "str": return;
          case "neg": case "not": bindExpr(n.e, allowAgg, inAgg, aliasMode); return;
          case "bin": case "and": case "or":
            bindExpr(n.l, allowAgg, inAgg, aliasMode); bindExpr(n.r, allowAgg, inAgg, aliasMode); return;
          case "cmp": case "like":
            bindExpr(n.l, allowAgg, inAgg, aliasMode); bindExpr(n.r, allowAgg, inAgg, aliasMode);
            convertDates(n, n.l, n.r); convertDates(n, n.r, n.l); return;
          case "between":
            bindExpr(n.l, allowAgg, inAgg, aliasMode); bindExpr(n.lo, allowAgg, inAgg, aliasMode); bindExpr(n.hi, allowAgg, inAgg, aliasMode);
            convertDates(n, n.l, n.lo); convertDates(n, n.l, n.hi); return;
        }
      }
      function convertDates(node, colSide, litSide) {
        if (colSide.k === "col" && colSide.ctype === "date" && litSide.k === "str") {
          var iso = dmyToIso(litSide.v);
          if (iso) { litSide.v = iso; litSide.wasDmy = true; notes.dmyDate = true; }
        }
      }

      q.items.forEach(function (it) { if (it.expr) bindExpr(it.expr, true, false); });
      if (q.where) bindExpr(q.where, false, false, "fallback");
      q.joinOn.forEach(function (e) { bindExpr(e, false, false); });
      q.group.forEach(function (e) { bindExpr(e, false, false, "fallback"); });
      if (q.having) bindExpr(q.having, true, false, "fallback");
      q.order.forEach(function (o) { if (o.expr.k !== "num") bindExpr(o.expr, true, false, "first"); });
      q.scope = scope;
    }

    function fmt(v) {
      if (v === null || v === undefined) return "NULL";
      if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(15)));
      return String(v);
    }

    function cmpVals(a, b) {
      if (typeof a === "number" && typeof b === "number") return a < b ? -1 : a > b ? 1 : 0;
      if (typeof a === "string" && typeof b === "string") return a < b ? -1 : a > b ? 1 : 0;
      return typeof a === "number" ? -1 : 1;
    }

    function likeRe(pat) {
      var re = "";
      for (var i = 0; i < pat.length; i++) {
        var c = pat[i];
        if (c === "%") re += ".*"; else if (c === "_") re += "."; else re += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }
      return new RegExp("^" + re + "$", "is");
    }

    function ev(n, ctx) {
      switch (n.k) {
        case "num": return n.v;
        case "str": return n.v;
        case "col": if (n.aliasRef) return ev(n.aliasRef.expr, ctx); return ctx.tuple ? ctx.tuple[n.src][n.cname] : null;
        case "neg": { var v = ev(n.e, ctx); return v === null ? null : -v; }
        case "bin": {
          var a = ev(n.l, ctx), b = ev(n.r, ctx);
          if (a === null || b === null) return null;
          if (typeof a === "string") a = isNumStr(a) ? Number(a) : 0;
          if (typeof b === "string") b = isNumStr(b) ? Number(b) : 0;
          if (n.op === "+") return a + b;
          if (n.op === "-") return a - b;
          if (n.op === "*") return a * b;
          if (b === 0) return null;
          if (n.op === "/") return (Number.isInteger(a) && Number.isInteger(b) && !isReal(n.l) && !isReal(n.r)) ? Math.trunc(a / b) : a / b;
          return a % b;
        }
        case "and": { var l = tv(ev(n.l, ctx)); if (l === false) return false; var r = tv(ev(n.r, ctx)); if (r === false) return false; return (l === null || r === null) ? null : true; }
        case "or": { var l2 = tv(ev(n.l, ctx)); if (l2 === true) return true; var r2 = tv(ev(n.r, ctx)); if (r2 === true) return true; return (l2 === null || r2 === null) ? null : false; }
        case "not": { var x = tv(ev(n.e, ctx)); return x === null ? null : !x; }
        case "cmp": return doCmp(n.op, ev(n.l, ctx), ev(n.r, ctx), n.l, n.r);
        case "between": {
          var v1 = ev(n.l, ctx), lo = ev(n.lo, ctx), hi = ev(n.hi, ctx);
          var c1 = doCmp(">=", v1, lo, n.l, n.lo), c2 = doCmp("<=", v1, hi, n.l, n.hi);
          var res = (c1 === false || c2 === false) ? false : (c1 === null || c2 === null) ? null : true;
          return n.neg && res !== null ? !res : res;
        }
        case "like": {
          var lv = ev(n.l, ctx), rv = ev(n.r, ctx);
          if (lv === null || rv === null) return null;
          var m = n.word ? String(lv).toLowerCase().indexOf(String(rv).toLowerCase()) !== -1 : likeRe(String(rv)).test(String(lv));
          return n.neg ? !m : m;
        }
        case "agg": return evAgg(n, ctx);
      }
      return null;
    }
    // SQLite truthiness: NULL is unknown, any non-zero number is true, text counts by its leading number
    function tv(x) {
      if (x === null || x === undefined) return null;
      if (typeof x === "boolean") return x;
      if (typeof x === "number") return x !== 0;
      var f = parseFloat(x); return !isNaN(f) && f !== 0;
    }
    function isReal(n) {
      if (n.k === "num") return /[.eE]/.test(n.raw);
      if (n.k === "agg") return n.fn === "AVG";
      if (n.k === "neg") return isReal(n.e);
      if (n.k === "bin") return isReal(n.l) || isReal(n.r);
      return false;
    }
    function aff(n) { return n.k === "col" && !n.aliasRef ? n.ctype : null; }
    function doCmp(op, a, b, ln, rn) {
      if (a === null || b === null) return null;
      var la = aff(ln), ra = aff(rn);
      if (la === "num" && typeof b === "string" && isNumStr(b)) b = Number(b);
      else if (ra === "num" && typeof a === "string" && isNumStr(a)) a = Number(a);
      else if (la && la !== "num" && typeof b === "number") b = String(b);
      else if (ra && ra !== "num" && typeof a === "number") a = String(a);
      var c = cmpVals(a, b);
      switch (op) { case "=": return c === 0; case "<>": return c !== 0; case "<": return c < 0; case ">": return c > 0; case "<=": return c <= 0; case ">=": return c >= 0; }
    }
    function evAgg(n, ctx) {
      var rows = ctx.rows || [];
      if (n.star) return rows.length;
      var vals = [];
      rows.forEach(function (t) { var v = ev(n.arg, { tuple: t }); if (v !== null) vals.push(v); });
      if (n.fn === "COUNT") return vals.length;
      if (!vals.length) return null;
      if (n.fn === "SUM" || n.fn === "AVG") {
        var sum = 0; vals.forEach(function (v) { sum += typeof v === "number" ? v : (isNumStr(v) ? Number(v) : 0); });
        return n.fn === "SUM" ? sum : sum / vals.length;
      }
      var best = vals[0];
      vals.forEach(function (v) { var c = cmpVals(v, best); if (n.fn === "MAX" ? c > 0 : c < 0) best = v; });
      return best;
    }

    function run(sql) {
      var notes = {}, q = parse(sql, notes);
      bind(q, notes);
      var scope = q.scope, tuples = [[]], total;
      scope.forEach(function (sc) {
        var next = [];
        tuples.forEach(function (t) { sc.def.rows.forEach(function (r) { next.push(t.concat([r])); }); });
        tuples = next;
        if (tuples.length > 200000) fail("That query would combine too many rows. Check your join conditions.");
      });
      total = tuples.length;
      var conds = [];
      if (q.where) conds.push(q.where);
      q.joinOn.forEach(function (e) { conds.push(e); });
      if (conds.length) tuples = tuples.filter(function (t) { return conds.every(function (c) { return tv(ev(c, { tuple: t })) === true; }); });

      // expand select list
      var items = [];
      q.items.forEach(function (it) {
        if (it.star) {
          scope.forEach(function (sc, i) {
            if (it.table && !((sc.alias || sc.tname).toLowerCase() === it.table.toLowerCase() || sc.tname.toLowerCase() === it.table.toLowerCase())) return;
            sc.def.cols.forEach(function (c) { items.push({ expr: { k: "col", src: i, cname: c.name, ctype: c.type, name: c.name, raw: c.name }, name: c.name }); });
          });
          if (it.table && !items.length) fail("There is no table called " + it.table + " in the FROM line.");
        } else {
          var nm = it.alias || (it.expr.k === "col" && !it.expr.aliasRef ? it.expr.cname : it.text);
          items.push({ expr: it.expr, name: nm });
        }
      });

      var isAgg = q.group.length > 0 || items.some(function (i) { return hasAgg(i.expr); }) || (q.having && hasAgg(q.having)) || q.order.some(function (o) { return hasAgg(o.expr); });
      if (q.having && !isAgg) fail("HAVING needs GROUP BY or an aggregate function such as COUNT or SUM.");
      var contexts;
      if (isAgg) {
        if (!q.group.length) {
          contexts = [{ rows: tuples, tuple: tuples[0] || null }];
          var bare = items.some(function (i) { var f = false; (function w(n) { if (!n || n.k === "agg") return; if (n.k === "col") f = true; ["l", "r", "e", "lo", "hi"].forEach(function (k) { w(n[k]); }); })(i.expr); return f; });
          if (bare) notes.bareColumn = true;
        } else {
          var map = {}, order = [];
          tuples.forEach(function (t) {
            var key = q.group.map(function (g) {
              if (g.k === "num") { var gi = g.v - 1; if (gi < 0 || gi >= items.length) fail("GROUP BY " + g.v + " is outside the " + items.length + " fields you selected."); return ev(items[gi].expr, { tuple: t }); }
              return ev(resolveAliasExpr(g, items), { tuple: t });
            });
            var ks = JSON.stringify(key);
            if (!map[ks]) { map[ks] = { rows: [], tuple: t, key: key }; order.push(ks); }
            map[ks].rows.push(t);
          });
          contexts = order.map(function (k) { return map[k]; });
          contexts.sort(function (a, b) {
            for (var i = 0; i < a.key.length; i++) { var c = a.key[i] === null ? (b.key[i] === null ? 0 : -1) : b.key[i] === null ? 1 : cmpVals(a.key[i], b.key[i]); if (c) return c; }
            return 0;
          });
        }
        if (isAgg) {
        // like SQLite: with exactly one MAX or MIN, plain fields come from the row that holds that extreme value
        var aggNodes = [];
        items.forEach(function (i) { walk(i.expr, function (x) { if (x.k === "agg") aggNodes.push(x); }); });
        if (q.having) walk(q.having, function (x) { if (x.k === "agg") aggNodes.push(x); });
        q.order.forEach(function (o) { walk(o.expr, function (x) { if (x.k === "agg") aggNodes.push(x); }); });
        if (aggNodes.length === 1 && (aggNodes[0].fn === "MAX" || aggNodes[0].fn === "MIN") && aggNodes[0].arg) {
          contexts.forEach(function (c) {
            if (!c.rows || !c.rows.length) return;
            var best = c.rows[0], bv = ev(aggNodes[0].arg, { tuple: best });
            c.rows.forEach(function (t) { var v = ev(aggNodes[0].arg, { tuple: t }); if (v === null) return; if (bv === null || (aggNodes[0].fn === "MAX" ? cmpVals(v, bv) > 0 : cmpVals(v, bv) < 0)) { best = t; bv = v; } });
            c.tuple = best;
          });
        }
      }
      if (q.having) contexts = contexts.filter(function (c) { return tv(ev(q.having, c)) === true; });
      } else {
        contexts = tuples.map(function (t) { return { tuple: t }; });
      }

      var out = contexts.map(function (c) {
        var vals = items.map(function (i) { return ev(i.expr, c); });
        var keys = q.order.map(function (o) {
          if (o.expr.k === "num") {
            var ix = o.expr.v - 1; if (ix < 0 || ix >= vals.length) fail("ORDER BY " + o.expr.v + " is outside the " + vals.length + " fields you selected.");
            return vals[ix];
          }
          if (o.expr.aliasRef) { var idx = q.items.indexOf(o.expr.aliasRef); var pos = 0; for (var z = 0; z < idx; z++) pos += q.items[z].star ? 0 : 1; return ev(o.expr.aliasRef.expr, c); }
          return ev(o.expr, c);
        });
        return { vals: vals, keys: keys };
      });
      if (q.order.length) {
        out = out.map(function (r, i) { r.i = i; return r; });
        out.sort(function (a, b) {
          for (var i = 0; i < q.order.length; i++) {
            var x = a.keys[i], y = b.keys[i], c = x === null ? (y === null ? 0 : -1) : y === null ? 1 : cmpVals(x, y);
            if (c) return q.order[i].dir === "DESC" ? -c : c;
          }
          return a.i - b.i;
        });
      }
      var rows = out.map(function (r) { return r.vals; });
      if (q.distinct) { var seen = {}; rows = rows.filter(function (r) { var k = JSON.stringify(r); if (seen[k]) return false; seen[k] = 1; return true; }); }
      if (q.offset) rows = rows.slice(q.offset);
      if (q.limit !== null) rows = rows.slice(0, q.limit);

      var rn = [];
      var bareOp = false;
      [q.where, q.having].concat(q.joinOn).forEach(function (e) { walk(e, function (x) {
        if (x.k === "and" || x.k === "or") [x.l, x.r].forEach(function (y) { if (y.k === "num" || y.k === "str" || y.k === "col") bareOp = true; });
        if (x.k === "not" && (x.e.k === "num" || x.e.k === "str" || x.e.k === "col")) bareOp = true;
      }); });
      if (bareOp) rn.push("Each side of AND, OR or NOT needs a full condition, like Cost = 15 OR Cost = 60. A bare value such as 'OR 60' is not a comparison. SQLite treats any number except 0 as true, so the condition is always true and the rows you expect do not get filtered.");
      if (notes.curly) rn.push("Your query had curly quote marks (‘ ’), probably copied from a PDF. This site fixed them, but SQL needs plain straight quotes: '");
      if (notes.doubleQuote) rn.push("Text values go in single quotes ('like this'), not double quotes.");
      if (notes.dmyDate) rn.push("A date written like '01/03/2022' is how the Course Specifications write it in their example, and this site understood it. Real SQLite compares dates as plain text, so that form would give wrong rows. In your Codespace store and search dates as YYYY-MM-DD, like '2022-03-01'.");
      if (notes.bareColumn) rn.push("You mixed an aggregate (like COUNT or SUM) with a plain field but did not use GROUP BY. SQLite runs it anyway and shows one arbitrary row, which is misleading. HSC answers need GROUP BY.");
      return { cols: items.map(function (i) { return i.name; }), rows: rows, notes: rn, ast: q, fmt: fmt, cartesian: total };
    }
    function resolveAliasExpr(g, items) {
      if (g.aliasRef) return g.aliasRef.expr;
      return g;
    }

    /* ---------------- printing and translation ---------------- */
    var WORD = { "=": "EQUALS", "<>": "NOT EQUAL TO", "<": "LESS THAN", ">": "GREATER THAN", "<=": "LESS THAN OR EQUAL TO", ">=": "GREATER THAN OR EQUAL TO" };
    var PREC = { or: 1, and: 2, not: 3, cmp: 4, like: 4, between: 4, bin: 5, neg: 7 };
    function quote(v) { return "'" + String(v).replace(/'/g, "''") + "'"; }
    function levelOf(n, mode) {
      if (n.k === "bin") return (n.op === "+" || n.op === "-") ? 5 : 6;
      if (n.k === "between" && mode === "hsc") return 2;
      return PREC[n.k] || 9;
    }

    function pLit(n, mode, dateCtx) {
      if (n.k === "str") {
        if (dateCtx) {
          if (mode === "hsc" && ISO.test(n.v)) return quote(isoToDmy(n.v));
          if (mode === "sqlite" && DMY.test(n.v)) return quote(dmyToIso(n.v));
        }
        return quote(n.v);
      }
      return null;
    }
    function isDateCol(n) { return n.k === "col" && n.ctype === "date"; }

    function pExpr(n, mode, parentLevel) {
      var s = pRaw(n, mode), lvl = levelOf(n, mode);
      if ((n.p && n.k !== "col" && n.k !== "num" && n.k !== "str" && n.k !== "agg") || lvl < parentLevel) return "(" + s + ")";
      return s;
    }
    function pRaw(n, mode) {
      switch (n.k) {
        case "num": return n.raw;
        case "str": return quote(n.v);
        case "col": return n.raw;
        case "neg": return "-" + pExpr(n.e, mode, 7);
        case "bin": { var lv = levelOf(n, mode); return pExpr(n.l, mode, lv) + " " + n.op + " " + pExpr(n.r, mode, lv + 1); }
        case "agg": return n.fn + (mode === "hsc" ? " (" : "(") + (n.star ? "*" : pExpr(n.arg, mode, 0)) + ")";
        case "and": return pExpr(n.l, mode, 2) + " AND " + pExpr(n.r, mode, 3);
        case "or": return pExpr(n.l, mode, n.l.k === "or" && !n.l.p ? 1 : 3) + " OR " + pExpr(n.r, mode, 3);
        case "not": return "NOT " + pExpr(n.e, mode, 3);
        case "cmp": {
          var dc = isDateCol(n.l) || isDateCol(n.r);
          var op = mode === "hsc" ? WORD[n.op] : n.op;
          return operand(n.l, mode, dc) + " " + op + " " + operand(n.r, mode, dc);
        }
        case "like": return printLike(n, mode);
        case "between":
          if (mode === "hsc") return pExpr(betweenAsAnd(n), "hsc", 0);
          return pExpr(n.l, mode, 5) + (n.neg ? " NOT" : "") + " BETWEEN " + operand(n.lo, mode, isDateCol(n.l)) + " AND " + operand(n.hi, mode, isDateCol(n.l));
      }
      return "";
    }
    function operand(n, mode, dateCtx) { var l = pLit(n, mode, dateCtx); return l !== null ? l : pExpr(n, mode, 5); }
    function betweenAsAnd(n) {
      var a = { k: "cmp", op: n.neg ? "<" : ">=", l: n.l, r: n.lo, form: "word" };
      var b = { k: "cmp", op: n.neg ? ">" : "<=", l: n.l, r: n.hi, form: "word" };
      var r = { k: n.neg ? "or" : "and", l: a, r: b };
      return r;
    }
    function containsText(n) { // pattern like '%text%' (no other wildcards) -> text, else null
      if (n.r.k !== "str") return null;
      var m = /^%([^%_]+)%$/.exec(n.r.v);
      return m ? m[1] : null;
    }
    function printLike(n, mode) {
      var l = pExpr(n.l, mode, 5);
      if (mode === "hsc") {
        if (n.word) return l + (n.neg ? " DOES NOT CONTAIN " : " CONTAINS ") + pExpr(n.r, mode, 5);
        var t = containsText(n);
        if (t !== null) return l + (n.neg ? " DOES NOT CONTAIN " : " CONTAINS ") + quote(t);
        return l + (n.neg ? " NOT LIKE " : " LIKE ") + pExpr(n.r, mode, 5);
      }
      if (n.word) {
        var rhs = n.r.k === "str" ? quote("%" + n.r.v + "%") : "'%' || " + pExpr(n.r, mode, 5) + " || '%'";
        return l + (n.neg ? " NOT LIKE " : " LIKE ") + rhs;
      }
      return l + (n.neg ? " NOT LIKE " : " LIKE ") + pExpr(n.r, mode, 5);
    }
    function flattenAnd(n, mode) {
      if (n.k === "and" && !n.p) return flattenAnd(n.l, mode).concat(flattenAnd(n.r, mode));
      if (n.k === "between" && mode === "hsc" && !n.neg) {
        return [{ k: "cmp", op: ">=", l: n.l, r: n.lo, form: "word" }, { k: "cmp", op: "<=", l: n.l, r: n.hi, form: "word" }];
      }
      return [n];
    }
    function printQuery(q, mode) {
      var lines = [];
      var sel = q.items.map(function (it) {
        if (it.star) return it.table ? it.table + ".*" : "*";
        return pExpr(it.expr, mode, 0) + (it.alias ? " AS " + it.alias : "");
      }).join(", ");
      lines.push("SELECT " + (q.distinct ? "DISTINCT " : "") + sel);
      lines.push("FROM " + q.from.map(function (s) { return s.table + (s.alias ? " " + s.alias : ""); }).join(", "));
      var conj = [];
      if (q.where) {
        var wc = flattenAnd(q.where, mode);
        conj = conj.concat(wc);
      }
      q.joinOn.forEach(function (e) { conj = conj.concat(flattenAnd(e, mode)); });
      if (conj.length) {
        lines.push("WHERE " + pExpr(conj[0], mode, conj.length > 1 ? 3 : 0));
        conj.slice(1).forEach(function (c) { lines.push("AND " + pExpr(c, mode, 3)); });
      }
      if (q.group.length) lines.push("GROUP BY " + q.group.map(function (g) { return pExpr(g, mode, 0); }).join(", "));
      if (q.having) lines.push("HAVING " + pExpr(q.having, mode, 0));
      if (q.order.length) lines.push("ORDER BY " + q.order.map(function (o) { return pExpr(o.expr, mode, 0) + (o.dirWritten || o.dir === "DESC" ? " " + o.dir : ""); }).join(", "));
      if (q.limit !== null) lines.push("LIMIT " + q.limit + (q.offset ? " OFFSET " + q.offset : ""));
      return lines.join("\n");
    }

    // Classify and explain: what syntax did the student use, and what would change in the other style?
    function analyse(q) {
      var symbols = [], words = [], toHsc = [], toSqlite = [], extras = [], seen = {};
      function add(arr, v) { if (arr.indexOf(v) === -1) arr.push(v); }
      function change(list, from, to) { var k = from + "|" + to; if (!seen[k]) { seen[k] = 1; list.push({ from: from, to: to }); } }
      var all = [];
      q.items.forEach(function (i) { if (i.expr) all.push(i.expr); });
      [q.where, q.having].concat(q.joinOn).forEach(function (e) { if (e) all.push(e); });
      var SYM = { "=": "=", "<>": "<>", "<": "<", ">": ">", "<=": "<=", ">=": ">=" };
      all.forEach(function (e) {
        walk(e, function (n) {
          if (n.k === "cmp") {
            if (n.form === "sym") { add(symbols, n.op); change(toHsc, SYM[n.op], WORD[n.op]); }
            else { add(words, WORD[n.op]); change(toSqlite, WORD[n.op], SYM[n.op]); }
            [[n.l, n.r], [n.r, n.l]].forEach(function (pr) {
              if (isDateCol(pr[0]) && pr[1].k === "str") {
                if (pr[1].wasDmy) change(toSqlite, "'" + isoToDmy(pr[1].v) + "'", "'" + pr[1].v + "'");
                else if (ISO.test(pr[1].v)) change(toHsc, "'" + pr[1].v + "'", "'" + isoToDmy(pr[1].v) + "'");
              }
            });
          }
          if (n.k === "like") {
            if (n.word) {
              add(words, n.neg ? "DOES NOT CONTAIN" : "CONTAINS");
              change(toSqlite, n.neg ? "DOES NOT CONTAIN" : "CONTAINS", n.neg ? "NOT LIKE '%...%'" : "LIKE '%...%'");
            } else {
              add(symbols, n.neg ? "NOT LIKE" : "LIKE");
              var t = containsText(n);
              if (t !== null) change(toHsc, (n.neg ? "NOT LIKE '%" : "LIKE '%") + t + "%'", (n.neg ? "DOES NOT CONTAIN '" : "CONTAINS '") + t + "'");
              else add(extras, "LIKE with a pattern such as " + (n.r.k === "str" ? quote(n.r.v) : "this one") + " has no HSC operator word. CONTAINS only covers text appearing anywhere inside a value.");
            }
          }
          if (n.k === "between") { add(symbols, n.neg ? "NOT BETWEEN" : "BETWEEN"); if (n.neg) change(toHsc, "NOT BETWEEN a AND b", "LESS THAN a OR GREATER THAN b"); else change(toHsc, "BETWEEN a AND b", "GREATER THAN OR EQUAL TO a AND LESS THAN OR EQUAL TO b"); }
        });
      });
      if (q.joinOn.length) change(toHsc, "JOIN ... ON", "FROM Table1, Table2 with the join condition written in WHERE");
      if (q.distinct) add(extras, "DISTINCT is not in the HSC syntax list. SQLite runs it, but an HSC answer should not rely on it.");
      if (q.limit !== null) add(extras, "LIMIT is not in the HSC syntax list. SQLite runs it, but an HSC answer should not rely on it.");
      if (q.having) add(extras, "HAVING is not in the HSC syntax list. SQLite runs it, but an HSC answer should not rely on it.");
      return { symbols: symbols, words: words, toHsc: toHsc, toSqlite: toSqlite, extras: extras, usesSymbols: symbols.length > 0, usesWords: words.length > 0, usesJoinOn: q.joinOn.length > 0 };
    }

    return { run: run, parse: parse, print: printQuery, analyse: analyse, fmt: fmt, tableNames: tableNames, db: db, WORD: WORD };
  }

  return { create: createEngine };
});
