# Feestrun – het spelletje van J-Martens.nl

Browserspel rond de productcategorieën van de online feestwinkel J-Martens.nl.
Vijf levels in vier spelstijlen: platformer (De winkel), flappy (Ballonvlucht),
snake (De ballonnenslang), tetris (Dozen inpakken) en een nachtplatformer
(Het magazijn bij nacht). Huisstijl: Grandstander/Roboto, rood #D20000, het echte logo.

## Mappen
- `src/` – de broncode in delen: `head.part` (HTML + CSS), `js1.part` (gedeeld:
  audio, muziek, helpers), `js2…js5` (de vier spelstijlen), `js6_flow.part`
  (spelverloop, invoer, navigatie), `segs.part` (levelkaarten van de platformers).
  `src/img/` bevat het logo, de favicon en de 10 categoriebeelden (320×320).
- `build_site.py` – plakt de delen aan elkaar en bouwt:
  - `artifact.html` (versie voor de Claude-artifact, zonder doctype/head),
  - `dist/feestrun-jmartens/feestrun/index.html` (losse websitepagina),
  - `dist/feestrun-jmartens/feestrun/embed.html` (compacte versie voor een iframe),
  - `dist/feestrun-jmartens/LEESMIJ.txt` en `dist/feestrun-jmartens.zip` (uploadpakket).
- `tools/` – `solve_final.js` (best-first zoeker over de spelfysica die controleert
  of elke sprong in de platformerlevels haalbaar is) en `sim2.js` (waypoint-check
  van het eindstuk van level 5). Draaien met `node tools/solve_final.js` na een build.

## Bouwen
```
python3 build_site.py
```
Vereist Python 3 met Pillow niet meer (beelden staan al klaar); Node is alleen
nodig voor de controlescripts.

## Op de website zetten
Zie `dist/feestrun-jmartens/LEESMIJ.txt`: map `feestrun` uploaden naar de
hoofdmap van de site en in WordPress een blok "Aangepaste HTML" met een iframe
naar `embed.html` plaatsen.

## Online proefversie
https://claude.ai/artifact/XGUGDbMRKymS59KVtGPM3e (privé, deelbaar via Share)
