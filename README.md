# Feestrun – de spelletjes van J-Martens.nl

Vier browserspelletjes rond de productcategorieën van de online feestwinkel J-Martens.nl,
elk met drie levels (makkelijk, gemiddeld, moeilijk):

| Spel | Stijl | Levels |
|---|---|---|
| De winkel | platformer | Openingstijd · Koopavond · Het magazijn bij nacht |
| Ballonvlucht | flappy | Zacht briesje · Stevige wind · Storm |
| De ballonnenslang | snake | Op je gemak · Drukte in de winkel · Speldenkussen |
| Dozen inpakken | tetris | Rustige ochtend · Middagdrukte · Voor 15 uur besteld! |

Huisstijl: Grandstander/Roboto, rood #D20000, het echte logo. Geen dependencies, geen bundler.

## Mappen
- `src/` – de broncode in delen, in de volgorde waarin `build_site.py` ze plakt:
  `head.part` (HTML + CSS), `js1.part` (gedeeld: categorieën, audio, muziek, helpers),
  `segs.part` (de drie platformerkaarten `SEGS_P1/P2/P3`), `levels.part` (`GAMES` met per
  spel drie levels en hun moeilijkheidsknoppen `diff`), `js2…js5` (de vier spelstijlen),
  `js6_flow.part` (spelverloop, invoer, navigatie). `hub.part` is de statische startpagina.
  `src/img/` bevat het logo, de favicon en de 10 categoriebeelden (320×320).
- `build_site.py` – bouwt:
  - `artifact.html` (alle vier spellen op één pagina, met spelkeuze; voor de Claude-artifact),
  - `dist/feestrun-jmartens/feestrun/index.html` (startpagina met de vier spellen),
  - `dist/…/feestrun/<spel>.html` en `<spel>-embed.html` (pagina en iframe-versie per spel),
  - `dist/feestrun-jmartens/LEESMIJ.txt` en `dist/feestrun-jmartens.zip` (uploadpakket).
- `tools/` – controle zonder browser:
  - `harness.js` laadt `artifact.html` in een Node-vm met een nep-DOM en nep-canvas;
  - `bots.js` speelt flappy, snake en tetris (en speelt een solver-route na in de platformer);
  - `solver.js` bewijst per platformerkaart dat elk kaartje en de kassa zonder doodgaan
    haalbaar zijn (`node tools/solve_final.js` print het rapport);
  - `test/` – de tests, zie hieronder.

## Bouwen en testen
```
python3 build_site.py                                            # altijd eerst
node --test tools/test/static.test.js tools/test/levels.test.js  # ±2 min: elk level speelbaar, dood, game over
node --test tools/test/solver.test.js                            # minuten: platformerkaarten bewijsbaar + naspelen
node tools/solve_final.js [SEGS_P2]                              # rapport van de solver
```
Python 3 zonder extra pakketten; Node 18 of hoger voor de tools.

## Op de website zetten
Zie `dist/feestrun-jmartens/LEESMIJ.txt`: map `feestrun` uploaden naar de hoofdmap van de
site en linken naar `feestrun/`, of per spel een iframe naar `<spel>-embed.html`.

## Online proefversie
https://claude.ai/artifact/XGUGDbMRKymS59KVtGPM3e (privé, deelbaar via Share)
