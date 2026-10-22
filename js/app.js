/* Bauprojekt-Planer – App-Logik (Vanilla JS, Daten in localStorage) */
(function () {
  'use strict';
  const STORE_KEY = 'bauplaner.v1';
  const DEFAULT_STOCK = [400, 500];
  const DEFAULT_KERF = 0.5;
  const STATUSES = ['offen', 'angefragt', 'bestellt', 'geliefert'];
  const TABS = ['projekte', 'liste', 'lager', 'zuschnitt', 'material', 'bestellung'];

  // ---------- helpers ----------
  const $ = (sel, el = document) => el.querySelector(sel);
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.').trim()); return isFinite(n) ? n : NaN; };
  const fmt = (n, d = 1) => Number(n).toLocaleString('de-DE', { maximumFractionDigits: d });
  const fmtX = s => String(s).replace(/x/g, '×');
  const fmtM = cm => (cm / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m';
  const eur = n => n == null ? '–' : Number(n).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  const normSection = s => String(s || '').toLowerCase().replace(/cm/g, '').replace(/[×*]/g, 'x').replace(/,/g, '.').replace(/\s+/g, '');
  const displaySection = s => normSection(s).replace(/\./g, ',');
  const groupKey = it => (it.material || '').trim() + '|' + normSection(it.section);
  const groupLabel = key => { const [m, s] = key.split('|'); return `${m || 'Material'} ${fmtX(displaySection(s))}`.trim(); };

  // ---------- state ----------
  let state = load();
  let editingItemId = null;
  let listSel = null;        // selected Querschnitt-Gruppe in Holzliste ('neu' = new)
  let draftQty = 1;
  let matDraft = null;       // Material entry being edited
  let menuFor = null;        // project id with open actions
  let showNewProject = false;
  let orderFilter = 'alle';

  function exampleProject() {
    const it = (designation, material, section, length, qty) => ({ id: uid(), designation, material, section, length, qty });
    return {
      id: uid(), name: 'Vordach', created: new Date().toISOString(), kerf: DEFAULT_KERF,
      items: [
        it('Balken A', 'KVH', '12x12', 398, 2),
        it('Balken B', 'KVH', '12x12', 362.5, 2),
        it('Balken C', 'KVH', '12x12', 98, 2),
        it('Balken D', 'KVH', '12x12', 114, 2),
        it('Pfette', 'KVH', '12x16', 390, 2),
        it('Sparren', 'KVH', '8x12', 150, 6),
        it('Profilbrett', 'Profilholz', '11.5x2', 400, 13)
      ],
      stock: {
        'KVH|12x12': { priceUnit: 'piece', lengths: [{ length: 500, price: null }] },
        'KVH|12x16': { priceUnit: 'piece', lengths: [{ length: 500, price: null }] },
        'KVH|8x12': { priceUnit: 'piece', lengths: [{ length: 500, price: null }] },
        'Profilholz|11.5x2': { priceUnit: 'piece', lengths: [{ length: 400, price: null }] }
      },
      materials: [
        { id: uid(), kind: 'beton', name: 'Pfostenlöcher Vordach', shape: 'rund', diameter: 30, depth: 80, qty: 4, zuschlag: 10,
          method: 'sack', bagKg: 25, bagLitres: 13, bagPrice: null, ratio: 4, cementBagKg: 25 },
        { id: uid(), kind: 'putz', name: 'Kellerwand Nord', mode: 'direkt', area: 10, length: null, height: null, openings: [],
          thickness: 15, type: 'kalkzement', kgPerM2mm: 1.4, zuschlag: 10, bagKg: 30, bagPrice: null }
      ],
      orders: {}
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && Array.isArray(s.projects)) { s.projects.forEach(normProject); return s; }
      }
    } catch (e) { console.warn('Daten konnten nicht geladen werden', e); }
    const p = exampleProject();
    return { version: 1, currentId: p.id, projects: [p] };
  }
  function normProject(p) {
    p.items = Array.isArray(p.items) ? p.items : [];
    p.stock = p.stock || {}; p.orders = p.orders || {};
    p.materials = Array.isArray(p.materials) ? p.materials : [];
    if (p.kerf == null) p.kerf = DEFAULT_KERF;
    return p;
  }
  function save() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  const current = () => state.projects.find(p => p.id === state.currentId) || null;

  function stockFor(project, key) {
    const s = project.stock[key];
    if (s && Array.isArray(s.lengths)) return s;
    return { priceUnit: 'piece', lengths: DEFAULT_STOCK.map(l => ({ length: l, price: null })) };
  }
  function ensureStock(project, key) {
    if (!project.stock[key]) project.stock[key] = stockFor(project, key);
    return project.stock[key];
  }

  function groups(project) {
    const map = new Map();
    for (const it of project.items) {
      const k = groupKey(it);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(it);
    }
    return map;
  }

  // ---------- optimization ----------
  function optimizeProject(project) {
    const out = [];
    for (const [key, items] of groups(project)) {
      const st = stockFor(project, key);
      const parts = [];
      items.forEach(it => {
        for (let i = 0; i < (it.qty || 0); i++) parts.push({ id: it.id + '_' + i, itemId: it.id, label: it.designation || '–', length: it.length });
      });
      const res = Optimizer.optimizeGroup({
        parts, kerf: project.kerf ?? DEFAULT_KERF,
        stocks: st.lengths.map(l => ({ length: l.length, price: l.price, priceUnit: st.priceUnit }))
      });
      const designations = [...new Set(items.map(i => i.designation || '–'))];
      out.push({ key, label: groupLabel(key), items, res, designations });
    }
    return out;
  }

  // ---------- toast ----------
  let toastT;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200);
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); toast('In die Zwischenablage kopiert'); }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('In die Zwischenablage kopiert'); } catch (_) { toast('Kopieren nicht möglich'); }
      ta.remove();
    }
  }

  // ---------- routing ----------
  function currentTab() { const t = (location.hash || '').replace(/^#\/?/, ''); return TABS.includes(t) ? t : 'projekte'; }
  function go(tab) { if (location.hash !== '#/' + tab) location.hash = '#/' + tab; else render(); }
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

  const TITLES = { projekte: 'Meine Projekte', liste: 'Holzliste', lager: 'Lager & Preise', zuschnitt: 'Zuschnittplan', material: 'Beton & Putz', bestellung: 'Bestellung' };
  const ICON = {
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', check: '<path d="m5 12 5 5L20 7"/>',
    dots: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>',
    warn: '<path d="M12 3 2 21h20z"/><path d="M12 10v5M12 18h.01"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'
  };
  const ic = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;

  function render() {
    const tab = currentTab();
    const p = current();
    $('#current-project').textContent = tab === 'projekte' ? 'Holzwerk' : (p ? p.name : 'Kein Projekt');
    $('#page-title').textContent = TITLES[tab];
    $('#top-action').innerHTML = tab === 'projekte'
      ? `<button class="iconbtn iconbtn--acc" data-act="toggle-new-project" aria-label="Neues Projekt">${ic('plus')}</button>` : '';
    document.querySelectorAll('.tab').forEach(b => { if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const view = $('#view');
    if (tab !== 'projekte' && !p) { view.innerHTML = `<div class="card stack"><p>Bitte zuerst ein Projekt anlegen oder öffnen.</p><button class="btn btn--pri" data-go="projekte">Zu den Projekten</button></div>`; return; }
    view.innerHTML = ({ projekte: viewProjects, liste: viewList, lager: viewStock, zuschnitt: viewCut, material: viewMaterial, bestellung: viewOrder })[tab](p);
  }

  // ---------- views: Projekte ----------
  function projectStats(p) {
    const parts = p.items.reduce((s, i) => s + (i.qty || 0), 0);
    const netM = p.items.reduce((s, i) => s + (i.qty || 0) * (i.length || 0), 0) / 100;
    const mats = [...new Set(p.items.map(i => i.material).filter(Boolean))];
    return { parts, netM, mats };
  }
  function viewProjects() {
    const newForm = (showNewProject || !state.projects.length) ? `<form class="card form" data-form="new-project">
        <label class="lbl" for="np-name">Neues Projekt</label>
        <div class="frow"><input id="np-name" class="grow" name="name" placeholder="z. B. Terrasse" required>
        <button class="btn btn--pri">Anlegen</button></div></form>` : '';
    const cards = state.projects.map(p => {
      const st = projectStats(p), active = p.id === state.currentId;
      const menu = menuFor === p.id ? `<div class="row menu">
          <button class="btn btn--ghost btn--sm" data-act="rename-project" data-id="${p.id}">Umbenennen</button>
          <button class="btn btn--ghost btn--sm" data-act="duplicate-project" data-id="${p.id}">Kopieren</button>
          <button class="btn btn--danger btn--sm" data-act="delete-project" data-id="${p.id}">Löschen</button></div>` : '';
      const sub = `${esc(st.mats.join(', ') || 'Noch keine Holzliste')} · ${st.parts} Teile${p.materials.length ? ' · ' + p.materials.length + ' Material' : ''}`;
      if (!active) {
        return `<div class="card project">
          <div class="prow"><div class="grow"><h3>${esc(p.name)}</h3><div class="muted small">${sub}</div></div>
            <button class="iconbtn iconbtn--ghost iconbtn--sm" data-act="project-menu" data-id="${p.id}" aria-label="Aktionen">${ic('dots')}</button></div>
          ${menu}
          <button class="btn btn--ghost btn--block" style="margin-top:12px" data-act="open-project" data-id="${p.id}">Öffnen</button>
        </div>`;
      }
      const lines = orderLines(p);
      const done = lines.filter(l => l.status === 'geliefert').length;
      const pct = lines.length ? Math.round(done / lines.length * 100) : 0;
      const stangen = lines.filter(l => !l.mat && !l.tooLong).reduce((s, l) => s + l.count, 0);
      const step = (ok, label) => `<li class="${ok ? 'done' : ''}">${ok ? ic('check', 's') : ''}${label}</li>`;
      return `<div class="card project project--active">
        <div class="prow"><span class="pill pill--live">Aktiv</span>
          <button class="iconbtn iconbtn--glass iconbtn--sm" data-act="project-menu" data-id="${p.id}" aria-label="Aktionen">${ic('dots')}</button></div>
        <h2>${esc(p.name)}</h2><div class="muted">${sub}</div>
        ${menu}
        <div class="progress"><div class="pbar"><i style="width:${pct}%"></i></div><span class="pnum">${pct} %</span></div>
        <ul class="steps">${step(p.items.length, 'Liste')}${step(p.items.length, 'Zuschnitt')}${step(p.materials.length, 'Material')}
          <li class="cur">Geliefert ${done}/${lines.length}</li></ul>
        <div class="kpis"><div><b>${fmt(st.netM, 2)} m</b><span>Holz netto</span></div><div><b>${stangen}</b><span>Stangen</span></div>
          <div><b>${p.materials.length}</b><span>Beton/Putz</span></div></div>
        <button class="btn btn--white btn--block" data-go="${p.items.length ? 'zuschnitt' : 'liste'}">${p.items.length ? 'Weiter: Zuschnitt ansehen' : 'Weiter: Holzliste anlegen'}</button>
      </div>`;
    }).join('');
    return `${newForm}${cards || ''}
      <div class="card stack">
        <h3>Daten sichern</h3>
        <p class="muted small">Alle Daten liegen nur auf diesem Gerät. Mit dem Export kannst du sie sichern oder auf ein anderes Gerät übertragen.</p>
        <div class="row">
          <button class="btn btn--ghost btn--sm" data-act="export-json">JSON exportieren</button>
          <label class="btn btn--ghost btn--sm">JSON importieren
            <input type="file" accept="application/json,.json" data-act="import-json" class="hidden"></label>
          <button class="btn btn--ghost btn--sm" data-act="load-example">Beispiel „Vordach“</button>
        </div>
      </div>`;
  }

  // ---------- views: Holzliste ----------
  const colorIdx = (designations, label) => (Math.max(0, designations.indexOf(label)) % 6) + 1;
  function viewList(p) {
    const editing = editingItemId ? p.items.find(i => i.id === editingItemId) : null;
    const gmap = groups(p), keys = [...gmap.keys()];
    if (editing) listSel = groupKey(editing);
    if (listSel !== 'neu' && !keys.includes(listSel)) listSel = keys.length ? keys[keys.length - 1] : 'neu';
    const multiMat = new Set(keys.map(k => k.split('|')[0])).size > 1;
    const chips = keys.map(k => { const [m, s] = k.split('|'); return `<button type="button" class="chip ${listSel === k ? 'on' : ''}" data-act="list-sel" data-key="${esc(k)}">${multiMat ? `<small>${esc(m)}</small> ` : ''}${esc(fmtX(displaySection(s)))}</button>`; }).join('');
    const e = editing || { designation: '', length: '' };
    const qty = editing ? editing.qty : draftQty;
    const [selM, selS] = listSel !== 'neu' ? listSel.split('|') : [lastMaterial(p), ''];
    const mats = [...new Set(['KVH', 'BSH', 'Latte', 'Profilholz', 'Dachlatte', 'OSB', ...p.items.map(i => i.material)].filter(Boolean))];
    const totalParts = p.items.reduce((s, i) => s + (i.qty || 0), 0);
    const totalM = p.items.reduce((s, i) => s + (i.qty || 0) * i.length, 0) / 100;
    let list = '';
    for (const [key, items] of gmap) {
      const des = [...new Set(items.map(i => i.designation || '–'))];
      const sumM = items.reduce((s, i) => s + i.qty * i.length, 0) / 100;
      list += `<div class="grph"><span>${esc(groupLabel(key))}</span><span class="mono">${fmt(sumM, 2)} m</span></div>
        ${items.map(i => `<div class="lrow ${editingItemId === i.id ? 'lrow--edit' : ''}">
          <span class="dot c${colorIdx(des, i.designation || '–')}"></span>
          <div class="lmain"><span class="len">${fmt(i.length, 2)} cm</span><span class="muted small">${esc(i.designation || '–')}</span></div>
          <span class="qty">${i.qty}×</span><span class="sum">${fmt(i.qty * i.length / 100, 2)} m</span>
          <button class="iconbtn iconbtn--xs" data-act="edit-item" data-id="${i.id}" aria-label="Bearbeiten">${ic('edit', 's')}</button>
          <button class="iconbtn iconbtn--xs" data-act="delete-item" data-id="${i.id}" aria-label="Löschen">${ic('x', 's')}</button>
        </div>`).join('')}`;
    }
    return `<form class="card form" data-form="item">
        <div><span class="lbl">Querschnitt (cm)</span>
          <div class="chips">${chips}<button type="button" class="chip chip--add ${listSel === 'neu' ? 'on' : ''}" data-act="list-sel" data-key="neu">${ic('plus', 's')}Neu</button></div></div>
        ${listSel === 'neu' ? `<div class="frow">
          <label class="field"><span class="lbl">Material</span><input name="material" list="dl-mat" value="${esc(selM)}" placeholder="KVH" required></label>
          <label class="field"><span class="lbl">Querschnitt</span><input name="section" class="mono" value="" placeholder="12x12" required></label></div>`
        : `<input type="hidden" name="material" value="${esc(selM)}"><input type="hidden" name="section" value="${esc(selS)}">`}
        <label class="field"><span class="lbl">Bezeichnung</span><input name="designation" value="${esc(e.designation)}" placeholder="z. B. Pfette, Sparren"></label>
        <div class="frow">
          <label class="field"><span class="lbl">Länge</span><span class="inp"><input name="length" inputmode="decimal" value="${e.length === '' ? '' : esc(fmt(e.length, 2))}" placeholder="0" required><span>cm</span></span></label>
          <div class="field"><span class="lbl">Stück</span><div class="stepper">
            <button type="button" data-act="qty-dec" aria-label="weniger">${ic('minus')}</button>
            <input name="qty" type="number" min="1" step="1" inputmode="numeric" value="${esc(qty)}" aria-label="Anzahl" required>
            <button type="button" data-act="qty-inc" aria-label="mehr">${ic('plus')}</button></div></div>
          <div class="field field--btn"><button class="iconbtn iconbtn--pri iconbtn--round" aria-label="${editing ? 'Änderung speichern' : 'Position hinzufügen'}">${ic('check')}</button></div>
        </div>
        ${editing ? '<button type="button" class="btn btn--ghost btn--sm" data-act="cancel-edit">Bearbeiten abbrechen</button>' : ''}
        <datalist id="dl-mat">${mats.map(m => `<option value="${esc(m)}">`).join('')}</datalist>
      </form>
      <div class="listhead"><h2>Teile <span class="muted">${totalParts}</span></h2><span class="total">${fmt(totalM, 2)} m gesamt</span></div>
      ${list ? `<div class="grp">${list}</div>` : '<p class="muted center">Noch keine Positionen.</p>'}`;
  }
  function lastMaterial(p) { return p.items.length ? p.items[p.items.length - 1].material : 'KVH'; }

  // ---------- views: Lager ----------
  function viewStock(p) {
    const gs = [...groups(p).keys()];
    const cards = gs.map(key => {
      const st = stockFor(p, key);
      return `<div class="card stack" data-group="${esc(key)}">
        <div class="group-head"><h3>${esc(groupLabel(key))}</h3>
          <select data-act="price-unit" data-key="${esc(key)}" class="select--sm" aria-label="Preisangabe">
            <option value="piece" ${st.priceUnit !== 'meter' ? 'selected' : ''}>€ / Stück</option>
            <option value="meter" ${st.priceUnit === 'meter' ? 'selected' : ''}>€ / lfm</option>
          </select></div>
        ${st.lengths.map((l, idx) => `<div class="stock-row">
          <label class="field"><span class="lbl">Lagerlänge</span><span class="inp inp--sm"><input inputmode="decimal" data-act="stock-len" data-key="${esc(key)}" data-idx="${idx}" value="${esc(fmt(l.length, 2))}"><span>cm</span></span></label>
          <label class="field"><span class="lbl">Preis (optional)</span><span class="inp inp--sm"><input inputmode="decimal" data-act="stock-price" data-key="${esc(key)}" data-idx="${idx}" value="${l.price == null ? '' : esc(fmt(l.price, 2))}" placeholder="–"><span>€</span></span></label>
          <button class="iconbtn iconbtn--ghost iconbtn--sm" data-act="stock-del" data-key="${esc(key)}" data-idx="${idx}" aria-label="Entfernen">${ic('x', 's')}</button>
        </div>`).join('')}
        <button class="btn btn--ghost btn--sm" data-act="stock-add" data-key="${esc(key)}">${ic('plus', 's')} Lagerlänge</button>
      </div>`;
    }).join('');
    return `<div class="card stack"><label class="field"><span class="lbl">Sägeschnitt / Schnittfuge</span>
        <span class="inp"><input inputmode="decimal" data-act="kerf" value="${esc(fmt(p.kerf ?? DEFAULT_KERF, 2))}"><span>cm</span></span></label>
        <p class="muted small">Wird zwischen den Teilen abgezogen. Preise sind optional. Sind für alle Längen eines Querschnitts Preise hinterlegt, wird auf Kosten optimiert, sonst auf möglichst wenig Verschnitt.</p></div>
      ${cards || '<p class="muted center">Erst Positionen in der Holzliste anlegen.</p>'}`;
  }

  // ---------- views: Zuschnitt ----------
  function patterns(bins) {
    const map = new Map();
    for (const b of bins) {
      const sig = b.stockLength + ':' + b.parts.map(x => x.label + '@' + x.length).join(',');
      if (!map.has(sig)) map.set(sig, { bin: b, count: 0 });
      map.get(sig).count++;
    }
    return [...map.values()];
  }

  function barHtml(bin, designations) {
    const L = bin.stockLength;
    const parts = bin.parts.map(x => {
      const w = (x.length / L) * 100;
      return `<div class="seg c${colorIdx(designations, x.label)}" style="width:${w}%" title="${esc(x.label)} ${fmt(x.length)} cm"><em>${w > 9 ? fmt(x.length) : ''}</em></div>`;
    }).join('');
    const waste = bin.waste > 0 ? `<div class="rest" style="flex:1" title="Rest ${fmt(bin.waste)} cm"></div>` : '';
    return `<div class="track">${parts}${waste}</div>`;
  }
  const stockTag = byStock => byStock.map(b => `${b.count} × ${fmt(b.stockLength / 100, 2)} m`).join(' + ');

  function viewCut(p) {
    const res = optimizeProject(p);
    if (!res.length) return `<p class="muted center">Erst Positionen in der Holzliste anlegen.</p>`;
    let totalCost = 0, anyCost = false, totalPieces = 0, stockTotal = 0, waste = 0, allExact = true;
    const cards = res.map(g => {
      const r = g.res, s = r.summary;
      totalPieces += s.pieces; stockTotal += s.stockTotal; waste += s.waste; allExact = allExact && r.exact;
      if (s.cost != null) { totalCost += s.cost; anyCost = true; }
      const tooLong = r.tooLong.length ? `<p class="warn">${ic('warn', 's')}<span><b>${r.noStock ? 'Keine Lagerlänge hinterlegt' : 'Zu lang für alle Lagerlängen'}:</b> ${
        Object.entries(r.tooLong.reduce((a, x) => (a[x.label + ' ' + fmt(x.length) + ' cm'] = (a[x.label + ' ' + fmt(x.length) + ' cm'] || 0) + 1, a), {}))
          .map(([k, n]) => `${n}× ${esc(k)}`).join(', ')}</span></p>` : '';
      const pats = patterns(r.bins).map(({ bin, count }) => `<div class="cbar">
          <div class="cmeta"><span class="mult">${count}×</span><span>${fmt(bin.stockLength / 100, 2)} m</span><span class="cparts">${bin.parts.map(x => esc(x.label)).join(' · ')}</span><span class="restl">Rest ${fmt(bin.waste)} cm</span></div>
          ${barHtml(bin, g.designations)}
        </div>`).join('');
      const wpct = s.stockTotal ? s.waste / s.stockTotal * 100 : 0;
      return `<div class="cgrp">
        <div class="cgh"><b>${esc(g.label)}</b>${s.byStock.length ? `<span class="tag">${stockTag(s.byStock)}</span>` : ''}<span class="vs">${fmt(wpct, 1)} %</span></div>
        ${pats}${tooLong}
        <p class="alt">${r.exact ? 'Optimal' : 'Näherung'} · ${s.pieces} Stangen · Verschnitt ${fmt(s.waste)} cm${s.cost != null ? ' · ' + eur(s.cost) : ''}</p>
      </div>`;
    }).join('');
    const wpct = stockTotal ? waste / stockTotal * 100 : 0;
    return `<div class="card sumcard">
        <div><b>${totalPieces}</b><span>Stangen</span></div>
        <div><b>${fmt(stockTotal / 100, 2)} m</b><span>Material</span></div>
        <div><b>${fmt(waste / 100, 2)} m</b><span>Verschnitt ${fmt(wpct, 1)} %</span></div>
        <p class="algo">${allExact ? 'Exakt optimiert' : 'Optimiert (teils Näherung)'} je Querschnitt · Sägeschnitt ${fmt(p.kerf ?? DEFAULT_KERF, 2)} cm${anyCost ? ' · ' + eur(totalCost) : ''}</p>
      </div>
      ${cards}`;
  }

  // ---------- views: Material (Beton & Putz) ----------
  const NUM_FIELDS = ['diameter', 'depth', 'length', 'width', 'height', 'area', 'thickness', 'qty', 'zuschlag', 'bagKg', 'bagLitres', 'bagPrice',
    'ratio', 'cementBagKg', 'cementBagPrice', 'kiesPricePerT', 'transportPrice', 'kgPerM2mm'];
  const vIn = v => v == null || v === '' ? '' : String(v).replace('.', ',');
  const toNum = v => { const x = num(v); return isFinite(x) ? x : null; };
  function newDraft(kind) {
    if (kind === 'putz') {
      const t = Material.PUTZ_TYPES[0];
      return { kind, name: '', mode: 'wand', length: '', height: '', openings: [], area: '', thickness: 15, type: t.id, kgPerM2mm: t.kgPerM2mm, zuschlag: Material.DEFAULT_ZUSCHLAG, bagKg: t.bagKg, bagPrice: '' };
    }
    const b = Material.BETON_BAGS[0];
    return { kind: 'beton', name: '', shape: 'rund', diameter: 30, depth: 80, length: '', width: '', area: '', thickness: 15, qty: 1,
      zuschlag: Material.DEFAULT_ZUSCHLAG, method: 'sack', bagKg: b.kg, bagLitres: b.litres, bagPrice: '', ratio: Material.MIX_DEFAULTS.ratio,
      cementBagKg: Material.MIX_DEFAULTS.cementBagKg, cementBagPrice: '', kiesPricePerT: '', transportPrice: '' };
  }
  function cleanEntry(d) {
    const o = { ...d };
    for (const f of NUM_FIELDS) if (f in o) o[f] = toNum(o[f]);
    if (o.openings) o.openings = o.openings.map(x => ({ name: x.name || '', width: toNum(x.width), height: toNum(x.height), qty: toNum(x.qty) ?? 1 }));
    o.name = (o.name || '').trim() || (o.kind === 'putz' ? 'Putzfläche' : 'Beton');
    return o;
  }
  function describe(e) {
    if (e.kind === 'putz') {
      const r = Material.putzResult(e);
      const area = e.mode === 'direkt' ? `${fmt(r.net, 2)} m²` : `${fmt(n0(e.length), 2)} × ${fmt(n0(e.height), 2)} m${r.openings ? ` − ${fmt(r.openings, 2)} m² Öffnungen` : ''} = ${fmt(r.net, 2)} m²`;
      return `${area} · ${fmt(r.thickness, 1)} mm · ${r.typeLabel}`;
    }
    const q = n0(e.qty) || 1;
    if (e.shape === 'rund') return `${q} × Ø ${fmt(n0(e.diameter))} cm, ${fmt(n0(e.depth))} cm tief`;
    if (e.shape === 'eckig') return `${q} × ${fmt(n0(e.length))} × ${fmt(n0(e.width))} cm, ${fmt(n0(e.depth))} cm tief`;
    const area = n0(e.area) > 0 ? `${fmt(n0(e.area), 2)} m²` : `${fmt(n0(e.length), 2)} × ${fmt(n0(e.width), 2)} m`;
    return `${q > 1 ? q + ' × ' : ''}${area}, ${fmt(n0(e.thickness))} cm dick`;
  }
  const n0 = v => { const x = num(v); return isFinite(x) ? x : 0; };
  function resultHtml(e) {
    const r = Material.entryResult(e);
    const cost = r.cost != null ? `<div class="mres__cost">${eur(r.cost)}</div>` : '';
    if (e.kind === 'putz') {
      return `<div class="mres"><div><b class="big">${fmt(r.kgTotal, 0)} kg</b><span>${fmt(r.kg, 0)} kg + ${fmt(r.zuschlag, 0)} % Zuschlag<br>${fmt(r.kgPerM2mm, 2)} kg/m²/mm</span></div>
        <div class="mres__bags"><b>${r.bags}</b><span>Sack à ${fmt(r.bagKg)} kg</span><small>(${fmt(r.bagsExact, 2)})</small></div></div>${cost}`;
    }
    const vol = `<div><b class="big">${fmt(r.total, 3)} m³</b><span>= ${fmt(r.litres, 1)} l inkl. ${fmt(r.zuschlag, 0)} %<br>netto ${fmt(r.volume, 3)} m³</span></div>`;
    if (r.method === 'sack') return `<div class="mres">${vol}<div class="mres__bags"><b>${r.bags}</b><span>Sack à ${fmt(r.bagKg)} kg / ${fmt(r.bagLitres)} l</span><small>(${fmt(r.bagsExact, 2)})</small></div></div>${cost}`;
    if (r.method === 'selbst') return `<div class="mres">${vol}<div class="mres__bags"><b>${r.cementBags}</b><span>Sack Zement à ${fmt(r.cementBagKg)} kg</span><small>(${fmt(r.cementKg, 0)} kg)</small></div></div>
        <p class="mres__mix">Mischung 1:${fmt(r.ratio)} (Raumteile) · Kiessand 0/16: <b>${fmt(r.kiesM3, 2)} m³</b> ≈ ${fmt(r.kiesKg, 0)} kg</p>${cost}`;
    return `<div class="mres">${vol}<div class="mres__bags"><b>${fmt(r.total, 2)}</b><span>m³ Transportbeton</span><small>meist ab 1 m³ + Anfahrt</small></div></div>${cost}`;
  }
  const seg = (field, val, opts) => `<div class="seg3" role="group">${opts.map(([v, l]) => `<button type="button" class="${val === v ? 'on' : ''}" data-act="mf-set" data-f="${field}" data-v="${v}">${l}</button>`).join('')}</div>`;
  const mf = (f, label, unit, d, extra = '') => `<label class="field"><span class="lbl">${label}</span><span class="inp inp--sm"><input inputmode="decimal" data-mf="${f}" value="${esc(vIn(d[f]))}" ${extra}><span>${unit}</span></span></label>`;
  function editorHtml(d) {
    let body = '';
    if (d.kind === 'beton') {
      body += seg('shape', d.shape, [['rund', 'Loch rund'], ['eckig', 'Loch eckig'], ['flaeche', 'Fläche']]);
      if (d.shape === 'rund') body += `<div class="frow">${mf('diameter', 'Durchmesser', 'cm', d)}${mf('depth', 'Tiefe', 'cm', d)}${mf('qty', 'Anzahl', 'Stk', d, 'inputmode="numeric"')}</div>`;
      else if (d.shape === 'eckig') body += `<div class="frow">${mf('length', 'Länge', 'cm', d)}${mf('width', 'Breite', 'cm', d)}</div><div class="frow">${mf('depth', 'Tiefe', 'cm', d)}${mf('qty', 'Anzahl', 'Stk', d, 'inputmode="numeric"')}</div>`;
      else body += `<div class="frow">${mf('length', 'Länge', 'm', d)}${mf('width', 'Breite', 'm', d)}${mf('area', 'oder Fläche', 'm²', d)}</div>
        <div class="frow">${mf('thickness', 'Dicke', 'cm', d)}${mf('qty', 'Anzahl', 'Stk', d, 'inputmode="numeric"')}</div>
        <p class="muted small">Für Platte oder Streifenfundament. Ist „Fläche“ ausgefüllt, gilt sie statt Länge × Breite.</p>`;
      body += `<div class="frow">${mf('zuschlag', 'Zuschlag', '%', d)}<span class="field"></span></div>`;
      body += `<span class="lbl">Beton als</span>` + seg('method', d.method, [['sack', 'Fertigbeton'], ['selbst', 'Selbst mischen'], ['transport', 'Transport']]);
      if (d.method === 'sack') {
        const cur = Material.BETON_BAGS.find(b => b.kg == n0(d.bagKg) && b.litres == n0(d.bagLitres));
        body += `<label class="field"><span class="lbl">Sackware (Herstellerangabe prüfen)</span><select data-mf="bagPreset">
            ${Material.BETON_BAGS.map(b => `<option value="${b.id}" ${cur && cur.id === b.id ? 'selected' : ''}>${b.label}</option>`).join('')}
            <option value="eigen" ${cur ? '' : 'selected'}>Eigene Angabe</option></select></label>
          <div class="frow">${mf('bagKg', 'Sack', 'kg', d)}${mf('bagLitres', 'ergibt', 'l', d)}${mf('bagPrice', 'Preis/Sack', '€', d, 'placeholder="–"')}</div>`;
      } else if (d.method === 'selbst') {
        body += `<div class="frow">${mf('ratio', 'Zement : Kies = 1 :', '', d)}${mf('cementBagKg', 'Zementsack', 'kg', d)}</div>
          <div class="frow">${mf('cementBagPrice', 'Preis/Zementsack', '€', d, 'placeholder="–"')}${mf('kiesPricePerT', 'Kiessand', '€/t', d, 'placeholder="–"')}</div>
          <p class="muted small">Raumteile (Eimer). Annahme: 1,5 × Volumen lose Trockenmischung, Zement 1,25 kg/l, Kiessand 1,6 t/m³.</p>`;
      } else {
        body += `<div class="frow">${mf('transportPrice', 'Preis', '€/m³', d, 'placeholder="–"')}<span class="field"></span></div>
          <p class="muted small">Transportbeton lohnt sich meist erst ab ca. 1 m³; Anfahrt und Mindermengenzuschlag beim Werk erfragen.</p>`;
      }
    } else {
      body += seg('mode', d.mode, [['wand', 'Wand − Öffnungen'], ['direkt', 'Fläche direkt']]);
      if (d.mode === 'wand') {
        body += `<div class="frow">${mf('length', 'Wandlänge', 'm', d)}${mf('height', 'Höhe', 'm', d)}</div>
          <span class="lbl">Öffnungen (Fenster, Türen)</span>
          ${(d.openings || []).map((o, i) => `<div class="open-row">
            <input data-mo="${i}" data-of="name" value="${esc(o.name)}" placeholder="Fenster" aria-label="Name">
            <input data-mo="${i}" data-of="width" inputmode="decimal" class="mono" value="${esc(vIn(o.width))}" placeholder="B m" aria-label="Breite in m">
            <input data-mo="${i}" data-of="height" inputmode="decimal" class="mono" value="${esc(vIn(o.height))}" placeholder="H m" aria-label="Höhe in m">
            <input data-mo="${i}" data-of="qty" inputmode="numeric" class="mono" value="${esc(vIn(o.qty))}" placeholder="Stk" aria-label="Anzahl">
            <button type="button" class="iconbtn iconbtn--xs" data-act="open-del" data-idx="${i}" aria-label="Öffnung entfernen">${ic('x', 's')}</button></div>`).join('')}
          <button type="button" class="btn btn--ghost btn--sm" data-act="open-add">${ic('plus', 's')} Öffnung</button>`;
      } else body += `<div class="frow">${mf('area', 'Putzfläche', 'm²', d)}<span class="field"></span></div>`;
      body += `<label class="field"><span class="lbl">Putzart</span><select data-mf="type">
          ${Material.PUTZ_TYPES.map(t => `<option value="${t.id}" ${d.type === t.id ? 'selected' : ''}>${t.label} (${fmt(t.kgPerM2mm, 2)} kg/m²/mm)</option>`).join('')}</select></label>
        <div class="frow">${mf('thickness', 'Putzdicke', 'mm', d)}${mf('kgPerM2mm', 'Verbrauch', 'kg/m²/mm', d)}</div>
        <div class="frow">${mf('zuschlag', 'Zuschlag', '%', d)}${mf('bagKg', 'Sack', 'kg', d)}${mf('bagPrice', 'Preis/Sack', '€', d, 'placeholder="–"')}</div>`;
    }
    return `<form class="card form editor" data-form="material">
      ${matDraft.id ? '' : seg('kind', d.kind, [['beton', 'Beton'], ['putz', 'Putz']])}
      <label class="field"><span class="lbl">Bezeichnung</span><input data-mf="name" value="${esc(d.name)}" placeholder="${d.kind === 'putz' ? 'z. B. Kellerwand Nord' : 'z. B. Pfostenlöcher'}"></label>
      ${body}
      <div class="mprev" id="mat-preview">${resultHtml(d)}</div>
      <div class="row"><button class="btn btn--pri grow">${matDraft.id ? 'Änderung speichern' : 'Eintrag hinzufügen'}</button>
        <button type="button" class="btn btn--ghost" data-act="mat-cancel">Abbrechen</button></div>
    </form>`;
  }
  function viewMaterial(p) {
    const agg = Material.aggregate(p.materials);
    const total = p.materials.length ? `<div class="card costcard">
        <div class="ctop"><span class="muted">Projekt gesamt · ${p.materials.length} Einträge</span>${agg.cost != null ? `<span class="pill ${agg.allPriced ? 'pill--ok' : 'pill--plan'}">${agg.allPriced ? 'mit Preisen' : 'Preise teilweise'}</span>` : '<span class="pill pill--idea">ohne Preise</span>'}</div>
        ${agg.cost != null ? `<b class="big">${eur(agg.cost)}</b>` : ''}
        <div class="mlist mlist--flat">${agg.lines.map(l => `<div class="mrow"><div class="mtxt"><b>${esc(l.label)}</b><span class="muted">${esc(l.entries.join(', '))}</span></div>
          <div class="mright"><span class="price">${l.continuous ? fmt(l.qty, 2) : l.qty} ${l.unit}</span>${l.cost != null ? `<span class="muted small mono">${eur(l.cost)}</span>` : ''}</div></div>`).join('')}</div>
        <button class="btn btn--ghost btn--sm" data-go="bestellung">In Bestellung ansehen</button>
      </div>` : '';
    const entryHtml = e => `<div class="card mentry">
        <div class="cgh"><span class="pill ${e.kind === 'putz' ? 'pill--putz' : 'pill--beton'}">${e.kind === 'putz' ? 'Putz' : 'Beton'}</span><b>${esc(e.name)}</b>
          <button class="iconbtn iconbtn--xs" data-act="mat-edit" data-id="${e.id}" aria-label="Bearbeiten">${ic('edit', 's')}</button>
          <button class="iconbtn iconbtn--xs" data-act="mat-del" data-id="${e.id}" aria-label="Löschen">${ic('x', 's')}</button></div>
        <p class="mdesc">${esc(describe(e))}</p>
        ${resultHtml(e)}
      </div>`;
    const adders = `<div class="row adders"><button class="btn btn--pri btn--sm grow" data-act="mat-new" data-kind="beton">${ic('plus', 's')} Beton</button>
        <button class="btn btn--acc btn--sm grow" data-act="mat-new" data-kind="putz">${ic('plus', 's')} Putz</button></div>`;
    return `${matDraft && !matDraft.id ? editorHtml(matDraft) : adders}
      ${p.materials.map(e => (matDraft && matDraft.id === e.id) ? editorHtml(matDraft) : entryHtml(e)).join('')}
      ${total}
      ${!p.materials.length && !matDraft ? '<p class="muted center">Noch keine Einträge. Lege Beton für Fundamente/Löcher oder Putz für Wände an.</p>' : ''}
      <p class="foot muted">Richtwerte nach Herstellerangaben (Baumit, Sakret, Knauf, ClayTec). Verbrauch und Ergiebigkeit immer auf dem Sack prüfen.</p>`;
  }

  // ---------- views: Bestellung ----------
  function orderLines(p) {
    const lines = [];
    for (const g of optimizeProject(p)) {
      for (const b of g.res.summary.byStock) {
        const key = g.key + '|' + b.stockLength;
        lines.push({ key, label: g.label, stockLength: b.stockLength, count: b.count, cost: g.res.priced ? b.cost : null, status: (p.orders || {})[key] || 'offen', group: g });
      }
      if (g.res.tooLong.length) lines.push({ key: g.key + '|zu-lang', label: g.label, tooLong: g.res.tooLong, status: (p.orders || {})[g.key + '|zu-lang'] || 'offen', group: g });
    }
    for (const l of Material.aggregate(p.materials || []).lines) {
      if (!(l.qty > 0)) continue;
      const key = 'mat|' + l.key;
      lines.push({ key, mat: true, label: l.label, qty: l.qty, unit: l.unit, continuous: l.continuous, entries: l.entries, cost: l.cost, status: (p.orders || {})[key] || 'offen' });
    }
    return lines;
  }
  const matQty = l => `${l.continuous ? fmt(l.qty, 2) : l.qty} ${l.unit}`;

  function orderText(p, withCuts) {
    const lines = orderLines(p);
    const wood = lines.filter(l => !l.mat), mat = lines.filter(l => l.mat);
    let t = `Materialliste Projekt „${p.name}“\n`;
    let lfm = 0, cost = 0, allPriced = true;
    if (wood.length) {
      t += '\nHolz:\n';
      for (const l of wood) {
        if (l.tooLong) {
          const agg = l.tooLong.reduce((a, x) => (a[fmt(x.length)] = (a[fmt(x.length)] || 0) + 1, a), {});
          t += `- ${l.label}: Sonderlänge ${Object.entries(agg).map(([len, n]) => `${n}× ${len} cm`).join(', ')}\n`;
          allPriced = false; continue;
        }
        t += `- ${l.count} Stück ${l.label}, Länge ${fmtM(l.stockLength)}\n`;
        lfm += l.count * l.stockLength / 100;
        if (l.cost == null) allPriced = false; else cost += l.cost;
      }
      t += `Summe Holz: ${fmt(lfm, 2)} lfm\n`;
    }
    if (mat.length) {
      t += '\nBeton & Putz:\n';
      for (const l of mat) {
        t += `- ${matQty(l)} ${l.label}${l.entries.length ? ` (für: ${l.entries.join(', ')})` : ''}\n`;
        if (l.cost == null) allPriced = false; else cost += l.cost;
      }
    }
    if (allPriced && lines.length) t += `\nGesamt ca. ${eur(cost)}\n`;
    if (withCuts && wood.length) {
      t += '\nGewünschter Zuschnitt (cm):\n';
      for (const g of optimizeProject(p)) {
        t += `${g.label}:\n`;
        for (const { bin, count } of patterns(g.res.bins)) t += `  ${count}× ${fmtM(bin.stockLength)} → ${bin.parts.map(x => fmt(x.length)).join(' + ')}\n`;
      }
    }
    return t;
  }

  function viewOrder(p) {
    const lines = orderLines(p);
    if (!lines.length) return `<p class="muted center">Erst Positionen in der Holzliste oder Beton/Putz anlegen.</p>`;
    let total = 0, priced = true;
    for (const l of lines) { if (l.cost == null) priced = false; else total += l.cost; }
    const cnt = s => lines.filter(l => l.status === s).length;
    const stack = STATUSES.filter(s => cnt(s)).map(s => `<i class="${s}" style="flex:${cnt(s)}"></i>`).join('');
    const legend = STATUSES.map(s => `<div><i class="lg ${s}"></i>${s[0].toUpperCase() + s.slice(1)}<b>${cnt(s)}</b></div>`).join('');
    const shown = lines.filter(l => orderFilter === 'alle' || l.status === orderFilter);
    const row = l => {
      const sel = `<select class="st ${l.status}" data-act="order-status" data-key="${esc(l.key)}" aria-label="Status">
        ${STATUSES.map(s => `<option value="${s}" ${s === l.status ? 'selected' : ''}>${s}</option>`).join('')}</select>`;
      if (l.tooLong) return `<div class="mrow"><div class="mtxt"><b>${esc(l.label)}</b><span class="warn-ink">Sonderlänge ${l.tooLong.map(x => fmt(x.length)).join(', ')} cm</span></div><div class="mright"><span class="price">–</span>${sel}</div></div>`;
      if (l.mat) return `<div class="mrow"><div class="mtxt"><b>${esc(l.label)}</b><span class="muted">${matQty(l)} · ${esc(l.entries.join(', '))}</span></div><div class="mright"><span class="price">${l.cost != null ? eur(l.cost) : matQty(l)}</span>${sel}</div></div>`;
      return `<div class="mrow"><div class="mtxt"><b>${esc(l.label)}</b><span class="muted">${l.count} × ${fmt(l.stockLength / 100, 2)} m · ${fmt(l.count * l.stockLength / 100, 2)} lfm</span></div><div class="mright"><span class="price">${l.cost != null ? eur(l.cost) : l.count + ' Stk'}</span>${sel}</div></div>`;
    };
    const wood = shown.filter(l => !l.mat), mat = shown.filter(l => l.mat);
    return `<div class="card costcard">
        <div class="ctop"><span class="muted">Gesamt</span>${priced ? '' : '<span class="pill pill--ex">Preise fehlen</span>'}</div>
        <b class="big">${priced ? eur(total) : lines.length + ' Positionen'}</b>
        <div class="sbar">${stack}</div>
        <div class="legend">${legend}</div>
      </div>
      <div class="chips filt">${['alle', ...STATUSES].map(s => `<button class="chip ${orderFilter === s ? 'on' : ''}" data-act="order-filter" data-v="${s}">${s[0].toUpperCase() + s.slice(1)}</button>`).join('')}</div>
      ${wood.length ? `<div class="card mlist"><div class="grph"><span>Holz</span></div>${wood.map(row).join('')}</div>` : ''}
      ${mat.length ? `<div class="card mlist"><div class="grph"><span>Beton &amp; Putz</span></div>${mat.map(row).join('')}</div>` : ''}
      ${!shown.length ? '<p class="muted center">Keine Positionen mit diesem Status.</p>' : ''}
      <div class="card stack">
        <h3>Text für Anfrage</h3>
        <label class="check"><input type="checkbox" data-act="with-cuts" ${state.withCuts ? 'checked' : ''}> Zuschnittmaße anhängen</label>
        <textarea class="export" readonly id="order-text">${esc(orderText(p, state.withCuts))}</textarea>
        <button class="btn btn--pri btn--block" data-act="copy-order">${ic('copy', 's')} Text kopieren</button>
      </div>`;
  }

  // ---------- actions ----------
  document.addEventListener('click', ev => {
    const el = ev.target.closest('[data-act],[data-tab],[data-go]');
    if (!el) return;
    if (el.dataset.tab) return go(el.dataset.tab);
    if (el.dataset.go) return go(el.dataset.go);
    const p = current(), id = el.dataset.id, act = el.dataset.act;
    switch (act) {
      case 'open-project': state.currentId = id; menuFor = null; matDraft = null; editingItemId = null; listSel = null; save(); go('liste'); break;
      case 'toggle-new-project': showNewProject = !showNewProject; render(); if (showNewProject) $('#np-name')?.focus(); break;
      case 'project-menu': menuFor = menuFor === id ? null : id; render(); break;
      case 'list-sel': listSel = el.dataset.key; editingItemId = null; render(); break;
      case 'qty-dec': case 'qty-inc': {
        const inp = el.closest('.stepper').querySelector('input');
        const v = Math.max(1, (parseInt(inp.value, 10) || 1) + (act === 'qty-inc' ? 1 : -1));
        inp.value = v; if (!editingItemId) draftQty = v; break;
      }
      case 'mat-new': matDraft = newDraft(el.dataset.kind); render(); window.scrollTo(0, 0); break;
      case 'mat-edit': { const e = p.materials.find(m => m.id === id); matDraft = JSON.parse(JSON.stringify(e)); render(); break; }
      case 'mat-cancel': matDraft = null; render(); break;
      case 'mat-del': {
        const e = p.materials.find(m => m.id === id);
        if (!confirm(`„${e.name}“ löschen?`)) return;
        p.materials = p.materials.filter(m => m.id !== id); if (matDraft && matDraft.id === id) matDraft = null; save(); render(); break;
      }
      case 'mf-set': {
        const f = el.dataset.f, v = el.dataset.v;
        if (f === 'kind') { if (matDraft.kind !== v) matDraft = { ...newDraft(v), name: matDraft.name }; }
        else matDraft[f] = v;
        render(); break;
      }
      case 'open-add': matDraft.openings = [...(matDraft.openings || []), { name: '', width: '', height: '', qty: 1 }]; render(); break;
      case 'open-del': matDraft.openings.splice(+el.dataset.idx, 1); render(); break;
      case 'order-filter': orderFilter = el.dataset.v; render(); break;
      case 'rename-project': {
        const pr = state.projects.find(x => x.id === id);
        const n = prompt('Neuer Name', pr.name);
        if (n && n.trim()) { pr.name = n.trim(); menuFor = null; save(); render(); }
        break;
      }
      case 'duplicate-project': {
        const pr = state.projects.find(x => x.id === id);
        const c = JSON.parse(JSON.stringify(pr)); c.id = uid(); c.name = pr.name + ' (Kopie)'; c.created = new Date().toISOString();
        state.projects.push(c); menuFor = null; save(); render(); break;
      }
      case 'delete-project': {
        const pr = state.projects.find(x => x.id === id);
        if (!confirm(`Projekt „${pr.name}“ wirklich löschen?`)) return;
        state.projects = state.projects.filter(x => x.id !== id);
        if (state.currentId === id) state.currentId = state.projects[0]?.id || null;
        save(); render(); toast('Projekt gelöscht'); break;
      }
      case 'load-example': { matDraft = null; listSel = null; const ex = exampleProject(); state.projects.push(ex); state.currentId = ex.id; save(); go('zuschnitt'); break; }
      case 'export-json': {
        const blob = new Blob([JSON.stringify({ app: 'bauprojekt-planer', version: 1, exported: new Date().toISOString(), projects: state.projects }, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = `bauprojekte-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); break;
      }
      case 'edit-item': editingItemId = id; render(); break;
      case 'cancel-edit': editingItemId = null; render(); break;
      case 'delete-item': {
        const it = p.items.find(i => i.id === id);
        if (!confirm(`„${it.designation || 'Position'}“ löschen?`)) return;
        p.items = p.items.filter(i => i.id !== id); if (editingItemId === id) editingItemId = null; save(); render(); break;
      }
      case 'stock-add': {
        const st = ensureStock(p, el.dataset.key);
        const max = Math.max(0, ...st.lengths.map(l => l.length));
        st.lengths.push({ length: max ? max + 100 : 500, price: null }); save(); render(); break;
      }
      case 'stock-del': { const st = ensureStock(p, el.dataset.key); st.lengths.splice(+el.dataset.idx, 1); save(); render(); break; }
      case 'copy-order': copyText($('#order-text').value); break;
    }
  });

  document.addEventListener('input', ev => {
    const el = ev.target;
    if (!matDraft || el.tagName === 'SELECT') return;
    if (el.dataset.mf) matDraft[el.dataset.mf] = el.value;
    else if (el.dataset.mo != null) matDraft.openings[+el.dataset.mo][el.dataset.of] = el.value;
    else return;
    const pv = $('#mat-preview'); if (pv) pv.innerHTML = resultHtml(matDraft);
  });

  document.addEventListener('change', ev => {
    const el = ev.target, act = el.dataset.act, p = current();
    if (el.tagName === 'SELECT' && el.dataset.mf && matDraft) {
      if (el.dataset.mf === 'bagPreset') {
        const b = Material.BETON_BAGS.find(x => x.id === el.value);
        if (b) { matDraft.bagKg = b.kg; matDraft.bagLitres = b.litres; }
      } else if (el.dataset.mf === 'type') {
        const t = Material.PUTZ_TYPES.find(x => x.id === el.value);
        matDraft.type = t.id; matDraft.kgPerM2mm = t.kgPerM2mm; matDraft.bagKg = t.bagKg;
      }
      render(); return;
    }
    if (!act) return;
    if (act === 'import-json') {
      const f = el.files[0]; if (!f) return;
      f.text().then(txt => {
        const data = JSON.parse(txt);
        const list = Array.isArray(data) ? data : data.projects;
        if (!Array.isArray(list)) throw new Error('Kein Projektformat');
        let n = 0;
        for (const pr of list) {
          if (!pr || !pr.name || !Array.isArray(pr.items)) continue;
          const c = normProject({ kerf: DEFAULT_KERF, stock: {}, orders: {}, materials: [], ...pr });
          if (state.projects.some(x => x.id === c.id) || !c.id) c.id = uid();
          state.projects.push(c); n++;
        }
        save(); render(); toast(`${n} Projekt(e) importiert`);
      }).catch(e => { console.warn(e); toast('Import fehlgeschlagen: ungültige Datei'); });
      return;
    }
    if (act === 'kerf') { const v = num(el.value); if (v >= 0) { p.kerf = v; save(); toast('Sägeschnitt gespeichert'); } else el.value = fmt(p.kerf, 2); return; }
    if (act === 'stock-len') {
      const v = num(el.value), st = ensureStock(p, el.dataset.key);
      if (v > 0) { st.lengths[+el.dataset.idx].length = v; st.lengths.sort((a, b) => a.length - b.length); save(); render(); }
      else el.value = fmt(st.lengths[+el.dataset.idx].length, 2);
      return;
    }
    if (act === 'stock-price') {
      const v = num(el.value), st = ensureStock(p, el.dataset.key);
      st.lengths[+el.dataset.idx].price = el.value.trim() === '' || !(v >= 0) ? null : v; save(); return;
    }
    if (act === 'price-unit') { ensureStock(p, el.dataset.key).priceUnit = el.value; save(); return; }
    if (act === 'order-status') { p.orders = p.orders || {}; p.orders[el.dataset.key] = el.value; save(); render(); return; }
    if (act === 'with-cuts') { state.withCuts = el.checked; save(); $('#order-text').value = orderText(p, state.withCuts); return; }
  });

  document.addEventListener('submit', ev => {
    const form = ev.target; ev.preventDefault();
    const fd = Object.fromEntries(new FormData(form));
    if (form.dataset.form === 'material') {
      const p = current(), e = cleanEntry(matDraft);
      if (e.id) { const i = p.materials.findIndex(m => m.id === e.id); p.materials[i] = e; toast('Gespeichert'); }
      else { e.id = uid(); p.materials.push(e); toast('Eintrag hinzugefügt'); }
      matDraft = null; save(); render(); return;
    }
    if (form.dataset.form === 'new-project') {
      const pr = { id: uid(), name: fd.name.trim(), created: new Date().toISOString(), kerf: DEFAULT_KERF, items: [], stock: {}, orders: {}, materials: [] };
      state.projects.push(pr); state.currentId = pr.id; showNewProject = false; listSel = 'neu'; save(); go('liste'); return;
    }
    if (form.dataset.form === 'item') {
      const p = current();
      const length = num(fd.length), qty = parseInt(fd.qty, 10);
      if (!(length > 0)) return toast('Bitte eine gültige Länge eingeben');
      if (!(qty > 0)) return toast('Bitte eine gültige Anzahl eingeben');
      if (!normSection(fd.section)) return toast('Bitte einen Querschnitt eingeben');
      const data = { designation: fd.designation.trim(), material: fd.material.trim(), section: normSection(fd.section), length, qty };
      if (editingItemId) { Object.assign(p.items.find(i => i.id === editingItemId), data); editingItemId = null; toast('Gespeichert'); }
      else { p.items.push({ id: uid(), ...data }); toast('Position hinzugefügt'); }
      listSel = groupKey(data); draftQty = 1;
      save(); render();
    }
  });

  // ---------- boot ----------
  if (!state.currentId && state.projects[0]) state.currentId = state.projects[0].id;
  save();
  render();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW', e)));
  }
  // for tests/debugging
  window.BauplanerApp = { get state() { return state; }, optimizeProject, orderText, orderLines };
})();
