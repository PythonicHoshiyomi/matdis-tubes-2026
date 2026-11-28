(() => {
  'use strict';

  const CFG = {
    geoUrl: 'data/jis_network.placeholder.geojson',
    resultUrl: '../output/maxflow_case22.json',
    center: [-6.125306, 106.860111], // JIS
    zoom: 15,
  };
  const ROUTING_URL = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot/';
  const ROAD_PATH_CACHE_KEY = 'jis-road-paths-v1';
  const ROAD_REQUEST_DELAY_MS = 350;
  const COLOR = { base: '#3b82f6', flow: '#16a34a', cut: '#dc2626', hit: '#f59e0b' };
  const ALGO_NAME = { ff: 'ford_fulkerson', dinic: 'dinic' };

  const S = {
    geo: null, res: null, algo: 'dinic', step: -1,
    baseCap: new Map(), edgeLayers: new Map(), nodeLayers: new Map(),
    nodeInfo: new Map(), group: null,
  };

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n, d = 0) => (n == null || Number.isNaN(n)) ? '—'
    : Number(n).toLocaleString('id-ID', { maximumFractionDigits: d });
  const vlabel = (id) => 'V' + String(id + 1).padStart(2, '0');
  const key = (a, b) => `${a}-${b}`;

  /* ---------- peta ---------- */
  const map = L.map('map').setView(CFG.center, CFG.zoom);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);

  /* ---------- util hasil ---------- */
  const algoRes = (a) => S.res?.results?.find((r) => r.algorithm === ALGO_NAME[a]);
  const stateOf = (a, step) => {
    const r = algoRes(a);
    if (!r) return null;
    return step < 0 ? r.initial : (r.events?.[step] || null);
  };

  function capacityAt(step) {
    const cur = new Map(S.baseCap);
    const hits = new Set();
    const events = algoRes(S.algo)?.events || [];
    for (let i = 0; i <= step; i++) {      // event bersifat kumulatif
      const ev = events[i];
      if (ev && ev.target_edge) {
        const k = key(ev.target_edge[0], ev.target_edge[1]);
        cur.set(k, ev.new_capacity);
        hits.add(k);
      }
    }
    return { cur, hits };
  }

  function pathEdges(paths) {
    const set = new Set();
    paths.forEach((p) => {
      for (let i = 0; i < p.length - 1; i++) set.add(key(p[i], p[i + 1]));
    });
    return set;
  }

  /* ---------- bangun layer dari GeoJSON ---------- */
  function buildNetwork(geo, fit = true) {
    if (S.group) S.group.remove();
    S.group = L.featureGroup().addTo(map);
    S.baseCap.clear(); S.edgeLayers.clear(); S.nodeLayers.clear(); S.nodeInfo.clear();

    const ll = (c) => [c[1], c[0]]; // GeoJSON [lng,lat] -> Leaflet [lat,lng]

    geo.features.filter((f) => f.properties.kind === 'edge').forEach((f) => {
      const { from, to, capacity } = f.properties;
      const k = key(from, to);
      const pts = f.geometry.coordinates.map(ll);
      S.baseCap.set(k, capacity);
      const line = L.polyline(pts, { color: COLOR.base, weight: 3, opacity: 0.9 });
      line.on('click', () => showEdge(from, to));
      line.addTo(S.group);
      S.edgeLayers.set(k, line);

      const segment = Math.min(Math.floor((pts.length - 1) / 2), pts.length - 2);
      const a = pts[segment], b = pts[segment + 1];
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const ang = Math.atan2(-(b[0] - a[0]), (b[1] - a[1]) * Math.cos(a[0] * Math.PI / 180)) * 180 / Math.PI;
      L.marker(mid, {
        interactive: false,
        icon: L.divIcon({
          className: '', iconSize: [14, 14],
          html: `<div class="arrow-i" style="transform:rotate(${ang}deg)">▶</div>`,
        }),
      }).addTo(S.group);
    });

    geo.features.filter((f) => f.properties.kind === 'node').forEach((f) => {
      const p = f.properties;
      S.nodeInfo.set(p.id, p);
      const style = p.role === 'source'
        ? { radius: 11, color: '#1e3a8a', fillColor: '#2563eb' }
        : p.role === 'sink'
          ? { radius: 11, color: '#7f1d1d', fillColor: '#dc2626' }
          : { radius: 6, color: '#374151', fillColor: '#9ca3af' };
      const m = L.circleMarker(ll(f.geometry.coordinates), { ...style, weight: 2, fillOpacity: 1 });
      m.bindTooltip(vlabel(p.id), { permanent: p.role !== 'mid', direction: 'top', className: 'node-tip' });
      m.on('click', () => showNode(p.id));
      m.addTo(S.group);
      S.nodeLayers.set(p.id, m);
    });

    if (fit) map.fitBounds(S.group.getBounds().pad(0.1));

    const banner = $('banner');
    banner.hidden = !geo.placeholder;
    if (geo.placeholder) {
      banner.textContent = '⚠ KOORDINAT PLACEHOLDER — posisi titik/ruas belum sesuai jalan sebenarnya (menunggu data GeoJSON dari Giza).';
    }
  }

  /* ---------- render ---------- */
  function render() {
    if (!S.geo) return;
    const { cur, hits } = capacityAt(S.step);
    const st = S.res ? stateOf(S.algo, S.step) : null;
    const cutSet = new Set((st?.min_cut_edges || []).map((e) => key(e.from, e.to)));
    const flowSet = st ? pathEdges(S.step < 0 ? (st.flow_paths || []).map((f) => f.path) : [st.path || []]) : new Set();
    const maxCap = Math.max(1, ...S.baseCap.values());

    S.edgeLayers.forEach((line, k) => {
      const cap = cur.get(k) ?? 0;
      let color = COLOR.base;
      if ($('chk-flow').checked && flowSet.has(k)) color = COLOR.flow;
      if (hits.has(k)) color = COLOR.hit;
      if ($('chk-cut').checked && cutSet.has(k)) color = COLOR.cut;
      line.setStyle({
        color,
        weight: cap <= 0 ? 2 : 2 + 8 * (cap / maxCap),
        dashArray: cap <= 0 ? '4 6' : null,
        opacity: cap <= 0 ? 0.7 : 0.9,
      });
    });

    renderScenario();
    renderMetrics(st);
    renderCompare();
    renderMinCut(st);
  }

  function renderScenario() {
    const events = algoRes(S.algo)?.events || [];
    const box = $('scenario-buttons');
    box.innerHTML = '';
    const mk = (label, step) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.className = step === S.step ? 'active' : '';
      b.onclick = () => { S.step = step; render(); };
      box.appendChild(b);
    };
    mk('🏁 Kondisi Awal', -1);
    events.forEach((ev, i) => mk(`Event ${ev.step ?? i + 1}`, i));

    const d = $('scenario-desc');
    if (S.step < 0) { d.textContent = 'Kondisi normal sebelum ada gangguan.'; return; }
    const ev = events[S.step];
    d.textContent = (ev?.description || '') + (S.step > 0 ? ' (Kumulatif: perubahan event sebelumnya tetap berlaku.)' : '');
  }

  function renderMetrics(st) {
    $('metrics-tag').textContent = (S.algo === 'ff' ? 'Ford-Fulkerson' : 'Dinic');
    const box = $('metrics');
    if (!st) { box.innerHTML = '<span class="desc">Hasil belum dimuat.</span>'; return; }
    const initial = S.step < 0;
    const card = (cls, name, val) => `<div class="metric ${cls}"><small>${name}</small><b>${val}</b></div>`;
    box.innerHTML =
      card('big', 'Max-Flow (kendaraan/jam)', fmt(st.max_flow)) +
      card('', 'Min-Cut', fmt(st.min_cut_value)) +
      card('', 'Runtime', st.runtime_ms == null ? '—' : fmt(st.runtime_ms, 3) + ' ms') +
      card('', 'Augmentasi', initial ? fmt(st.augmentations) : '—') +
      card('', 'Fase BFS', initial ? fmt(st.bfs_phases) : '—');
  }

  function renderCompare() {
    const ff = S.res ? stateOf('ff', S.step) : null;
    const di = S.res ? stateOf('dinic', S.step) : null;
    const init = S.step < 0;
    const rows = [
      ['Max-Flow', fmt(ff?.max_flow), fmt(di?.max_flow)],
      ['Min-Cut', fmt(ff?.min_cut_value), fmt(di?.min_cut_value)],
      ['Augmentasi', init ? fmt(ff?.augmentations) : '—', init ? fmt(di?.augmentations) : '—'],
      ['Fase BFS', init ? fmt(ff?.bfs_phases) : '—', init ? fmt(di?.bfs_phases) : '—'],
      ['Runtime (ms)', fmt(ff?.runtime_ms, 3), fmt(di?.runtime_ms, 3)],
    ];
    $('cmp-body').innerHTML = rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('');

    const a = $('agree');
    if (ff && di) {
      const same = ff.max_flow === di.max_flow;
      a.className = 'agree ' + (same ? 'ok' : 'bad');
      a.textContent = same ? '✔ Kedua algoritma menghasilkan max-flow yang sama.' : '✖ Max-flow kedua algoritma BERBEDA — periksa hasil.';
    } else { a.textContent = ''; }
  }

  function renderMinCut(st) {
    const ul = $('mincut-list');
    const edges = st?.min_cut_edges || [];
    ul.innerHTML = edges.length
      ? edges.map((e) => `<li>${vlabel(e.from)} → ${vlabel(e.to)} · ${fmt(e.capacity)} kend/jam</li>`).join('')
      : '<li class="desc">—</li>';
  }

  /* ---------- detail klik ---------- */
  function showEdge(from, to) {
    const k = key(from, to);
    const { cur, hits } = capacityAt(S.step);
    const st = S.res ? stateOf(S.algo, S.step) : null;
    const isCut = (st?.min_cut_edges || []).some((e) => key(e.from, e.to) === k);
    const status = isCut ? 'Min-Cut (bottleneck)' : hits.has(k) ? 'Terdampak event' : 'Normal';
    const nm = (id) => `${vlabel(id)} — ${esc(S.nodeInfo.get(id)?.label ?? '')}`;
    $('detail').innerHTML =
      `<b>Ruas ${vlabel(from)} → ${vlabel(to)}</b><br>` +
      `Dari: ${nm(from)}<br>Menuju: ${nm(to)}<br>` +
      `Kapasitas awal: <b>${fmt(S.baseCap.get(k))}</b> kend/jam<br>` +
      `Kapasitas saat ini: <b>${fmt(cur.get(k))}</b> kend/jam<br>Status: ${status}<br>` +
      `<small>Angka mengikuti YAML kasus, bukan data langsung dari Google Maps.</small>`;
  }

  function showNode(id) {
    const p = S.nodeInfo.get(id);
    const role = p.role === 'source' ? 'Source (super-source)' : p.role === 'sink' ? 'Sink (tujuan JIS)' : 'Persimpangan / titik perantara';
    $('detail').innerHTML = `<b>${vlabel(id)}</b> (node ${id})<br>${esc(p.label)}<br>Peran: ${role}`;
  }

  /* ---------- load data ---------- */
  function setStatus(msg) {
    const el = $('status');
    el.hidden = !msg;
    el.textContent = msg || '';
    el.className = 'status';
  }

  function setStatusKind(kind) {
    $('status').classList.add(`status--${kind}`);
  }

  function isValidPath(path) {
    return Array.isArray(path) && path.length >= 2 && path.every((point) =>
      Array.isArray(point) && point.length >= 2 && point.slice(0, 2).every(Number.isFinite));
  }

  function loadRoadPathCache() {
    try {
      const value = JSON.parse(localStorage.getItem(ROAD_PATH_CACHE_KEY) || '{}');
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('format cache tidak valid');
      }
      return value;
    } catch (error) {
      setStatus(`Cache rute jalan tidak dapat dibaca: ${error.message}`);
      setStatusKind('warning');
      return {};
    }
  }

  function roadPathKey(edge, nodeMap) {
    const from = nodeMap.get(edge.properties.from)?.geometry.coordinates;
    const to = nodeMap.get(edge.properties.to)?.geometry.coordinates;
    return `${edge.properties.from}-${edge.properties.to}:${from?.join(',')}:${to?.join(',')}`;
  }

  function applyCachedRoadPaths(geo) {
    const cache = loadRoadPathCache();
    const nodes = new Map(geo.features
      .filter((f) => f.properties.kind === 'node')
      .map((f) => [f.properties.id, f]));
    geo.features.filter((f) => f.properties.kind === 'edge').forEach((edge) => {
      const path = cache[roadPathKey(edge, nodes)];
      if (!edge.properties.road_source && isValidPath(path)) {
        edge.geometry.coordinates = path;
        edge.properties.road_source = 'OpenStreetMap';
        edge.properties.road_profile = 'foot';
      }
    });
  }

  function updateRoadButtons() {
    const edges = S.geo?.features.filter((f) => f.properties.kind === 'edge') || [];
    $('btn-fetch-roads').disabled = !edges.length;
    $('btn-download-roads').disabled = !edges.length || !edges.every((edge) =>
      edge.properties.road_source === 'OpenStreetMap' && isValidPath(edge.geometry.coordinates));
  }

  async function fetchRoadPaths() {
    const button = $('btn-fetch-roads');
    const originalLabel = button.textContent;
    const edges = S.geo.features.filter((f) => f.properties.kind === 'edge');
    const nodes = new Map(S.geo.features
      .filter((f) => f.properties.kind === 'node')
      .map((f) => [f.properties.id, f]));
    const cache = loadRoadPathCache();
    const failures = [];
    let ok = 0;
    let cacheSaveFailed = false;

    button.disabled = true;
    $('btn-download-roads').disabled = true;
    try {
      for (let i = 0; i < edges.length; i++) {
        const edge = edges[i];
        const { from, to } = edge.properties;
        const start = nodes.get(from);
        const end = nodes.get(to);
        if (edge.properties.road_source === 'OpenStreetMap' && isValidPath(edge.geometry.coordinates)) {
          ok++;
          continue;
        }
        if (!start || !end) {
          failures.push(`${vlabel(from)}→${vlabel(to)}: node tidak ditemukan`);
          continue;
        }

        const cacheKey = roadPathKey(edge, nodes);
        if (isValidPath(cache[cacheKey])) {
          edge.geometry.coordinates = cache[cacheKey];
          edge.properties.road_source = 'OpenStreetMap';
          edge.properties.road_profile = 'foot';
          ok++;
          continue;
        }

        button.textContent = `Mengambil ${i + 1}/${edges.length}...`;
        setStatus(`Meminta rute jalan ${i + 1}/${edges.length} dari OpenStreetMap...`);
        setStatusKind('info');
        const [fromLng, fromLat] = start.geometry.coordinates;
        const [toLng, toLat] = end.geometry.coordinates;
        const url = `${ROUTING_URL}${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
        try {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const result = await response.json();
          const coordinates = result.routes?.[0]?.geometry?.coordinates;
          if (result.code !== 'Ok' || !isValidPath(coordinates)) {
            throw new Error(result.message || 'rute jalan tidak ditemukan');
          }

          const path = [start.geometry.coordinates, ...coordinates, end.geometry.coordinates]
            .filter((point, index, points) => index === 0
              || point[0] !== points[index - 1][0] || point[1] !== points[index - 1][1]);
          edge.geometry.coordinates = path;
          edge.properties.road_source = 'OpenStreetMap';
          edge.properties.road_profile = 'foot';
          cache[cacheKey] = path;
          ok++;
          try {
            localStorage.setItem(ROAD_PATH_CACHE_KEY, JSON.stringify(cache));
          } catch (error) {
            cacheSaveFailed = true;
          }
        } catch (error) {
          failures.push(`${vlabel(from)}→${vlabel(to)}: ${error.message}`);
        }
        await new Promise((resolve) => setTimeout(resolve, ROAD_REQUEST_DELAY_MS));
      }
    } finally {
      button.textContent = originalLabel;
      button.disabled = false;
    }

    buildNetwork(S.geo, false);
    render();
    updateRoadButtons();

    if (failures.length) {
      const details = failures.slice(0, 3).join('; ');
      const remaining = failures.length > 3 ? `; dan ${failures.length - 3} edge lainnya` : '';
      setStatus(`${ok}/${edges.length} edge mengikuti jalan; ${failures.length} gagal: ${details}${remaining}`);
      setStatusKind('warning');
    } else {
      setStatus(`${ok}/${edges.length} edge berhasil mengikuti jalan OpenStreetMap.`);
      setStatusKind('success');
    }
    if (cacheSaveFailed) {
      setStatus(`${$('status').textContent} Cache browser gagal disimpan; unduh GeoJSON agar rute tidak hilang.`);
      setStatusKind('warning');
    }
  }

  function downloadRoadGeoJSON() {
    const blob = new Blob([JSON.stringify(S.geo, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'jis_network.roads.geojson';
    link.click();
    URL.revokeObjectURL(url);
  }

  function setGeo(geo) {
    applyCachedRoadPaths(geo);
    S.geo = geo;
    buildNetwork(geo);
    render();
    updateRoadButtons();
  }
  function setResult(res) {
    S.res = res; S.step = -1;
    if (res?.metadata?.title) $('subtitle').textContent = res.metadata.title;
    render();
  }

  async function autoLoad() {
    const fails = [];
    try { setGeo(await (await fetch(CFG.geoUrl)).json()); } catch (e) { fails.push('GeoJSON'); }
    try { setResult(await (await fetch(CFG.resultUrl)).json()); } catch (e) { fails.push('hasil JSON'); }
    if (fails.length) {
      setStatus(`Gagal memuat otomatis: ${fails.join(' & ')}. Jalankan lewat server ("python -m http.server" dari root repo, buka /visualizer/gis.html) atau pakai tombol Load di kanan atas.`);
    }
  }

  function readFile(input, cb) {
    input.addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = (ev) => {
        try { cb(JSON.parse(ev.target.result)); setStatus(''); }
        catch (err) { setStatus('Gagal membaca file: ' + err.message); }
      };
      r.readAsText(f);
    });
  }

  /* ---------- event UI ---------- */
  document.querySelectorAll('#algo-switch button').forEach((b) => {
    b.addEventListener('click', () => {
      S.algo = b.dataset.algo;
      document.querySelectorAll('#algo-switch button').forEach((x) => x.classList.toggle('active', x === b));
      render();
    });
  });
  $('chk-cut').addEventListener('change', render);
  $('chk-flow').addEventListener('change', render);
  $('btn-fetch-roads').addEventListener('click', fetchRoadPaths);
  $('btn-download-roads').addEventListener('click', downloadRoadGeoJSON);
  readFile($('geoLoader'), setGeo);
  readFile($('resultLoader'), setResult);

  window.jisGis = { S, render }; // untuk debugging/pengujian
  autoLoad();
})();
