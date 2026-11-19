export type IgPostFormat = 'Reel IG' | 'Carousel IG' | 'Gambar IG';

export type IgPostCategory =
  | 'Edukasi AI & Tech'
  | 'Alat Kesehatan & Sewa'
  | 'Tutorial & Tips'
  | 'Promo & Layanan'
  | 'Testimoni & Studi Kasus'
  | 'Insight & Opini'
  | 'Lainnya';

export interface IgPostRaw {
  post_id: string;
  account_id: string;
  username: string;
  account_name: string;
  description: string;
  duration_sec: number;
  published_raw: string;
  published_at: string; // ISO string (UTC)
  permalink: string;
  post_type: IgPostFormat;
  data_comment: string;
  date_preset: string;
  views: number;
  reach: number;
  likes: number;
  shares: number;
  follows: number;
  comments: number;
  saves: number;
}

export interface IgPostItem extends IgPostRaw {
  title: string;
  hashtags: string[];
  shortcode: string;
  embedUrl: string;
  category: IgPostCategory;
  totalInteractions: number;
  errPercent: number;
  ervPercent: number;
  viralityRate: number;
  saveRate: number;
  replayRatio: number;
  publishedWibDisplay: string;
  publishedMonthKey: string; // YYYY-MM (WIB)
  publishedMonthLabel: string; // e.g. "Nov 2026"
  publishedWibDay: string; // Senin..Minggu
  publishedWibHour: number; // 0..23
}

export interface IgRecommendationItem {
  id: string;
  priority: 'Tinggi' | 'Sedang' | 'Peluang';
  focusArea: string;
  title: string;
  rationale: string;
  actionPlan: string;
  suggestedFormat?: string;
  suggestedTiming?: string;
}

export interface IgAnalyticsSummary {
  totalPosts: number;
  reelCount: number;
  carouselCount: number;
  imageCount: number;
  totalViews: number;
  avgViews: number;
  totalReach: number;
  avgReach: number;
  avgReplayRatio: number;
  avgErrPercent: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalSaves: number;
  totalFollows: number;
  avgSaveRate: number;
  avgViralityRate: number;
  monthlyTrend: Array<{
    monthKey: string;
    month: string;
    views: number;
    reach: number;
    errPercent: number;
    posts: number;
  }>;
  formatComparison: Array<{
    format: IgPostFormat;
    count: number;
    avgViews: number;
    avgReach: number;
    avgErrPercent: number;
    totalViews: number;
  }>;
  categoryPerformance: Array<{
    category: IgPostCategory;
    count: number;
    avgViews: number;
    avgReach: number;
    avgErrPercent: number;
  }>;
  dayPerformance: Array<{
    day: string;
    avgViews: number;
    count: number;
  }>;
  hourSlotPerformance: Array<{
    slot: string;
    avgViews: number;
    count: number;
  }>;
  durationPerformance: Array<{
    bucket: string;
    avgViews: number;
    avgErrPercent: number;
    count: number;
  }>;
  topHashtags: Array<{
    tag: string;
    count: number;
    avgViews: number;
  }>;
  bestFormat: { format: IgPostFormat; avgViews: number; avgErrPercent: number } | null;
  bestCategory: { category: IgPostCategory; avgViews: number } | null;
  bestDay: { day: string; avgViews: number } | null;
  bestHourSlot: { slot: string; avgViews: number } | null;
  bestDuration: { bucket: string; avgViews: number } | null;
  recommendations: IgRecommendationItem[];
}
