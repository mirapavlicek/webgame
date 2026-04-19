# NetTycoon — návod pro kamaráda

Ahoj! Posílám ti jednu naši ISP simulační hru (postavíš si vlastního
poskytovatele internetu). Je v brzké alfa fázi, tak mě trochu omluv za chyby.

Jak to rozchodit:

## macOS (.dmg soubor)

1. Stáhni `NetTycoon_0.1.0_universal.dmg` (nebo podobný název).
2. Dvakrát na něj klikni → otevře se okno s ikonou NetTycoon.
3. Přetáhni ikonu NetTycoon do složky **Applications**.
4. Otevři Finder → Applications → pravý klik na **NetTycoon** → **Otevřít**.

Poprvé ti macOS řekne něco jako _„NetTycoon nelze otevřít, protože je od
neidentifikovaného vývojáře"_. To je normální — aplikace není podepsaná u
Applu (nechce se mi za to platit 99 $/rok). Máš dvě možnosti:

**Jednodušší cesta** — v té hlášce klikni **Zrušit**, pak jdi do:

> Systémové nastavení → Soukromí a bezpečnost → dolů ke zprávě
> „NetTycoon byla zablokována" → **Otevřít přesto**

**Geeky cesta** — v Terminálu:

```bash
xattr -cr /Applications/NetTycoon.app
```

Potom už NetTycoon otevřeš normálně dvojklikem.

## Windows (.exe nebo .msi)

1. Stáhni `NetTycoon_0.1.0_x64-setup.exe` (nebo `.msi`).
2. Dvakrát klikni na instalátor.
3. Windows SmartScreen ti nejspíš řekne _„Windows protected your PC"_ —
   aplikace není podepsaná. Klikni **More info** → **Run anyway**.
4. Projdi instalací (Next → Next → Install). Hra se nainstaluje do
   `C:\Program Files\NetTycoon\` a udělá zástupce v Start menu.
5. Spusť NetTycoon ze Start menu.

## Jak se hraje

- Založíš si firmu, zvolíš si město a startovní strategii.
- Hra má tutorial + helpovou ikonku (?) v pravém horním rohu.
- Uprav si rychlost hry dole (pauza / 1× / 2× / 4×).
- Save/load je v menu vlevo nahoře.

## Co kdyby něco nešlo

Pošli mi screenshot konzole:
- **macOS:** když NetTycoon běží, pravý klik do okna → **Inspect Element**
  → záložka **Console**.
- **Windows:** to samé (Tauri má DevTools vestavěné).

Zkopíruj červené řádky a hoď mi je.

---

Díky za vyzkoušení! 🎮
