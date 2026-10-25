# fake.json으로 핵심 통계 기대값을 scipy로 계산 (JS 분석 코드와 독립)
import json, csv, numpy as np
from scipy import stats
D = json.load(open("tests/fake.json"))
latest = {}
for r in D["rows"]: latest[(r["grade"], r["cls"], r["num"])] = r
rows = list(latest.values())
REV = {17, 32, 33, 34}
def sc(r, n, w="now"):
    a = r["answers"].get(str(n))
    if a is None: return np.nan
    v = a[w] if isinstance(a, dict) else a
    return 6 - v if n in REV else v
pre = np.array([np.mean([sc(r, n, "pre") for n in range(1, 9)]) for r in rows])
now = np.array([np.mean([sc(r, n, "now") for n in range(1, 9)]) for r in rows])
t = stats.ttest_rel(now, pre); d = now - pre
E = {"N": len(rows), "I_t": t.statistic, "I_p": t.pvalue, "I_df": len(rows) - 1, "I_dz": d.mean() / d.std(ddof=1), "I_pre": pre.mean(), "I_now": now.mean()}
i1p = np.array([sc(r, 1, "pre") for r in rows]); i1n = np.array([sc(r, 1, "now") for r in rows])
E["item1_t"] = stats.ttest_rel(i1n, i1p).statistic
E["item12_mean"] = np.nanmean([sc(r, 17) for r in rows])
M = np.array([[sc(r, n) for n in (14, 15, 16, 17)] for r in rows]); k = 4
E["alpha_II"] = k / (k - 1) * (1 - M.var(axis=0, ddof=1).sum() / M.sum(axis=1).var(ddof=1))
cm = {(c["grade"], c["cls"], c["num"]): c for c in D["curi"]}
gx, gy = [], []
for r in rows:
    c = cm.get((r["grade"], r["cls"], r["num"]))
    if not c: continue
    s = sum(int(v["last"]) - int(v["first"]) for v in c["stages"].values())
    gx.append(np.mean([sc(r, n, "now") for n in range(1, 9)]) - np.mean([sc(r, n, "pre") for n in range(1, 9)])); gy.append(s)
sp = stats.spearmanr(gx, gy); E["sp_n"] = len(gx); E["sp_rho"] = sp.statistic; E["sp_p"] = sp.pvalue
# 사전(학번 있음) 영역Ⅵ 대응
P = {}
with open("tests/pre_with_id.csv", encoding="utf-8-sig") as f:
    for row in csv.DictReader(f): P[(int(row["학년"]), int(row["반"]), int(row["번호"]))] = row
pv, qv = [], []
for r in rows:
    p = P.get((r["grade"], r["cls"], r["num"]))
    if not p: continue
    pr = [int(p["문항8"]), int(p["문항9"]), 6 - int(p["문항16"]), 6 - int(p["문항18"]), 6 - int(p["문항19"]), int(p["문항21"])]
    pv.append(np.mean(pr)); qv.append(np.mean([sc(r, n) for n in range(30, 36)]))
tp = stats.ttest_rel(qv, pv); E["pre_paired_t"] = tp.statistic; E["pre_n"] = len(pv)
# 사전(학번 없음) Welch
pn = []
with open("tests/pre_no_id.csv", encoding="utf-8") as f:
    for row in csv.DictReader(f):
        pn.append(np.mean([int(row["문항8"]), int(row["문항9"]), 6 - int(row["문항16"]), 6 - int(row["문항18"]), 6 - int(row["문항19"]), int(row["문항21"])]))
E["pre_welch_t"] = stats.ttest_ind([np.mean([sc(r, n) for n in range(30, 36)]) for r in rows], pn, equal_var=False).statistic
json.dump({k: float(v) for k, v in E.items()}, open("tests/expected.json", "w"), indent=1)
print(json.dumps({k: round(float(v), 4) for k, v in E.items()}, ensure_ascii=False))
