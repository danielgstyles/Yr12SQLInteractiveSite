/* Page content for the HSC SQL practice site. Pure data (no DOM), so tests can load it in Node.
   Task fields: key, text, q (prefilled), sol (reference answer, used for marking), hint,
   alias [expected headings], colOrder, ordered, orderCols, requires [{re,msg}], hintIf(query),
   mode: 'toHsc' | 'toSqlite' (translation tasks), onlyKeys. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PAGES = factory();
})(this, function () {
  "use strict";

  function anyNode(ast, pred) {
    var found = false;
    function w(n) { if (!n || found) return; if (pred(n)) { found = true; return; } ["l", "r", "e", "lo", "hi", "arg"].forEach(function (k) { if (n[k]) w(n[k]); }); }
    ast.items.forEach(function (i) { w(i.expr); });
    w(ast.where); w(ast.having); ast.joinOn.forEach(w); ast.order.forEach(function (o) { w(o.expr); });
    return found;
  }
  var NEEDS_GROUP = [{ test: function (ast) { return ast.group.length > 0; }, msg: "The rows are right, but the aim of this task is to practise GROUP BY.", how: "GROUP BY makes one row for each different value in a field. After FROM (and WHERE, if you have one) write GROUP BY and then the field you want one row for each of, for example GROUP BY Publisher_ID. Then put the calculated value, like COUNT (ID), in the SELECT line." }];
  var FN_HOW = {
    COUNT: "COUNT (field) counts the rows. Put it in the SELECT line, like SELECT COUNT (ID) AS Total_games, and use AS to give it the heading the task asks for.",
    SUM: "SUM (field) adds up all the values in a field. Put it in the SELECT line, like SELECT SUM (Cost) AS Total_cost.",
    AVG: "AVG (field) works out the average of the values in a field. Put it in the SELECT line, like SELECT AVG (Cost) AS Average_cost.",
    MAX: "MAX (field) finds the largest value. Put it in the SELECT line, like MAX (Cost) AS Highest_cost, next to the field you are grouping by."
  };
  function needsFn(fn, why) {
    return [{ test: function (ast) { return anyNode(ast, function (n) { return n.k === "agg" && n.fn === fn; }); }, msg: "The result looks right, but the aim of this task is to practise the " + fn + " function" + (why ? " (" + why + ")" : "") + ".", how: FN_HOW[fn] }];
  }
  var NEEDS_JOIN = [{ test: function (ast) { return ast.from.length > 1; }, msg: "The rows are right, but the aim of this task is to practise joining two tables, not to type in the publisher's ID number.", how: "List both tables after FROM, separated by a comma (FROM Games, Publishers). Then in WHERE match the foreign key to the primary key it points to (Games.Publisher_ID = Publishers.Publisher_ID), and join your other condition to it with AND. Use the publisher's name from the Publishers table for the filter." }];
  var NEEDS_NOT = [{ test: function (ast) { return anyNode(ast, function (n) { return n.k === "not"; }); }, msg: "The rows are right, but the aim of this task is to practise the logical operator NOT (writing NOT EQUAL TO or a > comparison gets the same rows a different way).", how: "Write the condition for the rows you do NOT want, put it in brackets, and put NOT in front of the brackets. Here the rows you don't want are publisher 1 or publisher 2, so it is NOT ( Publisher_ID = 1 OR Publisher_ID = 2 ). You can also write NOT Publisher_ID = 1 AND NOT Publisher_ID = 2." }];
  var NEEDS_QUOTED_DATE = [{ test: function (ast) { return anyNode(ast, function (n) { return n.k === "str" && /^[0-9]{1,4}[-\/][0-9]{1,2}[-\/][0-9]{1,4}$/.test(n.v); }); }, msg: "The rows are right, but dates are text, so the date has to be in single quotes.", how: "Write the date year first (the order the table uses) inside single quotes, for example Release_date >= '2024-01-01'." }];
  var BRACKET_HINT = function (q) {
    return /\bOR\b/i.test(q) && /\bAND\b/i.test(q) && q.indexOf("(") === -1
      ? "You have both AND and OR but no brackets. AND is worked out before OR, so use brackets to group the OR part." : "";
  };

  /* Entity relationship diagram for page 1 (inline SVG, modelled on the HSC Course Specifications figure).
     Two layouts: "wide" (side by side, like the HSC figure) and "narrow" (stacked, for phones).
     CSS shows one of them depending on the screen width. Lines join each FK row in Games to the PK row it points to. */
  function ER_SVG(layout) {
    var HH = 32, RH = 28;               // header height, row height
    var T = {
      games: { name: "Games", rows: [["ID (P)", "pk"], ["Name"], ["Release_date"], ["Cost"], ["Publisher_ID (F)", "fk"], ["Developer_ID (F)", "fk"]] },
      pubs:  { name: "Publishers", rows: [["Publisher_ID (P)", "pk"], ["Name"]] },
      devs:  { name: "Developers", rows: [["Developer_ID (P)", "pk"], ["First_name"], ["Last_name"]] }
    };
    var W, H, BW, pos, links, legendY;
    if (layout === "wide") {
      W = 720; BW = 190;
      pos = { pubs: [10, 10], games: [265, 10], devs: [520, 10] };
      legendY = 250; H = 264;
    } else {
      W = 320; BW = 200;
      pos = { pubs: [10, 10], games: [10, 128], devs: [10, 352] };
      legendY = 500; H = 512;
    }
    function rowY(t, i) { return pos[t][1] + HH + RH * i + RH / 2; }   // centre of row i
    var gx = pos.games[0] + BW;                                           // right edge of Games
    var pY = rowY("games", 4), dY = rowY("games", 5), ppY = rowY("pubs", 0), dpY = rowY("devs", 0);
    if (layout === "wide") {
      var gl = pos.games[0], pr = pos.pubs[0] + BW;
      links = [
        { d: "M" + gl + " " + pY + " H" + (gl - 33) + " V" + ppY + " H" + pr, many: [gl - 16, pY - 7], one: [pr + 4, ppY - 7] },
        { d: "M" + gx + " " + dY + " H" + (gx + 33) + " V" + dpY + " H" + pos.devs[0], many: [gx + 6, dY - 7], one: [pos.devs[0] - 14, dpY - 7] }
      ];
    } else {
      var px = pos.pubs[0] + BW, dx = pos.devs[0] + BW;
      links = [
        { d: "M" + gx + " " + pY + " H295 V" + ppY + " H" + px, many: [gx + 8, pY - 7], one: [px + 8, ppY - 7] },
        { d: "M" + gx + " " + dY + " H255 V" + dpY + " H" + dx, many: [gx + 8, dY + 19], one: [dx + 8, dpY - 7] }
      ];
    }
    var out = "<svg class='er-" + layout + "' viewBox='0 0 " + W + " " + H + "' role='img' aria-labelledby='er-t-" + layout + " er-d-" + layout + "'>" +
      "<title id='er-t-" + layout + "'>Entity relationship diagram: Games, Publishers and Developers</title>" +
      "<desc id='er-d-" + layout + "'>Games has fields ID (primary key), Name, Release_date, Cost, Publisher_ID (foreign key) and Developer_ID (foreign key). " +
      "Publishers has Publisher_ID (primary key) and Name. Developers has Developer_ID (primary key), First_name and Last_name. " +
      "A line joins Games.Publisher_ID to Publishers.Publisher_ID, one publisher to many games. " +
      "A line joins Games.Developer_ID to Developers.Developer_ID, one developer to many games. Publishers and Developers are not linked to each other.</desc>";
    links.forEach(function (l) {
      out += "<path class='er-line' d='" + l.d + "'/>" +
        "<text class='er-card' x='" + l.many[0] + "' y='" + l.many[1] + "'>∞</text>" +
        "<text class='er-card' x='" + l.one[0] + "' y='" + l.one[1] + "'>1</text>";
    });
    ["games", "pubs", "devs"].forEach(function (k) {
      var t = T[k], x = pos[k][0], y = pos[k][1], h = HH + RH * t.rows.length;
      out += "<g class='er-ent'><rect class='er-box' x='" + x + "' y='" + y + "' width='" + BW + "' height='" + h + "' rx='8'/>" +
        "<path class='er-head' d='M" + x + " " + (y + HH) + " V" + (y + 8) + " a8 8 0 0 1 8 -8 H" + (x + BW - 8) + " a8 8 0 0 1 8 8 V" + (y + HH) + " Z'/>" +
        "<text class='er-hname' x='" + (x + 12) + "' y='" + (y + 22) + "'>" + t.name + "</text>";
      t.rows.forEach(function (r, i) {
        var ry = y + HH + RH * i;
        if (r[1]) out += "<rect class='er-keyrow' x='" + (x + 2) + "' y='" + ry + "' width='" + (BW - 4) + "' height='" + RH + "'/>";
        out += "<text class='er-field" + (r[1] ? " er-key" : "") + "' x='" + (x + 12) + "' y='" + (ry + 19) + "'>" + r[0] + "</text>";
      });
      out += "<rect class='er-outline' x='" + x + "' y='" + y + "' width='" + BW + "' height='" + h + "' rx='8'/></g>";
    });
    out += "<text class='er-legend' x='10' y='" + legendY + "'>P = Primary key</text>" +
      "<text class='er-legend' x='" + (layout === "wide" ? 200 : 170) + "' y='" + legendY + "'>F = Foreign key</text></svg>";
    return out;
  }

  var P = [];

  /* ======================= PAGE 1 ======================= */
  P.push({
    id: 1, label: "The tables", title: "Meet the three tables",
    li: "I can describe the Games, Publishers and Developers tables, and explain how primary and foreign keys link them.",
    pace: "about 15 minutes",
    learn: [
      { h: "Learn: a relational database", html:
        "<p>A <strong>relational database</strong> stores data in several <strong>tables</strong> that are linked together. Here the data is split into three tables, the same three used in the HSC Course Specifications.</p>" +
        "<ul><li>A <strong>row</strong> (record) is everything about one thing, like one game.</li>" +
        "<li>A <strong>column</strong> (field) is one fact about every row, like <code>Cost</code>.</li>" +
        "<li>A <strong>primary key (P)</strong> is a column whose value is different for every row, so it identifies exactly one row.</li>" +
        "<li>A <strong>foreign key (F)</strong> is a column that holds another table's primary key value. It is how two tables are linked.</li></ul>" +
        "<p>The lines on the diagram join each <strong>foreign key</strong> in Games to the <strong>primary key</strong> it points to. Publishers and Developers are not joined to each other; both links go through Games.</p>" +
        "<p>The <strong>1</strong> and <strong>∞</strong> mean one-to-many: one publisher can publish many games, and one developer can develop many games. Each game has only one publisher and one developer.</p>" +
        "<figure class='er'>" + ER_SVG("wide") + ER_SVG("narrow") + "</figure>" },
      { h: "Worked example: following a key", html:
        "<p>Click a game to see how its two foreign keys point to rows in the other tables.</p>" +
        "<div class='tablewrap' id='explore-games'></div><div class='infopanel' id='explore-info'>Click a row in the Games table.</div>" +
        "<div class='annot'>All the dates in this site are stored as <code>YYYY-MM-DD</code> (for example <code>2022-03-01</code>). That is the form SQLite needs to compare dates correctly. A question may give you a date the other way round, like <code>01-03-2022</code> (day, month, year). Your query must use the order the table uses, so rewrite it as <code>'2022-03-01'</code>. The Specifications' own examples write dates day first, so being able to switch a date around is a skill worth practising.</div>" }
    ],
    tasks: [
      { key: "p1t1", text: "Press <strong>▶ Run</strong> (or Ctrl+Enter) to display every row and column of the Games table.", q: "SELECT * FROM Games", sol: "SELECT * FROM Games" },
      { key: "p1t2", text: "Now show everything in the <code>Developers</code> table. Edit the query and run it.", q: "SELECT * FROM Games", sol: "SELECT * FROM Developers", hint: "Change the table name after FROM." }
    ],
    checks: [
      { key: "p1q1", legend: "Which column is the primary key of the Games table?", options: [
        { t: "Name", fb: "Two games could share a name. A primary key must be different for every row." },
        { t: "ID", ok: true, fb: "Correct. ID is different for every game, so it identifies one row. It is marked (P) on the diagram." },
        { t: "Publisher_ID", fb: "Many games share the same publisher, so this repeats. It is a foreign key." },
        { t: "Cost", fb: "Lots of games cost the same amount, so it can't identify one row." }] },
      { key: "p1q2", legend: "In the Games table, Publisher_ID is a…", options: [
        { t: "primary key", fb: "In Games it repeats (Games Inc published many games), so it can't be Games' primary key. It is the primary key of the Publishers table." },
        { t: "foreign key", ok: true, fb: "Correct. It holds a primary key value from the Publishers table, which links each game to its publisher." },
        { t: "field type", fb: "Every column is a field, but this one has a special job. Which key links to another table?" },
        { t: "row", fb: "A row is a whole record, not a single column." }] },
      { key: "p1q3", legend: "Why is the publisher's name stored once in Publishers, not repeated in every Games row?", options: [
        { t: "SQL can't read long text", fb: "SQL handles text fine. Think about what happens if a name changes." },
        { t: "It is stored once and linked by key, so it only needs changing in one place", ok: true, fb: "Correct. Storing it once avoids repeated data and mistakes where two rows disagree." },
        { t: "A table can only have six columns", fb: "There is no such limit." }] }
    ],
    hpge: { prompt: "The studio wants to record which <strong>platforms</strong> (PC, Switch, PlayStation) each game is on. A game can be on several platforms. Sketch a new table (or tables) you would add. Which columns would be keys?",
      answer: "One neat answer: a <code>Platforms</code> table (Platform_ID (P), Name) and a linking table <code>Game_Platforms</code> (Game_ID (F), Platform_ID (F)). A game can then appear on many platforms and a platform can hold many games. Adding a Platform_ID foreign key straight into Games would force each game onto only one platform." }
  });

  /* ======================= PAGE 2 ======================= */
  P.push({
    id: 2, label: "SELECT", title: "SELECT, FROM and AS",
    li: "I can write a query that chooses different fields from a table, then work out new values and rename them for display with AS.",
    pace: "about 20 minutes",
    learn: [
      { h: "Learn: the HSC query layout", html:
        "<p>The Course Specifications give this layout. Start with the first two lines. The others come in later pages.</p>" +
        "<pre class='code'>SELECT   the field(s) or calculated values to be displayed\nFROM     the table(s) to be used\nWHERE    the search criteria\nGROUP BY the field(s) used to group the returned rows\nORDER BY the field(s) that determine the sequence of the displayed results</pre>" +
        "<ul><li><span class='kw'>SELECT</span> lists the fields to show, separated by commas. <code>*</code> means every field.</li>" +
        "<li><span class='kw'>FROM</span> names the table the fields come from.</li>" +
        "<li>The fields come out in the order you list them.</li>" +
        "<li>The clauses always go in the same order, even when some are left out: SELECT, FROM, WHERE, GROUP BY, ORDER BY. Put one in the wrong place and the query will not run.</li></ul>" },
      { h: "Worked example: choosing fields", html:
        "<p>Run each one and compare the results. Same table, different fields.</p>" +
        "<div class='runner' data-runner='p2w0'></div>" +
        "<div class='runner' data-runner='p2w1'></div>" }
    ],
    runners: {
      p2w0: { q: "SELECT *\nFROM Games" },
      p2w1: { q: "SELECT Name, Cost\nFROM Games" },
      p2w2: { q: "SELECT Name, Cost, Cost - 5 AS Sale_price\nFROM Games" }
    },
    blocks: [
      { html: "<h2><span class='stepno'>Try it:</span> choose the fields</h2>" },
      { task: { key: "p2t1", text: "Edit the query so it shows the <code>Name</code> <strong>and</strong> the <code>Cost</code> of every game.", q: "SELECT Name\nFROM Games", sol: "SELECT Name, Cost FROM Games", hint: "Fields are separated by a comma." } },
      { task: { key: "p2t2", text: "Write a query that shows the <code>First_name</code> and <code>Last_name</code> of every developer.", q: "", sol: "SELECT First_name, Last_name FROM Developers", hint: "FROM needs the Developers table." } },
      { task: { key: "p2t5", text: "Show the <code>Release_date</code>, then the <code>Name</code>, then the <code>Cost</code> of every game, <strong>in that order</strong>.", q: "", sol: "SELECT Release_date, Name, Cost FROM Games", colOrder: true, hint: "The fields appear in the order you list them after SELECT." } },
      { checks: [
        { key: "p2q1", legend: "What is wrong with <code>SELECT Name Cost FROM Games</code>?", options: [
          { t: "Nothing, it works", fb: "Run it to see. Two fields need to be separated." },
          { t: "There is no comma between Name and Cost", ok: true, fb: "Correct. Fields in the SELECT list are separated by commas." },
          { t: "FROM must come first", fb: "SELECT always comes first, then FROM." }] }
      ] },
      { html: "<h2 style='margin-top:22px'><span class='stepno'>Learn:</span> new values and new headings</h2>" +
        "<p>So far every heading has been the field's own name. The SELECT line can also show a <strong>calculated value</strong>, worked out for each row, like <code>Cost - 5</code>.</p>" +
        "<p><span class='kw'>AS</span> gives a field or calculated value a new heading in the <em>displayed</em> results only. The table itself does not change.</p>" +
        "<p>Run this one. The new heading <code>Sale_price</code> is made by <code>AS</code>.</p>" +
        "<div class='runner' data-runner='p2w2'></div>" +
        "<h2 style='margin-top:22px'><span class='stepno'>Try it:</span> calculated values and AS</h2>" },
      { task: { key: "p2t3", text: "Show each game's <code>Name</code> and a calculated value, its <code>Cost</code> minus 5, with the heading <code>Sale_price</code>.", q: "", sol: "SELECT Name, Cost - 5 AS Sale_price FROM Games", alias: ["name", "sale_price"], colOrder: true, hint: "SELECT Name, Cost - 5 AS ... FROM Games" } },
      { task: { key: "p2t4", text: "Show the <code>Name</code> of each game with the heading <code>Game</code>, and its <code>Release_date</code> with the heading <code>Released</code>.", q: "", sol: "SELECT Name AS Game, Release_date AS Released FROM Games", alias: ["game", "released"], colOrder: true } },
      { checks: [
        { key: "p2q2", legend: "What does <code>AS</code> change?", options: [
          { t: "The heading shown in the results", ok: true, fb: "Correct. It renames a field for display only." },
          { t: "The data stored in the table", fb: "SELECT never changes stored data." },
          { t: "The order of the rows", fb: "Ordering is done by ORDER BY." }] }
      ] }
    ],
    hpge: { task: { key: "p2h1", text: "Show <code>Name</code> and <code>Cost</code> for every game, plus two calculated fields: <code>Cost - 5</code> headed <code>Sale_price</code> and <code>Cost * 2</code> headed <code>Double_cost</code>.", q: "", sol: "SELECT Name, Cost, Cost - 5 AS Sale_price, Cost * 2 AS Double_cost FROM Games", alias: ["name", "cost", "sale_price", "double_cost"] } }
  });

  /* ======================= PAGE 3 ======================= */
  P.push({
    id: 3, label: "WHERE", title: "WHERE and the relational operators",
    li: "I can filter rows using the HSC relational operators, written as words or as SQLite symbols.",
    pace: "about 25 minutes",
    learn: [
      { h: "Learn: choosing rows with WHERE", html:
        "<p><span class='kw'>WHERE</span> keeps only the rows that match the search criteria. SELECT chooses columns, WHERE chooses rows.</p>" +
        "<p>The Course Specifications list the <strong>relational operators</strong> as words, but their own worked examples write <code>&gt;=</code>, <code>&lt;=</code> and <code>=</code> as symbols. SQLite itself only understands symbols. <strong>This site accepts both.</strong> After you succeed it shows you the other form, so you learn to read and write both.</p>" +
        "<table class='ref'><tr><th>HSC operator (words)</th><th>SQLite symbol</th><th>Example</th></tr>" +
        "<tr><td><span class='hw'>EQUALS</span></td><td><span class='sy'>=</span></td><td><code>Cost = 20</code></td></tr>" +
        "<tr><td><span class='hw'>NOT EQUAL TO</span></td><td><span class='sy'>&lt;&gt;</span> or <span class='sy'>!=</span></td><td><code>Cost &lt;&gt; 20</code></td></tr>" +
        "<tr><td><span class='hw'>GREATER THAN</span></td><td><span class='sy'>&gt;</span></td><td><code>Cost &gt; 40</code></td></tr>" +
        "<tr><td><span class='hw'>GREATER THAN OR EQUAL TO</span></td><td><span class='sy'>&gt;=</span></td><td><code>Cost &gt;= 40</code></td></tr>" +
        "<tr><td><span class='hw'>LESS THAN</span></td><td><span class='sy'>&lt;</span></td><td><code>Cost &lt; 25</code></td></tr>" +
        "<tr><td><span class='hw'>LESS THAN OR EQUAL TO</span></td><td><span class='sy'>&lt;=</span></td><td><code>Cost &lt;= 25</code></td></tr>" +
        "<tr><td><span class='hw'>CONTAINS</span></td><td><span class='sy'>LIKE '%text%'</span></td><td><code>Name LIKE '%Star%'</code></td></tr>" +
        "<tr><td><span class='hw'>DOES NOT CONTAIN</span></td><td><span class='sy'>NOT LIKE '%text%'</span></td><td><code>Name NOT LIKE '%Star%'</code></td></tr></table>" +
        "<ul><li><strong>Text values</strong> go in single quotes: <code>'Pixel Quest'</code>. Numbers do not.</li>" +
        "<li><strong>Dates</strong> are text, and this table stores them <strong>year first</strong>: <code>YYYY-MM-DD</code>. In a query write them in single quotes in that same order, like <code>'2024-01-01'</code>. A question may give a date as DD-MM-YYYY (<code>01-01-2024</code>), so you have to turn it around yourself. If the order doesn't match the table, the rows come out wrong (this site stops you with a message).</li>" +
        "<li>The % in <code>LIKE '%Star%'</code> means &quot;anything, or nothing&quot;.</li>" +
        "<li><strong>Capital letters:</strong> <code>=</code> is case-sensitive, so <code>Name = 'pixel quest'</code> finds nothing. <code>LIKE</code> (and so CONTAINS) ignores upper and lower case.</li></ul>" },
      { h: "Worked example: the same query two ways", html:
        "<p>Both of these return the same rows. Run each.</p>" +
        "<p><strong>Operator words:</strong></p><div class='runner' data-runner='p3w1'></div>" +
        "<p><strong>SQLite symbols:</strong></p><div class='runner' data-runner='p3w2'></div>" +
        "<p class='annot'>Notice that after you run one, the panel under it shows the other style. In a real SQLite database (like your Codespace) the word version gives a <em>syntax error</em>.</p>" }
      ,
      { h: "Worked examples: three new ideas, one at a time", html:
        "<p>Run each one. They show the three things students most often get wrong in WHERE.</p>" +
        "<p><strong>1. Text goes in single quotes.</strong> Change <code>'Pixel Quest'</code> to <code>'Star Drifter'</code> and run it again.</p><div class='runner' data-runner='p3w3'></div>" +
        "<p><strong>2. % means &quot;anything, or nothing&quot;.</strong> <code>LIKE '%Star%'</code> finds any name with Star anywhere inside it. (Words version: <code>CONTAINS 'Star'</code>, with no % needed.) Try removing the two % signs and see what happens.</p><div class='runner' data-runner='p3w4'></div>" +
        "<p><strong>3. Dates are text, so they go in quotes too,</strong> and the table stores them year first.</p><div class='runner' data-runner='p3w5'></div>" }
    ],
    runners: {
      p3w1: { q: "SELECT Name, Cost\nFROM Games\nWHERE Cost GREATER THAN 40" },
      p3w2: { q: "SELECT Name, Cost\nFROM Games\nWHERE Cost > 40" },
      p3w3: { q: "SELECT Name, Cost\nFROM Games\nWHERE Name = 'Pixel Quest'" },
      p3w4: { q: "SELECT Name\nFROM Games\nWHERE Name LIKE '%Star%'" },
      p3w5: { q: "SELECT Name, Release_date\nFROM Games\nWHERE Release_date >= '2024-01-01'" }
    },
    tasks: [
      { key: "p3t1", text: "Show the <code>Name</code> and <code>Cost</code> of games that cost exactly 20.", q: "SELECT Name, Cost\nFROM Games\nWHERE", sol: "SELECT Name, Cost FROM Games WHERE Cost = 20", hint: "WHERE Cost EQUALS 20, or WHERE Cost = 20." },
      { key: "p3t2", text: "Show the <code>Name</code> of every game whose name <strong>contains</strong> the letters <code>er</code>.", q: "", sol: "SELECT Name FROM Games WHERE Name LIKE '%er%'", hint: "WHERE Name CONTAINS 'er', or WHERE Name LIKE '%er%'. Remember the single quotes." },
      { key: "p3t3", text: "Show the <code>Name</code> and <code>Publisher_ID</code> of every game that was <strong>not</strong> published by publisher 1.", q: "", sol: "SELECT Name, Publisher_ID FROM Games WHERE Publisher_ID <> 1", hint: "NOT EQUAL TO, or <>." },
      { key: "p3t4", text: "Show the <code>Name</code> and <code>Release_date</code> of games released <strong>on or after 01-01-2024</strong> (DD-MM-YYYY).", q: "", sol: "SELECT Name, Release_date FROM Games WHERE Release_date >= '2024-01-01'", astRequires: NEEDS_QUOTED_DATE, hint: "GREATER THAN OR EQUAL TO, or >=. The table stores dates year first, so turn the date around: '2024-01-01', in single quotes." }
    ],
    checks: [
      { key: "p3q1", legend: "Which condition finds games that cost <strong>at least</strong> $40?", options: [
        { t: "Cost GREATER THAN 40", fb: "That leaves out games that cost exactly 40." },
        { t: "Cost GREATER THAN OR EQUAL TO 40", ok: true, fb: "Correct. 'At least 40' includes 40, so use >=." },
        { t: "Cost LESS THAN 40", fb: "That finds the cheaper games." },
        { t: "Cost NOT EQUAL TO 40", fb: "That finds everything except games costing exactly 40." }] },
      { key: "p3q2", legend: "You are working in a real SQLite database. Which line will run?", options: [
        { t: "<code>WHERE Cost EQUALS 20</code>", fb: "SQLite doesn't understand EQUALS. It is a syntax error." },
        { t: "<code>WHERE Cost = 20</code>", ok: true, fb: "Correct. SQLite only understands symbols. The words are the operator names the Course Specifications list, and their own examples use symbols too, so learn to read both." },
        { t: "<code>WHERE Name CONTAINS 'a'</code>", fb: "SQLite has no CONTAINS. Use LIKE '%a%'." },
        { t: "<code>WHERE Cost GREATER THAN 20</code>", fb: "SQLite doesn't understand GREATER THAN. Use >." }] },
      { key: "p3q3", legend: "Which is the correct way to match a game called Pixel Quest?", options: [
        { t: "<code>WHERE Name = Pixel Quest</code>", fb: "Without quotes SQL thinks Pixel and Quest are column names." },
        { t: "<code>WHERE Name = 'Pixel Quest'</code>", ok: true, fb: "Correct. Text values need single quotes." },
        { t: "<code>WHERE Name = 'Pixel Quest</code>", fb: "The closing quote is missing." }] }
    ],
    hpge: { task: { key: "p3h1", text: "Show the <code>Name</code> of every game whose name does <strong>not</strong> contain the letter <code>a</code> (upper or lower case).", q: "", sol: "SELECT Name FROM Games WHERE Name NOT LIKE '%a%'", hint: "DOES NOT CONTAIN 'a', or NOT LIKE '%a%'." } }
  });

  /* ======================= PAGE 4 ======================= */
  P.push({
    id: 4, label: "AND / OR / NOT", title: "Logical operators: AND, OR and NOT",
    li: "I can combine conditions using AND, OR and NOT, and use brackets to control the order.",
    pace: "about 20 minutes",
    learn: [
      { h: "Learn: combining conditions", html:
        "<ul><li><span class='kw'>AND</span>: <em>both</em> conditions must be true. It <strong>narrows</strong> the results.</li>" +
        "<li><span class='kw'>OR</span>: <em>either</em> condition can be true. It <strong>widens</strong> the results.</li>" +
        "<li><span class='kw'>NOT</span>: flips a condition, so rows that did match are left out.</li></ul>" +
        "<p><strong>AND is worked out before OR</strong>, like multiplying before adding. Brackets make your meaning clear and override that order.</p>" +
        "<p>For a date range, use AND with two conditions. This is the pattern from the Course Specifications' first example, with the dates written the way SQLite needs them:</p>" +
        "<pre class='code'>WHERE Release_date &gt;= '2022-03-01' AND Release_date &lt;= '2023-03-31'</pre>" },
      { h: "Worked examples", html:
        "<p><strong>1. AND</strong>: both conditions must be true.</p><div class='runner' data-runner='p4w1'></div>" +
        "<p><strong>2. OR</strong>: either condition can be true. Notice that each side of OR is a complete condition, with its own field name.</p><div class='runner' data-runner='p4w2'></div>" +
        "<p><strong>3. NOT</strong>: keeps the rows that do <em>not</em> match. Read <code>NOT Cost = 20</code> as &quot;not (cost equals 20)&quot;.</p><div class='runner' data-runner='p4w3'></div>" +
        "<p><strong>3b. NOT in front of brackets</strong> turns a whole OR condition around. This keeps every game that is <em>neither</em> 15 <em>nor</em> 60. Read it as &quot;not (15 or 60)&quot;.</p><div class='runner' data-runner='p4w6'></div>" +
        "<p><strong>4. Brackets change the answer.</strong> These two queries differ only by brackets. Run both and compare the number of rows (9, then 2). Without brackets the AND is worked out first, so every publisher 1 game comes back.</p>" +
        "<div class='runner' data-runner='p4w4'></div><div class='runner' data-runner='p4w5'></div>" }
    ],
    runners: { p4w1: { q: "SELECT Name, Cost, Publisher_ID\nFROM Games\nWHERE Cost GREATER THAN OR EQUAL TO 40 AND Publisher_ID EQUALS 1" },
      p4w2: { q: "SELECT Name, Cost\nFROM Games\nWHERE Cost = 15 OR Cost = 60" },
      p4w3: { q: "SELECT Name, Cost\nFROM Games\nWHERE NOT Cost = 20" },
      p4w6: { q: "SELECT Name, Cost\nFROM Games\nWHERE NOT (Cost = 15 OR Cost = 60)" },
      p4w4: { q: "SELECT Name, Cost, Publisher_ID\nFROM Games\nWHERE Publisher_ID = 1 OR Publisher_ID = 2 AND Cost < 30" },
      p4w5: { q: "SELECT Name, Cost, Publisher_ID\nFROM Games\nWHERE (Publisher_ID = 1 OR Publisher_ID = 2) AND Cost < 30" } },
    tasks: [
      { key: "p4t1", text: "Show the <code>Name</code> and <code>Cost</code> of games that cost <strong>30 or more</strong> <em>and</em> were published by publisher 1.", q: "", sol: "SELECT Name, Cost FROM Games WHERE Cost >= 30 AND Publisher_ID = 1" },
      { key: "p4t2", text: "Show the <code>Name</code> and <code>Release_date</code> of games released <strong>during 2023</strong> (1 January to 31 December).", q: "", sol: "SELECT Name, Release_date FROM Games WHERE Release_date >= '2023-01-01' AND Release_date <= '2023-12-31'", hint: "Two conditions joined by AND: on or after 1 January, and on or before 31 December." },
      { key: "p4t3", text: "Show the <code>Name</code> and <code>Cost</code> of games that cost exactly 15 <em>or</em> exactly 60.", q: "", sol: "SELECT Name, Cost FROM Games WHERE Cost = 15 OR Cost = 60", hint: "Cost can't be 15 and 60 at once, so which operator do you need?" },
      { key: "p4t4", text: "Show the <code>Name</code>, <code>Cost</code> and <code>Publisher_ID</code> of games from publisher 1 <em>or</em> publisher 2 that cost <strong>less than 30</strong>.", q: "", sol: "SELECT Name, Cost, Publisher_ID FROM Games WHERE (Publisher_ID = 1 OR Publisher_ID = 2) AND Cost < 30", hintIf: BRACKET_HINT, hint: "Do it in two steps. Step 1: the publisher part is an OR, so put it in brackets: ( Publisher_ID = 1 OR Publisher_ID = 2 ). Step 2: join the cost condition to the brackets with AND. Without the brackets the AND is worked out first and you get too many rows (worked example 4 shows the difference)." },
      { key: "p4t5", text: "Show the <code>Name</code> and <code>Publisher_ID</code> of games that are <strong>not</strong> from publisher 1 and <strong>not</strong> from publisher 2. <code>NOT</code> is one of the three logical operators (AND, OR, NOT), so this task practises using it. Look at worked examples 3 and 3b above: NOT can go in front of a whole bracketed condition.", q: "", sol: "SELECT Name, Publisher_ID FROM Games WHERE NOT (Publisher_ID = 1 OR Publisher_ID = 2)", astRequires: NEEDS_NOT, hint: "Do it in two steps. Step 1: write the condition for the games you want to leave OUT, which is publisher 1 OR publisher 2, inside brackets: ( Publisher_ID = 1 OR Publisher_ID = 2 ). Step 2: put NOT in front of the brackets. The WHERE line then reads WHERE NOT ( ... OR ... )." }
    ],
    checks: [
      { key: "p4q1", legend: "How many rows does <code>WHERE Cost = 15 AND Cost = 60</code> return?", options: [
        { t: "Every game that costs 15 or 60", fb: "That would be OR. AND needs both to be true at once." },
        { t: "None", ok: true, fb: "Correct. A single value can't be 15 and 60 at the same time." },
        { t: "All the games", fb: "AND only keeps rows where both conditions are true." }] },
      { key: "p4q2", legend: "Which is worked out first in <code>A OR B AND C</code>?", options: [
        { t: "A OR B", fb: "OR is worked out last." },
        { t: "B AND C", ok: true, fb: "Correct. AND comes before OR, so add brackets if you mean something else." }] }
    ],
    hpge: { task: { key: "p4h1", text: "Show <code>Name</code>, <code>Release_date</code>, <code>Cost</code> and <code>Publisher_ID</code> of games that were released in 2022 <em>or</em> cost more than 50, but were <strong>not</strong> published by publisher 1.", q: "", sol: "SELECT Name, Release_date, Cost, Publisher_ID FROM Games WHERE ((Release_date >= '2022-01-01' AND Release_date <= '2022-12-31') OR Cost > 50) AND Publisher_ID <> 1", hintIf: BRACKET_HINT } }
  });

  /* ======================= PAGE 5 ======================= */
  P.push({
    id: 5, label: "ORDER BY", title: "ORDER BY: putting rows in order",
    li: "I can sort results with ORDER BY using ASC and DESC, including more than one sort field.",
    pace: "about 20 minutes",
    learn: [
      { h: "Learn: sorting", html:
        "<p><span class='kw'>ORDER BY</span> decides the sequence of the displayed rows. The Course Specifications say to specify the field and the method.</p>" +
        "<ul><li><code>ASC</code> is ascending: A to Z or 0 to 9 (smallest first).</li><li><code>DESC</code> is descending: Z to A or 9 to 0 (largest first).</li>" +
        "<li>To break ties, list a second field: <code>ORDER BY Cost DESC, Name ASC</code> sorts by cost first, then by name among games with the same cost.</li></ul>" +
        "<p>Without ORDER BY, the order of the rows is not guaranteed.</p>" },
      { h: "Worked example", html: "<div class='runner' data-runner='p5w1'></div>" },
      { h: "Worked example: the Course Specifications' query", html:
        "<p>This is the first example in the Course Specifications. It shows the name and release date of all games released from 1 March 2022 to 31 March 2023, in alphabetical order by name. This is exactly how it is printed there:</p>" +
        "<pre class='code'>SELECT Name, Release_date\nFROM Games\nWHERE Release_date &gt;= '01/03/2022' AND Release_date &lt;= '31/03/2023'\nORDER BY Name ASC</pre>" +
        "<ul><li>It uses the symbols <code>&gt;=</code> and <code>&lt;=</code>, so symbols appear in the Specifications' own examples.</li>" +
        "<li>It writes the dates day first (<code>'01/03/2022'</code>). Our table stores them year first, so to run it here you have to <strong>turn each date around</strong>: <code>'2022-03-01'</code> and <code>'2023-03-31'</code>. You may have to do the same in an exam, where the question's date order might not match the table.</li>" +
        "<li>The PDF prints curly quote marks (‘ ’). Copy them into a real SQL editor and you get an error, so always retype them as plain straight quotes <code>'</code>.</li></ul>" +
        "<p>Here it is with the dates turned around. Run it.</p>" +
        "<div class='runner' data-runner='p5w2'></div>" +
        "<div class='annot'><strong>Try the day-first dates in real SQLite and it goes wrong.</strong> SQLite stores dates as plain text and compares them letter by letter, so <code>'01/03/2022'</code> does not work as a date range. Run on our data it returns <strong>all 17 games instead of the correct 9</strong>, with no error message. This practice site stops you with a message instead, so you notice.</div>" }
    ],
    runners: { p5w1: { q: "SELECT Name, Cost\nFROM Games\nORDER BY Cost DESC" },
      p5w2: { q: "SELECT Name, Release_date\nFROM Games\nWHERE Release_date >= '2022-03-01' AND Release_date <= '2023-03-31'\nORDER BY Name ASC" } },
    tasks: [
      { key: "p5t1", text: "Show the <code>Name</code> of every game in <strong>alphabetical order</strong> (A to Z).", q: "", sol: "SELECT Name FROM Games ORDER BY Name ASC", ordered: true },
      { key: "p5t2", text: "Show the <code>Name</code> and <code>Cost</code> of every game, <strong>cheapest first</strong>.", q: "", sol: "SELECT Name, Cost FROM Games ORDER BY Cost ASC", ordered: true, orderCols: [1], orderHint: "The rows are right but not in order. Cheapest first means the smallest Cost at the top." },
      { key: "p5t3", text: "Show the <code>Name</code> and <code>Cost</code> of every game, <strong>most expensive first</strong>. Where two games cost the same, put them in alphabetical order of name.", q: "", sol: "SELECT Name, Cost FROM Games ORDER BY Cost DESC, Name ASC", ordered: true, orderHint: "Two sort fields: Cost DESC first, then Name ASC to break ties." },
      { key: "p5t4", text: "<strong>Using the Specifications' query as a model.</strong> Display the name and cost of all games released from 01-07-2023 to 30-06-2024 (DD-MM-YYYY), with the most expensive first.", q: "", sol: "SELECT Name, Cost FROM Games WHERE Release_date >= '2023-07-01' AND Release_date <= '2024-06-30' ORDER BY Cost DESC", ordered: true, orderHint: "The rows are right but not in order. Most expensive first means DESC on Cost.", hint: "WHERE with two date conditions and AND, then ORDER BY Cost DESC. The table stores dates year first, so turn each date around: '2023-07-01'." }
    ],
    checks: [
      { key: "p5q1", legend: "Which puts the <strong>highest</strong> cost at the top?", options: [
        { t: "<code>ORDER BY Cost ASC</code>", fb: "ASC puts the smallest at the top." },
        { t: "<code>ORDER BY Cost DESC</code>", ok: true, fb: "Correct. DESC means descending, largest first." }] },
      { key: "p5q2", legend: "What happens if you write <code>ORDER BY Cost</code> and don't say ASC or DESC?", options: [
        { t: "It is an error", fb: "It runs. The method is optional." },
        { t: "It sorts ascending (smallest first)", ok: true, fb: "Correct. ASC is the default. The Course Specifications say to specify the method, so write it in HSC answers." }] }
    ],
    hpge: { task: { key: "p5h1", text: "Show <code>Name</code> and <code>Release_date</code> of every game, <strong>newest first</strong>. Where two games share a release date, put them in alphabetical order.", q: "", sol: "SELECT Name, Release_date FROM Games ORDER BY Release_date DESC, Name ASC", ordered: true } }
  });

  /* ======================= PAGE 6 ======================= */
  P.push({
    id: 6, label: "GROUP BY", title: "Aggregate functions and GROUP BY",
    li: "I can calculate totals, counts, averages, maximums and minimums, and use GROUP BY to calculate them for each group.",
    pace: "about 30 minutes",
    learn: [
      { h: "Learn: calculating from many rows", html:
        "<p>An <strong>aggregate function</strong> works out one value from many rows. The HSC list is:</p>" +
        "<table class='ref'><tr><th>Function</th><th>Gives you</th></tr><tr><td><code>SUM (field)</code></td><td>the total of the values</td></tr><tr><td><code>AVG (field)</code></td><td>the average</td></tr><tr><td><code>COUNT (field)</code></td><td>how many rows</td></tr><tr><td><code>MAX (field)</code></td><td>the largest value</td></tr><tr><td><code>MIN (field)</code></td><td>the smallest value</td></tr></table>" +
        "<p><span class='kw'>GROUP BY</span> splits the rows into groups, and the function is worked out <em>for each group</em>. The Course Specifications say that with GROUP BY it is useful to include the calculated value in SELECT, and <code>AS</code> gives it a clear heading.</p>" +
        "<p><strong>Rule of thumb:</strong> if you SELECT a plain field <em>and</em> an aggregate together, the plain field should be in GROUP BY. (Page 7 shows the one safe exception.)</p>" },
      { h: "Worked examples", html:
        "<p>1. No GROUP BY: one answer for the whole table.</p><div class='runner' data-runner='p6w1'></div>" +
        "<p>2. <strong>What is a group?</strong> Here are the games sorted by publisher. Each block of rows with the same Publisher_ID is one group. GROUP BY turns each block into a single row.</p><div class='runner' data-runner='p6w0'></div>" +
        "<p>3. With GROUP BY: one answer per publisher (one row per block above).</p><div class='runner' data-runner='p6w2'></div>" +
        "<p>4. You can sort by the heading you made with AS. Here the publisher with the most games comes first.</p><div class='runner' data-runner='p6w4'></div>" +
        "<p>5. <strong>Forgot GROUP BY?</strong> Run this and read the warning. SQLite doesn't stop you, which is the danger.</p><div class='runner' data-runner='p6w3'></div>" }
    ],
    runners: {
      p6w0: { q: "SELECT Publisher_ID, Name\nFROM Games\nORDER BY Publisher_ID" },
      p6w4: { q: "SELECT Publisher_ID, COUNT (ID) AS Games_published\nFROM Games\nGROUP BY Publisher_ID\nORDER BY Games_published DESC" },
      p6w1: { q: "SELECT COUNT (ID) AS Games_released\nFROM Games" },
      p6w2: { q: "SELECT Publisher_ID, COUNT (ID) AS Games_published\nFROM Games\nGROUP BY Publisher_ID" },
      p6w3: { q: "SELECT Publisher_ID, COUNT (ID) AS Games_published\nFROM Games" }
    },
    tasks: [
      { key: "p6t1", text: "How many games are there? Show the count with the heading <code>Total_games</code>.", q: "", sol: "SELECT COUNT(ID) AS Total_games FROM Games", alias: ["total_games"], astRequires: needsFn("COUNT", "count the rows"), hint: "Use the COUNT function on a field that every game has, such as ID. Worked example 1 above does the same job with a different heading." },
      { key: "p6t2", text: "Show the <strong>total cost</strong> of all the games, headed <code>Total_cost</code>.", q: "", sol: "SELECT SUM(Cost) AS Total_cost FROM Games", alias: ["total_cost"], astRequires: needsFn("SUM"), hint: "Same pattern as worked example 1, but use SUM on the Cost field." },
      { key: "p6t3", text: "Show the <strong>average cost</strong> of a game, headed <code>Average_cost</code>.", q: "", sol: "SELECT AVG(Cost) AS Average_cost FROM Games", alias: ["average_cost"], astRequires: needsFn("AVG"), hint: "Same pattern again, but use AVG on the Cost field." },
      { key: "p6t4", text: "Show each <code>Publisher_ID</code> with the number of games they published, headed <code>Games_published</code>.", q: "", sol: "SELECT Publisher_ID, COUNT(ID) AS Games_published FROM Games GROUP BY Publisher_ID", astRequires: NEEDS_GROUP.concat(needsFn("COUNT")), alias: ["publisher_id", "games_published"], hint: "You want one row for each publisher, so after FROM add GROUP BY Publisher_ID. SELECT Publisher_ID and the COUNT (ID) side by side. Worked example 3 above is almost this exact query." },
      { key: "p6t5", text: "Show each <code>Publisher_ID</code> with the <strong>highest</strong> cost among their games, headed <code>Highest_cost</code>.", q: "", sol: "SELECT Publisher_ID, MAX(Cost) AS Highest_cost FROM Games GROUP BY Publisher_ID", astRequires: NEEDS_GROUP.concat(needsFn("MAX")), alias: ["publisher_id", "highest_cost"], hint: "Same as the previous task, but use MAX (Cost) instead of COUNT (ID)." },
      { key: "p6t6", text: "Show each <code>Developer_ID</code> with the <strong>total cost</strong> of the games they developed, headed <code>Total</code>, with the biggest total first.", q: "", sol: "SELECT Developer_ID, SUM(Cost) AS Total FROM Games GROUP BY Developer_ID ORDER BY Total DESC", astRequires: NEEDS_GROUP.concat(needsFn("SUM")), ordered: true, alias: ["developer_id", "total"], hint: "Group by Developer_ID and use SUM (Cost) AS Total. Then add an ORDER BY line and sort by the heading you made with AS, with DESC so the biggest comes first (worked example 4 sorts by a heading)." }
    ],
    checks: [
      { key: "p6q1", legend: "You write <code>SELECT Publisher_ID, COUNT (ID) FROM Games</code>. What is missing?", options: [
        { t: "A WHERE clause", fb: "WHERE filters rows. The problem is about grouping." },
        { t: "GROUP BY Publisher_ID", ok: true, fb: "Correct. Without it SQLite shows one arbitrary row, and HSC answers need GROUP BY." },
        { t: "ORDER BY", fb: "Sorting isn't what is missing here." }] },
      { key: "p6q2", legend: "What does <code>SELECT COUNT (ID) FROM Games WHERE Cost GREATER THAN 40</code> return?", options: [
        { t: "4", ok: true, fb: "Correct. Four games cost more than 40 (60, 45, 50 and 55). WHERE filters the rows first, then COUNT counts what is left." },
        { t: "17", fb: "17 is the count of all games. WHERE removes the ones that don't match first." },
        { t: "The names of the games", fb: "COUNT gives a number, not the names." }] }
    ],
    hpge: { task: { key: "p6h1", text: "Show each <code>Publisher_ID</code> with how many games they published that cost <strong>30 or more</strong>, headed <code>Big_games</code>.", q: "", sol: "SELECT Publisher_ID, COUNT(ID) AS Big_games FROM Games WHERE Cost >= 30 GROUP BY Publisher_ID", astRequires: NEEDS_GROUP, hint: "WHERE comes before GROUP BY: it removes rows first, then the rest are grouped." },
      note: "SQLite also has <code>HAVING</code> (filter the groups after counting). It is <strong>not</strong> in the HSC syntax list, but try <code>... GROUP BY Publisher_ID HAVING COUNT (ID) &gt; 3</code> in the editor above to see it work." }
  });

  /* ======================= PAGE 7 ======================= */
  P.push({
    id: 7, label: "Joins", title: "Table joins",
    li: "I can combine two or more tables by matching a foreign key to a primary key.",
    pace: "about 30 minutes",
    learn: [
      { h: "Learn: joining tables", html:
        "<p>Game names are in <code>Games</code>, but publisher names are in <code>Publishers</code>. A <strong>join</strong> lines up rows from the two tables where the keys match.</p>" +
        "<p>The Specifications' example lists all the tables after FROM, separated by commas, then puts the matching condition in WHERE:</p>" +
        "<pre class='code'>SELECT Games.Name, Publishers.Name\nFROM Games, Publishers\nWHERE Games.Publisher_ID = Publishers.Publisher_ID</pre>" +
        "<ul><li>Write <code>Table.Field</code> whenever the same field name is in more than one table (both tables have a <code>Name</code>).</li>" +
        "<li>Without the matching condition, SQL pairs <em>every</em> row with <em>every</em> row: a <strong>cartesian product</strong>.</li>" +
        "<li>When you join and use <code>GROUP BY</code>, you can group by a table's primary key (like <code>Developers.Developer_ID</code>) and still show that table's other fields (<code>First_name</code>, <code>Last_name</code>). Every row in the group has the same developer, so those fields are the same all the way through. The Specifications' second example does exactly this.</li>" +
        "<li>SQLite also accepts <code>JOIN ... ON</code>. It is not in the HSC syntax list, so after you use it the site shows the HSC version.</li></ul>" },
      { h: "Remember: the keys", html:
        "<p>From page 1: <code>Games.Publisher_ID</code> is a <strong>foreign key</strong>. It holds a value from <code>Publishers.Publisher_ID</code>, the <strong>primary key</strong> of the Publishers table. A join matches them, so each game lines up with its own publisher. <code>Games.Developer_ID</code> does the same job for Developers.</p>" },
      { h: "Worked examples", html:
        "<p>1. A correct join.</p><div class='runner' data-runner='p7w1'></div>" +
        "<p>2. <strong>No join condition</strong>. How many rows come back? (17 games × 4 publishers.)</p><div class='runner' data-runner='p7w2'></div>" +
        "<p>3. <strong>Three tables.</strong> Add the third table to FROM and a second matching condition joined with AND. Read it line by line: line 1 chooses the fields, line 2 lists the three tables, line 3 matches Games to Publishers, line 4 matches Games to Developers.</p><div class='runner' data-runner='p7w3'></div>" }
    ],
    runners: {
      p7w1: { q: "SELECT Games.Name, Publishers.Name AS Publisher\nFROM Games, Publishers\nWHERE Games.Publisher_ID = Publishers.Publisher_ID" },
      p7w2: { q: "SELECT Games.Name, Publishers.Name AS Publisher\nFROM Games, Publishers" },
      p7w3: { q: "SELECT Games.Name, Publishers.Name AS Publisher, Developers.Last_name\nFROM Games, Publishers, Developers\nWHERE Games.Publisher_ID = Publishers.Publisher_ID\nAND Games.Developer_ID = Developers.Developer_ID" }
    },
    tasks: [
      { key: "p7t1", text: "Show each game's <code>Games.Name</code> and its publisher's name (headed <code>Publisher</code>).", q: "", sol: "SELECT Games.Name, Publishers.Name AS Publisher FROM Games, Publishers WHERE Games.Publisher_ID = Publishers.Publisher_ID", hint: "FROM Games, Publishers, then WHERE the two Publisher_ID fields match." },
      { key: "p7t2", text: "Show the <code>Games.Name</code> and <code>Games.Cost</code> of every game published by <strong>Pixel Press</strong>.", q: "", sol: "SELECT Games.Name, Games.Cost FROM Games, Publishers WHERE Publishers.Name = 'Pixel Press' AND Games.Publisher_ID = Publishers.Publisher_ID", astRequires: NEEDS_JOIN, hint: "Start from your Task 1 query. Add one more condition to WHERE with AND: the publisher's name equals 'Pixel Press'. You still need the line that matches the two Publisher_ID fields, and both tables must be listed after FROM." },
      { key: "p7t3", text: "Show each game's <code>Games.Name</code> with its developer's <code>First_name</code> and <code>Last_name</code>. Sort by developer last name, then by game name.", q: "", sol: "SELECT Games.Name, Developers.First_name, Developers.Last_name FROM Games, Developers WHERE Games.Developer_ID = Developers.Developer_ID ORDER BY Developers.Last_name, Games.Name", ordered: true },
      { key: "p7t4", text: "A three-table join. Show each game's <code>Games.Name</code>, its publisher's name (headed <code>Publisher</code>) and its developer's <code>Last_name</code>.", q: "", sol: "SELECT Games.Name, Publishers.Name AS Publisher, Developers.Last_name FROM Games, Publishers, Developers WHERE Games.Publisher_ID = Publishers.Publisher_ID AND Games.Developer_ID = Developers.Developer_ID", hint: "Worked example 3 above is this query with different fields. List three tables after FROM, then match Games.Publisher_ID to Publishers.Publisher_ID and Games.Developer_ID to Developers.Developer_ID, joined with AND." },
      { key: "p7t5", text: "<strong>From the Course Specifications.</strong> Display each developer, together with the total cost of games they have developed for the publisher 'Games Inc', listed in descending order of developer last name. Show <code>First_name</code>, <code>Last_name</code> and the total with the heading <code>Totalcost</code>.", q: "", sol: "SELECT Developers.First_name, Developers.Last_name, SUM (Games.Cost) AS Totalcost FROM Games, Publishers, Developers WHERE Publishers.Name = 'Games Inc' AND Publishers.Publisher_ID = Games.Publisher_ID AND Developers.Developer_ID = Games.Developer_ID GROUP BY Developers.Developer_ID ORDER BY Developers.Last_name DESC", ordered: true, astRequires: NEEDS_GROUP, alias: ["first_name", "last_name", "totalcost"], hint: "Three tables, three conditions in WHERE (the publisher name and two key matches), GROUP BY Developers.Developer_ID, ORDER BY Developers.Last_name DESC." }
    ],
    checks: [
      { key: "p7q1", legend: "Games has 17 rows and Publishers has 4. How many rows does <code>SELECT * FROM Games, Publishers</code> (no WHERE) return?", options: [
        { t: "17", fb: "That would be a proper join. With no condition, every game is paired with every publisher." },
        { t: "21", fb: "That is 17 + 4. A cartesian product multiplies." },
        { t: "68", ok: true, fb: "Correct: 17 × 4. This is why every join needs its matching condition in WHERE." }] },
      { key: "p7q2", legend: "The Developers table has a developer, Finn Murphy, who has no games. Why doesn't Finn appear in a Games-Developers join?", options: [
        { t: "There is a mistake in the table", fb: "The table is fine. Think about what the matching condition keeps." },
        { t: "No Games row has Finn's Developer_ID, so there is nothing to match him to", ok: true, fb: "Correct. A join only keeps rows where the keys match on both sides." }] }
    ],
    hpge: { task: { key: "p7h1", text: "Show each publisher's <code>Name</code> with the <strong>total cost</strong> of all their games, headed <code>Total</code>, biggest total first.", q: "", sol: "SELECT Publishers.Name, SUM(Games.Cost) AS Total FROM Games, Publishers WHERE Games.Publisher_ID = Publishers.Publisher_ID GROUP BY Publishers.Publisher_ID ORDER BY Total DESC", ordered: true, astRequires: NEEDS_GROUP } }
  });

  /* ======================= PAGE 8 ======================= */
  var P8 = {
    id: 8, label: "Exam practice", title: "HSC exam practice",
    li: "I can write complete queries from a description, translate between the operator words and SQLite symbols, read a query to predict its output, and find faults in a query.",
    pace: "about 40 minutes",
    learn: [
      { h: "How this page works", html:
        "<p>These tasks mix everything from pages 2 to 7. In Part A, write the answer in <strong>either style</strong>. When you succeed, the panel shows the other form. The Course Specifications list the operators as words but also use symbols in their own examples, so practise both.</p>" +
        "<p>Part A is <strong>write the query</strong>. Part B is <strong>translate</strong>. Part C is <strong>predict the output</strong>. Part D is <strong>fix the query</strong>.</p>" }
    ],
    hpge: null,
    blocks: []
  };
  P8.blocks.push({ html: "<h2>Part A: write the query</h2>" });
  [
    { key: "p8t1", exam: true, text: "Display the name and cost of all games that cost less than $30. List the cheapest first, and put games with the same cost in alphabetical order.", q: "", sol: "SELECT Name, Cost FROM Games WHERE Cost < 30 ORDER BY Cost ASC, Name ASC", ordered: true },
    { key: "p8t2", exam: true, text: "Display the name of every game whose name contains either 'Space' or 'Star'.", q: "", sol: "SELECT Name FROM Games WHERE Name LIKE '%Space%' OR Name LIKE '%Star%'" },
    { key: "p8t3", exam: true, text: "Display the name of each publisher together with the number of games they have published. Head the count <code>Games_published</code>.", q: "", sol: "SELECT Publishers.Name, COUNT (Games.ID) AS Games_published FROM Games, Publishers WHERE Games.Publisher_ID = Publishers.Publisher_ID GROUP BY Publishers.Publisher_ID", astRequires: NEEDS_GROUP, alias: [null, "games_published"] },
    { key: "p8t4", exam: true, text: "Display the first name and last name of each developer, together with the total cost of games they developed that were released in 2023. Head the total <code>Totalcost</code>, and list the highest total first.", q: "", sol: "SELECT Developers.First_name, Developers.Last_name, SUM (Games.Cost) AS Totalcost FROM Games, Developers WHERE Games.Release_date >= '2023-01-01' AND Games.Release_date <= '2023-12-31' AND Developers.Developer_ID = Games.Developer_ID GROUP BY Developers.Developer_ID ORDER BY Totalcost DESC", ordered: true, orderCols: [2], astRequires: NEEDS_GROUP, alias: ["first_name", "last_name", "totalcost"] },
    { key: "p8t5", exam: true, text: "Display the name of every game released after 30-06-2023 (DD-MM-YYYY) that was <strong>not</strong> published by publisher 1. Show the newest first.", q: "", sol: "SELECT Name FROM Games WHERE Release_date > '2023-06-30' AND Publisher_ID <> 1 ORDER BY Release_date DESC", ordered: true }
  ].forEach(function (t) { P8.blocks.push({ task: t }); });
  P8.blocks.push({ html: "<h2>Part B: translate</h2><p>Rewrite each query in the other style. The result has to stay the same, so the checker also runs your answer.</p>" });
  [
    { key: "p8x1", mode: "toHsc", exam: true, text: "Rewrite this SQLite query using the <strong>operator words</strong> from the Specifications (no symbols).", q: "SELECT Name, Cost\nFROM Games\nWHERE Cost >= 25 AND Publisher_ID <> 3\nORDER BY Name ASC", sol: "SELECT Name, Cost FROM Games WHERE Cost >= 25 AND Publisher_ID <> 3 ORDER BY Name ASC", answer: "SELECT Name, Cost FROM Games WHERE Cost GREATER THAN OR EQUAL TO 25 AND Publisher_ID NOT EQUAL TO 3 ORDER BY Name ASC", ordered: true, hint: "&gt;= is GREATER THAN OR EQUAL TO, and &lt;&gt; is NOT EQUAL TO." },
    { key: "p8x2", mode: "toHsc", exam: true, text: "Rewrite this using the Specifications' <strong>operator words and table style</strong>. It uses <code>JOIN ... ON</code> and <code>LIKE</code>. Use comma-separated tables in FROM, and operator words.", q: "SELECT Games.Name, Publishers.Name\nFROM Games JOIN Publishers ON Games.Publisher_ID = Publishers.Publisher_ID\nWHERE Games.Name LIKE '%Star%'", sol: "SELECT Games.Name, Publishers.Name FROM Games JOIN Publishers ON Games.Publisher_ID = Publishers.Publisher_ID WHERE Games.Name LIKE '%Star%'", answer: "SELECT Games.Name, Publishers.Name FROM Games, Publishers WHERE Games.Name CONTAINS 'Star' AND Games.Publisher_ID EQUALS Publishers.Publisher_ID", hint: "List both tables after FROM, then use WHERE for the name test and for the matching keys. LIKE '%Star%' becomes CONTAINS 'Star'." },
    { key: "p8x3", mode: "toSqlite", exam: true, text: "This is written with the Specifications' operator words. Rewrite it so it would <strong>run in SQLite</strong> (symbols and LIKE).", q: "SELECT Name\nFROM Games\nWHERE Cost GREATER THAN 30 AND Name DOES NOT CONTAIN 'a'", sol: "SELECT Name FROM Games WHERE Cost > 30 AND Name NOT LIKE '%a%'", answer: "SELECT Name FROM Games WHERE Cost > 30 AND Name NOT LIKE '%a%'", hint: "GREATER THAN is &gt;. DOES NOT CONTAIN 'a' is NOT LIKE '%a%'." }
  ].forEach(function (t) { P8.blocks.push({ task: t }); });
  P8.blocks.push({ html: "<h2>Part C: predict the output</h2><p>No running allowed. Read the query, then decide what it displays.</p>" });
  P8.blocks.push({ checks: [
    { key: "p8c1", legend: "<pre class='code'>SELECT Name\nFROM Games\nWHERE Cost EQUALS 15\nORDER BY Name DESC</pre>What does it display?", options: [
      { t: "Garden Gnomes, then Tiny Tides", fb: "That is ascending (A to Z). The query says DESC." },
      { t: "Tiny Tides, then Garden Gnomes", ok: true, fb: "Correct. Two games cost 15, and DESC puts Tiny Tides (T) before Garden Gnomes (G)." },
      { t: "Garden Gnomes only", fb: "Both games cost 15." }] },
    { key: "p8c2", legend: "<pre class='code'>SELECT Publisher_ID, COUNT (ID)\nFROM Games\nWHERE Cost GREATER THAN 40\nGROUP BY Publisher_ID</pre>Use the tables (the &quot;Show the three tables&quot; panel). What does it display?", options: [
      { t: "1 | 3 and 2 | 1", ok: true, fb: "Correct. Four games cost more than 40 (60, 45, 50 and 55). Publisher 1 made three of them and publisher 2 made one." },
      { t: "1 | 7 and 2 | 4", fb: "Those are all of each publisher's games. WHERE removes the ones costing 40 or less first." },
      { t: "4", fb: "GROUP BY gives one row per publisher, not one overall total." }] },
    { key: "p8c3", legend: "<pre class='code'>SELECT MAX (Cost)\nFROM Games\nWHERE Publisher_ID EQUALS 2</pre>Use the tables (the &quot;Show the three tables&quot; panel). What does it display?", options: [
      { t: "15", fb: "That is MIN." },
      { t: "45", ok: true, fb: "Correct. Publisher 2's games cost 25, 15, 45 and 30, and MAX gives the largest." },
      { t: "115", fb: "That is the SUM of those costs." }] }
  ] });
  P8.blocks.push({ html: "<h2>Part D: fix the query</h2><p>Each of these runs, but does not do what its description says. Fix it.</p>" });
  [
    { key: "p8f1", text: "<strong>Fault 1.</strong> This should show the number of games for <em>each</em> publisher, but it doesn't. Fix it.", q: "SELECT Publisher_ID, COUNT (ID) AS Games_published\nFROM Games", sol: "SELECT Publisher_ID, COUNT(ID) AS Games_published FROM Games GROUP BY Publisher_ID", astRequires: NEEDS_GROUP },
    { key: "p8f2", text: "<strong>Fault 2.</strong> This should show each game with its publisher, one row per game (17 rows). Fix it.", q: "SELECT Games.Name, Publishers.Name AS Publisher\nFROM Games, Publishers", sol: "SELECT Games.Name, Publishers.Name AS Publisher FROM Games, Publishers WHERE Games.Publisher_ID = Publishers.Publisher_ID" },
    { key: "p8f3", text: "<strong>Fault 3.</strong> This should show the details of the game called Dungeon Dash. Fix it.", q: "SELECT *\nFROM Games\nWHERE Name = Dungeon Dash", sol: "SELECT * FROM Games WHERE Name = 'Dungeon Dash'", hint: "Text values need single quotes." }
  ].forEach(function (t) { P8.blocks.push({ task: t }); });
  P.push(P8);

  /* ======================= PAGE 9 ======================= */
  P.push({
    id: 9, label: "ORM", title: "ORM compared to SQL",
    li: "I can interpret ORM code fragments and match them to the SQL they stand for.",
    pace: "about 20 minutes",
    learn: [
      { h: "Learn: what an ORM does", html:
        "<p><strong>Object-Relational Mapping (ORM)</strong> adds a layer between the database and the programming language. In an object-oriented language, an ORM usually represents <strong>rows as objects</strong> and <strong>columns as the properties</strong> of those objects.</p>" +
        "<p>The Course Specifications say students are expected to <strong>interpret</strong> ORM code fragments. You are <strong>not</strong> expected to write ORM code from scratch.</p>" +
        "<table class='ref'><tr><th>Database idea</th><th>ORM idea</th></tr><tr><td>Table (Games)</td><td>A class (<code>Game</code>)</td></tr><tr><td>Row</td><td>An object, one <code>Game</code></td></tr><tr><td>Column (Name, Cost)</td><td>A property (<code>game.name</code>, <code>game.cost</code>)</td></tr><tr><td>A query</td><td>A method call that returns objects</td></tr></table>" },
      { h: "Worked example: the same request twice", html:
        "<p>Both of these list the names of games costing more than 30, cheapest first. The ORM fragment below is written in the style of an ORM such as SQLAlchemy. The Course Specifications do not name a framework, so what matters is reading what the fragment does.</p>" +
        "<p><strong>SQL:</strong></p><pre class='code'>SELECT Name, Cost\nFROM Games\nWHERE Cost GREATER THAN 30\nORDER BY Cost ASC</pre>" +
        "<p><strong>ORM (Python):</strong></p><pre class='code'>games = Game.query.filter(Game.cost &gt; 30).order_by(Game.cost).all()\nfor game in games:\n    print(game.name, game.cost)</pre>" +
        "<ul><li><code>Game.query</code> starts a query on the Games table.</li><li><code>.filter(Game.cost &gt; 30)</code> does the job of <code>WHERE</code>.</li><li><code>.order_by(Game.cost)</code> does the job of <code>ORDER BY</code>.</li><li><code>.all()</code> runs it and returns a list of <code>Game</code> objects.</li><li><code>game.name</code> reads the Name <em>property</em> of one object.</li></ul>" +
        "<div class='annot'>Your AT1 project uses plain SQL from Python, not an ORM, so this page is about reading and comparing, not building.</div>" }
    ],
    tasks: [],
    checks: [
      { key: "p9q1", legend: "In an ORM, a <strong>row</strong> of the Games table is usually represented as…", options: [
        { t: "a Python module", fb: "A module is a file of code, not a data record." },
        { t: "an object (an instance of the Game class)", ok: true, fb: "Correct. Rows become objects and columns become the object's properties." },
        { t: "a SQL keyword", fb: "Keywords are words like SELECT and WHERE." }] },
      { key: "p9q2", legend: "Which SQL clause does <code>.filter(Game.cost &gt; 30)</code> correspond to?", options: [
        { t: "SELECT", fb: "SELECT chooses fields. The filter chooses rows." },
        { t: "WHERE", ok: true, fb: "Correct. filter(...) keeps only the rows that match, as WHERE does." },
        { t: "GROUP BY", fb: "GROUP BY makes groups for aggregate functions." }] },
      { key: "p9q3", legend: "<pre class='code'>Game.query.filter(Game.publisher_id == 1).order_by(Game.name.desc()).all()</pre>Which SQL does the same job?", options: [
        { t: "<pre class='code'>SELECT * FROM Games\nWHERE Publisher_ID EQUALS 1\nORDER BY Name DESC</pre>", ok: true, fb: "Correct. filter is WHERE, and .desc() is DESC in ORDER BY." },
        { t: "<pre class='code'>SELECT * FROM Games\nWHERE Name EQUALS 1\nORDER BY Publisher_ID ASC</pre>", fb: "The fields are swapped. The filter is on publisher_id, and the sort is on name." },
        { t: "<pre class='code'>SELECT Name FROM Games\nGROUP BY Publisher_ID</pre>", fb: "There is no grouping or aggregate in the ORM line." }] },
      { key: "p9q4", legend: "What is the HSC expectation about ORM?", options: [
        { t: "Write ORM code from scratch in the exam", fb: "The Course Specifications say students are expected to interpret ORM code fragments, not write them." },
        { t: "Interpret ORM code fragments", ok: true, fb: "Correct." },
        { t: "ORM replaces the need to know SQL", fb: "An ORM generates SQL behind the scenes. Knowing SQL is how you understand what the ORM is doing." }] }
    ],
    hpge: { prompt: "Name <strong>one advantage</strong> and <strong>one disadvantage</strong> of using an ORM instead of writing SQL directly, from a web developer's point of view.",
      answer: "<strong>Advantages:</strong> you stay in one language (the database is used like normal objects), the ORM can stop some mistakes (for example by safely building queries, which helps against SQL injection), and switching databases is easier. <strong>Disadvantages:</strong> an extra layer to learn, generated SQL can be slower or harder to debug than hand-written SQL, and very complicated queries may be awkward to express." }
  });

  /* Three class lessons (teacher decision 2026-10-22): lesson 1 = pages 1-3, lesson 2 = pages 4-5, lesson 3 = pages 6-7.
     Core tasks are what runs in class. Everything else on pages 1-7 is marked Optional (early finishers, homework).
     Timings are estimates, not measured with students. */
  var CORE = {};
  ["p1t1", "p1t2", "p1q2", "p2t1", "p2t2", "p2t3", "p2t4", "p3t1", "p3t2", "p3t3", "p3t4", "p3q2",
    "p4t1", "p4t2", "p4t3", "p4t4", "p4t5", "p4q2", "p5t1", "p5t2", "p5t3", "p5t4",
    "p6t1", "p6t4", "p6t5", "p6t6", "p6q1", "p7t1", "p7t2", "p7t4", "p7t5", "p7q1"].forEach(function (k) { CORE[k] = true; });
  var PACE = { 1: [10, 5], 2: [14, 6], 3: [24, 8], 4: [24, 4], 5: [20, 6], 6: [24, 10], 7: [26, 12] };
  var LESSON = { 1: 1, 2: 1, 3: 1, 4: 2, 5: 2, 6: 3, 7: 3 };
  P.forEach(function (pg) {
    if (pg.id > 7) return;
    (pg.tasks || []).concat(pg.blocks ? pg.blocks.filter(function (b) { return b.task; }).map(function (b) { return b.task; }) : []).forEach(function (t) { if (!CORE[t.key]) t.optional = true; });
    (pg.checks || []).concat((pg.blocks || []).reduce(function (a, b) { return a.concat(b.checks || []); }, [])).forEach(function (m) { if (!CORE[m.key]) m.optional = true; });
    pg.lesson = LESSON[pg.id];
    pg.pace = "core about " + PACE[pg.id][0] + " minutes; the optional items add about " + PACE[pg.id][1] + " more";
  });

  return P;
});
