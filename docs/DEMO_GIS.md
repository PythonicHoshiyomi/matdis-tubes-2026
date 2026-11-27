# Demo Web GIS - Max-Flow Akses JIS

Tampilan utama demo/video. Python (Ford-Fulkerson & Dinic) menghitung, Web GIS
hanya **menampilkan** hasilnya. Semua angka (max-flow, min-cut, runtime, dst.)
dibaca dari `output/maxflow_case22.json`, bukan dibuat di frontend.

## Menjalankan

```bash
# dari root repo
python -m http.server 8000
# buka http://localhost:8000/visualizer/gis.html
```

Kalau file dibuka langsung (tanpa server), pakai tombol **Load hasil JSON** dan
**Load GeoJSON** di kanan atas.

Membuat ulang hasil algoritma (jika kode/YAML berubah):

```bash
python -m scripts.run_maxflow --repeat 5 --json output/maxflow_case22.json
```

## Alur demo di video

1. Peta JIS: jelaskan source (V01), sink (V22), vertex, edge, arah panah.
2. Klik satu ruas -> tunjukkan kapasitas (kend/jam).
3. Kondisi Awal + Ford-Fulkerson -> baca max-flow.
4. Ganti ke Dinic (kondisi sama) -> bandingkan di panel perbandingan.
5. Aktifkan "Sorot Min-Cut" -> jelaskan bottleneck.
6. Event 1 (akses drop-off ditutup) -> lihat max-flow turun.
7. Event 2 (jalan menyempit; kumulatif dengan Event 1) -> lihat max-flow turun lagi.
8. Bandingkan respons kedua algoritma, simpulkan.

## Status data

| Bagian | Sumber | Status |
|---|---|---|
| Topologi & kapasitas | `visualizer/data/jis_network.placeholder.geojson` (dibuat dari YAML oleh `scripts/make_placeholder_geojson.py`) | Koordinat **placeholder** |
| Hasil algoritma | `output/maxflow_case22.json` | Asli (hasil Python) |
| Jalur aliran per event | belum ada di JSON (hanya `path` representatif) | Menunggu Dava |

## Saat data final datang

- **Giza:** simpan `visualizer/data/jis_network.geojson` dengan skema yang sama
  (Point: `kind="node", id, label, role`; LineString: `kind="edge", from, to, capacity`),
  lalu ubah `geoUrl` di `assets/js/gis-map.js`.
- **Dava:** tambahkan `flow_paths` di tiap event pada `scripts/run_maxflow.py`.
