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
| Topologi & kapasitas | `visualizer/data/jis_network.placeholder.geojson` (nama file lama; isinya sudah diperbarui Giza) | 22 titik dan 29 ruas, kapasitas sama dengan YAML |
| Posisi titik | disusun Giza mengikuti ilustrasi graf | **Skematik**, bukan hasil survei. Hanya V22 (JIS) di koordinat resmi |
| Bentuk ruas jalan | rute OpenStreetMap, profil jalan kaki | Beberapa ruas berbelok jauh karena rute pejalan kaki |
| Hasil algoritma | `output/maxflow_case22.json` | Asli (hasil Python) |
| Jalur aliran per event | `flow_paths` di JSON | Jika ada, semua jalur disorot. Jika belum ada, hanya satu jalur representatif |

## Catatan untuk tim

- **Jangan jalankan ulang** `scripts/make_placeholder_geojson.py`. Skrip itu menghasilkan koordinat placeholder lama dan akan menimpa data Giza.
- Tombol "Ambil bentuk jalan" tidak perlu diklik lagi, karena semua ruas sudah berisi bentuk jalan.
- Jika `run_maxflow.py` atau YAML berubah, buat ulang hasilnya dengan `python -m scripts.run_maxflow --repeat 5 --json output/maxflow_case22.json`, lalu commit oleh Dava.
