const test = require('node:test');
const assert = require('node:assert');
const { optimizeGroup, pieceCost, wasteOf } = require('../js/optimizer.js');

const P = (len, n, label = 'T') => Array.from({ length: n }, (_, i) => ({ length: len, label, id: label + len + '_' + i }));
const sig = r => r.bins.map(b => b.parts.map(p => p.length).sort((a, b) => b - a).join('+')).sort();

test('Vordach 12x12 mit 5 m: 4 Stangen (398+98, 362.5+114)', () => {
  const parts = [...P(398, 2), ...P(362.5, 2), ...P(98, 2), ...P(114, 2)];
  const r = optimizeGroup({ parts, stocks: [{ length: 500 }], kerf: 0.5 });
  assert.strictEqual(r.bins.length, 4);
  assert.deepStrictEqual(sig(r), ['362.5+114', '362.5+114', '398+98', '398+98']);
  assert.ok(r.exact);
  // waste: 500-496.5-0.5 = 3 ; 500-477-0.5 = 22.5
  assert.strictEqual(Math.round(r.summary.waste * 10) / 10, 2 * 3 + 2 * 22.5);
});

test('Vordach Sparren 8x12: 6x150 aus 5 m -> 2 Stangen à 3x150', () => {
  const r = optimizeGroup({ parts: P(150, 6), stocks: [{ length: 500 }], kerf: 0.5 });
  assert.strictEqual(r.bins.length, 2);
  r.bins.forEach(b => assert.strictEqual(b.parts.length, 3));
  assert.strictEqual(r.bins[0].waste, 500 - 451 - 0.5);
});

test('Pfetten 12x16 390 cm: 2 Stangen, 4 m bevorzugt wenn verfügbar', () => {
  const r5 = optimizeGroup({ parts: P(390, 2), stocks: [{ length: 500 }], kerf: 0.5 });
  assert.strictEqual(r5.bins.length, 2);
  const r45 = optimizeGroup({ parts: P(390, 2), stocks: [{ length: 400 }, { length: 500 }], kerf: 0.5 });
  assert.deepStrictEqual(r45.bins.map(b => b.stockLength), [400, 400]);
});

test('Profilholz 400 aus 4 m: exakt passend, kein Verschnitt', () => {
  const r = optimizeGroup({ parts: P(400, 13), stocks: [{ length: 400 }], kerf: 0.5 });
  assert.strictEqual(r.bins.length, 13);
  assert.strictEqual(r.summary.waste, 0);
});

test('Teile länger als längste Lagerlänge werden markiert', () => {
  const r = optimizeGroup({ parts: [...P(520, 1), ...P(200, 2)], stocks: [{ length: 400 }, { length: 500 }], kerf: 0.5 });
  assert.strictEqual(r.tooLong.length, 1);
  assert.strictEqual(r.tooLong[0].length, 520);
  assert.strictEqual(r.bins.length, 1);
  assert.strictEqual(r.bins[0].stockLength, 500); // 200+200+0.5 = 400.5 > 400
});

test('Sägeschnitt wird berücksichtigt', () => {
  // 2x250 = 500 genau; mit 0.5 Schnitt passt es nicht mehr in 500
  const noKerf = optimizeGroup({ parts: P(250, 2), stocks: [{ length: 500 }], kerf: 0 });
  assert.strictEqual(noKerf.bins.length, 1);
  assert.strictEqual(noKerf.bins[0].waste, 0);
  const kerf = optimizeGroup({ parts: P(250, 2), stocks: [{ length: 500 }], kerf: 0.5 });
  assert.strictEqual(kerf.bins.length, 2);
});

test('Kostenminimierung mit Preisen (Stück vs. laufender Meter)', () => {
  assert.strictEqual(pieceCost({ length: 500, price: 4, priceUnit: 'meter' }), 20);
  assert.strictEqual(pieceCost({ length: 500, price: 18, priceUnit: 'piece' }), 18);
  // 3 parts of 240: options 400@10 each (3 pcs = 30) vs 500@... 2x240+0.5 = 480.5 fits 500
  const cheap5 = optimizeGroup({ parts: P(240, 3), stocks: [{ length: 400, price: 10 }, { length: 500, price: 12 }], kerf: 0.5 });
  // best: 500(240+240)=12 + 400(240)=10 => 22
  assert.strictEqual(cheap5.summary.cost, 22);
  assert.ok(cheap5.priced);
});

test('Exakte Lösung schlägt einfaches FFD', () => {
  // Classic FFD-suboptimal instance, stock 100, no kerf
  const parts = [44, 24, 24, 22, 21, 17, 8, 8, 6, 6].map((l, i) => ({ length: l, id: 'p' + i }));
  // total = 180 -> lower bound 2 bins
  const r = optimizeGroup({ parts, stocks: [{ length: 100 }], kerf: 0 });
  assert.strictEqual(r.bins.length, 2);
  assert.ok(r.exact);
});

test('FFD-Gegenbeispiel: optimale Packung wird gefunden', () => {
  // stock 10: parts 5,4,3,3,3,2 (sum 20). FFD: [5,4],[3,3,3],[2] -> 3 bins; optimal: [5,3,2],[4,3,3] -> 2
  const parts = [5, 4, 3, 3, 3, 2].map((l, i) => ({ length: l, id: 'q' + i }));
  const r = optimizeGroup({ parts, stocks: [{ length: 10 }], kerf: 0 });
  assert.strictEqual(r.bins.length, 2);
});

test('Ohne Lagerlänge: alles als zu lang markiert', () => {
  const r = optimizeGroup({ parts: P(100, 2), stocks: [], kerf: 0.5 });
  assert.strictEqual(r.tooLong.length, 2);
  assert.ok(r.noStock);
});

test('Große Eingabe läuft schnell und vollständig zugeordnet', () => {
  const lens = [];
  for (let i = 0; i < 80; i++) lens.push(50 + ((i * 37) % 300) + 0.5);
  const parts = lens.map((l, i) => ({ length: l, id: 'r' + i }));
  const t = Date.now();
  const r = optimizeGroup({ parts, stocks: [{ length: 400 }, { length: 500 }], kerf: 0.5 });
  assert.ok(Date.now() - t < 5000);
  assert.strictEqual(r.bins.reduce((s, b) => s + b.parts.length, 0), 80);
  r.bins.forEach(b => assert.ok(b.used <= b.stockLength + 1e-9));
});

test('wasteOf: Rest kleiner Sägeschnitt ergibt 0', () => {
  assert.strictEqual(wasteOf(500, [{ length: 499.8 }], 0.5), 0);
});
