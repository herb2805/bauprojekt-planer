const test = require('node:test');
const assert = require('node:assert');
const M = require('../js/material.js');
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('Rundes Loch: 4 × Ø30 cm, 80 cm tief', () => {
  const e = { kind: 'beton', shape: 'rund', diameter: 30, depth: 80, qty: 4, zuschlag: 10, method: 'sack', bagKg: 25, bagLitres: 13 };
  close(M.betonVolume(e), 4 * Math.PI * 0.15 * 0.15 * 0.8);
  const r = M.betonResult(e);
  close(r.volume, 0.226195, 1e-5);
  close(r.total, 0.248814, 1e-5);
  close(r.litres, 248.814, 1e-2);
  assert.strictEqual(r.bags, 20); // 248,8 / 13 = 19,14 → 20
  assert.strictEqual(r.dryKg, 500);
});

test('Eckiges Loch und Fläche (L×B oder m²)', () => {
  close(M.betonVolume({ shape: 'eckig', length: 40, width: 40, depth: 80, qty: 2 }), 2 * 0.4 * 0.4 * 0.8);
  close(M.betonVolume({ shape: 'flaeche', length: 3, width: 2, thickness: 15 }), 0.9);
  close(M.betonVolume({ shape: 'flaeche', area: 6, length: 99, width: 99, thickness: 15 }), 0.9); // area wins
});

test('Zuschlag default 10 %, 0 % möglich', () => {
  const base = { shape: 'flaeche', area: 1, thickness: 10, method: 'transport' };
  close(M.betonResult(base).total, 0.11);
  close(M.betonResult({ ...base, zuschlag: 0 }).total, 0.1);
  const r = M.betonResult({ ...base, zuschlag: 0, transportPrice: 150 });
  close(r.cost, 15);
  assert.strictEqual(r.lines[0].unit, 'm³');
});

test('Selbst mischen 1:4 → ~375 kg Zement und 1,2 m³ Kiessand je m³', () => {
  const r = M.betonResult({ shape: 'flaeche', area: 10, thickness: 10, zuschlag: 0, method: 'selbst', ratio: 4, cementBagKg: 25 });
  close(r.total, 1);
  close(r.cementKg, 375);
  assert.strictEqual(r.cementBags, 15);
  close(r.kiesM3, 1.2);
  close(r.kiesKg, 1920);
  const r3 = M.betonResult({ shape: 'flaeche', area: 10, thickness: 10, zuschlag: 0, method: 'selbst', ratio: 3 });
  close(r3.cementKg, 468.75);
});

test('Sackpreis → Kosten, Sack 40 kg/20 l', () => {
  const r = M.betonResult({ shape: 'rund', diameter: 30, depth: 80, qty: 4, method: 'sack', bagKg: 40, bagLitres: 20, bagPrice: 6.5 });
  assert.strictEqual(r.bags, 13); // 248,8/20 = 12,44
  close(r.cost, 84.5);
});

test('Putz direkt: 10 m² Kalkzementputz 15 mm', () => {
  const r = M.putzResult({ kind: 'putz', mode: 'direkt', area: 10, thickness: 15, type: 'kalkzement' });
  close(r.kg, 210);
  close(r.kgTotal, 231);
  assert.strictEqual(r.bagKg, 30);
  assert.strictEqual(r.bags, 8); // 7,7 → 8
});

test('Putz Wand minus Öffnungen', () => {
  const r = M.putzResult({ mode: 'wand', length: 5, height: 2.5, openings: [{ width: 1, height: 1.2, qty: 2 }, { width: 0.9, height: 2, qty: 1 }], thickness: 10, type: 'gips', zuschlag: 0 });
  close(r.gross, 12.5); close(r.openings, 4.2); close(r.net, 8.3);
  close(r.kg, 8.3 * 10 * 0.8);
  assert.strictEqual(r.bags, 3); // 66,4/30 = 2,21
  const neg = M.putzResult({ mode: 'wand', length: 1, height: 1, openings: [{ width: 2, height: 2 }], thickness: 10 });
  assert.strictEqual(neg.net, 0); assert.strictEqual(neg.bags, 0);
});

test('Putz: eigener Verbrauch und Sackgröße, Presets', () => {
  const r = M.putzResult({ mode: 'direkt', area: 10, thickness: 10, type: 'lehm', kgPerM2mm: 1.6, bagKg: 25, zuschlag: 0, bagPrice: 9 });
  close(r.kg, 160); assert.strictEqual(r.bags, 7); close(r.cost, 63);
  const ids = M.PUTZ_TYPES.map(t => t.id + ':' + t.kgPerM2mm);
  assert.deepStrictEqual(ids, ['kalkzement:1.4', 'kalk:1.3', 'gips:0.8', 'lehm:1.5']);
});

test('Aggregation: gleiche Säcke über Einträge zusammengefasst, aufgerundet', () => {
  const a = { kind: 'beton', name: 'A', shape: 'flaeche', area: 1, thickness: 0.65, zuschlag: 0, method: 'sack', bagKg: 25, bagLitres: 13 }; // 6,5 l = 0,5 Sack
  const agg = M.aggregate([a, { ...a, name: 'B' }, { kind: 'putz', name: 'W', mode: 'direkt', area: 10, thickness: 15, type: 'kalkzement' }]);
  const beton = agg.lines.find(l => l.key === 'beton-sack|25|13');
  assert.strictEqual(beton.qty, 1); // 0,5 + 0,5
  assert.deepStrictEqual(beton.entries, ['A', 'B']);
  assert.strictEqual(agg.lines.find(l => l.key.startsWith('putz')).qty, 8);
  assert.strictEqual(agg.cost, null);
});
