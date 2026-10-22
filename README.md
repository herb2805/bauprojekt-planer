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
- **Trockenbau:** Wand oder Decke, GK-Platten 1250×2000/2600, Spachtel, Fugenband. Unterkonstruktion wählbar:
  - **Metall** (Standard, auch für alte Einträge): CW/UW mit 62,5 cm Achsabstand bzw. CD/UD; Schnellbauschrauben **Feingewinde** 3,5×25 (2-lagig 3,5×35).
  - **Holz:** Wand mit Kantholz 60×60 / 40×60 / 60×80 mm (oder eigener Querschnitt), Achsabstand 62,5 cm, Schwelle oben + unten; Decke mit Traglattung 24×48 / 30×50 mm, Achsabstand 50 cm (12,5 mm quer), optional Grund- + Traglattung (Grundlatte 80 cm, Kreuzungspunkte mit 4,3×55 verschraubt). Ausgabe in lfm und Stück bei einstellbarer Lieferlänge (Kantholz 5 m, Latten 4 m); Schnellbauschrauben **Grobgewinde** 3,9×35 (2-lagig 3,9×45).
  - Optional **Befestigung UK** (Schrauben + Dübel je m Anschluss, Paketgröße).
  - Quellen: DIN 18181 (max. UK-Abstände), Knauf W111 / D111 Systemblätter, Knauf „Montage- und Befestigungstechnik“ (Schraubentypen, Eindringtiefe) – siehe Kommentare in `js/calcs.js`.
- **Dämmung:** m², m³, Pakete.
- **Farbe / Lasur:** l/m² × Anstriche, ergibt die Gebinde.
- **Schüttgut:** m³ inkl. Verdichtung, Tonnen lose oder Big Bags.
- **Pflaster / Platten:** Stückzahl aus Format + Fuge: St./m² = 1 ÷ ((L + Fuge) × (B + Fuge)), Gesamtstück inkl. Verschnitt (aufgerundet). Presets Rechteckpflaster 20×10 / 24×16, Quadratpflaster 14×14 / 20×20, Terrassenplatten 40×40, 50×50, 60×30, 60×60, 80×40, 100×50 oder eigenes Maß; Fuge Standard 4 mm (3–5 mm). Optional Herstellerwert „St./m²“ (z. B. Verbundpflaster) und Palette (m² oder Stk) → Anzahl Paletten. Preis je Stück oder je m². Dazu Splittbettung in t und Fugensand (automatisch aus Format/Fuge/Dicke). Bestellung z. B. „990 Stk Rechteckpflaster 20×10×8 cm (≈ 21,0 m²)“. Alte Einträge ohne Format bleiben m²-basiert.
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
