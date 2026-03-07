#!/usr/bin/env python3
"""
Airflow OMS — System Integrity Audit Script
DB schema vs code column references, FE/BE consistency check
Usage: cd webapp && python3 scripts/audit.py
"""
import sqlite3, re, os, sys

DB_PATH = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/7c4adf011c1cb1b501454a117b3f8d2bf5a5e7bf5489f3dc90d4dc263af206dc.sqlite'
SRC_DIR = 'src'
JS_DIR = 'public/static/js'
DIST_DIR = 'dist'

# FE API에서 제거할 마운트 프리픽스 (index.tsx의 app.route 기반)
MOUNT_PREFIXES = ['/stats', '/hr', '/auth', '/orders', '/signup', '/notifications',
                  '/reconciliation', '/settlements', '/audit', '/system', '/banners']

print("=" * 80)
print("Airflow OMS — System Integrity Audit")
print("=" * 80)

issues = []

# ━━ 1. DB Schema ━━
print("\n[1/7] DB Schema...")
if not os.path.exists(DB_PATH):
    print("  SKIP: DB not found. Run `npm run db:migrate:local` first.")
else:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    tbl_rows = cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%'"
    ).fetchall()
    table_names = [r['name'] for r in tbl_rows]
    tables = {}
    not_null_cols = {}
    for t in table_names:
        rows = cur.execute(f"PRAGMA table_info({t})").fetchall()
        cols = set()
        nn = set()
        for r in rows:
            cols.add(r['name'])
            if r['notnull'] and not r['dflt_value'] and not r['pk']:
                nn.add(r['name'])
        tables[t] = cols
        not_null_cols[t] = nn
    conn.close()
    print(f"  {len(tables)} tables, {sum(len(v) for v in tables.values())} columns")

# ━━ File Collection ━━
ts_files, js_files = [], []
for root, _, files in os.walk(SRC_DIR):
    for f in files:
        if f.endswith(('.ts', '.tsx')):
            ts_files.append(os.path.join(root, f))
for root, _, files in os.walk(JS_DIR):
    for f in files:
        if f.endswith('.js'):
            js_files.append(os.path.join(root, f))
print(f"  BE: {len(ts_files)} TS, FE: {len(js_files)} JS")

# ━━ 2. SQL alias.column ━━
print(f"\n[2/7] SQL alias.column references...")
sql_issues = []
# Hono router variable names to exclude (they look like table.method)
ROUTER_VARS = {'router', 'app', 'notifications', 'orders', 'settlements', 'auth', 'signup', 'hr', 'stats', 'system', 'banners', 'audit', 'reconciliation'}

for fpath in ts_files:
    with open(fpath) as fp:
        content = fp.read()
    # Only match backtick SQL strings that contain SQL keywords
    for m in re.finditer(r"`([^`]+)`", content, re.DOTALL):
        sql = m.group(1)
        if not re.search(r'\b(?:SELECT|INSERT|UPDATE|DELETE)\b', sql, re.I):
            continue
        # Must contain FROM or JOIN to have valid alias mapping
        if not re.search(r'\b(?:FROM|JOIN)\b', sql, re.I):
            continue
        line0 = content[:m.start()].count('\n') + 1

        alias_map = {}
        for am in re.finditer(r'(?:FROM|JOIN)\s+(\w+)\s+(?:AS\s+)?(\w+)', sql, re.I):
            tbl, al = am.group(1).lower(), am.group(2).lower()
            if tbl in tables and al not in ROUTER_VARS:
                alias_map[al] = tbl
        for am in re.finditer(r'(?:FROM|JOIN)\s+(\w+)(?:\s+(?:WHERE|ON|LEFT|RIGHT|INNER|CROSS|JOIN|ORDER|GROUP|LIMIT|SET|VALUES|HAVING|\())', sql, re.I):
            tbl = am.group(1).lower()
            if tbl in tables:
                alias_map[tbl] = tbl

        if not alias_map:
            continue

        for cm in re.finditer(r'\b(\w+)\.(\w+)\b', sql):
            al, col = cm.group(1).lower(), cm.group(2).lower()
            if al in ROUTER_VARS:
                continue
            if al in alias_map:
                real = alias_map[al]
                if col not in tables[real] and col != '*':
                    ln = line0 + sql[:cm.start()].count('\n')
                    issue = f"[SQL-COL] {fpath}:{ln} -- {al}.{col}: '{real}' has no column '{col}'"
                    sql_issues.append(issue)

sql_issues = sorted(set(sql_issues))
for i in sql_issues:
    print(f"  ERR {i}")
    issues.append(i)
if not sql_issues:
    print("  OK")

# ━━ 3. INSERT column-value count ━━
print(f"\n[3/7] INSERT column-value count...")
ins_issues = []
for fpath in ts_files:
    with open(fpath) as fp:
        content = fp.read()
    # Match INSERT ... INTO table (cols) VALUES (...) with balanced parentheses
    for m in re.finditer(r'INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(', content, re.I | re.DOTALL):
        tbl = m.group(1).lower()
        cols = [c.strip() for c in m.group(2).split(',') if c.strip()]
        # Extract VALUES (...) with balanced parentheses
        start_idx = m.end() - 1  # position of the opening (
        depth = 0
        end_idx = start_idx
        for i in range(start_idx, min(start_idx + 2000, len(content))):
            if content[i] == '(':
                depth += 1
            elif content[i] == ')':
                depth -= 1
                if depth == 0:
                    end_idx = i
                    break
        vals_str = content[start_idx+1:end_idx]
        # Remove nested function calls by iteratively replacing innermost parens
        simplified = vals_str
        prev = ''
        while prev != simplified:
            prev = simplified
            simplified = re.sub(r'\([^()]*\)', '_X_', simplified)
        val_items = [v.strip() for v in simplified.split(',') if v.strip()]
        nv = len(val_items)

        if len(cols) != nv:
            ln = content[:m.start()].count('\n') + 1
            ins_issues.append(f"[INSERT-CNT] {fpath}:{ln} -- {tbl}: {len(cols)} cols vs {nv} vals")

for i in ins_issues:
    print(f"  ERR {i}")
    issues.append(i)
if not ins_issues:
    print("  OK")

# ━━ 4. NOT NULL missing ━━
print(f"\n[4/7] INSERT NOT NULL columns missing...")
nn_issues = []
for fpath in ts_files:
    with open(fpath) as fp:
        content = fp.read()
    for m in re.finditer(r'INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)\s*\(([^)]+)\)', content, re.I | re.DOTALL):
        tbl = m.group(1).lower()
        insert_cols = set(c.strip().lower() for c in m.group(2).split(',') if c.strip())
        if tbl in not_null_cols:
            miss = not_null_cols[tbl] - insert_cols
            if miss:
                ln = content[:m.start()].count('\n') + 1
                nn_issues.append(f"[NOT-NULL] {fpath}:{ln} -- {tbl}: missing {', '.join(sorted(miss))}")

for i in nn_issues:
    print(f"  ERR {i}")
    issues.append(i)
if not nn_issues:
    print("  OK")

# ━━ 5. FE ghost fields ━━
print(f"\n[5/7] FE ghost field references...")
GHOSTS = ['eupmyeondong', 'territory_id', 'admin_region_id', 'dong_name']
fe_issues = []
for fpath in js_files:
    with open(fpath) as fp:
        for idx, line in enumerate(fp, 1):
            s = line.strip()
            if s.startswith('//'):
                continue
            for g in GHOSTS:
                if re.search(rf'\.{g}\b|[\[\'\"]{g}[\'\"\]]', s):
                    fe_issues.append(f"[FE-GHOST] {fpath}:{idx} -- '{g}': {s[:100]}")

fe_issues = sorted(set(fe_issues))
for i in fe_issues:
    print(f"  ERR {i}")
    issues.append(i)
if not fe_issues:
    print("  OK")

# ━━ 6. FE<->BE route matching ━━
print(f"\n[6/7] FE<->BE route matching...")
be_routes = set()
for fpath in ts_files:
    with open(fpath) as fp:
        content = fp.read()
    # Match any variable.method() pattern (router, app, banners, system, auth, etc.)
    for mm in re.finditer(r'\b\w+\.(get|post|put|delete|patch)\s*\(\s*[\'"](\/[^\'"]+)[\'"]', content, re.I):
        method = mm.group(1).upper()
        raw_path = mm.group(2)
        # Skip non-route patterns (e.g., console.log, JSON.parse)
        prefix = content[max(0, mm.start()-30):mm.start()]
        if re.search(r'(console|JSON|Math|Object|Array|Promise|Date|String|Number|window|document)\.', prefix):
            continue
        path = re.sub(r':\w+', ':p', raw_path)
        be_routes.add((method, path))

fe_calls = set()
for fpath in js_files:
    with open(fpath) as fp:
        content = fp.read()
    for mm in re.finditer(r"api\s*\(\s*['\"](\w+)['\"],\s*['\"`]([^'\"`]+)['\"`]", content):
        method = mm.group(1).upper()
        path = mm.group(2)
        path = re.sub(r'\$\{[^}]+\}', ':p', path)
        path = re.sub(r'\?.*$', '', path)
        for pfx in MOUNT_PREFIXES:
            if path.startswith(pfx):
                path = path[len(pfx):]
                break
        path = re.sub(r':\w+', ':p', path)
        if path:  # Skip empty paths
            fe_calls.add((method, path))

def fuzzy(method, path, routes):
    segs = path.strip('/').split('/')
    for (bm, bp) in routes:
        if bm != method:
            continue
        bsegs = bp.strip('/').split('/')
        if len(segs) == len(bsegs) and all(a == b or ':p' in (a, b) for a, b in zip(segs, bsegs)):
            return True
    return False

missing = [(m, p) for (m, p) in sorted(fe_calls - be_routes) if not fuzzy(m, p, be_routes)]
for m, p in missing[:20]:
    w = f"[ROUTE] FE {m} {p} -> no BE match"
    print(f"  WARN {w}")
    issues.append(w)
if not missing:
    print("  OK")
print(f"  BE: {len(be_routes)}, FE: {len(fe_calls)}, unmatched: {len(missing)}")

# ━━ 7. dist sync ━━
print(f"\n[7/7] dist <-> source sync...")
sync = []
pub = 'public/static'
dst = 'dist/static'
for root, _, files in os.walk(pub):
    for f in files:
        s = os.path.join(root, f)
        d = s.replace(pub, dst)
        if os.path.exists(d) and os.path.getmtime(s) > os.path.getmtime(d) + 2:
            sync.append(f"[SYNC] {s} -> needs rebuild")

ws = max((os.path.getmtime(f) for f in ts_files), default=0)
if os.path.exists('dist/_worker.js') and ws > os.path.getmtime('dist/_worker.js') + 2:
    sync.append("[SYNC] TS source newer than dist/_worker.js")

for i in sync:
    print(f"  WARN {i}")
    issues.append(i)
if not sync:
    print("  OK")

# ━━ Summary ━━
print("\n" + "=" * 80)
crit = [i for i in issues if any(k in i for k in ['SQL-COL', 'INSERT', 'NOT-NULL', 'FE-GHOST'])]
warn = [i for i in issues if i not in crit]
print(f"TOTAL: {len(issues)} issues ({len(crit)} critical, {len(warn)} warnings)")
print("=" * 80)
if crit:
    print("\nCRITICAL:")
    for i, x in enumerate(crit, 1):
        print(f"  {i}. {x}")
if warn:
    print("\nWARNINGS:")
    for i, x in enumerate(warn, 1):
        print(f"  {i}. {x}")
if not issues:
    print("  All checks passed!")

sys.exit(1 if crit else 0)
