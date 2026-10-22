/*
 * Bauprojekt-Planer – weitere Mengenrechner (Mauerwerk, Estrich, Fliesen, Trockenbau, Dämmung,
 * Farbe/Lasur, Schüttgut, Pflaster, Dach, Freie Position).
 * Pure functions, browser (window.Calcs) + Node (module.exports). Beton & Putz bleiben in material.js.
 *
 * Alle Vorgaben sind Richtwerte (Stand Okt. 2026) und im Editor änderbar. Quellen:
 *
 * MAUERWERK
 *  - Porenbeton Planblock 599×249 mm: 6,7 St./m²; Dünnbettmörtel ca. 2,2 kg/m² (17,5 cm), 2,9 kg/m² (24 cm),
 *    1,6 kg/m² (11,5 cm) – Xella Ytong Silka Baubuch, 6. Aufl., S. 103, Tabelle 1
 *    https://technik.xella.de/media/books/baubuch/103/
 *  - Porenbeton Planstein 599×199 mm: 1 / (0,6 m × 0,2 m Raster) ≈ 8,4 St./m²; Dünnbettmörtel ca. 0,25 kg je Stein bei
 *    11,5 cm (Ytong FIX N 241 Datenblatt, Tabelle Verbrauch pro Stein) → ≈ 2,1 kg/m²; 25 kg Sack ≈ 20 l
 *    https://technik.xella.de/media/ressources/ytong/technische-produktdatenblaetter/Ytong-Duennbettmoertel-N241.pdf
 *    https://www.deutschland-rechner.de/porenbeton-rechner (8,4 St./m², Formel Wandfläche × St./m² × (1 + Verschnitt))
 *  - Kalksandstein 2 DF (240×115×113, Wand 11,5 cm): 32 St./m², 17 l Normalmauermörtel/m²;
 *    3 DF (240×175×113, Wand 17,5 cm): 32 St./m², 26 l/m² – Kalksandstein „Kompaktes Wissen“
 *    https://www.kalksandstein.de/media/08_downloadcenter/kompaktes_wissen_2025.pdf
 *    Trockenmörtel: SAKRET Mauermörtel „ca. 35 kg/m² bei Steinformat 2 DF“ (≈ 2 kg Trockenmörtel je l Frischmörtel,
 *    daraus 3 DF: 26 l ≈ 52 kg/m²) – SAKRET DIY-Produktkatalog
 *    https://www.sakret.de/download-files/DIY/Produktkatalog/SAKRET-DIY-Produktkatalog-2021.pdf
 *  - Hochlochziegel Planziegel 248×175×249: 1 / (0,25 × 0,25) = 16 St./m²; Dünnbettmörtel Faustwert
 *    ≈ 0,8 kg/m² je 100 mm Wanddicke → 1,4 kg/m² (deutschland-rechner.de, s. o.; Wienerberger liefert den
 *    Mörtel meist passend mit)
 *  - Schalungsstein 500×175×250: 8 St./m², ca. 11 l Füllbeton je Stein ≈ 90 l/m² (KANN Schalungsstein-Datenblatt)
 *    https://behling-baustoffe.de/media/d4/d7/5b/1749647198/KANN_Schalungsstein_Datenblatt_125.pdf
 *  - Verschnitt 5 % (deutschland-rechner.de Porenbeton-Rechner, Voreinstellung)
 *
 * ESTRICH
 *  - Zementestrich / Beton-Estrich: ca. 2 kg/m² je mm, 40 kg Sack – SAKRET Beton-Estrich TM
 *    https://www.sakret.de/product-files/documents/tm-sakret-diy-beton-estrich-de-2022-11-30.pdf
 *    (SAKRET ZE: 30 kg ≈ 15 l ≈ 0,38 m² bei 40 mm → ebenfalls ≈ 2 kg/m²/mm,
 *    https://www.rygol-sakret.de/fileadmin/user_upload/tm/tm_zementestrich_ze.pdf)
 *  - Schnellestrich: ca. 1,8 kg/m² je mm, 30 kg Sack – SAKRET DIY-Produktkatalog (s. o.)
 *
 * FLIESEN
 *  - Verschnitt gerade 10 %, diagonal 15 % (übliche Faustwerte, im Editor änderbar)
 *  - Fliesenkleber je Zahnung: 4 mm 1,5 · 6 mm 2,0 · 8 mm 2,8 · 10 mm 3,6 kg/m² – BAUVISTA professional Flexkleber C2TE,
 *    Technisches Merkblatt; Vergleich SAKRET Fliesenkleber 1,8/2,3/2,8 kg/m² (4/6/8 mm)
 *    https://www.sakret.de/product-files/documents/tm-sakret-diy-fliesenkleber-de-2023-06-02.pdf
 *  - Fugenmörtel kg/m² = (A + B) / (A × B) × Fugenbreite × Fugentiefe × K, A/B/Breite/Tiefe in mm, K ≈ 1,6
 *    (typisch zementär) – z. B. https://roomcalcs.com/de/fugenmoertel-rechner/ ,
 *    https://naruservice.com/de/articles/fugenmoertel-verbrauch-berechnen (300×300, 3 mm, 8 mm → 0,256 kg/m²)
 *
 * TROCKENBAU (Knauf W111 – Metallständerwand, je Seite eine Lage 12,5 mm)
 *  - je m² Wand: 2,0 m² Platte, 2,0 m CW, 0,7 m UW, ca. 29 Schnellbauschrauben TN 3,5×25, 0,5 kg Uniflott,
 *    1,5 m Fugendeckstreifen → je m² Beplankung/Seite: ≈ 15 Schrauben, 0,25 kg Spachtel, 0,75 m Fugenband
 *    (doppellagig 0,8 statt 0,5 kg Spachtel → Faktor 1,6) – Knauf W11 Systemblatt / Zusammenfassung
 *    https://www.bauboss24.de/pages/trockenbau-rechner
 *  - CW-Achsabstand 62,5 cm (halbe Plattenbreite), + 1 Endständer; UW oben + unten über die Wandlänge
 *  - Decke: Tragprofil CD Achsabstand 50 cm (Knauf D112 für 12,5 mm, quer montiert), UD umlaufend; Abhänger/
 *    Grundprofile sind nicht enthalten (Unterkonstruktion nach Systemblatt planen)
 *
 *  - Holz-Unterkonstruktion: max. Achsabstände der UK für 12,5 mm Gipsplatten nach DIN 18181 (Tab. 2):
 *    Wand 625 mm; Decke 500 mm bei Platten quer zur UK (420 mm längs). Holzständerwand Knauf W111 (Kantholz ≥ 60×60,
 *    Achse 625 mm, Schwelle oben/unten) – Knauf W11.de Technische Information
 *    https://knauf.com/de-DE/p/system/w11-de-metall-und-holzstaenderwaende
 *    Holzdecke Knauf D111 (Traglatte quer, Achse 500 mm; Grund- + Traglatte ≥ 50×30, Achse Grundlatte 500–1200 mm je
 *    Abhängerabstand, z. B. 800 mm → Abhänger 1050 mm bei ≤ 0,15 kN/m²; Grund-/Traglatte mit TN 4,3×55 verschraubt)
 *    https://media.knauf.com/a/LKcHZoUu79sMenFwmpe4G5 (D11.ch Technische Information); Vorgabe Grundlatte 80 cm.
 *  - Schrauben: Feingewinde TN 3,5×25/35 für Metall-UK bis 0,7 mm, Grobgewinde TN 3,9×35/45/55 für Holz-UK; Eindringtiefe
 *    Metall ≥ 10 mm, Holz ≥ 19 mm (Knauf DIY „Montage- und Befestigungstechnik“; toom/Knauf Datenblatt Schnellbauschrauben,
 *    Grobgewinde 250 Stk/Pck) https://knauf.com/de-DE/kunden-gruppe/diy/anleitungen/trockenbau-basiswissen/montage-und-befestigungstechnik
 *  - Befestigung UK (Dübel/Schrauben je m Anschluss) ohne Vorgabe; Knauf: Anschlussprofile mit Abstand ≤ 1 m befestigen
 *
 * DÄMMUNG – Packungsinhalt (m²/Paket) steht auf dem Etikett; Vorgabe 5 m² ist nur ein Platzhalter. Verschnitt 5 %
 *    (https://www.hanitools.de/trockenbau-rechner: „Wandfläche + 5 % Verschnitt“).
 *
 * FARBE / LASUR
 *  - Wandfarbe innen ca. 165 ml/m² je Anstrich (Alpina Universal Decken- und Wandfarbe, TI)
 *    https://alpina-farben.de/fileadmin/InterfaceAssets/assets/pdf/TI_3347420250522.pdf
 *  - Holzlasur ca. 75 ml/m² je Anstrich (Alpina Universal-Lasur, TI)
 *    https://alpina-farben.de/fileadmin/InterfaceAssets/assets/pdf/TI_23850_Alpina_Universal-Lasur_CH_DE.pdf
 *
 * SCHÜTTGUT (lose Schüttdichte)
 *  - Schotter 0/32 ≈ 1,7 t/m³, Kies 16/32 ≈ 1,78 t/m³, Splitt 2/5 ≈ 1,5 t/m³ (1,45–1,70), Sand 0/2 ≈ 1,5 t/m³
 *    https://rechner-info.de/einheiten/schuettgewicht-rechner , https://rechner-info.de/garten/kies-schotter-rechner
 *  - Big Bag 1 t; Verdichtungszuschlag 20 % ist eine Annahme (Tragschichten verdichten je nach Material um 15–30 %)
 *
 * PFLASTER
 *  - Bettung Splitt 0/5, 4 cm im verdichteten Zustand (DIN 18318; Lithonplus Verlegehinweise)
 *    https://www.lithon.de/mein-zuhause/service/verlegehinweise/pflastersteine-verlegen
 *  - Fugensand ca. 5 kg/m² (≈ 5,6 kg/m² bei 20×10 cm, 3 mm Fuge, 8 cm Steinhöhe – https://rechner-werk.de/pflasterfugen-rechner/);
 *    ohne Eingabe automatisch: (A + B) / (A × B) × Fuge × Höhe × 1,55 kg/l (A, B, Fuge, Höhe in mm)
 *  - Steine/Platten je m² = 1 / ((L + Fuge) × (B + Fuge)); Fugenbreite Pflaster 3–5 mm nach DIN 18318 → Vorgabe 4 mm.
 *    Verbundpflaster/Mehrsteinsysteme: St./m² laut Hersteller eintragen (überschreibt die Formel).
 *  - Paletten: m²/Palette oder St./Palette laut Hersteller (Datenblatt), keine Vorgabe
 *
 * DACH
 *  - Trapezblech: 6–8 Befestigungsschrauben/m² + 2–3 Überlappungsschrauben/m² → Vorgabe 8/m²
 *    https://www.dwz-shop.de/montageanleitungen/profilbleche/trapezblech-verlegen
 *  - Unterspannbahn/Folie: Rolle 1,5 × 50 m = 75 m², Überlappung ca. 10 % (Annahme, ≈ 10–15 cm je 1,5 m Bahn)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Calcs = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const n = v => { const x = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.')); return isFinite(x) ? x : 0; };
  const pos = v => Math.max(0, n(v));
  const ceilN = x => (x <= 1e-9 ? 0 : Math.ceil(x - 1e-9));
  const price = v => (v === null || v === undefined || v === '' || !isFinite(n(v))) ? null : n(v);
  const pct = (v, d) => (v === null || v === undefined || v === '') ? d : pos(v);
  const f = (x, d = 2) => (Math.round(x * 10 ** d) / 10 ** d).toLocaleString('de-DE', { maximumFractionDigits: d });

  /** Fläche: Maße (Länge × Breite/Höhe in m) minus Öffnungen, oder direkt m². */
  function area(e, second = 'width') {
    if (e.mode === 'direkt') return { gross: pos(e.area), openings: 0, net: pos(e.area) };
    const gross = pos(e.length) * pos(e[second]);
    const openings = (e.openings || []).reduce((s, o) => s + pos(o.width) * pos(o.height) * Math.max(0, Math.round(n(o.qty ?? 1))), 0);
    return { gross, openings, net: Math.max(0, gross - openings) };
  }
  const areaText = (e, a, second = 'width') => e.mode === 'direkt' ? `${f(a.net)} m²`
    : `${f(pos(e.length))} × ${f(pos(e[second]))} m${a.openings ? ` − ${f(a.openings)} m² Öffn.` : ''} = ${f(a.net)} m²`;

  function line(key, label, unit, exact, unitPrice, continuous = false) {
    return { key, label, unit, exact, qty: continuous ? exact : ceilN(exact), unitPrice, continuous };
  }
  function finish(r) {
    let cost = 0, any = false;
    for (const l of r.lines) if (l.unitPrice != null && l.qty > 0) { cost += l.qty * l.unitPrice; any = true; }
    r.cost = any ? cost : null;
    return r;
  }

  // ---------- presets ----------
  const STONES = [
    { id: 'pb-249-175', label: 'Porenbeton Planblock 599×175×249', short: 'Porenbeton PB 17,5', perM2: 6.7, mortar: 'duenn', mortarKgPerM2: 2.2, mortarBagKg: 25, fillLPerM2: 0 },
    { id: 'pb-249-240', label: 'Porenbeton Planblock 599×240×249', short: 'Porenbeton PB 24', perM2: 6.7, mortar: 'duenn', mortarKgPerM2: 2.9, mortarBagKg: 25, fillLPerM2: 0 },
    { id: 'pb-199-115', label: 'Porenbeton Planstein 599×115×199', short: 'Porenbeton PP 11,5', perM2: 8.4, mortar: 'duenn', mortarKgPerM2: 2.1, mortarBagKg: 25, fillLPerM2: 0 },
    { id: 'ks-2df', label: 'Kalksandstein 2 DF 240×115×113', short: 'KS 2 DF', perM2: 32, mortar: 'normal', mortarKgPerM2: 35, mortarBagKg: 25, fillLPerM2: 0 },
    { id: 'ks-3df', label: 'Kalksandstein 3 DF 240×175×113', short: 'KS 3 DF', perM2: 32, mortar: 'normal', mortarKgPerM2: 52, mortarBagKg: 25, fillLPerM2: 0 },
    { id: 'hlz-175', label: 'Hochlochziegel Planziegel 248×175×249', short: 'Planziegel 17,5', perM2: 16, mortar: 'duenn', mortarKgPerM2: 1.4, mortarBagKg: 25, fillLPerM2: 0 },
    { id: 'schal-175', label: 'Schalungsstein 500×175×250', short: 'Schalstein 17,5', perM2: 8, mortar: 'fill', mortarKgPerM2: 0, mortarBagKg: 25, fillLPerM2: 90 }
  ];
  const ESTRICH_TYPES = [
    { id: 'zement', label: 'Zementestrich / Beton-Estrich', kgPerM2mm: 2.0, bagKg: 40 },
    { id: 'schnell', label: 'Schnellestrich', kgPerM2mm: 1.8, bagKg: 30 }
  ];
  const ZAHNUNG = [{ id: '4', kg: 1.5 }, { id: '6', kg: 2.0 }, { id: '8', kg: 2.8 }, { id: '10', kg: 3.6 }];
  const PAINTS = [
    { id: 'wand', label: 'Wandfarbe innen', lPerM2: 0.165, canL: 10 },
    { id: 'lasur', label: 'Holzlasur', lPerM2: 0.075, canL: 2.5 }
  ];
  const BULK = [
    { id: 'schotter', label: 'Schotter 0/32', density: 1.7 },
    { id: 'kies', label: 'Kies 16/32', density: 1.78 },
    { id: 'splitt', label: 'Splitt 2/5', density: 1.5 },
    { id: 'sand', label: 'Sand 0/2', density: 1.5 }
  ];
  const UNITS = ['Stk', 'Pck', 'm', 'm²', 'kg', 'l', 'Sack'];
  const CONT_UNITS = ['m', 'm²', 'kg', 'l'];

  // ---------- field helpers for the generic editor ----------
  const num = (k, label, unit, extra = {}) => ({ t: 'num', f: k, label, unit, ...extra });
  const row = (...items) => ({ t: 'row', items });
  // Holz-UK: Stückzahl bei Lieferlänge S für `rows` Läufe der Länge X. Passt X in S, werden mehrere Läufe aus einer
  // Stange geschnitten (floor(S/X) je Stange); längere Läufe werden gestoßen (Stoß auf Unterkonstruktion) mit
  // 10 % Zuschlag für Stoß/Verschnitt (Annahme).
  const WOOD_JOIN_WASTE = 0.10;
  function woodPieces(rows, X, S) {
    if (!(rows > 0) || !(X > 0) || !(S > 0)) return 0;
    if (X <= S + 1e-9) return ceilN(rows / Math.floor(S / X + 1e-9));
    return ceilN(rows * X * (1 + WOOD_JOIN_WASTE) / S);
  }
  // Pflaster/Platten-Formate (L × B × D in cm, Fuge in mm). Fuge Pflaster 3–5 mm (DIN 18318), Platten 3–5 mm
  // (Fugenkreuze); Vorgabe 4 mm. Werte sind Nennmaße, Hersteller-St./m² können abweichen.
  const PAVERS = [
    { id: 'rp-20x10', label: 'Rechteckpflaster 20×10×8', product: 'Rechteckpflaster', l: 20, w: 10, t: 8, fuge: 4 },
    { id: 'rp-24x16', label: 'Rechteckpflaster 24×16×8', product: 'Rechteckpflaster', l: 24, w: 16, t: 8, fuge: 4 },
    { id: 'qp-14x14', label: 'Quadratpflaster 14×14×8', product: 'Quadratpflaster', l: 14, w: 14, t: 8, fuge: 4 },
    { id: 'qp-20x20', label: 'Quadratpflaster 20×20×8', product: 'Quadratpflaster', l: 20, w: 20, t: 8, fuge: 4 },
    { id: 'tp-40x40', label: 'Terrassenplatte 40×40×4', product: 'Terrassenplatte', l: 40, w: 40, t: 4, fuge: 4 },
    { id: 'tp-50x50', label: 'Terrassenplatte 50×50×5', product: 'Terrassenplatte', l: 50, w: 50, t: 5, fuge: 4 },
    { id: 'tp-60x30', label: 'Terrassenplatte 60×30×4', product: 'Terrassenplatte', l: 60, w: 30, t: 4, fuge: 4 },
    { id: 'tp-60x60', label: 'Terrassenplatte 60×60×4', product: 'Terrassenplatte', l: 60, w: 60, t: 4, fuge: 4 },
    { id: 'tp-80x40', label: 'Terrassenplatte 80×40×4', product: 'Terrassenplatte', l: 80, w: 40, t: 4, fuge: 4 },
    { id: 'tp-100x50', label: 'Terrassenplatte 100×50×4', product: 'Terrassenplatte', l: 100, w: 50, t: 4, fuge: 4 }
  ];
  // Fugensand kg/m² = (A + B) / (A × B) × Fugenbreite × Steinhöhe × 1,55 kg/l (A, B, Fuge, Höhe in mm) –
  // gleiche Formel wie Fugenmörtel; ergibt 5,6 kg/m² bei 20×10×8 cm, 3 mm (vgl. rechner-werk.de Pflasterfugen-Rechner)
  const SAND_DENSITY = 1.55;
  function paverGeom(e) {
    const L = pos(e.fmtL), W = pos(e.fmtW), T = pos(e.fmtT), fu = pos(e.fuge);
    const manual = pos(e.perM2) > 0;
    const hasSize = L > 0 && W > 0;
    const perM2 = manual ? pos(e.perM2) : hasSize ? 1 / ((L / 100 + fu / 1000) * (W / 100 + fu / 1000)) : 0;
    const prod = (e.product || 'Pflaster').trim();
    const size = hasSize ? `${f(L, 1)}×${f(W, 1)}${T > 0 ? '×' + f(T, 1) : ''} cm` : '';
    const label = size && !prod.includes(size.replace(' cm', '')) ? `${prod} ${size}` : prod;
    const key = hasSize ? `${prod}|${L}x${W}x${T}|${manual ? 'm' + pos(e.perM2) : 'f' + fu}` : `${prod}|m${pos(e.perM2)}`;
    const sandAuto = hasSize && fu > 0 ? (L * 10 + W * 10) / (L * 10 * W * 10) * fu * (T > 0 ? T * 10 : 80) * SAND_DENSITY : null;
    return { perM2, manual, label, key, sandAuto };
  }
  const priceRow = (...items) => ({ t: 'row', items: items.map(([k, label, unit]) => num(k, label, unit, { ph: '–' })), price: true });
  const areaFields = (second, secondLabel, withOpenings) => [
    { t: 'seg', f: 'mode', opts: [['mass', withOpenings ? `L × ${secondLabel[0]} − Öffnungen` : `Länge × ${secondLabel}`], ['direkt', 'Fläche direkt']] },
    row(num('length', 'Länge', 'm', { show: d => d.mode !== 'direkt' }), num(second, secondLabel, 'm', { show: d => d.mode !== 'direkt' }),
      num('area', 'Fläche', 'm²', { show: d => d.mode === 'direkt' })),
    ...(withOpenings ? [{ t: 'openings', show: d => d.mode !== 'direkt' }] : [])
  ];
  const areaDefaults = second => ({ mode: 'mass', length: '', [second]: '', area: '', openings: [] });

  // ---------- calculators ----------
  const CALCS = {
    mauer: {
      cat: 'rohbau', label: 'Mauerwerk', sub: 'Steine & Mörtel', ph: 'z. B. Gartenmauer',
      defaults: () => ({ ...areaDefaults('height'), stone: STONES[0].id, ...stoneFields(STONES[0]), waste: 5, stonePrice: '', mortarBagPrice: '', fillBagPrice: '' }),
      fields: () => [
        ...areaFields('height', 'Höhe', true),
        { t: 'select', f: 'stone', label: 'Steinformat', opts: [...STONES.map(s => [s.id, `${s.label} · ${f(s.perM2, 1)} St./m²`]), ['eigen', 'Eigenes Format']] },
        row(num('perM2', 'Steine', 'St./m²'), num('waste', 'Verschnitt', '%')),
        { t: 'seg', f: 'mortar', opts: [['duenn', 'Dünnbett'], ['normal', 'Normalmörtel'], ['fill', 'Füllbeton']] },
        row(num('mortarKgPerM2', 'Mörtel', 'kg/m²', { show: d => d.mortar !== 'fill' }), num('mortarBagKg', 'Sack', 'kg', { show: d => d.mortar !== 'fill' }),
          num('fillLPerM2', 'Füllbeton', 'l/m²', { show: d => d.mortar === 'fill' })),
        { t: 'note', text: d => d.mortar === 'fill' ? 'Füllbeton wird als Fertigbeton 25 kg (≈ 13 l) gerechnet.' : 'Richtwerte nach Herstellerangaben (Xella/Ytong, Kalksandstein, SAKRET).' },
        priceRow(['stonePrice', 'Preis/Stein', '€'], ['mortarBagPrice', 'Preis/Sack', '€'])
      ],
      onSelect(d, k, v) { if (k === 'stone') { const s = STONES.find(x => x.id === v); if (s) Object.assign(d, stoneFields(s)); else d.stoneLabel = d.stoneLabel || 'Mauerstein'; } },
      describe: e => `${areaText(e, area(e, 'height'), 'height')} · ${e.stoneLabel || 'Mauerstein'}`,
      compute(e) {
        const a = area(e, 'height'), w = pct(e.waste, 5) / 100, lbl = (e.stoneLabel || 'Mauerstein').trim();
        const stonesExact = a.net * pos(e.perM2) * (1 + w);
        const r = { area: a, net: a.net, stonesExact, stones: ceilN(stonesExact), lines: [], info: [] };
        r.lines.push(line(`stein|${lbl}`, lbl, 'Stk', stonesExact, price(e.stonePrice)));
        if (e.mortar === 'fill') {
          r.fillL = a.net * pos(e.fillLPerM2) * (1 + w);
          r.lines.push(line('beton-sack|25|13', 'Fertigbeton 25 kg (≈ 13 l)', 'Sack', r.fillL / 13, price(e.fillBagPrice)));
          r.info.push(`Füllbeton ${f(r.fillL / 1000, 3)} m³ ≈ ${ceilN(r.fillL / 13)} Sack Fertigbeton 25 kg`);
        } else {
          const bag = pos(e.mortarBagKg) || 25;
          r.mortarKg = a.net * pos(e.mortarKgPerM2) * (1 + w);
          r.mortarBags = ceilN(r.mortarKg / bag);
          r.lines.push(line(`moertel|${e.mortar}|${bag}`, `${e.mortar === 'duenn' ? 'Dünnbettmörtel' : 'Mauermörtel'} ${f(bag)} kg`, 'Sack', r.mortarKg / bag, price(e.mortarBagPrice)));
          r.info.push(`${e.mortar === 'duenn' ? 'Dünnbettmörtel' : 'Mauermörtel'} ${f(r.mortarKg, 1)} kg → ${r.mortarBags} Sack à ${f(bag)} kg`);
        }
        r.big = `${r.stones} Steine`; r.sub = `${f(a.net)} m² × ${f(pos(e.perM2), 1)} St./m² + ${f(w * 100, 0)} %`;
        r.side = { n: e.mortar === 'fill' ? ceilN(r.fillL / 13) : r.mortarBags, label: e.mortar === 'fill' ? 'Sack Fertigbeton' : `Sack Mörtel à ${f(pos(e.mortarBagKg) || 25)} kg` };
        return finish(r);
      }
    },
    estrich: {
      cat: 'rohbau', label: 'Estrich', sub: 'Zement-/Schnellestrich', ph: 'z. B. Kellerboden',
      defaults: () => ({ ...areaDefaults('width'), thickness: 50, type: 'zement', kgPerM2mm: 2.0, bagKg: 40, waste: 5, bagPrice: '' }),
      fields: () => [
        ...areaFields('width', 'Breite', false),
        { t: 'select', f: 'type', label: 'Estrich', opts: [...ESTRICH_TYPES.map(t => [t.id, `${t.label} (${f(t.kgPerM2mm, 1)} kg/m²/mm)`]), ['eigen', 'Eigene Angabe']] },
        row(num('thickness', 'Dicke', 'mm'), num('kgPerM2mm', 'Verbrauch', 'kg/m²/mm')),
        row(num('waste', 'Zuschlag', '%'), num('bagKg', 'Sack', 'kg')),
        { t: 'note', text: () => 'SAKRET: Verbundestrich 30–60 mm, auf Dämmschicht ab 40–45 mm.' },
        priceRow(['bagPrice', 'Preis/Sack', '€'])
      ],
      onSelect(d, k, v) { if (k === 'type') { const t = ESTRICH_TYPES.find(x => x.id === v); if (t) Object.assign(d, { kgPerM2mm: t.kgPerM2mm, bagKg: t.bagKg }); } },
      describe: e => `${areaText(e, area(e))} · ${f(pos(e.thickness), 0)} mm · ${(ESTRICH_TYPES.find(t => t.id === e.type) || { label: 'Estrich' }).label}`,
      compute(e) {
        const a = area(e), w = pct(e.waste, 5) / 100, bag = pos(e.bagKg) || 40;
        const t = ESTRICH_TYPES.find(x => x.id === e.type);
        const kg = a.net * pos(e.thickness) * pos(e.kgPerM2mm) * (1 + w);
        const r = { net: a.net, kg, bags: ceilN(kg / bag), lines: [], info: [] };
        r.lines.push(line(`estrich|${e.type}|${bag}`, `${t ? t.label : 'Estrich'} ${f(bag)} kg`, 'Sack', kg / bag, price(e.bagPrice)));
        r.big = `${f(kg, 0)} kg`; r.sub = `${f(a.net)} m² × ${f(pos(e.thickness), 0)} mm × ${f(pos(e.kgPerM2mm), 2)} + ${f(w * 100, 0)} %`;
        r.side = { n: r.bags, label: `Sack à ${f(bag)} kg`, small: `(${f(kg / bag, 2)})` };
        return finish(r);
      }
    },
    fliesen: {
      cat: 'ausbau', label: 'Fliesen', sub: 'Fliesen, Kleber, Fuge', ph: 'z. B. Bad Boden',
      defaults: () => ({ ...areaDefaults('width'), verlegung: 'gerade', waste: 10, tileL: 60, tileW: 30, packM2: 1.44, zahnung: '8', kleberKgPerM2: 2.8, kleberBagKg: 25,
        fugeB: 3, fugeT: 8, fugeK: 1.6, fugeBagKg: 5, matZuschlag: 10, packPrice: '', kleberBagPrice: '', fugeBagPrice: '' }),
      fields: () => [
        ...areaFields('width', 'Breite', false),
        { t: 'seg', f: 'verlegung', opts: [['gerade', 'Gerade (10 %)'], ['diagonal', 'Diagonal (15 %)']] },
        row(num('tileL', 'Fliese L', 'cm'), num('tileW', 'B', 'cm'), num('waste', 'Verschnitt', '%')),
        row(num('packM2', 'Paket', 'm²')),
        { t: 'lbl', text: 'Fliesenkleber' },
        { t: 'seg', f: 'zahnung', opts: ZAHNUNG.map(z => [z.id, `${z.id} mm`]) },
        row(num('kleberKgPerM2', 'Verbrauch', 'kg/m²'), num('kleberBagKg', 'Sack', 'kg')),
        { t: 'lbl', text: 'Fugenmörtel' },
        row(num('fugeB', 'Fugenbreite', 'mm'), num('fugeT', 'Tiefe', 'mm'), num('fugeK', 'Faktor', 'kg/l')),
        row(num('fugeBagKg', 'Sack', 'kg'), num('matZuschlag', 'Zuschlag', '%')),
        { t: 'note', text: () => 'Fuge: (A + B) / (A × B) × Breite × Tiefe × Faktor (Maße in mm). Tiefe ≈ Fliesenstärke.' },
        priceRow(['packPrice', 'Preis/Paket', '€'], ['kleberBagPrice', 'Kleber/Sack', '€'], ['fugeBagPrice', 'Fuge/Sack', '€'])
      ],
      onSet(d, k, v) {
        if (k === 'verlegung') d.waste = v === 'diagonal' ? 15 : 10;
        if (k === 'zahnung') { const z = ZAHNUNG.find(x => x.id === v); if (z) d.kleberKgPerM2 = z.kg; }
      },
      describe: e => `${areaText(e, area(e))} · ${f(pos(e.tileL), 1)} × ${f(pos(e.tileW), 1)} cm ${e.verlegung === 'diagonal' ? 'diagonal' : 'gerade'}`,
      compute(e) {
        const a = area(e), w = pct(e.waste, 10) / 100, mz = pct(e.matZuschlag, 10) / 100;
        const L = pos(e.tileL), W = pos(e.tileW), pack = pos(e.packM2) || 1;
        const m2 = a.net * (1 + w), packs = ceilN(m2 / pack);
        const pieces = L && W ? ceilN(m2 / (L * W / 1e4)) : 0;
        const kleberKg = a.net * pos(e.kleberKgPerM2) * (1 + mz), kb = pos(e.kleberBagKg) || 25;
        const A = L * 10, B = W * 10;
        const fugeKgPerM2 = A && B ? (A + B) / (A * B) * pos(e.fugeB) * pos(e.fugeT) * pos(e.fugeK) : 0;
        const fugeKg = a.net * fugeKgPerM2 * (1 + mz), fb = pos(e.fugeBagKg) || 5;
        const r = { net: a.net, m2, packs, pieces, kleberKg, kleberBags: ceilN(kleberKg / kb), fugeKgPerM2, fugeKg, fugeBags: ceilN(fugeKg / fb), lines: [], info: [] };
        const fmtT = `${f(L, 1)}×${f(W, 1)} cm`;
        r.lines.push(line(`fliesen|${fmtT}|${pack}`, `Fliesen ${fmtT} (${f(pack)} m²/Paket)`, 'Pck', m2 / pack, price(e.packPrice)));
        r.lines.push(line(`kleber|${kb}`, `Fliesenkleber ${f(kb)} kg`, 'Sack', kleberKg / kb, price(e.kleberBagPrice)));
        if (fugeKg > 0) r.lines.push(line(`fuge|${fb}`, `Fugenmörtel ${f(fb)} kg`, 'Sack', fugeKg / fb, price(e.fugeBagPrice)));
        r.big = `${f(m2)} m²`; r.sub = `${f(a.net)} m² + ${f(w * 100, 0)} % Verschnitt · ≈ ${pieces} Fliesen`;
        r.side = { n: packs, label: `Pakete à ${f(pack)} m²` };
        r.info.push(`Kleber (${e.zahnung || '–'} mm Zahnung): ${f(kleberKg, 1)} kg → ${r.kleberBags} Sack à ${f(kb)} kg`);
        r.info.push(`Fugenmörtel: ${f(fugeKgPerM2, 3)} kg/m² → ${f(fugeKg, 1)} kg → ${r.fugeBags} Sack à ${f(fb)} kg`);
        return finish(r);
      }
    },
    trockenbau: {
      cat: 'ausbau', label: 'Trockenbau', sub: 'GK-Platten, Metall- oder Holz-UK', ph: 'z. B. Trennwand Büro',
      defaults: () => ({ mode: 'wand', uk: 'metall', length: '', height: '', width: '', sides: 2, layers: 1, plate: '2000', plateW: 1.25, plateL: 2.0, waste: 10,
        cwAxis: 62.5, cwLen: 2.6, uwLen: 3, cdAxis: 50, cdLen: 4, udLen: 3,
        kantSec: '60x60', kantAxis: 62.5, kantLen: 5, lattSec: '24x48', lattAxis: 50, lattLen: 4, lattDouble: 'nein', grundSec: '30x50', grundAxis: 80, secCustom: '',
        screwsPerM2: 15, screwPack: 1000, fixPerM: '', fixPack: 100, spachtelKgPerM2: 0.25, spachtelBagKg: 5,
        bandMPerM2: 0.75, bandRoll: 50, platePrice: '', profilePrice: '', screwPackPrice: '', fixPackPrice: '', spachtelBagPrice: '', bandRollPrice: '' }),
      fields: () => {
        const holz = d => d.uk === 'holz', metall = d => d.uk !== 'holz', wand = d => d.mode !== 'decke', decke = d => d.mode === 'decke';
        const secOpts = list => [...list.map(x => [x, x.replace('x', ' × ') + ' mm']), ['eigen', 'Eigener Querschnitt']];
        return [
          { t: 'seg', f: 'mode', opts: [['wand', 'Ständerwand'], ['decke', 'Decke']] },
          row(num('length', 'Länge', 'm'), num('height', 'Höhe', 'm', { show: wand }), num('width', 'Breite', 'm', { show: decke })),
          row(num('sides', 'Seiten', '', { show: wand, inputmode: 'numeric' }), num('layers', 'Lagen', '', { inputmode: 'numeric' }), num('waste', 'Verschnitt', '%')),
          { t: 'select', f: 'plate', label: 'Gipskartonplatte 12,5 mm', opts: [['2000', '1250 × 2000 mm (2,5 m²)'], ['2600', '1250 × 2600 mm (3,25 m²)'], ['eigen', 'Eigenes Maß']] },
          row(num('plateW', 'Platte B', 'm'), num('plateL', 'L', 'm')),
          { t: 'lbl', text: 'Unterkonstruktion' },
          { t: 'seg', f: 'uk', opts: [['metall', 'Metall (CW/UW/CD)'], ['holz', 'Holz']] },
          row(num('cwAxis', 'CW-Achse', 'cm', { show: d => metall(d) && wand(d) }), num('cwLen', 'CW-Länge', 'm', { show: d => metall(d) && wand(d) }), num('uwLen', 'UW-Länge', 'm', { show: d => metall(d) && wand(d) }),
            num('cdAxis', 'CD-Achse', 'cm', { show: d => metall(d) && decke(d) }), num('cdLen', 'CD-Länge', 'm', { show: d => metall(d) && decke(d) }), num('udLen', 'UD-Länge', 'm', { show: d => metall(d) && decke(d) })),
          { t: 'select', f: 'kantSec', label: 'Kantholz (Ständer + Schwellen)', opts: secOpts(['60x60', '40x60', '60x80']), show: d => holz(d) && wand(d) },
          { t: 'select', f: 'lattSec', label: 'Traglattung', opts: secOpts(['24x48', '30x50']), show: d => holz(d) && decke(d) },
          { t: 'text', f: 'secCustom', label: 'Querschnitt (mm)', ph: 'z. B. 50x70', show: d => holz(d) && (wand(d) ? d.kantSec === 'eigen' : d.lattSec === 'eigen') },
          row(num('kantAxis', 'Achsabstand', 'cm', { show: d => holz(d) && wand(d) }), num('kantLen', 'Lieferlänge', 'm', { show: d => holz(d) && wand(d) }),
            num('lattAxis', 'Achsabstand', 'cm', { show: d => holz(d) && decke(d) }), num('lattLen', 'Lieferlänge', 'm', { show: d => holz(d) && decke(d) })),
          { t: 'seg', f: 'lattDouble', opts: [['nein', 'Nur Traglattung'], ['ja', 'Grund- + Traglattung']], show: d => holz(d) && decke(d) },
          { t: 'select', f: 'grundSec', label: 'Grundlattung', opts: [['30x50', '30 × 50 mm'], ['40x60', '40 × 60 mm'], ['24x48', '24 × 48 mm']], show: d => holz(d) && decke(d) && d.lattDouble === 'ja' },
          row(num('grundAxis', 'Achse Grundlatte', 'cm', { show: d => holz(d) && decke(d) && d.lattDouble === 'ja' })),
          row(num('screwsPerM2', 'Plattenschrauben', 'St./m²'), num('screwPack', 'Paket', 'Stk')),
          row(num('fixPerM', 'Befestigung UK', 'St./m', { ph: 'opt.' }), num('fixPack', 'Paket', 'Stk')),
          row(num('spachtelKgPerM2', 'Spachtel', 'kg/m²'), num('spachtelBagKg', 'Sack', 'kg')),
          row(num('bandMPerM2', 'Fugenband', 'm/m²'), num('bandRoll', 'Rolle', 'm')),
          { t: 'note', text: d => {
            if (holz(d)) return decke(d) ? 'Holz-UK Decke (Knauf D111, DIN 18181): Traglatten quer zur Platte alle 50 cm (12,5 mm), Grundlatten nach Abhängerabstand. Schrauben mit Grobgewinde.'
              : 'Holzständerwand (Knauf W111): Ständer alle 62,5 cm + Endständer, Schwelle oben und unten. Schrauben mit Grobgewinde.';
            return decke(d) ? 'Decke: CD-Tragprofile + UD umlaufend; Abhänger und Grundprofile nach Knauf-Systemblatt ergänzen.' : 'Knauf W111: CW alle 62,5 cm + Endständer, UW oben und unten. Schrauben mit Feingewinde.';
          } },
          { t: 'note', text: () => 'Befestigung UK: Schrauben + Dübel je m Anschluss (Wand: Schwellen/UW + Randständer; Decke: UD bzw. direkt befestigte Latten), z. B. 1,5 St./m (Abstand ≤ 1 m bzw. nach Abhängerabstand).' },
          priceRow(['platePrice', 'Platte', '€'], ['profilePrice', 'Profil/Holz', '€/Stk'], ['screwPackPrice', 'Schr./Pck', '€']),
          priceRow(['fixPackPrice', 'Dübel/Pck', '€'], ['spachtelBagPrice', 'Spachtel', '€/Sack'], ['bandRollPrice', 'Band', '€/Rolle'])
        ];
      },
      onSelect(d, k, v) { if (k === 'plate' && v !== 'eigen') { d.plateW = 1.25; d.plateL = v === '2600' ? 2.6 : 2.0; } },
      onSet(d, k, v) { if (k === 'uk') d.screwPack = v === 'holz' ? 250 : 1000; },
      describe: e => (e.mode === 'decke' ? `Decke ${f(pos(e.length))} × ${f(pos(e.width))} m · ${pos(e.layers) || 1}-lagig`
        : `Wand ${f(pos(e.length))} × ${f(pos(e.height))} m · ${pos(e.sides) || 1} Seite(n), ${pos(e.layers) || 1}-lagig`) + (e.uk === 'holz' ? ' · Holz-UK' : ''),
      compute(e) {
        const decke = e.mode === 'decke', holz = e.uk === 'holz', L = pos(e.length), H = decke ? pos(e.width) : pos(e.height);
        const A = L * H, sides = decke ? 1 : Math.max(1, Math.round(pos(e.sides) || 1)), layers = Math.max(1, Math.round(pos(e.layers) || 1));
        const w = pct(e.waste, 10) / 100, pw = pos(e.plateW) || 1.25, pl = pos(e.plateL) || 2;
        const board = A * sides * layers, platesExact = board * (1 + w) / (pw * pl);
        const r = { area: A, board, plates: ceilN(platesExact), lines: [], info: [] };
        const pp = price(e.profilePrice);
        r.lines.push(line(`gk|${Math.round(pw * 1000)}x${Math.round(pl * 1000)}`, `Gipskartonplatte 12,5 mm ${Math.round(pw * 1000)}×${Math.round(pl * 1000)}`, 'Stk', platesExact, price(e.platePrice)));
        let fixM = 0;
        if (holz) {
          const secOf = v => (v === 'eigen' ? String(e.secCustom || '').trim() || 'Holz' : String(v || '')).replace(/\s*[x×]\s*/g, '×');
          if (!decke) {
            const axis = (pos(e.kantAxis) || 62.5) / 100, S = pos(e.kantLen) || 5, sec = secOf(e.kantSec || '60x60');
            const studs = L > 0 && H > 0 ? ceilN(L / axis) + 1 : 0;
            const pStuds = woodPieces(studs, H, S), pPlates = woodPieces(L > 0 && H > 0 ? 2 : 0, L, S);
            Object.assign(r, { studs, woodM: studs * H + 2 * L, woodPcs: pStuds + pPlates, woodSec: sec, woodLen: S });
            r.lines.push(Object.assign(line(`kantholz|${sec}|${S}`, `Kantholz ${sec} mm, ${f(S)} m`, 'Stk', r.woodPcs, pp), { lfm: r.woodM }));
            r.info.push(`${studs} Ständer à ${f(H)} m + Schwellen 2 × ${f(L)} m = ${f(r.woodM, 1)} lfm → ${r.woodPcs} Stk à ${f(S)} m`);
            fixM = 2 * L + 2 * H;
          } else {
            const axis = (pos(e.lattAxis) || 50) / 100, S = pos(e.lattLen) || 4, sec = secOf(e.lattSec || '24x48');
            const rows = L > 0 && H > 0 ? ceilN(H / axis) + 1 : 0;
            const pcs = woodPieces(rows, L, S);
            Object.assign(r, { lattRows: rows, woodM: rows * L, woodPcs: pcs, woodSec: sec, woodLen: S });
            r.lines.push(Object.assign(line(`latte|${sec}|${S}`, `Latte ${sec} mm, ${f(S)} m`, 'Stk', pcs, pp), { lfm: r.woodM }));
            r.info.push(`Traglattung: ${rows} Reihen à ${f(L)} m (Achse ${f(axis * 100, 1)} cm) = ${f(r.woodM, 1)} lfm → ${pcs} Stk à ${f(S)} m`);
            fixM = r.woodM;
            if (e.lattDouble === 'ja') {
              const ga = (pos(e.grundAxis) || 80) / 100, gsec = secOf(e.grundSec || '30x50');
              const grows = L > 0 && H > 0 ? ceilN(L / ga) + 1 : 0, gpcs = woodPieces(grows, H, S);
              Object.assign(r, { grundRows: grows, grundM: grows * H, grundPcs: gpcs, crossings: rows * grows });
              const gKey = `latte|${gsec}|${S}`, same = r.lines.findIndex(l => l.key === gKey);
              if (same >= 0) r.lines[same] = Object.assign(line(gKey, r.lines[same].label, 'Stk', pcs + gpcs, pp), { lfm: r.woodM + r.grundM });
              else r.lines.push(Object.assign(line(gKey, `Latte ${gsec} mm, ${f(S)} m`, 'Stk', gpcs, pp), { lfm: r.grundM }));
              r.info.push(`Grundlattung: ${grows} Reihen à ${f(H)} m (Achse ${f(ga * 100, 0)} cm) = ${f(r.grundM, 1)} lfm → ${gpcs} Stk ${gsec} mm`);
              r.lines.push(line('holzschraube|4,3x55|100', 'Holzbauschrauben 4,3×55 (100 Stk, Grund-/Traglatte)', 'Pck', r.crossings / 100, null));
              r.info.push(`${r.crossings} Kreuzungspunkte Grund-/Traglatte → je 1 Schraube 4,3×55`);
              fixM = r.grundM;
            }
          }
        } else if (!decke) {
          const axis = (pos(e.cwAxis) || 62.5) / 100, cwLen = pos(e.cwLen) || 2.6, uwLen = pos(e.uwLen) || 3;
          const studs = L > 0 ? ceilN(L / axis) + 1 : 0;
          r.studs = studs; r.cw = studs * ceilN(H / cwLen); r.uw = ceilN(2 * L / uwLen);
          r.lines.push(line(`cw|${cwLen}`, `CW-Profil ${f(cwLen)} m`, 'Stk', r.cw, pp));
          r.lines.push(line(`uw|${uwLen}`, `UW-Profil ${f(uwLen)} m`, 'Stk', r.uw, pp));
          r.info.push(`${studs} Ständer (Achse ${f(axis * 100, 1)} cm) → ${r.cw} CW à ${f(cwLen)} m · UW ${f(2 * L)} m → ${r.uw} Stk`);
          fixM = 2 * L + 2 * H;
        } else {
          const axis = (pos(e.cdAxis) || 50) / 100, cdLen = pos(e.cdLen) || 4, udLen = pos(e.udLen) || 3;
          const cdM = A / axis; r.cd = ceilN(cdM * (1 + w) / cdLen); r.ud = ceilN(2 * (L + H) / udLen);
          r.lines.push(line(`cd|${cdLen}`, `CD-Profil ${f(cdLen)} m`, 'Stk', r.cd, pp));
          r.lines.push(line(`ud|${udLen}`, `UD-Profil ${f(udLen)} m`, 'Stk', r.ud, pp));
          r.info.push(`CD ${f(cdM, 1)} m (Achse ${f(axis * 100, 0)} cm) → ${r.cd} Stk · UD ${f(2 * (L + H))} m → ${r.ud} Stk`);
          fixM = 2 * (L + H);
        }
        const sp = pos(e.screwPack) || (holz ? 250 : 1000);
        r.screws = Math.round(board * pos(e.screwsPerM2));
        // Schraubenlänge: Beplankung + Eindringtiefe (Metall ≥ 10 mm, Holz ≥ 19 mm, Knauf) → Metall 25/35, Holz 35/45
        if (holz) {
          const len = layers > 1 ? 45 : 35; r.screwType = `Grobgewinde 3,9×${len}`;
          r.lines.push(line(`tn-grob|${len}|${sp}`, `Schnellbauschrauben Grobgewinde 3,9×${len} (Holz, ${f(sp, 0)} Stk)`, 'Pck', r.screws / sp, price(e.screwPackPrice)));
        } else {
          const len = layers > 1 ? 35 : 25; r.screwType = `Feingewinde 3,5×${len}`;
          r.lines.push(line(len === 25 ? `tn|${sp}` : `tn${len}|${sp}`, `Schnellbauschrauben Feingewinde 3,5×${len} (Metall, ${f(sp, 0)} Stk)`, 'Pck', r.screws / sp, price(e.screwPackPrice)));
        }
        if (pos(e.fixPerM) > 0 && fixM > 0) {
          const fp = pos(e.fixPack) || 100;
          r.fixM = fixM; r.fix = ceilN(fixM * pos(e.fixPerM));
          r.lines.push(line(`ukfix|${fp}`, `Befestigung UK: Schrauben + Dübel (${f(fp, 0)} Stk)`, 'Pck', r.fix / fp, price(e.fixPackPrice)));
          r.info.push(`Befestigung UK: ${f(fixM, 1)} m × ${f(pos(e.fixPerM), 1)} St./m = ${r.fix} Schrauben + Dübel`);
        }
        const sb = pos(e.spachtelBagKg) || 5;
        r.spachtelKg = A * sides * pos(e.spachtelKgPerM2) * (layers > 1 ? 1.6 : 1);
        r.lines.push(line(`spachtel|${sb}`, `Fugenspachtel ${f(sb)} kg`, 'Sack', r.spachtelKg / sb, price(e.spachtelBagPrice)));
        const roll = pos(e.bandRoll) || 50;
        r.bandM = A * sides * pos(e.bandMPerM2);
        r.lines.push(line(`fugenband|${roll}`, `Fugendeckstreifen ${f(roll, 0)} m`, 'Rolle', r.bandM / roll, price(e.bandRollPrice)));
        r.info.push(`Plattenschrauben ${r.screwType} ≈ ${r.screws} · Spachtel ${f(r.spachtelKg, 1)} kg · Fugenband ${f(r.bandM, 1)} m`);
        r.big = `${r.plates} Platten`; r.sub = `${f(board)} m² Beplankung + ${f(w * 100, 0)} %`;
        if (holz) r.side = { n: r.woodPcs + (r.grundPcs || 0), label: decke ? `Latten à ${f(r.woodLen)} m` : `Kantholz à ${f(r.woodLen)} m`, small: `${f(r.woodM + (r.grundM || 0), 1)} lfm` };
        else r.side = decke ? { n: r.cd, label: `CD à ${f(pos(e.cdLen) || 4)} m` } : { n: r.cw, label: `CW à ${f(pos(e.cwLen) || 2.6)} m` };
        return finish(r);
      }
    },
    daemmung: {
      cat: 'ausbau', label: 'Dämmung', sub: 'm², m³, Pakete', ph: 'z. B. Dachboden',
      defaults: () => ({ ...areaDefaults('width'), product: 'Mineralwolle WLS 035', thickness: 10, packM2: 5, waste: 5, packPrice: '' }),
      fields: () => [
        ...areaFields('width', 'Breite', false),
        { t: 'text', f: 'product', label: 'Dämmstoff', ph: 'z. B. Mineralwolle, Holzfaser' },
        row(num('thickness', 'Dicke', 'cm'), num('packM2', 'Paket', 'm²'), num('waste', 'Verschnitt', '%')),
        { t: 'note', text: () => 'Paketinhalt (m²) steht auf dem Etikett – Vorgabe nur Platzhalter.' },
        priceRow(['packPrice', 'Preis/Paket', '€'])
      ],
      describe: e => `${areaText(e, area(e))} · ${f(pos(e.thickness), 1)} cm ${e.product || ''}`.trim(),
      compute(e) {
        const a = area(e), w = pct(e.waste, 5) / 100, pack = pos(e.packM2) || 1, th = pos(e.thickness);
        const m2 = a.net * (1 + w), m3 = m2 * th / 100;
        const prod = (e.product || 'Dämmung').trim();
        const r = { net: a.net, m2, m3, packs: ceilN(m2 / pack), lines: [], info: [] };
        r.lines.push(line(`daemm|${prod}|${th}|${pack}`, `${prod} ${f(th, 1)} cm (${f(pack)} m²/Paket)`, 'Pck', m2 / pack, price(e.packPrice)));
        r.big = `${f(m2)} m²`; r.sub = `= ${f(m3, 2)} m³ · ${f(a.net)} m² + ${f(w * 100, 0)} %`;
        r.side = { n: r.packs, label: `Pakete à ${f(pack)} m²` };
        return finish(r);
      }
    },
    farbe: {
      cat: 'ausbau', label: 'Farbe / Lasur', sub: 'Liter & Eimer', ph: 'z. B. Wohnzimmer Wände',
      defaults: () => ({ ...areaDefaults('height'), paint: 'wand', paintLabel: PAINTS[0].label, coats: 2, lPerM2: PAINTS[0].lPerM2, canL: PAINTS[0].canL, waste: 5, canPrice: '' }),
      fields: () => [
        ...areaFields('height', 'Höhe', true),
        { t: 'select', f: 'paint', label: 'Produkt', opts: [...PAINTS.map(p => [p.id, `${p.label} (${f(p.lPerM2 * 1000, 0)} ml/m²)`]), ['eigen', 'Eigene Angabe']] },
        { t: 'text', f: 'paintLabel', label: 'Bezeichnung Produkt', ph: 'z. B. Fassadenfarbe' },
        row(num('coats', 'Anstriche', '×'), num('lPerM2', 'Verbrauch', 'l/m²')),
        row(num('canL', 'Gebinde', 'l'), num('waste', 'Reserve', '%')),
        priceRow(['canPrice', 'Preis/Gebinde', '€'])
      ],
      onSelect(d, k, v) { if (k === 'paint') { const p = PAINTS.find(x => x.id === v); if (p) Object.assign(d, { paintLabel: p.label, lPerM2: p.lPerM2, canL: p.canL }); } },
      describe: e => `${areaText(e, area(e, 'height'), 'height')} · ${pos(e.coats) || 1}× ${e.paintLabel || 'Farbe'}`,
      compute(e) {
        const a = area(e, 'height'), w = pct(e.waste, 5) / 100, can = pos(e.canL) || 10, coats = pos(e.coats) || 1;
        const litres = a.net * coats * pos(e.lPerM2) * (1 + w);
        const lbl = (e.paintLabel || 'Farbe').trim();
        const r = { net: a.net, litres, cans: ceilN(litres / can), lines: [], info: [] };
        r.lines.push(line(`farbe|${lbl}|${can}`, `${lbl} ${f(can)} l`, 'Gebinde', litres / can, price(e.canPrice)));
        r.big = `${f(litres, 1)} l`; r.sub = `${f(a.net)} m² × ${f(coats, 0)} × ${f(pos(e.lPerM2), 3)} l/m² + ${f(w * 100, 0)} %`;
        r.side = { n: r.cans, label: `Gebinde à ${f(can)} l`, small: `(${f(litres / can, 2)})` };
        return finish(r);
      }
    },
    schutt: {
      cat: 'aussen', label: 'Schüttgut', sub: 'Schotter, Kies, Splitt, Sand', ph: 'z. B. Unterbau Terrasse',
      defaults: () => ({ ...areaDefaults('width'), material: 'schotter', materialLabel: BULK[0].label, density: BULK[0].density, depth: 20, compaction: 20, delivery: 'lose', bigBagT: 1, pricePerT: '', bigBagPrice: '' }),
      fields: () => [
        ...areaFields('width', 'Breite', false),
        { t: 'select', f: 'material', label: 'Material', opts: [...BULK.map(b => [b.id, `${b.label} (${f(b.density, 2)} t/m³)`]), ['eigen', 'Eigenes Material']] },
        row(num('depth', 'Schichtdicke', 'cm'), num('compaction', 'Verdichtung', '%'), num('density', 'Dichte', 't/m³')),
        { t: 'seg', f: 'delivery', opts: [['lose', 'Lose (t)'], ['bigbag', 'Big Bags']] },
        row(num('bigBagT', 'Big Bag', 't', { show: d => d.delivery === 'bigbag' })),
        priceRow(['pricePerT', 'Preis', '€/t'], ['bigBagPrice', 'Preis/Big Bag', '€'])
      ],
      onSelect(d, k, v) { if (k === 'material') { const b = BULK.find(x => x.id === v); if (b) Object.assign(d, { materialLabel: b.label, density: b.density }); else d.materialLabel = d.materialLabel || 'Schüttgut'; } },
      describe: e => `${areaText(e, area(e))} · ${f(pos(e.depth), 1)} cm ${e.materialLabel || ''}`.trim(),
      compute(e) {
        const a = area(e), c = pct(e.compaction, 20) / 100;
        const m3 = a.net * pos(e.depth) / 100 * (1 + c), t = m3 * pos(e.density), bb = pos(e.bigBagT) || 1;
        const lbl = (e.materialLabel || 'Schüttgut').trim();
        const r = { net: a.net, m3, t, bigBags: ceilN(t / bb), lines: [], info: [] };
        if (e.delivery === 'bigbag') r.lines.push(line(`bigbag|${lbl}|${bb}`, `${lbl} Big Bag ${f(bb)} t`, 'Stk', t / bb, price(e.bigBagPrice)));
        else r.lines.push(line(`schutt|${lbl}`, lbl, 't', t, price(e.pricePerT), true));
        r.big = `${f(m3, 2)} m³`; r.sub = `${f(a.net)} m² × ${f(pos(e.depth), 1)} cm + ${f(c * 100, 0)} % Verdichtung`;
        r.side = e.delivery === 'bigbag' ? { n: r.bigBags, label: `Big Bags à ${f(bb)} t`, small: `${f(t, 2)} t` } : { n: f(t, 2), label: 't lose', small: `${r.bigBags} Big Bags à ${f(bb)} t` };
        return finish(r);
      }
    },
    pflaster: {
      cat: 'aussen', label: 'Pflaster / Platten', sub: 'Steine/Platten, Bettung, Fugensand', ph: 'z. B. Einfahrt',
      defaults: () => ({ ...areaDefaults('width'), format: 'rp-20x10', product: 'Rechteckpflaster', fmtL: 20, fmtW: 10, fmtT: 8, fuge: 4, perM2: '',
        waste: 5, palletM2: '', palletStk: '', bettungCm: 4, bettungComp: 20, bettungDensity: 1.5, sandKgPerM2: '', sandBagKg: 25,
        piecePrice: '', m2Price: '', splittPricePerT: '', sandBagPrice: '' }),
      fields: () => [
        ...areaFields('width', 'Breite', false),
        { t: 'select', f: 'format', label: 'Format', opts: [...PAVERS.map(x => [x.id, x.label]), ['eigen', 'Eigenes Format / Herstellerwert']] },
        { t: 'text', f: 'product', label: 'Bezeichnung Stein / Platte', ph: 'z. B. Betonpflaster grau' },
        row(num('fmtL', 'Länge', 'cm'), num('fmtW', 'Breite', 'cm'), num('fmtT', 'Dicke', 'cm', { ph: 'opt.' })),
        row(num('fuge', 'Fuge', 'mm'), num('perM2', 'oder St./m²', 'St.', { ph: 'Hersteller' })),
        { t: 'note', text: d => pos(d.perM2) > 0 ? 'St./m² vom Hersteller ist eingetragen und ersetzt die Berechnung aus dem Format (z. B. Verbundpflaster, Mehrsteinsystem).'
          : 'Steine/m² = 1 ÷ ((Länge + Fuge) × (Breite + Fuge)). Für Verbundpflaster/Mehrsteinsysteme den Herstellerwert bei „St./m²“ eintragen.' },
        row(num('waste', 'Verschnitt', '%'), num('palletM2', 'Palette', 'm²', { ph: 'opt.' }), num('palletStk', 'oder', 'St./Pal.', { ph: 'opt.' })),
        { t: 'lbl', text: 'Bettung Splitt 0/5' },
        row(num('bettungCm', 'Dicke verd.', 'cm'), num('bettungComp', 'Verdichtung', '%'), num('bettungDensity', 'Dichte', 't/m³')),
        row(num('sandKgPerM2', 'Fugensand', 'kg/m²', { ph: 'auto' }), num('sandBagKg', 'Sack', 'kg')),
        { t: 'note', text: () => 'DIN 18318: Bettung ca. 4 cm verdichtet (3–5 cm). Fugensand leer = automatisch aus Format, Fuge und Dicke.' },
        priceRow(['piecePrice', 'Preis', '€/Stk'], ['m2Price', 'oder', '€/m²']),
        priceRow(['splittPricePerT', 'Splitt', '€/t'], ['sandBagPrice', 'Sand', '€/Sack'])
      ],
      onSelect(d, k, v) {
        if (k !== 'format') return;
        const x = PAVERS.find(p => p.id === v);
        if (x) Object.assign(d, { product: x.product, fmtL: x.l, fmtW: x.w, fmtT: x.t, fuge: x.fuge, perM2: '' });
      },
      describe: e => { const g = paverGeom(e); return `${areaText(e, area(e))} · ${g.label}`; },
      compute(e) {
        const a = area(e), w = pct(e.waste, 5) / 100;
        const m2 = a.net * (1 + w);
        const g = paverGeom(e);
        const splittM3 = a.net * pos(e.bettungCm) / 100 * (1 + pct(e.bettungComp, 20) / 100), splittT = splittM3 * pos(e.bettungDensity);
        const sandAuto = e.sandKgPerM2 === '' || e.sandKgPerM2 == null;
        const sandPerM2 = sandAuto ? (g.sandAuto ?? 5) : pos(e.sandKgPerM2);
        const sb = pos(e.sandBagKg) || 25, sandKg = a.net * sandPerM2;
        const r = { net: a.net, m2, splittM3, splittT, sandKg, sandPerM2, sandBags: ceilN(sandKg / sb), perM2: g.perM2, lines: [], info: [] };
        const pp = price(e.piecePrice), mp = price(e.m2Price);
        if (g.perM2 > 0) {
          const pieces = ceilN(m2 * g.perM2);
          const perPallet = pos(e.palletStk) > 0 ? pos(e.palletStk) : pos(e.palletM2) > 0 ? pos(e.palletM2) * g.perM2 : 0;
          Object.assign(r, { pieces, perPallet, pallets: perPallet ? ceilN(pieces / perPallet) : 0 });
          const unitPrice = pp != null ? pp : mp != null ? mp / g.perM2 : null;
          const l = line(`pflaster-stk|${g.key}`, g.label, 'Stk', m2 * g.perM2, unitPrice);
          l.m2PerUnit = 1 / g.perM2; if (perPallet) l.perPallet = perPallet;
          r.lines.push(l);
          r.big = `${pieces.toLocaleString('de-DE')} Stk`;
          r.sub = `${f(a.net)} m² + ${f(w * 100, 0)} % = ${f(m2)} m² × ${f(g.perM2, 2)} St./m²${g.manual ? ' (Hersteller)' : ''}`;
          r.info.push(`${g.label}: ${pieces.toLocaleString('de-DE')} Stk ≈ ${f(pieces / g.perM2, 1)} m²`);
          if (perPallet) r.info.push(`Paletten: ${r.pallets} × ${f(perPallet, 0)} Stk${pos(e.palletStk) > 0 ? '' : ` (${f(pos(e.palletM2))} m²)`}`);
        } else {
          r.lines.push(line(`pflaster|${g.label}`, g.label, 'm²', Math.ceil(m2 * 10 - 1e-9) / 10, mp, true));
          r.big = `${f(m2)} m²`; r.sub = `${f(a.net)} m² + ${f(w * 100, 0)} % Verschnitt`;
        }
        r.lines.push(line('schutt|Splitt 0/5 (Bettung)', 'Splitt 0/5 (Bettung)', 't', splittT, price(e.splittPricePerT), true));
        r.lines.push(line(`fugensand|${sb}`, `Fugensand ${f(sb)} kg`, 'Sack', sandKg / sb, price(e.sandBagPrice)));
        r.side = { n: f(splittT, 2), label: 't Splitt 0/5', small: `${f(splittM3, 2)} m³` };
        r.info.push(`Fugensand ${f(sandPerM2, 1)} kg/m²${sandAuto && g.sandAuto != null ? ' (aus Format)' : ''} → ${f(sandKg, 0)} kg → ${r.sandBags} Sack à ${f(sb)} kg`);
        return finish(r);
      }
    },
    dach: {
      cat: 'aussen', label: 'Dach', sub: 'Platten/Folie, Schrauben', ph: 'z. B. Carport-Dach',
      defaults: () => ({ ...areaDefaults('width'), type: 'platten', plateLabel: 'Trapezblech', plateW: 1.035, plateL: 3, overlap: 10, screwsPerM2: 8, screwPack: 100,
        rollM2: 75, rollLabel: 'Unterspannbahn', platePrice: '', screwPackPrice: '', rollPrice: '' }),
      fields: () => [
        ...areaFields('width', 'Breite', false),
        { t: 'seg', f: 'type', opts: [['platten', 'Dachplatten'], ['folie', 'Folie / Bahn']] },
        { t: 'text', f: 'plateLabel', label: 'Platte', ph: 'z. B. Trapezblech, Wellplatte', show: d => d.type !== 'folie' },
        row(num('plateW', 'Deckbreite', 'm', { show: d => d.type !== 'folie' }), num('plateL', 'Länge', 'm', { show: d => d.type !== 'folie' }), num('overlap', 'Überlappung', '%')),
        row(num('screwsPerM2', 'Schrauben', 'St./m²', { show: d => d.type !== 'folie' }), num('screwPack', 'Paket', 'Stk', { show: d => d.type !== 'folie' })),
        { t: 'text', f: 'rollLabel', label: 'Bahn', ph: 'z. B. Unterspannbahn', show: d => d.type === 'folie' },
        row(num('rollM2', 'Rolle', 'm²', { show: d => d.type === 'folie' })),
        { t: 'note', text: d => d.type === 'folie' ? 'Rolle 1,5 × 50 m = 75 m². Überlappung laut Hersteller (meist 10–15 cm).' : 'Deckbreite = nutzbare Breite nach Seitenüberlappung. Längsstoß als Überlappung in %.' },
        priceRow(['platePrice', 'Platte', '€'], ['screwPackPrice', 'Schr./Pck', '€'], ['rollPrice', 'Rolle', '€'])
      ],
      describe: e => `${areaText(e, area(e))} · ${e.type === 'folie' ? (e.rollLabel || 'Folie') : (e.plateLabel || 'Dachplatten')}`,
      compute(e) {
        const a = area(e), ov = pct(e.overlap, 10) / 100, m2 = a.net * (1 + ov);
        const r = { net: a.net, m2, lines: [], info: [] };
        if (e.type === 'folie') {
          const roll = pos(e.rollM2) || 75, lbl = (e.rollLabel || 'Unterspannbahn').trim();
          r.rolls = ceilN(m2 / roll);
          r.lines.push(line(`folie|${lbl}|${roll}`, `${lbl} (${f(roll)} m²/Rolle)`, 'Rolle', m2 / roll, price(e.rollPrice)));
          r.side = { n: r.rolls, label: `Rollen à ${f(roll)} m²` };
        } else {
          const pw = pos(e.plateW), pl = pos(e.plateL), lbl = (e.plateLabel || 'Dachplatte').trim(), sp = pos(e.screwPack) || 100;
          r.plates = pw && pl ? ceilN(m2 / (pw * pl)) : 0;
          r.screws = Math.round(a.net * pos(e.screwsPerM2));
          r.lines.push(line(`dachplatte|${lbl}|${pw}x${pl}`, `${lbl} ${f(pw, 3)} × ${f(pl)} m`, 'Stk', pw && pl ? m2 / (pw * pl) : 0, price(e.platePrice)));
          r.lines.push(line(`dachschraube|${sp}`, `Dachschrauben (${f(sp, 0)} Stk)`, 'Pck', r.screws / sp, price(e.screwPackPrice)));
          r.side = { n: r.plates, label: `Platten ${f(pw, 3)} × ${f(pl)} m` };
          r.info.push(`Schrauben ≈ ${r.screws} (${f(pos(e.screwsPerM2), 0)}/m²) → ${ceilN(r.screws / sp)} Pck à ${f(sp, 0)}`);
        }
        r.big = `${f(m2)} m²`; r.sub = `${f(a.net)} m² + ${f(ov * 100, 0)} % Überlappung`;
        return finish(r);
      }
    },
    frei: {
      cat: 'sonst', label: 'Freie Position', sub: 'Kleinteile, Beschläge', ph: 'z. B. Pfostenträger H-Form',
      defaults: () => ({ qty: 1, unit: 'Stk', price: '', note: '' }),
      fields: () => [
        row(num('qty', 'Menge', ''), { t: 'select', f: 'unit', label: 'Einheit', opts: UNITS.map(u => [u, u]) }),
        { t: 'text', f: 'note', label: 'Notiz (optional)', ph: 'z. B. feuerverzinkt, 100 mm' },
        priceRow(['price', 'Preis je Einheit', '€'])
      ],
      describe: e => `${f(pos(e.qty))} ${e.unit || 'Stk'}${e.note ? ' · ' + e.note : ''}`,
      compute(e) {
        const unit = e.unit || 'Stk', q = pos(e.qty), cont = CONT_UNITS.includes(unit);
        const lbl = (e.name || 'Position').trim() + (e.note ? ` (${e.note.trim()})` : '');
        const r = { qty: q, lines: [line(`frei|${lbl}|${unit}`, lbl, unit, q, price(e.price), cont)], info: [] };
        r.big = `${f(q)} ${unit}`; r.sub = price(e.price) != null ? `à ${f(price(e.price))} €` : 'ohne Preis';
        return finish(r);
      }
    }
  };
  function stoneFields(s) { return { stoneLabel: s.short, perM2: s.perM2, mortar: s.mortar, mortarKgPerM2: s.mortarKgPerM2, mortarBagKg: s.mortarBagKg, fillLPerM2: s.fillLPerM2 }; }

  const CATEGORIES = [
    { id: 'rohbau', label: 'Rohbau & Mörtel', kinds: ['beton', 'putz', 'mauer', 'estrich'] },
    { id: 'ausbau', label: 'Innenausbau', kinds: ['fliesen', 'trockenbau', 'daemmung', 'farbe'] },
    { id: 'aussen', label: 'Außen & Dach', kinds: ['schutt', 'pflaster', 'dach'] },
    { id: 'sonst', label: 'Sonstiges', kinds: ['frei'] }
  ];

  function numFields(kind) {
    const c = CALCS[kind]; if (!c) return [];
    const out = new Set();
    const walk = list => list.forEach(x => { if (x.t === 'row') walk(x.items); else if (x.t === 'num') out.add(x.f); });
    walk(c.fields());
    return [...out];
  }
  function result(e) { const c = CALCS[e.kind]; return c ? c.compute(e) : { lines: [], info: [], cost: null, big: '–', sub: '' }; }

  return { PAVERS, paverGeom, CALCS, CATEGORIES, STONES, ESTRICH_TYPES, ZAHNUNG, PAINTS, BULK, UNITS, area, result, numFields, fmt: f };
});
