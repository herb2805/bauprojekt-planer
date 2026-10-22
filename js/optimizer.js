/*
 * Bauprojekt-Planer – 1D-Zuschnittoptimierung (Cutting Stock)
 * Units: centimetres. Works in browser (window.Optimizer) and Node (module.exports).
 *
 * Kerf model: n parts on one stock piece need n-1 cuts between them plus one more cut
 * to separate the offcut (only if offcut > 0). Feasible if sum + kerf*(n-1) <= stock length.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Optimizer = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const EPS = 1e-9;

  function pieceCost(stock) {
    if (stock.price == null || stock.price === '' || isNaN(Number(stock.price))) return null;
    const p = Number(stock.price);
    return stock.priceUnit === 'meter' ? p * stock.length / 100 : p;
  }

  function usedLength(parts, kerf) {
    if (!parts.length) return 0;
    return parts.reduce((s, p) => s + p.length, 0) + kerf * (parts.length - 1);
  }

  function wasteOf(stockLen, parts, kerf) {
    const rest = stockLen - usedLength(parts, kerf);
    if (rest <= EPS) return 0;
    return Math.max(0, rest - kerf); // final separating cut
  }

  // free capacity when adding a new part: need part.length + kerf (if bin not empty)
  function fits(bin, len, kerf) {
    const add = bin.parts.length ? len + kerf : len;
    return bin.used + add <= bin.stock.length + EPS;
  }
  function place(bin, part, kerf) {
    bin.used += bin.parts.length ? part.length + kerf : part.length;
    bin.parts.push(part);
  }

  function objective(bins, priced) {
    let v = 0;
    for (const b of bins) v += priced ? b.cost : b.stock.length;
    return v + bins.length * 1e-6; // tie-break: fewer pieces
  }

  function cloneBins(bins) {
    return bins.map(b => ({ stock: b.stock, cost: b.cost, used: b.used, parts: b.parts.slice() }));
  }

  function newBin(stock) { return { stock, cost: pieceCost(stock) || 0, used: 0, parts: [] }; }

  // First-fit decreasing with a given stock chooser
  function ffd(parts, stocks, kerf, chooseNew) {
    const bins = [];
    for (const p of parts) {
      let b = bins.find(x => fits(x, p.length, kerf));
      if (!b) { b = newBin(chooseNew(p)); bins.push(b); }
      place(b, p, kerf);
    }
    return bins;
  }

  // Improvement: shrink each bin to the cheapest/shortest stock that still holds its parts
  function downsize(bins, stocks, kerf, priced) {
    for (const b of bins) {
      const need = usedLength(b.parts, kerf);
      let best = b.stock;
      for (const s of stocks) {
        if (s.length + EPS < need) continue;
        const sv = priced ? pieceCost(s) : s.length;
        const bv = priced ? pieceCost(best) : best.length;
        if (sv < bv - EPS) best = s;
      }
      if (best !== b.stock) { b.stock = best; b.cost = pieceCost(best) || 0; }
    }
    return bins;
  }

  function heuristic(parts, stocks, kerf, priced) {
    const candidates = [];
    const maxLen = Math.max(...stocks.map(s => s.length));
    for (const s of stocks) {
      if (s.length + EPS < parts[0].length) continue;
      candidates.push(ffd(parts, stocks, kerf, () => s));
    }
    // mixed: open the longest stock, later downsize
    candidates.push(ffd(parts, stocks, kerf, () => stocks.find(s => s.length === maxLen)));
    // mixed: open the smallest stock that fits the part
    const asc = stocks.slice().sort((a, b) => a.length - b.length);
    candidates.push(ffd(parts, stocks, kerf, p => asc.find(s => s.length + EPS >= p.length)));
    let best = null, bestV = Infinity;
    for (const c of candidates) {
      downsize(c, stocks, kerf, priced);
      const v = objective(c, priced);
      if (v < bestV - EPS) { bestV = v; best = c; }
    }
    return best;
  }

  // Branch and bound (exact if it finishes within nodeLimit)
  function branchAndBound(parts, stocks, kerf, priced, initial, nodeLimit) {
    let best = cloneBins(initial), bestV = objective(initial, priced);
    let nodes = 0, complete = true;
    const suffix = new Array(parts.length + 1).fill(0);
    for (let i = parts.length - 1; i >= 0; i--) suffix[i] = suffix[i + 1] + parts[i].length;
    const unit = priced
      ? Math.min(...stocks.map(s => pieceCost(s) / s.length))
      : 1;
    const bins = [];
    const lastBinOf = new Array(parts.length).fill(-1);
    let cur = 0;

    function lowerBound(i) {
      let free = 0;
      for (const b of bins) free += Math.max(0, b.stock.length - b.used - (b.parts.length ? kerf : 0));
      const need = Math.max(0, suffix[i] - free);
      return cur + need * unit;
    }

    function rec(i) {
      if (++nodes > nodeLimit) { complete = false; return; }
      if (i === parts.length) {
        const v = objective(bins, priced);
        if (v < bestV - EPS) { bestV = v; best = cloneBins(bins); }
        return;
      }
      if (lowerBound(i) >= bestV - 1e-5) return;
      const p = parts[i];
      const minIdx = (i > 0 && Math.abs(parts[i - 1].length - p.length) < EPS) ? lastBinOf[i - 1] : 0;
      const seen = new Set();
      for (let k = Math.max(0, minIdx); k < bins.length; k++) {
        const b = bins[k];
        if (!fits(b, p.length, kerf)) continue;
        const sig = b.stock.length + '|' + b.used.toFixed(4) + '|' + b.cost;
        if (seen.has(sig)) continue;
        seen.add(sig);
        const prevUsed = b.used;
        place(b, p, kerf); lastBinOf[i] = k;
        rec(i + 1);
        b.parts.pop(); b.used = prevUsed;
        if (!complete) return;
      }
      for (const s of stocks) {
        if (s.length + EPS < p.length) continue;
        const b = newBin(s);
        place(b, p, kerf);
        bins.push(b); lastBinOf[i] = bins.length - 1;
        cur += priced ? b.cost : s.length;
        rec(i + 1);
        cur -= priced ? b.cost : s.length;
        bins.pop();
        if (!complete) return;
      }
    }
    rec(0);
    return { bins: best, exact: complete, nodes };
  }

  /**
   * optimizeGroup({ parts:[{length, label, ...}], stocks:[{length, price?, priceUnit?}], kerf })
   * returns { bins:[{stockLength, parts, waste, cost}], tooLong:[parts], summary, exact, priced }
   */
  function optimizeGroup(opts) {
    const kerf = Math.max(0, Number(opts.kerf) || 0);
    const stocks = (opts.stocks || [])
      .map(s => ({ ...s, length: Number(s.length) }))
      .filter(s => s.length > 0);
    const nodeLimit = opts.nodeLimit || 300000;
    const allParts = (opts.parts || []).map(p => ({ ...p, length: Number(p.length) })).filter(p => p.length > 0);
    const result = { bins: [], tooLong: [], exact: true, priced: false, summary: null };
    if (!stocks.length) {
      result.tooLong = allParts; result.noStock = true;
      result.summary = summarize([], allParts, false); return result;
    }
    const maxLen = Math.max(...stocks.map(s => s.length));
    const parts = [], tooLong = [];
    for (const p of allParts) (p.length > maxLen + EPS ? tooLong : parts).push(p);
    parts.sort((a, b) => b.length - a.length);
    const priced = stocks.every(s => pieceCost(s) != null);
    result.priced = priced; result.tooLong = tooLong;
    if (parts.length) {
      const h = heuristic(parts, stocks, kerf, priced);
      const bb = branchAndBound(parts, stocks, kerf, priced, h, nodeLimit);
      result.exact = bb.exact;
      result.bins = bb.bins
        .map(b => ({
          stockLength: b.stock.length,
          stock: b.stock,
          parts: b.parts.slice().sort((x, y) => y.length - x.length),
          used: usedLength(b.parts, kerf),
          waste: wasteOf(b.stock.length, b.parts, kerf),
          cost: pieceCost(b.stock)
        }))
        .sort((a, b) => b.stockLength - a.stockLength || b.used - a.used);
    }
    result.summary = summarize(result.bins, tooLong, priced);
    return result;
  }

  function summarize(bins, tooLong, priced) {
    const byStock = {};
    let waste = 0, cost = 0, stockTotal = 0, partsTotal = 0;
    for (const b of bins) {
      const k = b.stockLength;
      byStock[k] = byStock[k] || { stockLength: k, count: 0, cost: 0 };
      byStock[k].count++;
      if (b.cost != null) { byStock[k].cost += b.cost; cost += b.cost; }
      waste += b.waste; stockTotal += b.stockLength;
      partsTotal += b.parts.reduce((s, p) => s + p.length, 0);
    }
    return {
      byStock: Object.values(byStock).sort((a, b) => b.stockLength - a.stockLength),
      pieces: bins.length, waste, stockTotal, partsTotal,
      cost: priced ? cost : null,
      utilization: stockTotal ? partsTotal / stockTotal : 0,
      tooLongCount: tooLong.length
    };
  }

  return { optimizeGroup, pieceCost, usedLength, wasteOf };
});
