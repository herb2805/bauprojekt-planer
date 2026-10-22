const test = require('node:test');
const assert = require('node:assert');
const C = require('../js/calcs.js');
const M = require('../js/material.js');
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

// Eintrag wie in der App: Defaults, dann Auswahlfelder über onSelect/onSet, dann Werte
function mk(kind, sel = {}, vals = {}) {
  const c = C.CALCS[kind], d = { ...c.defaults(), kind };
  for (const [k, v] of Object.entries(sel)) { d[k] = v; (c.onSelect || c.onSet || (() => {}))(d, k, v); if (c.onSet && c.onSelect) c.onSet(d, k, v); }
  return Object.assign(d, vals);
}
const lines = r => Object.fromEntries(r.lines.map(l => [l.key.split('|')[0], l]));

test('Alle Rechner haben Kategorie, Defaults und liefern ohne Eingaben kein NaN', () => {
  const cats = C.CATEGORIES.flatMap(c => c.kinds);
  for (const k of Object.keys(C.CALCS)) {
    assert.ok(cats.includes(k), `${k} fehlt in Kategorien`);
    const r = C.result(mk(k));
    for (const l of r.lines) assert.ok(Number.isFinite(l.exact) && Number.isFinite(l.qty), `${k}: ${l.key}`);
  }
  for (const k of ['beton', 'putz']) assert.ok(cats.includes(k));
});

test('Mauerwerk: 4 × 2,5 m − Tür 1 × 2 m, Porenbeton 17,5 → 57 Steine, 1 Sack Dünnbettmörtel', () => {
  const r = C.result(mk('mauer', {}, { length: 4, height: 2.5, openings: [{ width: 1, height: 2, qty: 1 }], stonePrice: 3.5, mortarBagPrice: 12 }));
  const L = lines(r);
  close(L.stein.exact, 8 * 6.7 * 1.05);          // 56,28 → 57
  assert.strictEqual(L.stein.qty, 57);
  close(L.moertel.exact, 8 * 2.2 * 1.05 / 25);
  assert.strictEqual(L.moertel.qty, 1);
  close(r.cost, 57 * 3.5 + 12);
});

test('Mauerwerk: KS 2 DF → 32 St/m², Normalmörtel 35 kg/m²', () => {
  const r = C.result(mk('mauer', { stone: 'ks-2df' }, { length: 5, height: 2, waste: 0 }));
  const L = lines(r);
  assert.strictEqual(L.stein.qty, 320);
  assert.strictEqual(L.moertel.qty, 14); // 350 kg / 25 kg
});

test('Schalstein-Füllbeton landet auf demselben Beton-Sack wie der Beton-Rechner', () => {
  const schal = mk('mauer', { stone: 'schal-175' }, { length: 5, height: 1, waste: 0 });
  const r = C.result(schal);
  assert.strictEqual(lines(r).stein.qty, 40);
  const fill = r.lines.find(l => l.key === 'beton-sack|25|13');
  close(fill.exact, 450 / 13); // 5 m² × 90 l
  const beton = { kind: 'beton', shape: 'flaeche', area: 1, thickness: 10, zuschlag: 0, method: 'sack', bagKg: 25, bagLitres: 13 };
  const agg = M.aggregate([beton, schal]);
  const b = agg.lines.find(l => l.key === 'beton-sack|25|13');
  assert.strictEqual(b.qty, Math.ceil(100 / 13 + 450 / 13)); // 43
});

test('Estrich: 20 m² × 50 mm Zementestrich → 2.100 kg → 53 Sack à 40 kg', () => {
  const r = C.result(mk('estrich', {}, { mode: 'direkt', area: 20 }));
  close(r.lines[0].exact, 20 * 50 * 2 * 1.05 / 40);
  assert.strictEqual(r.lines[0].qty, 53);
  const s = C.result(mk('estrich', { type: 'schnell' }, { mode: 'direkt', area: 20 }));
  assert.strictEqual(s.lines[0].qty, Math.ceil(20 * 50 * 1.8 * 1.05 / 30));
});

test('Fliesen: 12 m² gerade/diagonal, Kleber nach Zahnung, Fugenmasse-Formel', () => {
  const g = lines(C.result(mk('fliesen', {}, { mode: 'direkt', area: 12 })));
  close(g.fliesen.exact, 13.2 / 1.44);
  assert.strictEqual(g.fliesen.qty, 10);
  close(g.kleber.exact, 12 * 2.8 * 1.1 / 25);
  assert.strictEqual(g.kleber.qty, 2);
  const fugeKg = (600 + 300) / (600 * 300) * 3 * 8 * 1.6 * 12 * 1.1; // ≈ 2,53 kg
  close(g.fuge.exact, fugeKg / 5);
  assert.strictEqual(g.fuge.qty, 1);
  const d = lines(C.result(mk('fliesen', { verlegung: 'diagonal' }, { mode: 'direkt', area: 12 })));
  close(d.fliesen.exact, 13.8 / 1.44);
  const z4 = lines(C.result(mk('fliesen', { zahnung: '4' }, { mode: 'direkt', area: 12 })));
  close(z4.kleber.exact, 12 * 1.5 * 1.1 / 25);
});

test('Trockenbau Wand 4 × 2,5 m beidseitig: 9 Platten, 8 CW, 3 UW', () => {
  const L = lines(C.result(mk('trockenbau', {}, { length: 4, height: 2.5 })));
  close(L.gk.exact, 20 * 1.1 / 2.5);
  assert.strictEqual(L.gk.qty, 9);
  assert.strictEqual(L.cw.qty, 8);  // ceil(400/62,5)+1
  assert.strictEqual(L.uw.qty, 3);  // ceil(8/3)
  close(L.tn.exact, 20 * 15 / 1000);
  assert.strictEqual(L.spachtel.qty, 1);
  assert.strictEqual(L.fugenband.qty, 1);
  const p26 = lines(C.result(mk('trockenbau', { plate: '2600' }, { length: 4, height: 2.5 })));
  assert.strictEqual(p26.gk.qty, Math.ceil(22 / 3.25));
  const decke = lines(C.result(mk('trockenbau', { mode: 'decke' }, { length: 4, width: 3 })));
  assert.ok(decke.cd && decke.ud);
  assert.strictEqual(decke.ud.qty, 5); // 14 m Umfang / 3 m
});

test('Trockenbau: alter Eintrag ohne uk bleibt Metall (gleiche Keys), Feingewinde-Label', () => {
  const old = { kind: 'trockenbau', mode: 'wand', length: 4, height: 2.5, sides: 2, layers: 1, plate: '2000', plateW: 1.25, plateL: 2, waste: 10,
    cwAxis: 62.5, cwLen: 2.6, uwLen: 3, cdAxis: 50, cdLen: 4, udLen: 3, screwsPerM2: 15, screwPack: 1000, spachtelKgPerM2: 0.25, spachtelBagKg: 5, bandMPerM2: 0.75, bandRoll: 50 };
  const r = C.result(old), keys = r.lines.map(l => l.key);
  assert.deepStrictEqual(keys, ['gk|1250x2000', 'cw|2.6', 'uw|3', 'tn|1000', 'spachtel|5', 'fugenband|50']);
  assert.match(r.lines[3].label, /Feingewinde 3,5×25 \(Metall/);
  const d2 = lines(C.result(mk('trockenbau', {}, { length: 4, height: 2.5, layers: 2 })));
  assert.match(d2.tn35.label, /Feingewinde 3,5×35/);
});

test('Trockenbau Holz-Wand 4 × 2,5 m: 8 Ständer + Schwellen = 28 lfm → 6 Kantholz à 5 m, Grobgewinde', () => {
  const r = C.result(mk('trockenbau', { uk: 'holz' }, { length: 4, height: 2.5 }));
  const L = lines(r);
  assert.strictEqual(r.studs, 8);
  close(r.woodM, 8 * 2.5 + 8);
  assert.strictEqual(L.kantholz.key, 'kantholz|60×60|5');
  assert.strictEqual(L.kantholz.qty, 6); // 8 Ständer à 2,5 m → 4 Stangen; 2 Schwellen à 4 m → 2 Stangen
  assert.ok(!L.cw && !L.uw && !L.tn);
  assert.strictEqual(L['tn-grob'].key, 'tn-grob|35|250');
  assert.match(L['tn-grob'].label, /Grobgewinde 3,9×35 \(Holz/);
  close(L['tn-grob'].exact, 300 / 250);
  // Preset 60x80, Achse 50 cm, Höhe > Lieferlänge → gestoßen mit 10 % Zuschlag
  const r2 = C.result(mk('trockenbau', { uk: 'holz', kantSec: '60x80' }, { length: 3, height: 5.5, kantAxis: 50, kantLen: 5 }));
  assert.strictEqual(r2.studs, 7);
  assert.strictEqual(lines(r2).kantholz.key, 'kantholz|60×80|5');
  assert.strictEqual(r2.woodPcs, Math.ceil(7 * 5.5 * 1.1 / 5) + 2);
  // eigener Querschnitt
  const r3 = C.result(mk('trockenbau', { uk: 'holz', kantSec: 'eigen' }, { length: 2, height: 2.5, secCustom: '50 x 70' }));
  assert.match(lines(r3).kantholz.label, /Kantholz 50×70 mm/);
});

test('Trockenbau Holz-Decke: Traglattung 50 cm, optional Grund- + Traglattung, Befestigung UK', () => {
  const r = C.result(mk('trockenbau', { uk: 'holz', mode: 'decke' }, { length: 4, width: 3 }));
  assert.strictEqual(r.lattRows, 7); // ceil(3/0,5)+1
  assert.strictEqual(lines(r).latte.key, 'latte|24×48|4');
  assert.strictEqual(r.woodPcs, 7);
  const sep = C.result(mk('trockenbau', { uk: 'holz', mode: 'decke', lattDouble: 'ja' }, { length: 5, width: 3.5 }));
  assert.deepStrictEqual(sep.lines.filter(l => l.key.startsWith('latte|')).map(l => [l.key, l.qty]), [['latte|24×48|4', 11], ['latte|30×50|4', 8]]);
  const r2 = C.result(mk('trockenbau', { uk: 'holz', mode: 'decke', lattSec: '30x50', lattDouble: 'ja' }, { length: 5, width: 3.5, fixPerM: 1.5 }));
  assert.strictEqual(r2.lattRows, 8);
  assert.strictEqual(r2.woodPcs, Math.ceil(8 * 5 * 1.1 / 4)); // 11
  assert.strictEqual(r2.grundRows, 8);                         // ceil(5/0,8)+1
  assert.strictEqual(r2.grundPcs, 8);                          // 3,5 m passt 1× in 4 m
  const latten = r2.lines.filter(l => l.key.startsWith('latte|'));
  assert.strictEqual(latten.length, 1);                       // gleicher Querschnitt → zusammengefasst
  assert.strictEqual(latten[0].qty, 19);
  assert.strictEqual(r2.crossings, 64);
  assert.strictEqual(r2.fix, Math.ceil(28 * 1.5));             // Grundlatten 8 × 3,5 m
  assert.strictEqual(lines(r2).ukfix.qty, 1);
  // Metall + Befestigung: UW + Randständer
  const m = C.result(mk('trockenbau', {}, { length: 4, height: 2.5, fixPerM: 2 }));
  assert.strictEqual(m.fix, 26);
});

test('Trockenbau Holz: Bestellung zeigt Material, Projektsumme fasst Kantholz zusammen', () => {
  const a = { ...mk('trockenbau', { uk: 'holz' }, { length: 4, height: 2.5 }), id: 'a', name: 'Wand A' };
  const b = { ...mk('trockenbau', { uk: 'holz' }, { length: 2, height: 2.5 }), id: 'b', name: 'Wand B' };
  const agg = M.aggregate([a, b]).lines;
  const k = agg.find(l => l.key === 'kantholz|60×60|5');
  assert.ok(k && /Kantholz 60×60 mm, 5 m/.test(k.label));
  assert.strictEqual(k.qty, 6 + C.result(b).woodPcs);
  assert.strictEqual(M.lineNote(k), '44,5 lfm Bedarf'); // 28 + (5 × 2,5 + 4) lfm
});

test('Farbe 40 m², 2 Anstriche → 13,9 l → 2 Eimer à 10 l; Lasur-Preset', () => {
  const r = C.result(mk('farbe', {}, { mode: 'direkt', area: 40 }));
  close(r.lines[0].exact, 40 * 2 * 0.165 * 1.05 / 10);
  assert.strictEqual(r.lines[0].qty, 2);
  const lasur = mk('farbe', { paint: 'lasur' });
  close(lasur.lPerM2, 0.075);
});

test('Schüttgut 4 × 3 m × 20 cm Schotter: 2,88 m³ → 4,9 t lose oder 5 Big Bags', () => {
  const lose = C.result(mk('schutt', {}, { length: 4, width: 3 }));
  close(lose.lines[0].exact, 12 * 0.2 * 1.2 * 1.7);
  assert.strictEqual(lose.lines[0].unit, 't');
  assert.strictEqual(lose.lines[0].continuous, true);
  const bb = C.result(mk('schutt', { delivery: 'bigbag' }, { length: 4, width: 3 }));
  assert.strictEqual(bb.lines[0].qty, 5);
});

test('Pflaster 20 m² (altes Format ohne Steinmaß): Fläche + Bettung + Fugensand', () => {
  const L = lines(C.result(mk('pflaster', { format: 'eigen' }, { mode: 'direkt', area: 20, m2Price: 25, fmtL: '', fmtW: '', product: 'Pflaster', sandKgPerM2: 5 })));
  close(L.pflaster.exact, 21);
  close(L.schutt.exact, 20 * 0.04 * 1.2 * 1.5); // 1,44 t
  assert.strictEqual(L.fugensand.qty, 4);       // 100 kg / 25
});

test('Dach: Trapezblech mit 10 % Überlappung, Folie in Rollen', () => {
  const L = lines(C.result(mk('dach', {}, { mode: 'direkt', area: 20 })));
  close(L.dachplatte.exact, 22 / (1.035 * 3));
  assert.strictEqual(L.dachplatte.qty, 8);
  assert.strictEqual(L.dachschraube.qty, 2); // 160 Schrauben / 100
  const F = C.result(mk('dach', { type: 'folie' }, { mode: 'direkt', area: 100 }));
  assert.strictEqual(F.lines[0].qty, 2);
});

test('Freie Position mit Preis; m/kg/l bleiben unrund', () => {
  const r = C.result(mk('frei', {}, { name: 'Winkelverbinder', qty: 12, unit: 'Stk', price: 2.5 }));
  assert.strictEqual(r.lines[0].qty, 12);
  close(r.cost, 30);
  const m = C.result(mk('frei', {}, { name: 'Kabel', qty: 7.5, unit: 'm' }));
  assert.strictEqual(m.lines[0].continuous, true);
  close(m.lines[0].qty, 7.5);
});

test('Material.entryResult: alte Einträge ohne kind bleiben Beton, neue Arten gehen an Calcs', () => {
  const old = { shape: 'flaeche', area: 1, thickness: 10, zuschlag: 0, method: 'sack', bagKg: 25, bagLitres: 13 };
  assert.strictEqual(M.entryResult(old).lines[0].key, 'beton-sack|25|13');
  const r = M.entryResult(mk('frei', {}, { name: 'X', qty: 2 }));
  assert.strictEqual(r.lines[0].qty, 2);
});

test('Pflaster: 20 m² Rechteckpflaster 20×10, Fuge 4 mm → 47,13 St./m² → 990 Stk inkl. 5 %', () => {
  const e = mk('pflaster', {}, { mode: 'direkt', area: 20 });
  const r = C.result(e);
  close(r.perM2, 1 / (0.204 * 0.104));
  assert.strictEqual(r.pieces, 990);           // 21 m² × 47,13 = 989,7
  const L = lines(r);
  assert.strictEqual(L['pflaster-stk'].unit, 'Stk');
  assert.strictEqual(L['pflaster-stk'].label, 'Rechteckpflaster 20×10×8 cm');
  assert.ok(!L.pflaster, 'keine doppelte m²-Position');
  close(L.schutt.exact, 1.44);
  close(r.sandPerM2, 300 / 20000 * 4 * 80 * 1.55); // 7,44 kg/m² aus Format
  const agg = M.aggregate([e]).lines.find(l => l.unit === 'Stk');
  assert.strictEqual(M.lineNote(agg), '≈ 21,0 m²');
});

test('Pflaster: Terrassenplatten 60×30 mit Palette und Stückpreis; Preis pro m² alternativ', () => {
  const e = mk('pflaster', { format: 'tp-60x30' }, { mode: 'direkt', area: 20, palletStk: 50, piecePrice: 3.2 });
  const r = C.result(e);
  close(r.perM2, 1 / (0.604 * 0.304));
  assert.strictEqual(r.pieces, 115);
  assert.strictEqual(r.pallets, 3);
  close(r.lines[0].unitPrice, 3.2);
  close(r.cost, 115 * 3.2);
  const agg = M.aggregate([e]).lines.find(l => l.unit === 'Stk');
  assert.strictEqual(M.lineNote(agg), '≈ 21,1 m² · 3 Paletten à 50 Stk');
  const m2 = C.result(mk('pflaster', { format: 'tp-60x30' }, { mode: 'direkt', area: 20, m2Price: 30 }));
  close(m2.lines[0].unitPrice, 30 / r.perM2);
  const pal = C.result(mk('pflaster', { format: 'tp-60x30' }, { mode: 'direkt', area: 20, palletM2: 10 }));
  close(pal.perPallet, 10 * r.perM2);
});

test('Pflaster: St./m² vom Hersteller ersetzt Formatberechnung; eigenes Format', () => {
  const r = C.result(mk('pflaster', { format: 'eigen' }, { mode: 'direkt', area: 10, perM2: 36, product: 'Verbundpflaster', fmtL: '', fmtW: '', fmtT: '' }));
  assert.strictEqual(r.pieces, 378);
  assert.strictEqual(r.lines[0].label, 'Verbundpflaster');
  close(r.sandPerM2, 5); // ohne Format: Vorgabe 5 kg/m²
  const own = C.result(mk('pflaster', { format: 'eigen' }, { mode: 'direkt', area: 10, fmtL: 30, fmtW: 15, fmtT: 6, fuge: 5, waste: 0 }));
  assert.strictEqual(own.pieces, Math.ceil(10 / (0.305 * 0.155)));
});

test('Pflaster: alte gespeicherte Einträge (nur m²) bleiben unverändert', () => {
  const old = { kind: 'pflaster', mode: 'direkt', area: 20, product: 'Pflaster 20×10×8', waste: 5, bettungCm: 4, bettungComp: 20, bettungDensity: 1.5, sandKgPerM2: 5, sandBagKg: 25, m2Price: 25 };
  const r = C.result(old);
  assert.deepStrictEqual(r.lines.map(l => [l.key, l.unit, l.qty]), [
    ['pflaster|Pflaster 20×10×8', 'm²', 21], ['schutt|Splitt 0/5 (Bettung)', 't', r.lines[1].exact], ['fugensand|25', 'Sack', 4]]);
  close(r.cost, 21 * 25);
});
