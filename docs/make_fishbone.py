from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

OUT = Path(__file__).with_name("fishbone_jis.png")

HEAD = "Akses menuju JIS padat\nsaat konser The Weeknd\n(26-27 Sep 2026)"

# (title, attach_x, side, is_root, causes)
BONES = [
    ("MAN (Manusia)", 4.4, +1, False, [
        "Lonjakan pejalan kaki & penonton",
        "Ojol/jemputan berhenti di badan jalan",
        "Parkir liar di sekitar stadion",
    ]),
    ("METHOD (Metode)", 8.4, +1, False, [
        "Rekayasa lalin situasional Dishub",
        "Akses masuk dibagi per kategori tiket",
        "JPO Stasiun JIS ditutup sementara",
        "Sterilisasi drop-off area VVIP",
    ]),
    ("MACHINE / INFRASTRUKTUR", 12.4, +1, True, [
        "Kapasitas ruas jalan terbatas (kend/jam)",
        "Pintu masuk JIS terbatas (ramp, Jl. Utama)",
        "Jl. Danau Sunter Barat menyempit",
    ]),
    ("MATERIAL (Kendaraan & Moda)", 6.4, -1, False, [
        "Dominasi kendaraan pribadi & ojol",
        "Volume kendaraan > kapasitas ruas",
        "Kantong parkir terbatas",
    ]),
    ("ENVIRONMENT (Lingkungan)", 10.4, -1, False, [
        "Konser 2 hari berturut-turut",
        "Gate dibuka 14.00 -> kedatangan serentak",
        "Jam sibuk sore + lalin Ancol/Tj. Priok",
    ]),
]

fig, ax = plt.subplots(figsize=(17, 9.5))
ax.set_xlim(0, 17)
ax.set_ylim(-5.6, 5.6)
ax.axis("off")

# spine + head
ax.annotate("", xy=(13.4, 0), xytext=(0.6, 0),
            arrowprops=dict(arrowstyle="-|>", lw=3, color="#1f2937"))
ax.add_patch(FancyBboxPatch((13.5, -1.0), 3.3, 2.0, boxstyle="round,pad=0.05",
                            fc="#fee2e2", ec="#b91c1c", lw=2.5))
ax.text(15.15, 0, HEAD, ha="center", va="center", fontsize=12.5,
        fontweight="bold", color="#7f1d1d")

for title, x, side, root, causes in BONES:
    color = "#b91c1c" if root else "#1d4ed8"
    x0, y0 = x - 1.6, side * 3.6          # outer end of the bone
    ax.plot([x0, x], [y0, 0], lw=2.6 if root else 2.2, color=color)
    ax.text(x0, y0 + side * 0.32, title, ha="center", va="center",
            fontsize=11.5, fontweight="bold", color="white",
            bbox=dict(boxstyle="round,pad=0.35", fc=color, ec=color))
    n = len(causes)
    for i, text in enumerate(causes):
        t = (i + 1) / (n + 1)             # position along the bone
        by = y0 + (0 - y0) * t
        bx = x0 + (x - x0) * t
        ax.plot([bx - 0.3, bx], [by, by], lw=1.4, color=color)
        ax.text(bx - 0.35, by, text, ha="right", va="center", fontsize=9.3,
                color="#111827")

# root-cause callout (bottom strip)
ax.add_patch(FancyBboxPatch((0.5, -5.45), 16.3, 0.95, boxstyle="round,pad=0.04",
                            fc="#fef3c7", ec="#b45309", lw=1.8))
ax.text(8.65, -4.97,
        "AKAR MASALAH UTAMA (dimodelkan ke graf): kapasitas ruas jalan & pintu masuk < "
        "permintaan kendaraan  =>  Max-Flow\n"
        "Persimpangan/pintu = Vertex  |  ruas jalan = Edge berarah  |  kapasitas (kend/jam) "
        "= capacity  |  bottleneck = Min-Cut",
        ha="center", va="center", fontsize=10.5, color="#78350f")

ax.set_title("Diagram Fishbone (Ishikawa) - Akses Menuju JIS saat Konser The Weeknd",
             fontsize=15, fontweight="bold", pad=12)
fig.savefig(OUT, dpi=150, bbox_inches="tight", facecolor="white")
print(f"saved {OUT}")
