# PRD: Modul Laporan & Analitik Performa Instagram (`Lap. IG`)

## 1. Ringkasan & Tujuan Produk
- **Nama Fitur**: Laporan Performa Instagram (`Lap. IG` — route `/lap-ig`)
- **Tujuan Utama**:
  1. Mengolah file CSV mentah hasil ekspor **Meta Business Suite** menjadi dashboard laporan analitik yang bersih, rapi, dan siap dipresentasikan di tingkat eksekutif/manajemen.
  2. Memungkinkan penambahan/pembaruan data secara berkelanjutan melalui **Upload CSV (Merge/Upsert)** dengan format yang sama maupun **Input Manual**.
  3. Menyajikan metrik kunci *Social Media Analyst* (Tayangan, Jangkauan, Engagement Rate by Reach/Views, Replay Ratio, Waktu & Durasi Reels Optimal, Content Pillar) beserta **Live Preview Embed Reels/Postingan Instagram** langsung di dalam aplikasi.

---

## 2. Arsitektur & Alur Data

```text
Upload CSV Meta Business Suite / File CSV Dasar
                     │
                     ▼
   Parser CSV RFC-4180 (Multi-line Caption Safe)
                     │
   ├─► Konversi Zona Waktu: America/Los_Angeles (PST/PDT) ──► UTC / WIB (+07:00)
   ├─► Ekstraksi Hook Judul (Baris Pertama Caption), #Hashtag, & Shortcode URL
   ├─► Klasifikasi Otomatis Kategori Topik (Content Pillar)
   └─► Kalkulasi Metrik Analitik (ERR %, ERV %, Replay Ratio, Total Interaksi)
                     │
                     ▼
   Penyimpanan Hibrida (Upsert by post_id / permalink)
   ├── Primary Cloud DB : Supabase / PostgreSQL (tabel `instagram_posts`)
   └── Local/Backup CSV : File CSV dengan struktur 18 kolom identik
```

---

## 3. Spesifikasi Format CSV & Aturan Parsing (Kritis)

### 3.1 Struktur 18 Kolom CSV Meta Business Suite
Urutan header standar yang wajib didukung saat **Import (Upload)** maupun **Export**:
1. `ID Postingan` (`post_id` — **Wajib disimpan sebagai `string`**, karena berukuran 17 digit seperti `18107446301035864` yang akan mengalami pembulatan jika di-parse sebagai `Number` JavaScript).
2. `ID Akun` (`account_id` — `string`)
3. `Nama pengguna akun` (`username` — `string`)
4. `Nama akun` (`account_name` — `string`)
5. `Deskripsi` (`description` — `string` multi-baris di dalam tanda kutip `"..."`)
6. `Durasi (detik)` (`duration_sec` — `number`, bernilai `0` untuk Gambar/Carousel, `> 0` untuk Reels)
7. `Waktu penerbitan` (`published_raw` — `string` format `"MM/DD/YYYY HH:mm"`)
8. `Permalink` (`permalink` — URL konten, mis. `https://www.instagram.com/reel/Df6HlAbhL8s/`)
9. `Jenis postingan` (`post_type` — `'Reel IG' | 'Carousel IG' | 'Gambar IG'`)
10. `Komentar data` (`data_comment` — `string`)
11. `Tanggal` (`date_preset` — mis. `'Sepanjang Masa'`)
12. `Tayangan` (`views` — `number`)
13. `Jangkauan` (`reach` — `number`)
14. `Suka` (`likes` — `number`)
15. `Frekuensi dibagikan` (`shares` — `number`)
16. `Mengikuti` (`follows` — `number`, pengikut baru dari konten)
17. `Komentar` (`comments` — `number`)
18. `Frekuensi Disimpan` (`saves` — `number`)

### 3.2 Aturan Parser CSV (RFC-4180)
- **Jangan gunakan `line.split(',')` atau `text.split('\n')`** karena kolom `Deskripsi` mengandung banyak baris baru (*newlines*) dan koma di dalam tanda kutip.
- Gunakan *state-machine parser* karakter-per-karakter yang menangani:
  - UTF-8 BOM (`\uFEFF`) di awal file.
  - Tanda kutip pembuka/penutup (`"..."`) dan *escaped quote* (`""` menjadi `"`).
  - Baris baru `\r\n` dan `\n` di dalam tanda kutip sebagai bagian dari teks caption.

### 3.3 Aturan Konversi Zona Waktu (`America/Los_Angeles` → `WIB`)
- **Masalah Standar Meta**: Meta Business Suite mengekspor kolom `Waktu penerbitan` (`MM/DD/YYYY HH:mm`) dalam zona waktu **Pacific Time (`America/Los_Angeles`)**:
  - **PDT (`UTC-7`)** saat *Daylight Saving Time* (Maret–November) → selisih **+14 jam** ke WIB (`UTC+7`).
  - **PST (`UTC-8`)** saat *Standard Time* (November–Maret) → selisih **+15 jam** ke WIB (`UTC+7`).
- **Solusi Konversi**:
  - Saat mem-parse string `"MM/DD/YYYY HH:mm"` dari CSV, deteksi offset `America/Los_Angeles` pada tanggal tersebut menggunakan `Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', timeZoneName: 'shortOffset' })` (`GMT-7` atau `GMT-8`).
  - Hitung timestamp UTC dengan `Date.UTC(year, month - 1, day, hour - pacificOffset, minute)`.
  - Saat menampilkan ke UI atau mengelompokkan jam tayang, konversikan ke **WIB (`UTC+7`)**.
  - Saat mengekspor kembali ke CSV (`serializeIgCsv`), konversikan ke format `"MM/DD/YYYY HH:mm"` dalam `America/Los_Angeles` menggunakan `hourCycle: 'h23'` agar *round-trip safe*.

---

## 4. Rumus Metrik Analitik & Klasifikasi Otomatis

### 4.1 Rumus Metrik Turunan per Konten
- **Total Interaksi**:
  `likes + comments + shares + saves`
- **Engagement Rate by Reach (`ERR %`)**:
  `(Total Interaksi / Jangkauan) * 100`
- **Engagement Rate by Views (`ERV %`)**:
  `(Total Interaksi / Tayangan) * 100`
- **Virality Rate (`%`)**:
  `(Frekuensi dibagikan / Jangkauan) * 100`
- **Save Rate (`%`)**:
  `(Frekuensi Disimpan / Jangkauan) * 100`
- **Replay Ratio (Rasio Tayang Ulang)**:
  `Tayangan / Jangkauan`

### 4.2 Ekstraksi Otomatis dari Caption & URL
1. **Judul / Hook Konten (`title`)**: Ambil baris pertama non-kosong dari `Deskripsi` yang bukan sekadar kumpulan `#hashtag` atau tanda baca, potong rapi maksimal 110 karakter.
2. **Hashtags (`hashtags`)**: Ekstrak semua kecocokan `/#[A-Za-z0-9_]+/g`, ubah ke huruf kecil (*lowercase*), dan deduplikasi agar analisis *Top Hashtag* akurat.
3. **Shortcode (`shortcode`)**: Ekstrak dari `Permalink` dengan regex `/instagram\.com\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i`.
4. **URL Live Embed**:
   `https://www.instagram.com/{permalink.includes('/reel/') ? 'reel' : 'p'}/{shortcode}/embed`
5. **Klasifikasi Kategori Topik (`category`)**: Klasifikasikan caption berdasarkan kata kunci ke dalam *Content Pillar* (sesuaikan kata kunci dengan domain web target; contoh pada proyek ini: `Workshop & Sekolah`, `Seminar & Event Kampus`, `Kisah Alumni & Karier`, `Magang & Industri`, `PMB & Beasiswa`, `Prestasi & Karya Mahasiswa`, `Edukasi & Prodi`, `Pengumuman & Hari Besar`, `Hiburan & Kehidupan Kampus`).

---

## 5. Skema Database (Supabase / PostgreSQL)

```sql
CREATE TABLE IF NOT EXISTS instagram_posts (
    post_id VARCHAR(64) PRIMARY KEY,
    account_id VARCHAR(64),
    username VARCHAR(100),
    account_name TEXT,
    description TEXT,
    duration_sec INTEGER DEFAULT 0,
    published_raw VARCHAR(50),
    published_at TIMESTAMP WITH TIME ZONE,
    permalink TEXT,
    post_type VARCHAR(50),
    data_comment TEXT,
    date_preset VARCHAR(50) DEFAULT 'Sepanjang Masa',
    views INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    follows INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    saves INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_instagram_posts_published_at ON instagram_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_instagram_posts_username ON instagram_posts(username);
CREATE INDEX IF NOT EXISTS idx_instagram_posts_post_type ON instagram_posts(post_type);
```

---

## 6. Spesifikasi API (`/api/lap-ig`)

| Method | Endpoint | Payload / Query | Perilaku |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/lap-ig` | - | Mengambil seluruh daftar postingan yang sudah diperkaya metriknya, diurutkan dari `published_at` terbaru. |
| `POST` | `/api/lap-ig` | `{ mode: 'csv', csvText: string }` | Mem-parse teks CSV, melakukan **upsert/merge** berdasarkan `post_id` (atau `permalink` yang dinormalisasi): jika sudah ada maka metrik diperbarui, jika belum ada maka ditambahkan sebagai baris baru. Mengembalikan `{ success, addedCount, updatedCount, totalCount, items }`. |
| `POST` | `/api/lap-ig` | `{ mode: 'manual', post: Partial<IgPostItem> }` | Menambahkan 1 laporan konten secara manual, menghasilkan `post_id` & `published_raw` yang kompatibel dengan CSV. |
| `DELETE` | `/api/lap-ig` | `?post_id=<id>` | Menghapus 1 entri postingan berdasarkan `post_id`. |

---

## 7. Standar Desain UI/UX (Standar Presentasi Eksekutif / Anti "AI Slop")

### 7.1 Prinsip Visual
- **Palet Warna Tenang & Korporat**: Gunakan permukaan netral, satu warna aksen utama (`#0071CE` untuk metrik utama/Tayangan), `#94A3B8` untuk pembanding/Jangkauan, dan `#D97706` untuk garis rasio `ERR %`. **Hindari** tumpukan kartu gradien pelangi atau ikon berwarna-warni di setiap angka.
- **Format Angka Ribuan dengan Titik (`.`) & Tabular**:
  - Seluruh angka ribuan pada grafik (`YAxis`/`XAxis`), tooltip, tabel ringkasan, dan kartu KPI menggunakan pemisah titik (`.`, contoh: `45.000`, `128.450`) dengan helper `String(Math.round(val)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')`.
  - Gunakan class `tabular-nums` pada seluruh kolom dan blok angka.
  - Berikan lebar cukup pada sumbu Y grafik (`width={56}`) agar label angka ribuan tidak terpotong.
- **Fokus Satu Akun**: Jika dashboard didedikasikan untuk satu akun resmi (mis. `@bsi_surakarta`), hilangkan dropdown filter akun dan label `@username` yang berulang di kartu maupun tabel.

### 7.2 Tata Letak Halaman (5 Bagian Utama)
1. **Header Laporan**:
   - Judul formal (*"Laporan Performa Instagram"*) + deskripsi singkat.
   - 3 tombol aksi di kanan: **Upload CSV** (Primary), **Tambah Data** (Secondary), **Export CSV** (Secondary).
2. **4 Kartu KPI Utama (1 Baris)**:
   - **Total Konten** (rincian jumlah `Reels · Carousel · Gambar`).
   - **Total Tayangan (Views)** (rata-rata per konten & `Replay Ratio`).
   - **Total Jangkauan (Reach)** (rata-rata akun per konten).
   - **Engagement Rate (ERR)** (persentase rata-rata ERR beserta total `suka · share · save · +follow`).
3. **Bar Filter Terpadu (1 Baris, 5 Kolom Grid)**:
   - Input Pencarian (`Cari judul konten atau hashtag...` menempati 2 kolom), Dropdown `Periode/Bulan`, Dropdown `Format Konten`, dan Dropdown `Kategori`, ditambah tombol `Reset Filter` saat filter aktif.
4. **Panel Analisis Performa & Tren (Layout 2 Kolom: 8 Kolom Grafik + 4 Kolom Ringkasan)**:
   - **Kolom Kiri (Grafik dengan 4 Tab)**:
     1. *Tren Bulanan*: ComposedChart Bar (`Tayangan` & `Jangkauan`) + Line (`ERR %`).
     2. *Perbandingan Format*: BarChart rata-rata Tayangan & Jangkauan per format (`Reel IG`, `Carousel IG`, `Gambar IG`) + tabel ringkasan di bawahnya.
     3. *Kategori Topik*: Horizontal BarChart rata-rata tayangan per kategori.
     4. *Waktu & Durasi*: BarChart rata-rata tayangan per Hari, per rentang Jam (WIB), dan per kelompok Durasi Reels (`< 20 dtk`, `20–35 dtk`, `36–60 dtk`, `> 60 dtk`).
   - **Kolom Kanan (`Ringkasan Analitik`)**:
     - Panel teks eksekutif berisi 4 temuan otomatis dari data terfilter: *Format Paling Efektif*, *Topik Tertinggi* (klik untuk filter), *Waktu & Durasi Optimal*, dan *6 Hashtag Performa Terbaik* (klik untuk filter).
5. **Daftar Konten & Modal Live Preview**:
   - Dilengkapi dropdown pengurutan (`Terbaru`, `Tayangan Tertinggi`, `Jangkauan Tertinggi`, `ERR Tertinggi`, `Suka`, `Dibagikan`, `Disimpan`, `Follow Baru`), toggle tampilan **Kartu** vs **Tabel**, dan paginasi (24 konten per halaman).
   - **Modal Live Preview (`PostPreviewModal`)**:
     - Sisi kiri (5 kolom): `iframe` embed resmi Instagram (`https://www.instagram.com/{reel|p}/{shortcode}/embed`).
     - Sisi kanan (7 kolom): Judul konten, 4 kotak metrik utama (`Tayangan`, `Jangkauan`, `ERR`, `Replay Ratio`), baris metrik sekunder (`Suka`, `Komentar`, `Bagikan`, `Disimpan`, `Follow`, `ERV %`), teks caption lengkap dengan tombol **Salin Caption**, daftar hashtag, dan tombol **Hapus Entri**.

---

## 8. Referensi File Implementasi
- `src/types/lapIg.ts` — Definisi tipe `IgPostItem` dan `IgPostCategory`
- `src/lib/igCsvParser.ts` — Parser RFC-4180, konversi zona waktu Pacific → UTC/WIB, klasifikasi topik, dan serializer CSV
- `src/lib/lapIgStore.ts` — Layer penyimpanan hibrida (Supabase `instagram_posts` + file CSV lokal)
- `src/app/api/lap-ig/route.ts` — Endpoint API `GET`, `POST` (CSV merge & input manual), dan `DELETE`
- `src/app/lap-ig/page.tsx` — Server Component pemuat data awal
- `src/components/lap-ig/LapIgClient.tsx` — Dashboard utama, KPI, filter, daftar kartu & tabel
- `src/components/lap-ig/LapIgCharts.tsx` — Grafik Recharts (dengan pemisah ribuan `.`) dan panel Ringkasan Analitik
- `src/components/lap-ig/LapIgModals.tsx` — Modal Upload CSV (dengan pratinjau merge), Modal Input Manual, Modal Live Preview Instagram, dan Konfirmasi Hapus
- `scripts/migrate_instagram_posts.sql` — Skrip SQL migrasi tabel dan policy RLS Supabase
