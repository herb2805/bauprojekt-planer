/*
 * Bauprojekt-Planer – Mengenrechner Beton & Putz
 * Pure functions, browser (window.Material) + Node (module.exports).
 *
 * Default values and sources (as of Oct 2026, typical German DIY values; always check the product datasheet):
 *
 * BETON – Fertigbeton / Trockenbeton (Sackware)
 *  - 25 kg Sack ≈ 13 l Frischbeton: Baumit Trockenbeton, Produktdatenblatt
 *    https://www.baumit-selbermachen.de/gartenbau/trockenbeton-25-kg_pid_8_8658.html
 *    (other brands 12–13 l / 25 kg, e.g. Quick-Mix RZB 13 l, Sakret BM-BE 12,5 l, overview:
 *    https://de.buildingclub.info/concrete-bags-calculator/)
 *  - 40 kg Sack ≈ 20 l Frischbeton: SAKRET Beton-Estrich BE, https://www.sakret.de/heimwerker/produkte/beton-estrich
 *  - 30 kg Sack ≈ 13 l: SAKRET Trockenbeton TB, Ergiebigkeit ca. 0,43 m³/t (30 kg × 0,43 l/kg ≈ 12,9 l)
 *    https://www.sakret-sachsen.de/wp-content/uploads/2021/09/tm_trockenbeton_tb_sachsen_210906.pdf
 *
 * BETON – selbst mischen (Zement + Kiessand 0/16)
 *  - Mischungsverhältnis 1:4 nach Raumteilen (Eimer/Schaufeln), nicht nach Gewicht.
 *  - Lose Trockenzutaten ≈ 1,5 × fertiges Betonvolumen; Zement lose ≈ 1,25 kg/l
 *    → bei 1:4 ca. 375 kg Zement und 1,2 m³ Kiessand je m³ Beton
 *    Quelle: https://projectyards.com/de/beton-mischungsverhaeltnis/
 *  - Plausibilität ~300 kg Zement + 1.800–1.950 kg Sand/Kies je m³ (C20/25):
 *    https://bauherren-magazin.de/wieviel-zement-fuer-1m3-beton/ , https://bau-szene.de/wieviel-zement-fuer-1m3-beton/
 *  - Kiessand lose ≈ 1,6 t/m³ (Annahme, 1.800 kg ≈ 1,0–1,25 m³ Schüttgut laut bau-szene.de)
 *  - Zementsack 25 kg (Baumarkt-Standard)
 *
 * PUTZ – Verbrauch in kg je m² und mm Putzdicke (Herstellerangaben):
 *  - Kalkzementputz 1,4: Baumit KalkzementPutz KZP 65 (ca. 1,4 kg/m²/mm)
 *    https://baumit.de/files/de/pdf_files/pds_kalkzementputz_kzp_65_bde_de_24224.pdf ;
 *    Hasit 650 Kalkzementputz 30 kg: 1,25 kg/m²/mm https://www.hasit.de/produkt/hasit-650-kalkzementputz
 *  - Kalkputz 1,3: Baumit Kalkputz KlimaSpeed 25 kg (ca. 1,3), Hasit 666 Kalkputz 30 kg (ca. 1,18)
 *    (Übersicht/Median der Datenblätter Baumit, Hasit, Knauf, quick-mix, Claytec: Gips ~0,9, Kalk 1,3,
 *    Kalkzement 1,4, Lehm-Unterputz 1,55 kg/m²/mm – https://calxia.com/de/bauwesen/putz-rechner/)
 *  - Gipsputz 0,8: Knauf Rotband Haftputzgips 30 kg, "ca. 0,8 kg/m² je mm Putzstärke"
 *    https://knauf.com/de-DE/p/produkt/rotband-10001_0022
 *  - Lehmputz 1,5: ClayTec Lehm-Unterputz mit Stroh, trocken 25 kg ("Ca. 1,50 kg/m² je mm Putzdicke", 25 kg ergibt 16,7 l)
 *    https://claytec.de/produkt/lehmputze/lehm-unterputz-mit-stroh/
 *  - Zuschlag 10 %: Baumit KZP 65 Datenblatt "Praxisbedingt ist ein Mehrverbrauch von ca. 10 % zu berücksichtigen."
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Material = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const BETON_BAGS = [
    { id: 'b25', label: 'Fertigbeton 25 kg (≈ 13 l)', kg: 25, litres: 13 },
    { id: 'b30', label: 'Trockenbeton 30 kg (≈ 13 l)', kg: 30, litres: 13 },
    { id: 'b40', label: 'Fertigbeton 40 kg (≈ 20 l)', kg: 40, litres: 20 }
  ];
  const MIX_DEFAULTS = { ratio: 4, looseFactor: 1.5, cementBulkKgPerL: 1.25, kiesBulkTPerM3: 1.6, cementBagKg: 25 };

  const PUTZ_TYPES = [
    { id: 'kalkzement', label: 'Kalkzementputz', kgPerM2mm: 1.4, bagKg: 30 },
    { id: 'kalk', label: 'Kalkputz', kgPerM2mm: 1.3, bagKg: 30 },
    { id: 'gips', label: 'Gipsputz', kgPerM2mm: 0.8, bagKg: 30 },
    { id: 'lehm', label: 'Lehmputz', kgPerM2mm: 1.5, bagKg: 25 }
  ];
  const DEFAULT_ZUSCHLAG = 10;

  const n = v => { const x = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.')); return isFinite(x) ? x : 0; };
  const pos = v => Math.max(0, n(v));
  const ceilBags = x => (x <= 1e-9 ? 0 : Math.ceil(x - 1e-9));
  const priceOrNull = v => (v === null || v === undefined || v === '' || !isFinite(n(v))) ? null : n(v);

  /** Volume of one Beton entry in m³ (before Zuschlag). Holes in cm; Fläche length/width in m, thickness in cm. */
  function betonVolume(e) {
    const qty = Math.max(0, Math.round(n(e.qty ?? 1)));
    let one = 0;
    if (e.shape === 'rund') {
      const r = pos(e.diameter) / 200; // cm → m radius
      one = Math.PI * r * r * pos(e.depth) / 100;
    } else if (e.shape === 'eckig') {
      one = (pos(e.length) / 100) * (pos(e.width) / 100) * (pos(e.depth) / 100);
    } else { // flaeche
      const area = pos(e.area) > 0 ? pos(e.area) : pos(e.length) * pos(e.width);
      one = area * pos(e.thickness) / 100;
    }
    return one * qty;
  }

  function betonResult(e) {
    const volume = betonVolume(e);
    const z = e.zuschlag == null || e.zuschlag === '' ? DEFAULT_ZUSCHLAG : pos(e.zuschlag);
    const total = volume * (1 + z / 100);
    const litres = total * 1000;
    const out = { volume, zuschlag: z, total, litres, method: e.method || 'sack', cost: null, lines: [] };
    if (out.method === 'sack') {
      const kg = pos(e.bagKg) || 25, l = pos(e.bagLitres) || 13;
      const exact = litres / l, bags = ceilBags(exact);
      const price = priceOrNull(e.bagPrice);
      Object.assign(out, { bagKg: kg, bagLitres: l, bagsExact: exact, bags, dryKg: bags * kg, cost: price == null ? null : bags * price });
      out.lines.push({ key: `beton-sack|${kg}|${l}`, label: `Fertigbeton ${fmtNum(kg)} kg (≈ ${fmtNum(l)} l)`, unit: 'Sack', exact, qty: bags, unitPrice: price });
    } else if (out.method === 'selbst') {
      const ratio = pos(e.ratio) || MIX_DEFAULTS.ratio;
      const looseL = litres * MIX_DEFAULTS.looseFactor;
      const cementL = looseL / (1 + ratio), kiesL = looseL - cementL;
      const cementKg = cementL * MIX_DEFAULTS.cementBulkKgPerL;
      const bagKg = pos(e.cementBagKg) || MIX_DEFAULTS.cementBagKg;
      const cementBagsExact = cementKg / bagKg, cementBags = ceilBags(cementBagsExact);
      const kiesM3 = kiesL / 1000, kiesKg = kiesM3 * MIX_DEFAULTS.kiesBulkTPerM3 * 1000;
      const cp = priceOrNull(e.cementBagPrice), kp = priceOrNull(e.kiesPricePerT);
      const cost = (cp == null && kp == null) ? null : (cp || 0) * cementBags + (kp || 0) * kiesKg / 1000;
      Object.assign(out, { ratio, cementKg, cementBagKg: bagKg, cementBagsExact, cementBags, kiesM3, kiesKg, cost });
      out.lines.push({ key: `zement|${bagKg}`, label: `Zement ${fmtNum(bagKg)} kg`, unit: 'Sack', exact: cementBagsExact, qty: cementBags, unitPrice: cp });
      out.lines.push({ key: 'kiessand', label: 'Kiessand 0/16', unit: 't', exact: kiesKg / 1000, qty: kiesKg / 1000, unitPrice: kp, continuous: true });
    } else { // transport
      const p = priceOrNull(e.transportPrice);
      Object.assign(out, { transportM3: total, cost: p == null ? null : total * p });
      out.lines.push({ key: 'transportbeton', label: 'Transportbeton', unit: 'm³', exact: total, qty: total, unitPrice: p, continuous: true });
    }
    return out;
  }

  /** Putz: area from wall (length×height m) minus openings (w×h m × qty), or direct m². thickness in mm. */
  function putzArea(e) {
    if (e.mode === 'direkt') return { gross: pos(e.area), openings: 0, net: pos(e.area) };
    const gross = pos(e.length) * pos(e.height);
    const openings = (e.openings || []).reduce((s, o) => s + pos(o.width) * pos(o.height) * Math.max(0, Math.round(n(o.qty ?? 1))), 0);
    return { gross, openings, net: Math.max(0, gross - openings) };
  }

  function putzResult(e) {
    const a = putzArea(e);
    const type = PUTZ_TYPES.find(t => t.id === e.type) || PUTZ_TYPES[0];
    const cons = e.kgPerM2mm == null || e.kgPerM2mm === '' ? type.kgPerM2mm : pos(e.kgPerM2mm);
    const thickness = pos(e.thickness);
    const z = e.zuschlag == null || e.zuschlag === '' ? DEFAULT_ZUSCHLAG : pos(e.zuschlag);
    const kg = a.net * thickness * cons;
    const kgTotal = kg * (1 + z / 100);
    const bagKg = pos(e.bagKg) || type.bagKg;
    const exact = kgTotal / bagKg, bags = ceilBags(exact);
    const price = priceOrNull(e.bagPrice);
    return {
      ...a, type: type.id, typeLabel: type.label, kgPerM2mm: cons, thickness, zuschlag: z, kg, kgTotal, bagKg, bagsExact: exact, bags,
      cost: price == null ? null : bags * price,
      lines: [{ key: `putz|${type.id}|${bagKg}`, label: `${type.label} ${fmtNum(bagKg)} kg`, unit: 'Sack', exact, qty: bags, unitPrice: price }]
    };
  }

  function entryResult(e) { return e.kind === 'putz' ? putzResult(e) : betonResult(e); }

  /** Aggregate order lines over all entries. Bags: ceil(sum of exact) per product; continuous units summed. */
  function aggregate(entries) {
    const map = new Map();
    let cost = 0, anyCost = false, allPriced = true;
    for (const e of entries || []) {
      const r = entryResult(e);
      for (const l of r.lines) {
        if (!map.has(l.key)) map.set(l.key, { key: l.key, label: l.label, unit: l.unit, exact: 0, continuous: !!l.continuous, unitPrice: l.unitPrice, entries: [] });
        const m = map.get(l.key);
        m.exact += l.exact; m.entries.push(e.name || '');
        if (m.unitPrice == null && l.unitPrice != null) m.unitPrice = l.unitPrice;
      }
    }
    const lines = [...map.values()].map(m => {
      const qty = m.continuous ? m.exact : ceilBags(m.exact);
      const c = m.unitPrice == null ? null : qty * m.unitPrice;
      if (c == null) allPriced = false; else { cost += c; anyCost = true; }
      return { ...m, qty, cost: c };
    });
    return { lines, cost: anyCost ? cost : null, allPriced: allPriced && lines.length > 0 };
  }

  function fmtNum(x) { return String(Math.round(x * 100) / 100).replace('.', ','); }

  return { BETON_BAGS, MIX_DEFAULTS, PUTZ_TYPES, DEFAULT_ZUSCHLAG, betonVolume, betonResult, putzArea, putzResult, entryResult, aggregate };
});
