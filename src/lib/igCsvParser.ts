import type { IgPostCategory, IgPostFormat, IgPostItem, IgPostRaw } from '../types/lapIg';

const CSV_HEADERS = [
  'ID Postingan',
  'ID Akun',
  'Nama pengguna akun',
  'Nama akun',
  'Deskripsi',
  'Durasi (detik)',
  'Waktu penerbitan',
  'Permalink',
  'Jenis postingan',
  'Komentar data',
  'Tanggal',
  'Tayangan',
  'Jangkauan',
  'Suka',
  'Frekuensi dibagikan',
  'Mengikuti',
  'Komentar',
  'Frekuensi Disimpan',
] as const;

/** Format angka ribuan dengan pemisah titik (.) sesuai standar executive dashboard. */
export function formatDotNumber(val: number | string | null | undefined): string {
  const num = typeof val === 'number' ? val : Number(val) || 0;
  const rounded = Math.round(num);
  const sign = rounded < 0 ? '-' : '';
  return sign + String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** State-machine parser RFC-4180 (aman untuk multi-line caption & escaped quote). */
export function parseCsvRfc4180(rawText: string): string[][] {
  const text = rawText.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

/** Hitung offset Pacific Time (GMT-7 PDT atau GMT-8 PST) pada tanggal tertentu. */
function getPacificOffsetHours(year: number, month: number, day: number): number {
  try {
    const probe = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      timeZoneName: 'shortOffset',
    }).formatToParts(probe);
    const tzName = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT-8';
    const match = tzName.match(/GMT([+-]\d+)/);
    return match ? Number(match[1]) : -8;
  } catch {
    return -8;
  }
}

/** Konversi "MM/DD/YYYY HH:mm" (America/Los_Angeles) menjadi ISO UTC string. */
export function parsePacificPublishTimeToIso(raw: string): string {
  const trimmed = raw.trim();
  const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (!m) {
    const fallback = new Date(trimmed);
    return Number.isNaN(fallback.getTime()) ? new Date().toISOString() : fallback.toISOString();
  }
  const month = Number(m[1]);
  const day = Number(m[2]);
  const year = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const offsetHours = getPacificOffsetHours(year, month, day);
  const utcMs = Date.UTC(year, month - 1, day, hour - offsetHours, minute, 0);
  return new Date(utcMs).toISOString();
}

/** Konversi ISO UTC kembali ke "MM/DD/YYYY HH:mm" dalam America/Los_Angeles untuk export round-trip. */
export function formatIsoToPacificPublishTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('month')}/${get('day')}/${get('year')} ${get('hour')}:${get('minute')}`;
}

export function normalizePostType(raw: string): IgPostFormat {
  const lower = raw.trim().toLowerCase();
  if (lower.includes('reel')) return 'Reel IG';
  if (lower.includes('carousel')) return 'Carousel IG';
  return 'Gambar IG';
}

export function normalizePermalink(url: string): string {
  return url.trim().replace(/\/+$/, '').toLowerCase();
}

export function extractShortcode(permalink: string): string {
  const match = permalink.match(/instagram\.com\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
  return match ? match[1] : '';
}

export function buildEmbedUrl(permalink: string, shortcode: string): string {
  if (!shortcode) return '';
  const kind = permalink.toLowerCase().includes('/reel') ? 'reel' : 'p';
  return `https://www.instagram.com/${kind}/${shortcode}/embed`;
}

export function extractHashtags(description: string): string[] {
  const matches = description.match(/#[A-Za-z0-9_]+/g) ?? [];
  const seen = new Set<string>();
  for (const tag of matches) {
    seen.add(tag.toLowerCase());
  }
  return Array.from(seen);
}

export function extractHookTitle(description: string, fallbackType: IgPostFormat): string {
  const lines = description.replace(/\r\n/g, '\n').split('\n');
  for (const line of lines) {
    const cleaned = line.trim();
    if (!cleaned) continue;
    const withoutHashtags = cleaned.replace(/#[A-Za-z0-9_]+/g, '').trim();
    if (!withoutHashtags || /^[.,!?;:\-–—]+$/.test(withoutHashtags)) continue;
    if (cleaned.length <= 110) return cleaned;
    return `${cleaned.slice(0, 107).trimEnd()}...`;
  }
  return `${fallbackType} Tanpa Judul`;
}

export function classifyIgCategory(description: string, username: string): IgPostCategory {
  const text = `${description} ${username}`.toLowerCase();

  if (
    /(testimoni|review|pelanggan|customer|wa dari|order|terima kasih|puas|kasus|studi kasus|berhasil)/.test(
      text
    )
  ) {
    return 'Testimoni & Studi Kasus';
  }
  if (/(sewa|promo|diskon|gratis|siap kirim|jemput|order|pesan|wa|hubungi|ready|stok|harga)/.test(text)) {
    return 'Promo & Layanan';
  }
  if (
    /(kursi roda|bed crank|bed pasien|alkes|alat kesehatan|oksigen|tabung|nebulizer|tensimeter|joyoalkes|hospital|medis)/.test(
      text
    )
  ) {
    return 'Alat Kesehatan & Sewa';
  }
  if (/(cara|tips|tutorial|langkah|panduan|ketahui|wajib tahu|hindari|jangan|trik|setup)/.test(text)) {
    return 'Tutorial & Tips';
  }
  if (
    /(ai|llm|rag|sintetis|synthetic|lidar|yolo|cnn|nerf|model|coding|programming|python|data|machine learning|deep learning|agent|prompt|gpu|transformer)/.test(
      text
    )
  ) {
    return 'Edukasi AI & Tech';
  }
  if (/(kenapa|pentingnya|tantangan|opini|menurut|kenyataannya|fakta|perbandingan|vs|lebih tepat)/.test(text)) {
    return 'Insight & Opini';
  }
  return 'Lainnya';
}

function getWibParts(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return {
      display: '-',
      monthKey: '1970-01',
      monthLabel: '-',
      day: 'Senin',
      hour: 12,
    };
  }

  const display =
    new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d) + ' WIB';

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);

  const year = parts.find((p) => p.type === 'year')?.value ?? '2026';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '12');

  const monthLabel = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    month: 'short',
    year: 'numeric',
  }).format(d);

  const dayRaw = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
  }).format(d);
  const day = dayRaw.charAt(0).toUpperCase() + dayRaw.slice(1);

  return {
    display,
    monthKey: `${year}-${month}`,
    monthLabel,
    day,
    hour,
  };
}

/** Memperkaya baris mentah menjadi IgPostItem dengan seluruh metrik analitik & klasifikasi. */
export function enrichIgPost(raw: IgPostRaw): IgPostItem {
  const views = Math.max(0, Number(raw.views) || 0);
  const reach = Math.max(0, Number(raw.reach) || 0);
  const likes = Math.max(0, Number(raw.likes) || 0);
  const comments = Math.max(0, Number(raw.comments) || 0);
  const shares = Math.max(0, Number(raw.shares) || 0);
  const saves = Math.max(0, Number(raw.saves) || 0);
  const follows = Math.max(0, Number(raw.follows) || 0);

  const totalInteractions = likes + comments + shares + saves;
  const errPercent = reach > 0 ? Number(((totalInteractions / reach) * 100).toFixed(2)) : 0;
  const ervPercent = views > 0 ? Number(((totalInteractions / views) * 100).toFixed(2)) : 0;
  const viralityRate = reach > 0 ? Number(((shares / reach) * 100).toFixed(2)) : 0;
  const saveRate = reach > 0 ? Number(((saves / reach) * 100).toFixed(2)) : 0;
  const replayRatio = reach > 0 ? Number((views / reach).toFixed(2)) : 0;

  const shortcode = extractShortcode(raw.permalink);
  const embedUrl = buildEmbedUrl(raw.permalink, shortcode);
  const title = extractHookTitle(raw.description, raw.post_type);
  const hashtags = extractHashtags(raw.description);
  const category = classifyIgCategory(raw.description, raw.username);
  const wib = getWibParts(raw.published_at);

  return {
    ...raw,
    views,
    reach,
    likes,
    comments,
    shares,
    saves,
    follows,
    title,
    hashtags,
    shortcode,
    embedUrl,
    category,
    totalInteractions,
    errPercent,
    ervPercent,
    viralityRate,
    saveRate,
    replayRatio,
    publishedWibDisplay: wib.display,
    publishedMonthKey: wib.monthKey,
    publishedMonthLabel: wib.monthLabel,
    publishedWibDay: wib.day,
    publishedWibHour: wib.hour,
  };
}

/** Parse CSV Meta Business Suite (mendukung header Bahasa Inggris maupun Bahasa Indonesia). */
export function parseMetaIgCsv(csvText: string): IgPostItem[] {
  const rows = parseCsvRfc4180(csvText);
  if (rows.length < 2) return [];

  const headerRow = rows[0].map((h) => h.trim().toLowerCase());
  const findCol = (...candidates: string[]) => {
    for (const c of candidates) {
      const idx = headerRow.indexOf(c.toLowerCase());
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const idxPostId = findCol('post id', 'id postingan');
  const idxAccountId = findCol('account id', 'id akun');
  const idxUsername = findCol('account username', 'nama pengguna akun');
  const idxAccountName = findCol('account name', 'nama akun');
  const idxDesc = findCol('description', 'deskripsi');
  const idxDuration = findCol('duration (sec)', 'durasi (detik)');
  const idxPublish = findCol('publish time', 'waktu penerbitan');
  const idxPermalink = findCol('permalink');
  const idxPostType = findCol('post type', 'jenis postingan');
  const idxCommentData = findCol('data comment', 'komentar data');
  const idxDate = findCol('date', 'tanggal');
  const idxViews = findCol('views', 'tayangan');
  const idxReach = findCol('reach', 'jangkauan');
  const idxLikes = findCol('likes', 'suka');
  const idxShares = findCol('shares', 'frekuensi dibagikan');
  const idxFollows = findCol('follows', 'mengikuti');
  const idxComments = findCol('comments', 'komentar');
  const idxSaves = findCol('saves', 'frekuensi disimpan');

  const items: IgPostItem[] = [];

  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    const cell = (idx: number, fallbackIdx: number) =>
      (idx !== -1 ? cols[idx] : cols[fallbackIdx]) ?? '';

    const rawPostId = String(cell(idxPostId, 0)).trim();
    const permalink = String(cell(idxPermalink, 7)).trim();
    if (!rawPostId && !permalink) continue;

    const publishedRaw = String(cell(idxPublish, 6)).trim();
    const postType = normalizePostType(String(cell(idxPostType, 8)));

    const raw: IgPostRaw = {
      post_id: rawPostId || `url_${extractShortcode(permalink) || r}`,
      account_id: String(cell(idxAccountId, 1)).trim(),
      username: String(cell(idxUsername, 2)).trim(),
      account_name: String(cell(idxAccountName, 3)).trim(),
      description: String(cell(idxDesc, 4)),
      duration_sec: Math.max(0, Math.round(Number(cell(idxDuration, 5)) || 0)),
      published_raw: publishedRaw,
      published_at: parsePacificPublishTimeToIso(publishedRaw),
      permalink,
      post_type: postType,
      data_comment: String(cell(idxCommentData, 9)).trim(),
      date_preset: String(cell(idxDate, 10)).trim() || 'Sepanjang Masa',
      views: Math.max(0, Math.round(Number(cell(idxViews, 11)) || 0)),
      reach: Math.max(0, Math.round(Number(cell(idxReach, 12)) || 0)),
      likes: Math.max(0, Math.round(Number(cell(idxLikes, 13)) || 0)),
      shares: Math.max(0, Math.round(Number(cell(idxShares, 14)) || 0)),
      follows: Math.max(0, Math.round(Number(cell(idxFollows, 15)) || 0)),
      comments: Math.max(0, Math.round(Number(cell(idxComments, 16)) || 0)),
      saves: Math.max(0, Math.round(Number(cell(idxSaves, 17)) || 0)),
    };

    items.push(enrichIgPost(raw));
  }

  return items;
}

function escapeCsvCell(val: string | number): string {
  const str = String(val ?? '');
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Serialize kembali ke format CSV 18 kolom identik (round-trip safe). */
export function serializeIgCsv(posts: IgPostRaw[]): string {
  const lines = [CSV_HEADERS.map((h) => escapeCsvCell(h)).join(',')];
  for (const p of posts) {
    const pubRaw = p.published_raw || formatIsoToPacificPublishTime(p.published_at);
    const row = [
      p.post_id,
      p.account_id,
      p.username,
      p.account_name,
      p.description,
      p.duration_sec,
      pubRaw,
      p.permalink,
      p.post_type,
      p.data_comment,
      p.date_preset,
      p.views,
      p.reach,
      p.likes,
      p.shares,
      p.follows,
      p.comments,
      p.saves,
    ];
    lines.push(row.map(escapeCsvCell).join(','));
  }
  return '\uFEFF' + lines.join('\r\n');
}
