#!/usr/bin/env bash
# Release script: commit version bump → create tag v0.2.0 → push → CI sestaví
# macOS DMG (universal) + Windows MSI/EXE a vyvěsí je na GitHub Releases.
set -e

cd "$(dirname "$0")"

VERSION="0.2.0"
TAG="v${VERSION}"

# Úklid stale .lock souborů v .git/ (pojistka, pokud tam něco zbylo ze sandboxu)
find .git -name "*.lock" -type f -delete 2>/dev/null || true
find .git/objects -name "tmp_obj_*" -type f -delete 2>/dev/null || true

echo "📋 Aktuální stav:"
git status --short
echo

# 1) Commit version bump (pokud jsou změny)
if ! git diff --quiet; then
  echo "📦 Commituji version bump na ${VERSION}"
  git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml CHANGELOG.md
  git commit -m "chore(release): v${VERSION}

Bump version to ${VERSION}.
Viz CHANGELOG.md pro detaily obsahu releasu."
fi

# 2) Zkontroluj, že tag ještě neexistuje
if git rev-parse "${TAG}" >/dev/null 2>&1; then
  echo "⚠️  Tag ${TAG} už existuje. Pro re-release tag smaž: git tag -d ${TAG} && git push --delete origin ${TAG}"
  exit 1
fi

# 3) Anotovaný tag (GitHub ho zobrazí jako Release)
echo "🏷  Vytvářím tag ${TAG}"
git tag -a "${TAG}" -m "NetTycoon ${TAG}

Viz CHANGELOG.md pro detaily:
- Inflace propagace (tariffInflation)
- AI konkurence: marginal-cost pricing
- Cloud: mCost, reputace, SLA kredity
- BGP routing fix
- HACK MíraNet + HARD režim
- Morálka: threshold škálovaný školením"

# 4) Push main + tag (tag spouští .github/workflows/release.yml)
echo "🚀 Push main + tag na GitHub"
git push origin main
git push origin "${TAG}"

echo
echo "✅ Tag ${TAG} pushnutý. CI běží na:"
echo "   https://github.com/mirapavlicek/webgame/actions"
echo
echo "Po ~10-15 minutách najdeš macOS DMG + Windows MSI/EXE na:"
echo "   https://github.com/mirapavlicek/webgame/releases/tag/${TAG}"
