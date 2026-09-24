"""Build Feestrun.

Joins the parts in src/ into one script and writes:
  artifact.html                                  raw join, all four games with a game switcher
                                                 (for the Claude artifact; keeps hot-reload hooks)
  dist/feestrun-jmartens/feestrun/index.html     hub page linking the four games
  dist/feestrun-jmartens/feestrun/<game>.html    one page per game (FIXED_GAME set)
  dist/feestrun-jmartens/feestrun/<game>-embed.html  compact iframe version of that game
  dist/feestrun-jmartens/feestrun/img/           logo, favicon, category images
  dist/feestrun-jmartens/LEESMIJ.txt + dist/feestrun-jmartens.zip   upload package
  docs/                                          copy of the site for GitHub Pages (main branch, /docs)
"""
import os, re, shutil, zipfile

VERSION = '2.0'
DATE = '24 september 2026'
PARTS = ['head.part', 'js1.part', 'segs.part', 'levels.part', 'js2_platform.part', 'js3_flappy.part',
         'js4_snake.part', 'js5_tetris.part', 'js6_flow.part']
GAMES = [  # id, page title part, meta description
    ('platformer', 'De winkel (platformer)', 'Spring als rode ballon door de winkel van J-Martens.nl en verzamel alle productcategorieën in 3 levels.'),
    ('flappy', 'Ballonvlucht (flappy)', 'Flap als rode ballon tussen de rollen cadeaupapier door en vang alle productcategorieën van J-Martens.nl in 3 levels.'),
    ('snake', 'De ballonnenslang (snake)', 'Eet als ballonnenslang alle productcategorieën van J-Martens.nl en ontwijk de spelden in 3 levels.'),
    ('tetris', 'Dozen inpakken (tetris)', 'Stapel de dozen van J-Martens.nl strak in: elke volle rij is een verzonden bestelling. 3 levels.'),
]
FAVICON = 'img/favicon.png'

src = ''.join(open('src/' + p).read() for p in PARTS)
open('artifact.html', 'w').write(src)  # versie voor de Claude-artifact (zonder doctype/head)

# strip artifact-only bits
src = src.replace("window.claude?.hot?.ready ? window.claude.hot.ready(boot) : boot(window.claude?.hot?.data ?? null);", "boot(null);")
src = re.sub(r"try\{ window\.claude\?\.hot\?\.snapshot.*?\}catch\(e\)\{\}\n", "", src)
src = re.sub(r"window\.__feest=\{.*?\};\n", "", src)
assert 'window.claude' not in src and '__feest' not in src
assert src.count("const FIXED_GAME=null;") == 1


def wrap(body, title, description, extra_css=''):
    body = body.replace('<title>Feestrun J. Martens</title>\n', '', 1)
    return ('<!DOCTYPE html>\n<html lang="nl">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
            f'<title>{title}</title>\n<meta name="description" content="{description}">\n'
            f'<link rel="icon" type="image/png" href="{FAVICON}">\n<meta name="robots" content="index,follow">\n'
            '<style>html{color-scheme:light}body{margin:0;background:#fff}img{max-width:100%}[hidden]{display:none!important}' + extra_css + '</style>\n'
            '</head>\n<body>\n' + body + '\n</body>\n</html>\n')


EMBED_STRIP = [r'  <div class="top">.*?</div>\n  </div>\n', r'  <div class="brandbar">.*?</div>\n  </div>\n',
               r'  <div class="xline">De levels</div>\n  <div class="levels" id="levelCards"></div>\n',
               r'  <div class="usp">.*?</div>\n', r'  <footer>.*?</footer>\n']


def embed_of(page):
    emb = page
    for pat in EMBED_STRIP:
        emb, n = re.subn(pat, '', emb, flags=re.S); assert n == 1, pat
    emb = emb.replace('<img class="nav-logo" src="img/logo.png" alt="" hidden>', '<img class="nav-logo" src="img/logo.png" alt="J-Martens.nl">')
    emb = emb.replace('<button type="button" class="home" data-home>Home</button>',
                      '<button type="button" class="home" data-home>Home</button><button type="button" id="btnMute" aria-pressed="false" style="margin-left:auto">🔊 Geluid</button><button type="button" id="btnRestart">↻ Opnieuw</button>')
    return emb


out = 'dist/feestrun-jmartens/feestrun'
shutil.rmtree('dist/feestrun-jmartens', ignore_errors=True); os.makedirs(out + '/img')
pages = set()
for gid, gtitle, gdesc in GAMES:
    page = src.replace("const FIXED_GAME=null;", f"const FIXED_GAME='{gid}';")
    assert page.count(f"const FIXED_GAME='{gid}';") == 1
    open(f'{out}/{gid}.html', 'w').write(wrap(page, f'Feestrun – {gtitle} – J-Martens.nl', gdesc))
    open(f'{out}/{gid}-embed.html', 'w').write(wrap(embed_of(page), f'Feestrun – {gtitle} – J-Martens.nl', gdesc,
                                                     '.wrap{padding:8px 8px 10px!important}.nav{margin-bottom:8px!important}'))
    pages.add(f'{gid}.html')

# hub: the stylesheet of head.part + the static hub fragment
head = open('src/head.part').read()
styles = re.findall(r'<style>.*?</style>', head, flags=re.S); assert len(styles) == 1
hub = open('src/hub.part').read()
for href in re.findall(r'href="([^"]+\.html)"', hub):
    assert href == 'index.html' or href in pages, f'hub links to unknown page {href}'
open(f'{out}/index.html', 'w').write(wrap(styles[0] + '\n' + hub, 'Feestrun – de spelletjes van J-Martens.nl',
                                          'Feestrun: vier spelletjes van J-Martens.nl. Verzamel als rode ballon alle productcategorieën in een platformer, flappy, snake en tetris, elk met 3 levels.',
                                          '.wrap p{font-size:15px;line-height:1.5}'))

for f in os.listdir('src/img'):
    if not f.startswith('logo-origineel'): shutil.copy('src/img/' + f, out + '/img/' + f)

open('dist/feestrun-jmartens/LEESMIJ.txt', 'w').write(f'''FEESTRUN – spelletjes voor J-Martens.nl  (versie {VERSION}, {DATE})
=====================================================================

INHOUD VAN DE MAP "feestrun"
  index.html            Startpagina met kop, logo, rode balk en de vier spelletjes.
                        Te gebruiken als eigen pagina, bijv. https://j-martens.nl/feestrun/
  platformer.html       "De winkel" (platformer), 3 levels
  flappy.html           "Ballonvlucht" (flappy), 3 levels
  snake.html            "De ballonnenslang" (snake), 3 levels
  tetris.html           "Dozen inpakken" (tetris), 3 levels
  <spel>-embed.html     Compacte versie van elk spel (alleen spel + levelbalk) om in een
                        WordPress-pagina te zetten via een iframe.
  Komen er later spelletjes bij, dan zijn dat gewoon extra bestanden in deze map en
  een extra kaartje op de startpagina; de bestaande bestanden blijven werken.
  img/                  Het logo (logo.png, favicon.png) en de 10 categoriebeelden (320x320 jpg).
                        Vervang een beeld door een nieuw bestand met dezelfde naam als een
                        categoriefoto verandert.

Alles staat in de map zelf. Er is geen database, plugin of externe code nodig,
behalve de lettertypen Grandstander en Roboto van Google Fonts (die de website
al gebruikt).

STAP 1 – MAP OP DE WEBSERVER ZETTEN
  1. Log in op de hosting (FTP of de bestandsbeheerder van het hostingpaneel).
  2. Upload de hele map "feestrun" naar de hoofdmap van de website, naast de map
     wp-content. Het resultaat is dan: https://j-martens.nl/feestrun/
     (Een andere plek mag ook, bijv. wp-content/uploads/feestrun/. Pas dan de
     adressen in stap 2 aan.)
  3. Open https://j-martens.nl/feestrun/ in de browser, klik een spel aan en
     controleer dat de categoriebeelden op het titelscherm zichtbaar zijn.

STAP 2 – IN DE WEBSITE ZETTEN
  Het makkelijkst: zet een knop of menu-item (Weergave > Menu's) met een link naar
  https://j-martens.nl/feestrun/ . Die startpagina heeft zelf al de kop en de rode
  balk in de huisstijl en linkt naar de vier spelletjes.

  Liever een spel in een eigen WordPress-pagina? Maak een pagina, voeg een blok
  "Aangepaste HTML" toe en plak dit erin (vervang platformer door flappy, snake
  of tetris voor de andere spelletjes):

     <iframe src="https://j-martens.nl/feestrun/platformer-embed.html"
             title="Feestrun – De winkel – J-Martens"
             style="width:100%;max-width:1000px;aspect-ratio:1000/680;min-height:520px;border:0;display:block;margin:0 auto"
             loading="lazy" allow="autoplay"></iframe>

GOED OM TE WETEN
  - Geluid en muziek starten pas na de eerste klik of toetsaanslag; dat is een
    regel van browsers, geen fout.
  - Werkt op computer (pijltjes, spatie, R, M) en op telefoon/tablet (knoppen
    onder het speelveld). Op een telefoon is het speelveld het grootst als je
    hem een kwartslag draait; het spel zegt dat zelf ook.
  - Een level direct openen kan met ?level=2 achter de bestandsnaam, bijv.
    https://j-martens.nl/feestrun/flappy.html?level=2
  - Elk spel heeft drie levels: makkelijk, gemiddeld en moeilijk. Elk level eindigt
    met een kassabon; na level 3 staat ook de totaalscore van het spel op de bon.
      De winkel:          Openingstijd · Koopavond · Het magazijn bij nacht
      Ballonvlucht:       Zacht briesje · Stevige wind · Storm
      De ballonnenslang:  Op je gemak · Drukte in de winkel · Speldenkussen
      Dozen inpakken:     Rustige ochtend · Middagdrukte · Voor 15 uur besteld!
  - Teksten aanpassen: open het spelbestand in een teksteditor; de categorienamen
    staan bovenin het script bij "const CATS", de spel- en levelnamen en de uitleg
    bij "const GAMES".
  - Wil je het spel later bijwerken, dan vervang je gewoon de bestanden in de map.
''')
# GitHub Pages: the same site, served from docs/ on the main branch
shutil.rmtree('docs', ignore_errors=True); shutil.copytree(out, 'docs'); open('docs/.nojekyll', 'w').close()

z = 'dist/feestrun-jmartens.zip'
with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, _, files in os.walk('dist/feestrun-jmartens'):
        for f in sorted(files):
            p = os.path.join(root, f); zf.write(p, os.path.relpath(p, 'dist'))
print('built', os.path.getsize(z))
