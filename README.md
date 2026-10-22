# Bauprojekt-Planer (MVP)

Mobile-first PWA (plain HTML/CSS/JS, no backend) for Holzlisten, Zuschnittoptimierung und Bestellstatus.

- `index.html` – Shell with tab bar (Projekte, Stückliste, Lager, Zuschnitt, Bestellung)
- `css/styles.css` – all styling, colours/sizes as CSS variables in `:root` (placeholder design)
- `js/optimizer.js` – 1D cutting-stock optimizer (FFD heuristics + downsizing + branch & bound, exact within node limit)
- `js/app.js` – UI, localStorage (`bauplaner.v1`), JSON export/import, order text
- `sw.js`, `manifest.json`, `icons/` – offline + home screen
- `test/optimizer.test.js` – `npm test` (node --test)

Run locally: `python3 -m http.server 8765` → http://127.0.0.1:8765/
Kerf model: n Teile auf einer Stange brauchen n−1 Schnitte; plus ein Schnitt zum Reststück, falls Rest > 0.

## Beton & Putz (Tab „Material“)

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

## Design „Holzwerk“

Das Design ist Variante 3 von Design Dirk:

- **Farben:** Tannengrün `#0E8A5F`, Koralle `#FF5A36`, Eiche `#C98B4E`, Ahorn `#E8B66A`, Nuss `#8A5A34` und Creme `#FBF5EC`.
- **Schriften:** Bricolage Grotesque, DM Sans und DM Mono. Sie liegen selbst gehostet in `fonts/` (SIL OFL 1.1, siehe `fonts/OFL-*.txt`), damit die App offline funktioniert.
