#!/usr/bin/env bash
# Jednorázový commit + push release s inflačními a AI úpravami.
# Spusť z root folderu repa: `bash commit-and-push.sh`
set -e

cd "$(dirname "$0")"

# Stale .lock soubory z předchozího crashu/sandboxu — smaž všechny.
echo "🗑  mažu stale .lock soubory v .git/"
find .git -maxdepth 3 -name "*.lock" -type f -print -delete 2>/dev/null || true
# Některé tmp objekty z neúspěšného `git add` — ty taky uklidit
find .git/objects -name "tmp_obj_*" -type f -print -delete 2>/dev/null || true

echo "📋 git status:"
git status --short
echo

echo "➕ git add -A"
git add -A

echo "📝 git commit"
git commit -m "feat: inflation propagation, AI pricing rewrite, cloud depth, BGP fix

Velký balík ekonomických a AI úprav.

Inflace / ekonomika:
- Nová osa G.tariffInflation (valorizační doložka, 0.5-0.7x CPI/rok)
- calcBldRevenue násobí výstup tariffInflation
- Cloud revenue max(tariffInflation, 0.9x componentInflation)
- Per-customer support (25 Kč) přes inflSalaryCost
- UI: status ukazuje tarifní inflaci, tabulka tarifů info banner + šipka

AI konkurence:
- Marginal-cost-plus-margin pricing (premium 28% / balanced 18% / budget 10%)
- pricingMood konečně funkční (reaguje na minulou marži)
- Per-konkurent tariffInflation se šumem +/-15%
- Kapacitně řízená expanze (capacityPressure > 0.80)
- Všechny AI náklady a thresholdy škálují inflací

Cloud:
- Per-instance mCost (18-22% ceny)
- calcCloudOpCost s dev automatizací (až -30%)
- Reputační systém (drift dle výpadků, spirála churnu pod 40)
- Reálné SLA kredity dle výpadkových dnů vs smluvní uptime
- Marketing/support/dev cross-effects, compPressure, kapacitní brzda

BGP routing fix:
- bfsCablePath traversuje jen segmenty s kabelem
- diagDCPath: linked/noRoadPath/cableGap/sameDC
- UI vypisuje všechna DC s per-pair diagnostikou

Startovní režimy:
- HACK MíraNet = 500M startovní hotovost
- HARD režim = 500K úvěr / 10% p.a. / 60 měs.

Morálka:
- getMoraleThreshold škáluje podle trainingBudgetM
- Symetrický model kolem prahu

Viz CHANGELOG.md pro detaily."

echo "🚀 git push origin main"
git push origin main

echo "✅ Hotovo."
