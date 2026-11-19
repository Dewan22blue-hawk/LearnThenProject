import { supabase } from '../lib/supabaseClient';
import {
  enrichIgPost,
  formatDotNumber,
  formatIsoToPacificPublishTime,
  normalizePermalink,
  parseMetaIgCsv,
} from '../lib/igCsvParser';
import type {
  IgAnalyticsSummary,
  IgPostCategory,
  IgPostFormat,
  IgPostItem,
  IgPostRaw,
  IgRecommendationItem,
} from '../types/lapIg';
import joyoalkesCsvRaw from '../../JoyoalkesDec-31-2025_Nov-18-2026_1731551591701620.csv?raw';
import cumangituCsvRaw from '../../cumangitu Jan-01-2026_Nov-19-2026_2592818254566874.csv?raw';

const LOCAL_STORAGE_KEY = 'outputlab_lap_ig_posts_v1';
const DELETED_IDS_KEY = 'outputlab_lap_ig_deleted_v1';

const DAY_ORDER = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const HOUR_SLOTS = [
  { label: '06:00–09:59', min: 6, max: 9 },
  { label: '10:00–13:59', min: 10, max: 13 },
  { label: '14:00–17:59', min: 14, max: 17 },
  { label: '18:00–21:59', min: 18, max: 21 },
  { label: '22:00–05:59', min: 22, max: 29 },
];

function getSeedPosts(): IgPostItem[] {
  return [...parseMetaIgCsv(joyoalkesCsvRaw), ...parseMetaIgCsv(cumangituCsvRaw)];
}

function getDeletedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_IDS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

function markDeletedId(postId: string) {
  try {
    const set = getDeletedSet();
    set.add(postId);
    localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(Array.from(set)));
  } catch {
    /* ignore storage error */
  }
}

function readLocalRawPosts(): IgPostRaw[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as IgPostRaw[]) : [];
  } catch {
    return [];
  }
}

function writeLocalRawPosts(posts: IgPostRaw[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(posts));
  } catch {
    /* ignore storage error */
  }
}

function isTableMissingError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const msg = (error as { message?: string; code?: string }).message?.toLowerCase() ?? '';
  const code = (error as { code?: string }).code ?? '';
  return code === '42P01' || msg.includes('relation') || msg.includes('does not exist');
}

function stripEnrichedFields(p: IgPostRaw | IgPostItem): IgPostRaw {
  return {
    post_id: p.post_id,
    account_id: p.account_id,
    username: p.username,
    account_name: p.account_name,
    description: p.description,
    duration_sec: p.duration_sec,
    published_raw: p.published_raw,
    published_at: p.published_at,
    permalink: p.permalink,
    post_type: p.post_type,
    data_comment: p.data_comment,
    date_preset: p.date_preset,
    views: p.views,
    reach: p.reach,
    likes: p.likes,
    shares: p.shares,
    follows: p.follows,
    comments: p.comments,
    saves: p.saves,
  };
}

function mergePostCollections(base: IgPostItem[], incoming: IgPostItem[]): {
  merged: IgPostItem[];
  addedCount: number;
  updatedCount: number;
} {
  const byKey = new Map<string, IgPostItem>();
  const permalinkToKey = new Map<string, string>();

  for (const item of base) {
    byKey.set(item.post_id, item);
    const normLink = normalizePermalink(item.permalink);
    if (normLink) permalinkToKey.set(normLink, item.post_id);
  }

  let addedCount = 0;
  let updatedCount = 0;

  for (const inc of incoming) {
    const normLink = normalizePermalink(inc.permalink);
    const existingKey = byKey.has(inc.post_id)
      ? inc.post_id
      : normLink
        ? permalinkToKey.get(normLink)
        : undefined;

    if (existingKey && byKey.has(existingKey)) {
      byKey.set(existingKey, { ...inc, post_id: existingKey });
      updatedCount++;
    } else {
      byKey.set(inc.post_id, inc);
      if (normLink) permalinkToKey.set(normLink, inc.post_id);
      addedCount++;
    }
  }

  const merged = Array.from(byKey.values()).sort(
    (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
  );

  return { merged, addedCount, updatedCount };
}

export async function listIgPosts(): Promise<IgPostItem[]> {
  const deleted = getDeletedSet();
  const seed = getSeedPosts().filter((p) => !deleted.has(p.post_id));
  const localRaw = readLocalRawPosts().map(enrichIgPost);

  let base = mergePostCollections(seed, localRaw).merged;

  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (userId) {
      const { data, error } = await supabase
        .from('instagram_posts')
        .select('*')
        .order('published_at', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        const remoteItems = (data as IgPostRaw[]).map(enrichIgPost);
        base = mergePostCollections(base, remoteItems).merged;
      } else if (error && !isTableMissingError(error)) {
        console.warn('Error fetching instagram_posts:', error.message);
      }
    }
  } catch {
    /* fallback to seed + local */
  }

  writeLocalRawPosts(base.map(stripEnrichedFields));
  return base;
}

export function previewCsvMerge(existing: IgPostItem[], csvText: string) {
  const incoming = parseMetaIgCsv(csvText);
  const { merged, addedCount, updatedCount } = mergePostCollections(existing, incoming);
  return {
    incomingCount: incoming.length,
    addedCount,
    updatedCount,
    totalCount: merged.length,
    incoming,
  };
}

export async function upsertIgPostsFromCsv(
  existing: IgPostItem[],
  csvText: string
): Promise<{
  addedCount: number;
  updatedCount: number;
  totalCount: number;
  items: IgPostItem[];
}> {
  const incoming = parseMetaIgCsv(csvText);
  const { merged, addedCount, updatedCount } = mergePostCollections(existing, incoming);

  writeLocalRawPosts(merged.map(stripEnrichedFields));

  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (userId && incoming.length > 0) {
      const rows = incoming.map((p) => ({
        ...stripEnrichedFields(p),
        user_id: userId,
      }));
      const { error } = await supabase
        .from('instagram_posts')
        .upsert(rows, { onConflict: 'user_id,post_id' });
      if (error && !isTableMissingError(error)) {
        console.warn('Supabase upsert instagram_posts warning:', error.message);
      }
    }
  } catch {
    /* local storage already updated */
  }

  return { addedCount, updatedCount, totalCount: merged.length, items: merged };
}

export async function addManualIgPost(
  existing: IgPostItem[],
  input: {
    username: string;
    account_name: string;
    description: string;
    post_type: IgPostFormat;
    duration_sec: number;
    published_at_local: string; // YYYY-MM-DDTHH:mm (WIB)
    permalink: string;
    views: number;
    reach: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    follows: number;
  }
): Promise<IgPostItem[]> {
  const iso = input.published_at_local
    ? new Date(`${input.published_at_local}:00+07:00`).toISOString()
    : new Date().toISOString();

  const postId = `manual_${Date.now()}`;
  const raw: IgPostRaw = {
    post_id: postId,
    account_id: '',
    username: input.username.trim() || 'custom_account',
    account_name: input.account_name.trim() || input.username.trim() || 'Akun Instagram',
    description: input.description.trim(),
    duration_sec: input.post_type === 'Reel IG' ? Math.max(0, input.duration_sec) : 0,
    published_raw: formatIsoToPacificPublishTime(iso),
    published_at: iso,
    permalink: input.permalink.trim(),
    post_type: input.post_type,
    data_comment: '',
    date_preset: 'Sepanjang Masa',
    views: Math.max(0, input.views),
    reach: Math.max(0, input.reach),
    likes: Math.max(0, input.likes),
    shares: Math.max(0, input.shares),
    follows: Math.max(0, input.follows),
    comments: Math.max(0, input.comments),
    saves: Math.max(0, input.saves),
  };

  const enriched = enrichIgPost(raw);
  const { merged } = mergePostCollections(existing, [enriched]);
  writeLocalRawPosts(merged.map(stripEnrichedFields));

  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (userId) {
      await supabase
        .from('instagram_posts')
        .upsert({ ...raw, user_id: userId }, { onConflict: 'user_id,post_id' });
    }
  } catch {
    /* ignore */
  }

  return merged;
}

export async function deleteIgPost(existing: IgPostItem[], postId: string): Promise<IgPostItem[]> {
  markDeletedId(postId);
  const next = existing.filter((p) => p.post_id !== postId);
  writeLocalRawPosts(next.map(stripEnrichedFields));

  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (userId) {
      await supabase
        .from('instagram_posts')
        .delete()
        .eq('user_id', userId)
        .eq('post_id', postId);
    }
  } catch {
    /* ignore */
  }

  return next;
}

function getDurationBucket(sec: number): string {
  if (sec < 20) return '< 20 dtk';
  if (sec <= 35) return '20–35 dtk';
  if (sec <= 60) return '36–60 dtk';
  return '> 60 dtk';
}

function generateIgRecommendations(
  posts: IgPostItem[],
  summary: Omit<IgAnalyticsSummary, 'recommendations'>
): IgRecommendationItem[] {
  if (posts.length === 0) return [];

  const recs: IgRecommendationItem[] = [];
  const topPosts = [...posts].sort((a, b) => b.views - a.views);
  const topPost = topPosts[0];
  const topHashtagsList = summary.topHashtags.slice(0, 3).map((h) => h.tag).join(' ');

  // 1. Format & Durasi Reels Optimal
  if (summary.bestFormat) {
    const durText =
      summary.bestFormat.format === 'Reel IG' && summary.bestDuration
        ? ` dengan durasi ${summary.bestDuration.bucket} (rata-rata ${formatDotNumber(summary.bestDuration.avgViews)} tayangan)`
        : '';

    recs.push({
      id: 'rec-format',
      priority: 'Tinggi',
      focusArea: 'Format & Durasi',
      title: `Prioritaskan produksi ${summary.bestFormat.format}${summary.bestDuration && summary.bestFormat.format === 'Reel IG' ? ` (${summary.bestDuration.bucket})` : ''}`,
      rationale: `Format ${summary.bestFormat.format} mencatat rata-rata tertinggi sebesar ${formatDotNumber(summary.bestFormat.avgViews)} tayangan per konten dengan ERR ${summary.bestFormat.avgErrPercent}%.`,
      actionPlan: `Jadikan ${summary.bestFormat.format}${durText} sebagai tulang punggung 60–70% kalender konten bulan depan. Gunakan hook kuat pada 3 detik pertama seperti pola di "${topPost.title.slice(0, 55)}...".`,
      suggestedFormat:
        summary.bestFormat.format === 'Reel IG' && summary.bestDuration
          ? `${summary.bestFormat.format} · ${summary.bestDuration.bucket}`
          : summary.bestFormat.format,
    });
  }

  // 2. Topik / Content Pillar yang Perlu Diperbanyak
  if (summary.bestCategory) {
    const highErrCategory = [...summary.categoryPerformance]
      .filter((c) => c.count >= 2)
      .sort((a, b) => b.avgErrPercent - a.avgErrPercent)[0];

    const secondPillar =
      highErrCategory && highErrCategory.category !== summary.bestCategory.category
        ? highErrCategory
        : null;

    recs.push({
      id: 'rec-pillar',
      priority: 'Tinggi',
      focusArea: 'Content Pillar',
      title: `Buat seri lanjutan topik "${summary.bestCategory.category}"`,
      rationale: `Topik "${summary.bestCategory.category}" menghasilkan rata-rata ${formatDotNumber(summary.bestCategory.avgViews)} tayangan.${secondPillar ? ` Sementara "${secondPillar.category}" unggul dari sisi interaksi (ERR ${secondPillar.avgErrPercent}%).` : ''}`,
      actionPlan: `Rencanakan minimal 2–3 konten seri/part lanjutan dari topik "${summary.bestCategory.category}" (studi kasus nyata, perbandingan, atau tanya-jawab audiens).${topHashtagsList ? ` Sertakan hashtag efektif: ${topHashtagsList}.` : ''}`,
    });
  }

  // 3. Jadwal Tayang Optimal (WIB)
  if (summary.bestDay && summary.bestHourSlot) {
    recs.push({
      id: 'rec-timing',
      priority: 'Sedang',
      focusArea: 'Jadwal Upload (WIB)',
      title: `Jadwalkan unggahan utama di hari ${summary.bestDay.day} pukul ${summary.bestHourSlot.slot} WIB`,
      rationale: `Berdasarkan konversi waktu tayang ke WIB, hari ${summary.bestDay.day} mencatat rata-rata ${formatDotNumber(summary.bestDay.avgViews)} tayangan, dan slot jam ${summary.bestHourSlot.slot} WIB memiliki rata-rata ${formatDotNumber(summary.bestHourSlot.avgViews)} tayangan.`,
      actionPlan: `Kunci slot ${summary.bestDay.day} pukul ${summary.bestHourSlot.slot} WIB untuk konten unggulan mingguan agar mendapatkan dorongan distribusi awal (early velocity) yang lebih baik.`,
      suggestedTiming: `${summary.bestDay.day} · ${summary.bestHourSlot.slot} WIB`,
    });
  }

  // 4. Optimasi Save, Share & Follow Conversion
  const lowSaveRate = summary.avgSaveRate < 1.5;
  const lowVirality = summary.avgViralityRate < 0.8;
  if (lowSaveRate || lowVirality) {
    recs.push({
      id: 'rec-cta',
      priority: 'Peluang',
      focusArea: 'Retensi & Konversi',
      title: lowSaveRate
        ? 'Tingkatkan Save Rate lewat konten checklist & panduan praktis'
        : 'Dorong Virality Rate dengan konten perbandingan & opini tegas',
      rationale: `Save Rate saat ini rata-rata ${summary.avgSaveRate}% dan Virality (Share) Rate ${summary.avgViralityRate}% dari total jangkauan. Total konversi follow baru baru mencapai ${formatDotNumber(summary.totalFollows)} akun.`,
      actionPlan: lowSaveRate
        ? 'Sisipkan ringkasan poin langkah demi langkah atau Carousel ringkas + CTA eksplisit ("Simpan agar tidak lupa") di akhir slide/video.'
        : 'Buat format "Perbandingan / Mitos vs Fakta" yang relevan dengan audiens inti dan tutup dengan CTA ajakan membagikan ke rekan/keluarga.',
    });
  }

  return recs;
}

export function computeIgAnalytics(posts: IgPostItem[]): IgAnalyticsSummary {
  const totalPosts = posts.length;
  const reelCount = posts.filter((p) => p.post_type === 'Reel IG').length;
  const carouselCount = posts.filter((p) => p.post_type === 'Carousel IG').length;
  const imageCount = posts.filter((p) => p.post_type === 'Gambar IG').length;

  const totalViews = posts.reduce((s, p) => s + p.views, 0);
  const totalReach = posts.reduce((s, p) => s + p.reach, 0);
  const totalLikes = posts.reduce((s, p) => s + p.likes, 0);
  const totalComments = posts.reduce((s, p) => s + p.comments, 0);
  const totalShares = posts.reduce((s, p) => s + p.shares, 0);
  const totalSaves = posts.reduce((s, p) => s + p.saves, 0);
  const totalFollows = posts.reduce((s, p) => s + p.follows, 0);

  const avgViews = totalPosts > 0 ? Math.round(totalViews / totalPosts) : 0;
  const avgReach = totalPosts > 0 ? Math.round(totalReach / totalPosts) : 0;
  const avgReplayRatio =
    totalReach > 0 ? Number((totalViews / totalReach).toFixed(2)) : 0;

  const postsWithReach = posts.filter((p) => p.reach > 0);
  const avgErrPercent =
    postsWithReach.length > 0
      ? Number(
          (
            postsWithReach.reduce((s, p) => s + p.errPercent, 0) / postsWithReach.length
          ).toFixed(2)
        )
      : 0;
  const avgSaveRate =
    postsWithReach.length > 0
      ? Number(
          (
            postsWithReach.reduce((s, p) => s + p.saveRate, 0) / postsWithReach.length
          ).toFixed(2)
        )
      : 0;
  const avgViralityRate =
    postsWithReach.length > 0
      ? Number(
          (
            postsWithReach.reduce((s, p) => s + p.viralityRate, 0) / postsWithReach.length
          ).toFixed(2)
        )
      : 0;

  // 1. Tren Bulanan
  const monthMap = new Map<
    string,
    { monthKey: string; month: string; views: number; reach: number; errSum: number; errCount: number; posts: number }
  >();
  for (const p of posts) {
    const cur = monthMap.get(p.publishedMonthKey) ?? {
      monthKey: p.publishedMonthKey,
      month: p.publishedMonthLabel,
      views: 0,
      reach: 0,
      errSum: 0,
      errCount: 0,
      posts: 0,
    };
    cur.views += p.views;
    cur.reach += p.reach;
    cur.posts += 1;
    if (p.reach > 0) {
      cur.errSum += p.errPercent;
      cur.errCount += 1;
    }
    monthMap.set(p.publishedMonthKey, cur);
  }
  const monthlyTrend = Array.from(monthMap.values())
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .map((m) => ({
      monthKey: m.monthKey,
      month: m.month,
      views: m.views,
      reach: m.reach,
      errPercent: m.errCount > 0 ? Number((m.errSum / m.errCount).toFixed(2)) : 0,
      posts: m.posts,
    }));

  // 2. Perbandingan Format
  const formats: IgPostFormat[] = ['Reel IG', 'Carousel IG', 'Gambar IG'];
  const formatComparison = formats
    .map((format) => {
      const group = posts.filter((p) => p.post_type === format);
      const count = group.length;
      const sumViews = group.reduce((s, p) => s + p.views, 0);
      const sumReach = group.reduce((s, p) => s + p.reach, 0);
      const withReach = group.filter((p) => p.reach > 0);
      const avgErr =
        withReach.length > 0
          ? Number(
              (withReach.reduce((s, p) => s + p.errPercent, 0) / withReach.length).toFixed(2)
            )
          : 0;
      return {
        format,
        count,
        avgViews: count > 0 ? Math.round(sumViews / count) : 0,
        avgReach: count > 0 ? Math.round(sumReach / count) : 0,
        avgErrPercent: avgErr,
        totalViews: sumViews,
      };
    })
    .filter((f) => f.count > 0);

  // 3. Performa Kategori Topik
  const catMap = new Map<IgPostCategory, IgPostItem[]>();
  for (const p of posts) {
    const arr = catMap.get(p.category) ?? [];
    arr.push(p);
    catMap.set(p.category, arr);
  }
  const categoryPerformance = Array.from(catMap.entries())
    .map(([category, group]) => {
      const count = group.length;
      const withReach = group.filter((p) => p.reach > 0);
      return {
        category,
        count,
        avgViews: Math.round(group.reduce((s, p) => s + p.views, 0) / count),
        avgReach: Math.round(group.reduce((s, p) => s + p.reach, 0) / count),
        avgErrPercent:
          withReach.length > 0
            ? Number(
                (withReach.reduce((s, p) => s + p.errPercent, 0) / withReach.length).toFixed(2)
              )
            : 0,
      };
    })
    .sort((a, b) => b.avgViews - a.avgViews);

  // 4. Performa Hari & Jam (WIB)
  const dayPerformance = DAY_ORDER.map((day) => {
    const group = posts.filter((p) => p.publishedWibDay === day);
    return {
      day,
      count: group.length,
      avgViews:
        group.length > 0 ? Math.round(group.reduce((s, p) => s + p.views, 0) / group.length) : 0,
    };
  });

  const hourSlotPerformance = HOUR_SLOTS.map((slot) => {
    const group = posts.filter((p) => {
      const h = p.publishedWibHour < 6 ? p.publishedWibHour + 24 : p.publishedWibHour;
      return h >= slot.min && h <= slot.max;
    });
    return {
      slot: slot.label,
      count: group.length,
      avgViews:
        group.length > 0 ? Math.round(group.reduce((s, p) => s + p.views, 0) / group.length) : 0,
    };
  });

  // 5. Performa Durasi Reels
  const reels = posts.filter((p) => p.post_type === 'Reel IG' && p.duration_sec > 0);
  const buckets = ['< 20 dtk', '20–35 dtk', '36–60 dtk', '> 60 dtk'];
  const durationPerformance = buckets
    .map((bucket) => {
      const group = reels.filter((p) => getDurationBucket(p.duration_sec) === bucket);
      const withReach = group.filter((p) => p.reach > 0);
      return {
        bucket,
        count: group.length,
        avgViews:
          group.length > 0
            ? Math.round(group.reduce((s, p) => s + p.views, 0) / group.length)
            : 0,
        avgErrPercent:
          withReach.length > 0
            ? Number(
                (withReach.reduce((s, p) => s + p.errPercent, 0) / withReach.length).toFixed(2)
              )
            : 0,
      };
    })
    .filter((d) => d.count > 0);

  // 6. Top Hashtags
  const tagMap = new Map<string, { count: number; viewsSum: number }>();
  for (const p of posts) {
    for (const tag of p.hashtags) {
      const cur = tagMap.get(tag) ?? { count: 0, viewsSum: 0 };
      cur.count += 1;
      cur.viewsSum += p.views;
      tagMap.set(tag, cur);
    }
  }
  const topHashtags = Array.from(tagMap.entries())
    .map(([tag, info]) => ({
      tag,
      count: info.count,
      avgViews: Math.round(info.viewsSum / info.count),
    }))
    .sort((a, b) => b.avgViews - a.avgViews)
    .slice(0, 6);

  const bestFormat =
    [...formatComparison].sort((a, b) => b.avgViews - a.avgViews)[0] ?? null;
  const bestCategory = categoryPerformance[0] ?? null;
  const bestDay =
    [...dayPerformance].filter((d) => d.count > 0).sort((a, b) => b.avgViews - a.avgViews)[0] ??
    null;
  const bestHourSlot =
    [...hourSlotPerformance].filter((h) => h.count > 0).sort((a, b) => b.avgViews - a.avgViews)[0] ??
    null;
  const bestDuration =
    [...durationPerformance].sort((a, b) => b.avgViews - a.avgViews)[0] ?? null;

  const baseSummary = {
    totalPosts,
    reelCount,
    carouselCount,
    imageCount,
    totalViews,
    avgViews,
    totalReach,
    avgReach,
    avgReplayRatio,
    avgErrPercent,
    totalLikes,
    totalComments,
    totalShares,
    totalSaves,
    totalFollows,
    avgSaveRate,
    avgViralityRate,
    monthlyTrend,
    formatComparison,
    categoryPerformance,
    dayPerformance,
    hourSlotPerformance,
    durationPerformance,
    topHashtags,
    bestFormat: bestFormat
      ? {
          format: bestFormat.format,
          avgViews: bestFormat.avgViews,
          avgErrPercent: bestFormat.avgErrPercent,
        }
      : null,
    bestCategory: bestCategory
      ? { category: bestCategory.category, avgViews: bestCategory.avgViews }
      : null,
    bestDay: bestDay ? { day: bestDay.day, avgViews: bestDay.avgViews } : null,
    bestHourSlot: bestHourSlot
      ? { slot: bestHourSlot.slot, avgViews: bestHourSlot.avgViews }
      : null,
    bestDuration: bestDuration
      ? { bucket: bestDuration.bucket, avgViews: bestDuration.avgViews }
      : null,
  };

  return {
    ...baseSummary,
    recommendations: generateIgRecommendations(posts, baseSummary),
  };
}
