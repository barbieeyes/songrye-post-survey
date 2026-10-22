import json, sys, numpy as np
from scipy import stats
cases = json.load(sys.stdin); bad = 0; n = 0
def chk(name, a, b, tol=5e-4):
    global bad, n; n += 1
    if a is None or b is None or not (abs(a - b) <= tol * max(1, abs(b))):
        if not (np.isnan(a) and np.isnan(b)): bad += 1; print("MISMATCH", name, a, b)
for i, c in enumerate(cases):
    x, y, z = np.array(c["x"], float), np.array(c["y"], float), np.array(c["z"], float)
    r = stats.ttest_rel(y, x); d = y - x
    chk(f"{i} paired t", c["paired"]["t"], r.statistic); chk(f"{i} paired p", c["paired"]["p"], r.pvalue)
    chk(f"{i} dz", c["paired"]["dz"], d.mean() / d.std(ddof=1))
    w = stats.ttest_ind(z, x, equal_var=False)
    chk(f"{i} welch t", c["welch"]["t"], w.statistic); chk(f"{i} welch p", c["welch"]["p"], w.pvalue)
    R = np.array(c["rows"], float); k = R.shape[1]
    alpha = k / (k - 1) * (1 - R.var(axis=0, ddof=1).sum() / R.sum(axis=1).var(ddof=1))
    chk(f"{i} alpha", c["alpha"]["alpha"], alpha)
    s = stats.spearmanr(c["a"], c["b"])
    chk(f"{i} rho", c["sp"]["rho"], s.statistic); chk(f"{i} sp p", c["sp"]["p"], s.pvalue)
print(f"통계 대조 {n}개 중 불일치 {bad}개"); sys.exit(1 if bad else 0)
