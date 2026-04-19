# Push na GitHub + CI build pro macOS/Windows

Ze sandboxu nemůžu pushovat přímo (nemám přístup k tvým GitHub credentials).
Všechno ostatní je ale připravené — workflow, .gitignore, commit jsem udělal
a výsledek exportoval jako git bundle. Stačí spustit tyhle příkazy v terminálu
na tvém macu.

## Varianta A — jednorázový push (nejjednodušší)

```bash
cd ~/Documents/Projects/WebAGame

# 1) Odstraň rozpracovaný .git (sandbox ho neumí smazat)
rm -rf .git

# 2) Fresh init, commit, push
git init -b main
git config user.email "mira@pavlicek.cloud"
git config user.name "Mira Pavlicek"
git add .
git commit -m "Initial commit: NetTycoon v0.1.0"
git remote add origin https://github.com/mirapavlicek/webgame.git
git branch -M main
git push -u origin main
```

Při prvním pushi tě GitHub vyzve k autentizaci — na macOS to typicky
vyřeší Keychain dialog / osxkeychain helper. Pokud nemáš, vygeneruj si
[Personal Access Token](https://github.com/settings/tokens?type=beta)
(scope: `repo`, `workflow`) a použij ho jako heslo.

## Varianta B — import z připraveného git bundle

Pokud chceš zachovat můj commit (včetně commit message), stáhni
`nettycoon-initial.bundle` a naimportuj:

```bash
cd ~/Documents/Projects/WebAGame
rm -rf .git

# Stáhni bundle (je ve složce outputs)
# NEBO přímo
git clone /path/to/nettycoon-initial.bundle /tmp/nettycoon-clone
cp -R /tmp/nettycoon-clone/.git ./
git remote set-url origin https://github.com/mirapavlicek/webgame.git
git push -u origin main
```

## Spuštění buildu pro kamaráda

Po úspěšném pushnutí kódu:

```bash
cd ~/Documents/Projects/WebAGame
git tag v0.1.0
git push origin v0.1.0
```

Tohle spustí GitHub Actions workflow (`.github/workflows/release.yml`),
který paralelně zbuilduje:

- **macOS universal .dmg** (Intel + Apple Silicon) — runs-on: `macos-latest`
- **Windows .msi + .exe** (NSIS installer) — runs-on: `windows-latest`

Build trvá cca **15–25 minut**. Průběh najdeš na:

> https://github.com/mirapavlicek/webgame/actions

Po dokončení se vytvoří **Release v0.1.0** s připojenými balíčky:

> https://github.com/mirapavlicek/webgame/releases/tag/v0.1.0

Pošli kamarádovi odkaz na `.dmg` (pro Mac) nebo `.exe` (pro Windows)
spolu s textem z [DISTRIBUCE.md](./DISTRIBUCE.md).

## Ruční spuštění workflow (bez tagu)

Pokud chceš jen vyzkoušet, že CI funguje bez vytváření releasu:

1. Jdi na https://github.com/mirapavlicek/webgame/actions
2. Vlevo vyber **Release Build**
3. Klikni **Run workflow** → vyber větev `main` → **Run**

Artefakty se pak objeví dole v run detailu (stažitelné ručně, bez
vytvoření Release).

## Co všechno jde na GitHub

- Herní kód (`js/`, `css/`, `index.html`, `src/`, `src-tauri/`)
- Tauri config + ikony
- `package.json`, `.gitignore`, docs
- CI workflow (`.github/workflows/release.yml`)

## Co NEjde na GitHub (a proč)

- `node_modules/` — instaluje se v CI přes `npm install`
- `vendor/pixi*.min.js` — CI je fetchne přes `vendor/fetch.sh`
- `src-tauri/target/` — build artefakty
- `dist-game/` — generuje `prepare-dist.sh`
- `nettycoon_*.json` — save soubory hry
- `.DS_Store`
