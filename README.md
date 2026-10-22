# Bauprojekt-Planer (MVP)

Mobile-first PWA (plain HTML/CSS/JS, no backend) for Holzlisten, Zuschnittoptimierung und Bestellstatus.

- `index.html` – Shell with tab bar (Projekte, Holzliste, Lager, Zuschnitt, Material, Bestellung)
- `css/styles.css` – all styling, colours/sizes as CSS variables in `:root` (Design „Blaupause“)
- `js/optimizer.js` – 1D cutting-stock optimizer (FFD heuristics + downsizing + branch & bound, exact within node limit)
- `js/material.js`, `js/calcs.js` – Mengenrechner (Beton/Putz bzw. alle weiteren)
- `js/app.js` – UI, localStorage (`bauplaner.v1`), JSON export/import, order text
- `sw.js`, `manifest.json`, `icons/` – offline + home screen
- `test/optimizer.test.js` – `npm test` (node --test)

Run locally: `python3 -m http.server 8765` → http://127.0.0.1:8765/
Kerf model: n Teile auf einer Stange brauchen n−1 Schnitte; plus ein Schnitt zum Reststück, falls Rest > 0.

## Beton & Putz

Mengenrechner pro Projekt (gespeichert in `project.materials`, im JSON-Export enthalten):

- **Beton**: Loch rund (Ø, Tiefe) oder eckig (L × B × T) mit Anzahl, oder Fläche/Platte/Streifenfundament (L × B oder m², Dicke).
  Ergebnis in m³ und Litern inkl. Zuschlag (Standard 10 %), dazu wahlweise:
  - Fertig-/Trockenbeton in Säcken (Standard 25 kg ≈ 13 l, Vorlagen 30 kg ≈ 13 l und 40 kg ≈ 20 l, frei änderbar)
  - selbst mischen mit Zement : Kiessand = 1 : x nach Raumteilen (kg Zement, Zementsäcke, m³ und kg Kiessand)
  - Transportbeton in m³ mit optionalem Preis pro m³
- **Putz**: Wand (L × H) minus Öffnungen oder Fläche direkt, Putzdicke in mm, Verbrauch in kg/m²/mm mit Vorlagen
  (Kalkzementputz 1,4 · Kalkputz 1,3 · Gipsputz 0,8 · Lehmputz 1,5), Zuschlag, Sackgröße und Preis.
- Gleiche Säcke aus mehreren Einträgen werden in der **Bestellung** zusammengefasst und aufgerundet. Sie haben einen eigenen Status und erscheinen im Anfragetext.

Die Quellen für alle Richtwerte stehen im Kopf von `js/material.js`. Die Tests liegen in `test/material.test.js`.

## Material-Rechner (Tab „Material“)

Über „Material berechnen“ öffnet sich eine Auswahl, nach Kategorien gruppiert:

- **Rohbau & Mörtel:** Beton, Putz (unverändert), **Mauerwerk**, **Estrich**
- **Innenausbau:** **Fliesen**, **Trockenbau**, **Dämmung**, **Farbe / Lasur**
- **Außen & Dach:** **Schüttgut**, **Pflaster / Platten**, **Dach**
- **Sonstiges:** **Freie Position**

Was die neuen Rechner können:

- **Mauerwerk:** L × H minus Öffnungen, Stein-Vorlagen (Porenbeton, KS 2 DF/3 DF, Planziegel, Schalungsstein) mit St./m², Steinanzahl und Mörtelsäcken. Der Füllbeton von Schalsteinen landet auf derselben Sackposition wie der Beton-Rechner.
- **Estrich:** Fläche × Dicke × kg/m²/mm, ergibt die Säcke.
- **Fliesen:** Verschnitt 10 % (gerade) oder 15 % (diagonal), Pakete, Kleber nach Zahnung, Fugenmasse nach der Formel (A+B)/(A·B)·b·t·K.
- **Trockenbau:** Wand oder Decke, GK-Platten 1250×2000/2600, CW/UW mit 62,5 cm Achsabstand bzw. CD/UD, Schrauben, Spachtel, Fugenband.
- **Dämmung:** m², m³, Pakete.
- **Farbe / Lasur:** l/m² × Anstriche, ergibt die Gebinde.
- **Schüttgut:** m³ inkl. Verdichtung, Tonnen lose oder Big Bags.
- **Pflaster:** m², Splittbettung in t, Fugensand-Säcke.
- **Dach:** Platten mit Überlappung und Schrauben, oder Folie in Rollen.
- **Freie Position:** Menge mit Einheit (Stk, Pck, m, m², kg, l, …) und Preis.

Alle Vorgaben sind im Editor änderbar und Preise sind optional. Die Ergebnisse fließen in die **Bestellung** (Status, Abschnitt „Material:“ im Anfragetext). Gleiche Positionen werden zusammengefasst.
Die Quellen für alle Richtwerte stehen im Kopf von `js/calcs.js` (neue Rechner) und `js/material.js` (Beton/Putz). Die Tests liegen in `test/calc.test.js`.
Ältere Einträge ohne `kind` werden beim Laden als Beton übernommen.

## Design „Blaupause“

Das Design ist Variante 2 von Design Dirk: dunkles Blaupausen-Raster mit Neon-Akzenten.

- **Farben:** Hintergrund `#0A1224` mit Flächen `#111C33` und `#1A2A4D`, Text `#E8F0FF`. Die Akzente sind Cyan `#22E4FF`, Magenta `#FF3DCB`, Lime `#B6FF3B`, Amber `#FFB020` und Violett `#9B7BFF`.
- **Schriften:** Space Grotesk für Überschriften und Text, JetBrains Mono für Maße. Beide liegen selbst gehostet in `fonts/` (SIL OFL 1.1, siehe `fonts/OFL-*.txt`), nur als Latin-Subset.
- Icons und `manifest.json` stammen aus v2 (`short_name` „Bauprojekt-Planer“).

## Service Worker / Updates

`sw.js` arbeitet mit einem versionierten Cache (`bauplaner-vN`) und `skipWaiting` + `clients.claim`. Seitenaufrufe holen zuerst aus dem Netz (network-first), Assets kommen aus dem Cache.
Wird ein neuer Service Worker aktiv, zeigt die App oben „Update verfügbar“ mit einem Button „Neu laden“.
Bei jeder Änderung an den Assets muss `CACHE` in `sw.js` hochgezählt werden.
