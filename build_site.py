import re, os, shutil, zipfile
import subprocess
PARTS=['head.part','js1.part','js2_platform.part','js3_flappy.part','js4_snake.part','js5_tetris.part','js6_flow.part']
src=''.join(open('src/'+p).read() for p in PARTS)
open('artifact.html','w').write(src)  # versie voor de Claude-artifact (zonder doctype/head)
# strip artifact-only bits
src=src.replace("window.claude?.hot?.ready ? window.claude.hot.ready(boot) : boot(window.claude?.hot?.data ?? null);","boot(null);")
src=re.sub(r"try\{ window\.claude\?\.hot\?\.snapshot.*?\}catch\(e\)\{\}\n","",src)
src=re.sub(r"window\.__feest=\{.*?\};\n","",src)
assert 'window.claude' not in src and '__feest' not in src
FAVICON='img/favicon.png'
def wrap(body,title,extra_css=''):
    body=body.replace('<title>Feestrun J. Martens</title>\n','',1)
    return ('<!DOCTYPE html>\n<html lang="nl">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
            f'<title>{title}</title>\n<meta name="description" content="Feestrun: het spelletje van J-Martens.nl. Verzamel als rode ballon alle productcategorieën in 5 levels: platformer, flappy, snake en tetris.">\n'
            f'<link rel="icon" type="image/png" href="{FAVICON}">\n<meta name="robots" content="index,follow">\n'
            '<style>html{color-scheme:light}body{margin:0;background:#fff}img{max-width:100%}[hidden]{display:none!important}'+extra_css+'</style>\n'
            '</head>\n<body>\n'+body+'\n</body>\n</html>\n')
full=wrap(src,'Feestrun – het spelletje van J-Martens.nl')
# embed: strip site chrome (top bar, brand bar, level cards, usp, footer)
emb=src
for pat in [r'  <div class="top">.*?</div>\n  </div>\n', r'  <div class="brandbar">.*?</div>\n  </div>\n', r'  <div class="xline">De levels</div>\n  <div class="levels" id="levelCards"></div>\n', r'  <div class="usp">.*?</div>\n', r'  <footer>.*?</footer>\n']:
    emb,n=re.subn(pat,'',emb,flags=re.S); assert n==1,pat
emb=emb.replace('<img class="nav-logo" src="img/logo.png" alt="" hidden>','<img class="nav-logo" src="img/logo.png" alt="J-Martens.nl">')
emb=emb.replace('<button type="button" class="home" data-home>Home</button>','<button type="button" class="home" data-home>Home</button><button type="button" id="btnMute" aria-pressed="false" style="margin-left:auto">🔊 Geluid</button><button type="button" id="btnRestart">↻ Opnieuw</button>')
embed=wrap(emb,'Feestrun – J-Martens.nl','.wrap{padding:8px 8px 10px!important}.nav{margin-bottom:8px!important}')
out='dist/feestrun-jmartens/feestrun'
shutil.rmtree('dist/feestrun-jmartens',ignore_errors=True); os.makedirs(out+'/img')
open(out+'/index.html','w').write(full); open(out+'/embed.html','w').write(embed)
for f in os.listdir('src/img'):
    if not f.startswith('logo-origineel'): shutil.copy('src/img/'+f,out+'/img/'+f)
open('dist/feestrun-jmartens/LEESMIJ.txt','w').write('''FEESTRUN – spelletje voor J-Martens.nl  (versie 1.1, 21 september 2026)
=====================================================================

INHOUD VAN DE MAP "feestrun"
  index.html   Losse spelpagina met kop, logo, rode balk, levelkaarten en uitleg.
               Te gebruiken als eigen pagina, bijv. https://j-martens.nl/feestrun/
  embed.html   Compacte versie (alleen spel + levelbalk) om in een WordPress-pagina
               te zetten via een iframe.
  img/         Het logo (logo.png, favicon.png) en de 10 categoriebeelden (320x320 jpg). Vervang een beeld door een
               nieuw bestand met dezelfde naam als een categoriefoto verandert.

Alles staat in de map zelf. Er is geen database, plugin of externe code nodig,
behalve de lettertypen Grandstander en Roboto van Google Fonts (die de website
al gebruikt).

STAP 1 – MAP OP DE WEBSERVER ZETTEN
  1. Log in op de hosting (FTP of de bestandsbeheerder van het hostingpaneel).
  2. Upload de hele map "feestrun" naar de hoofdmap van de website, naast de map
     wp-content. Het resultaat is dan: https://j-martens.nl/feestrun/index.html
     (Een andere plek mag ook, bijv. wp-content/uploads/feestrun/. Pas dan de
     adressen in stap 2 aan.)
  3. Open https://j-martens.nl/feestrun/ in de browser en controleer dat de
     categoriebeelden op het titelscherm zichtbaar zijn.

STAP 2 – IN EEN WORDPRESS-PAGINA ZETTEN
  1. Maak in WordPress een nieuwe pagina, bijv. "Feestrun" of "Speel mee".
  2. Voeg een blok "Aangepaste HTML" toe en plak dit erin:

     <iframe src="https://j-martens.nl/feestrun/embed.html"
             title="Feestrun – het spelletje van J-Martens"
             style="width:100%;max-width:1000px;aspect-ratio:1000/680;min-height:520px;border:0;display:block;margin:0 auto"
             loading="lazy" allow="autoplay"></iframe>

  3. Publiceer de pagina en zet hem eventueel in het menu (Weergave > Menu's).

  Liever geen iframe? Link dan gewoon naar https://j-martens.nl/feestrun/ met een
  knop of menu-item. Die pagina heeft zelf al de kop en de rode balk in de
  huisstijl.

GOED OM TE WETEN
  - Geluid en muziek starten pas na de eerste klik of toetsaanslag; dat is een
    regel van browsers, geen fout.
  - Werkt op computer (pijltjes, spatie, R, M) en op telefoon/tablet (knoppen
    onder in beeld).
  - Levels: 1 platformer "De winkel", 2 flappy "Ballonvlucht", 3 snake
    "De ballonnenslang", 4 tetris "Dozen inpakken", 5 platformer "Het magazijn
    bij nacht". Elk level eindigt met een kassabon.
  - Teksten aanpassen: open index.html of embed.html in een teksteditor; de
    categorienamen staan bovenin het script bij "const CATS", de levelnamen en
    uitleg bij "const LEVELS".
  - Wil je het spel later bijwerken, dan vervang je gewoon de bestanden in de map.
''')
z='dist/feestrun-jmartens.zip'
with zipfile.ZipFile(z,'w',zipfile.ZIP_DEFLATED) as zf:
    for root,_,files in os.walk('dist/feestrun-jmartens'):
        for f in files:
            p=os.path.join(root,f); zf.write(p,os.path.relpath(p,'dist'))
print('built', os.path.getsize(z))
