"""Runs queries in real SQLite against the practice database. stdin: {"db": {...}, "queries": [...]}. stdout: JSON results."""
import json, sqlite3, sys
req = json.load(sys.stdin)
con = sqlite3.connect(":memory:")
for tname, t in req["db"].items():
    cols = ", ".join(f'{c["name"]} {"INTEGER" if c["type"]=="num" else "TEXT"}' for c in t["cols"])
    con.execute(f"CREATE TABLE {tname} ({cols})")
    names = [c["name"] for c in t["cols"]]
    for r in t["rows"]:
        con.execute(f'INSERT INTO {tname} VALUES ({",".join("?"*len(names))})', [r[n] for n in names])
out = []
for q in req["queries"]:
    try:
        cur = con.execute(q)
        out.append({"ok": True, "cols": [d[0] for d in cur.description], "rows": cur.fetchall()})
    except Exception as e:
        out.append({"ok": False, "err": str(e)})
print(json.dumps(out))
