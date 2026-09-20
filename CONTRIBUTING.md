# Közreműködés

Köszönöm, hogy hozzájárulnál a projekthez! Az alábbiakban leírom, hogyan tudod a legegyszerűbben megtenni.

## Fejlesztői környezet felállítása

1. Forkold és klónozd a repót:
   ```bash
   git clone https://github.com/doomhyena/toll.git
   cd toll
   ```

2. Telepítsd az előfeltételeket (Go 1.23+, Node.js 18+, Wails CLI v2).

3. Telepítsd a frontend függőségeket:
   ```bash
   cd frontend && npm install && cd ..
   ```

4. Indítsd el fejlesztői módban:
   ```bash
   wails dev
   ```

## Kódstílus

### Go
- `gofmt` formázás kötelező (a legtöbb szerkesztő automatikusan elvégzi).
- Csomagnév: `snake_case`, fájlnév: `snake_case.go`.
- Exportált szimbólumokhoz rövid, angol doc comment.
- Hibák visszaadása, nem `panic` — kivéve inicializálás során.

### TypeScript / React
- Minden komponens `.tsx` fájlban, function component (nem class).
- `Props` interface közvetlenül a komponens előtt.
- A Wails által generált `wailsjs/` könyvtárat ne szerkeszd kézzel — `wails build` vagy `wails dev` regenerálja.
- CSS osztályok: a meglévő BEM-szerű konvencióhoz igazodj (`page`, `page-header`, `card`, stb.).

## Branch és commit konvenciók

```
feat/rovid-leiras # új funkció
fix/rovid-leiras # hibajavítás
chore/rovid-leiras # karbantartás, refaktor
```

Commit üzenetek: imperatív módban, magyarul vagy angolul (következetesen):

```
feat: órarend szombat nézet hozzáadva
fix: Cimek JSON unmarshal hiba javítva
```

## Pull Request folyamat

1. Nyiss egy issue-t a változtatás megbeszéléséhez (nagyobb feladatoknál).
2. Hozz létre feature branchet `main`-ből.
3. Győződj meg róla, hogy a projekt lefordul (`wails build`), és nincs TypeScript vagy Go fordítási hiba.
4. Nyiss PR-t a `main` branch felé. Írj rövid leírást arról, mit és miért változtattál.

## Amit ne módosíts

- `wailsjs/` — automatikusan generált fájlok.
- `build/bin/` — build kimenet, nincs verziókövetésben.
- Felhasználói adatfájlok (`accounts.json`, `entries.json`, `local_profile.json`) — `.gitignore`-ban vannak.

## Kérdések

Nyiss egy GitHub issue-t, vagy írj a [contact@doomhyena.hu](mailto:contact@doomhyena.hu) e-mail címre.
