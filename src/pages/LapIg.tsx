import { useEffect, useMemo, useState } from 'react';
import { formatDotNumber, serializeIgCsv } from '../lib/igCsvParser';
import {
  addManualIgPost,
  computeIgAnalytics,
  deleteIgPost,
  listIgPosts,
  upsertIgPostsFromCsv,
} from '../services/lapIg';
import type { IgPostCategory, IgPostFormat, IgPostItem } from '../types/lapIg';
import { useToast } from '../hooks/useToast';
import { Badge, Button, Card, EmptyState, ErrorState, Loading, SecondaryButton, SelectInput, TextInput } from '../components/ui';
import { LapIgCharts } from '../components/lap-ig/LapIgCharts';
import { LapIgRecommendations } from '../components/lap-ig/LapIgRecommendations';
import {
  CsvUploadModal,
  ManualPostModal,
  PostPreviewModal,
} from '../components/lap-ig/LapIgModals';

type SortBy =
  | 'newest'
  | 'views'
  | 'reach'
  | 'err'
  | 'likes'
  | 'shares'
  | 'saves'
  | 'follows';

const PAGE_SIZE = 24;

export default function LapIgPage() {
  const { push } = useToast();
  const [posts, setPosts] = useState<IgPostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Account & Filter State
  const [selectedAccount, setSelectedAccount] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState<string>('ALL');
  const [formatFilter, setFormatFilter] = useState<IgPostFormat | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<IgPostCategory | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [page, setPage] = useState(1);

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [previewPost, setPreviewPost] = useState<IgPostItem | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listIgPosts();
      setPosts(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat laporan Instagram.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const accounts = useMemo(() => {
    const map = new Map<string, { username: string; account_name: string; count: number }>();
    for (const p of posts) {
      const key = p.username || 'unknown';
      const cur = map.get(key) ?? {
        username: key,
        account_name: p.account_name || key,
        count: 0,
      };
      cur.count += 1;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [posts]);

  const monthOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of posts) {
      if (selectedAccount !== 'ALL' && p.username !== selectedAccount) continue;
      map.set(p.publishedMonthKey, p.publishedMonthLabel);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [posts, selectedAccount]);

  const categoryOptions = useMemo(() => {
    const set = new Set<IgPostCategory>();
    for (const p of posts) set.add(p.category);
    return Array.from(set);
  }, [posts]);

  const filteredPosts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = posts.filter((p) => {
      if (selectedAccount !== 'ALL' && p.username !== selectedAccount) return false;
      if (monthFilter !== 'ALL' && p.publishedMonthKey !== monthFilter) return false;
      if (formatFilter !== 'ALL' && p.post_type !== formatFilter) return false;
      if (categoryFilter !== 'ALL' && p.category !== categoryFilter) return false;
      if (q) {
        const hay = `${p.title} ${p.description} ${p.hashtags.join(' ')} ${p.username}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      switch (sortBy) {
        case 'views':
          return b.views - a.views;
        case 'reach':
          return b.reach - a.reach;
        case 'err':
          return b.errPercent - a.errPercent;
        case 'likes':
          return b.likes - a.likes;
        case 'shares':
          return b.shares - a.shares;
        case 'saves':
          return b.saves - a.saves;
        case 'follows':
          return b.follows - a.follows;
        case 'newest':
        default:
          return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
      }
    });
  }, [posts, selectedAccount, monthFilter, formatFilter, categoryFilter, search, sortBy]);

  useEffect(() => {
    setPage(1);
  }, [selectedAccount, monthFilter, formatFilter, categoryFilter, search, sortBy]);

  const analytics = useMemo(() => computeIgAnalytics(filteredPosts), [filteredPosts]);

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / PAGE_SIZE));
  const paginatedPosts = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredPosts.slice(start, start + PAGE_SIZE);
  }, [filteredPosts, page]);

  const hasActiveFilter =
    search.trim() !== '' ||
    monthFilter !== 'ALL' ||
    formatFilter !== 'ALL' ||
    categoryFilter !== 'ALL';

  const resetFilters = () => {
    setSearch('');
    setMonthFilter('ALL');
    setFormatFilter('ALL');
    setCategoryFilter('ALL');
  };

  const handleExportCsv = () => {
    const csv = serializeIgCsv(filteredPosts);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan-ig-${selectedAccount === 'ALL' ? 'semua-akun' : selectedAccount}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    push('CSV laporan berhasil diekspor.');
  };

  const handleImportCsv = async (csvText: string) => {
    const res = await upsertIgPostsFromCsv(posts, csvText);
    setPosts(res.items);
    push(
      `Impor selesai: ${res.addedCount} konten baru, ${res.updatedCount} konten diperbarui.`
    );
  };

  const handleAddManual = async (
    input: Parameters<typeof addManualIgPost>[1]
  ) => {
    const next = await addManualIgPost(posts, input);
    setPosts(next);
    push('Konten manual berhasil ditambahkan.');
  };

  const handleDeletePost = async (postId: string) => {
    const next = await deleteIgPost(posts, postId);
    setPosts(next);
    push('Entri konten dihapus.');
  };

  if (loading) return <Loading text="Memuat laporan analitik Instagram..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const accountLabel =
    selectedAccount === 'ALL' ? 'Semua Akun' : `@${selectedAccount}`;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      {/* 1. Header Laporan */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Laporan Performa Instagram</h1>
            <Badge>Analitik IG</Badge>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Analisis konten Meta Business Suite beserta rekomendasi ide & jadwal ke depan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => setShowUploadModal(true)}
            className="text-xs py-2 px-3.5"
          >
            Upload CSV
          </Button>
          <SecondaryButton
            type="button"
            onClick={() => setShowManualModal(true)}
            className="text-xs py-2 px-3.5"
          >
            Tambah Data
          </SecondaryButton>
          <SecondaryButton
            type="button"
            onClick={handleExportCsv}
            disabled={filteredPosts.length === 0}
            className="text-xs py-2 px-3.5"
          >
            Export CSV
          </SecondaryButton>
        </div>
      </div>

      {/* Selector Akun */}
      {accounts.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedAccount('ALL')}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              selectedAccount === 'ALL'
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            Semua Akun ({formatDotNumber(posts.length)})
          </button>
          {accounts.map((acc) => (
            <button
              key={acc.username}
              type="button"
              onClick={() => setSelectedAccount(acc.username)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                selectedAccount === acc.username
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              @{acc.username} · {acc.account_name} ({formatDotNumber(acc.count)})
            </button>
          ))}
        </div>
      )}

      {/* 2. 4 Kartu KPI Utama (1 Baris) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4 space-y-1">
          <span className="text-[11px] font-medium text-slate-500">Total Konten</span>
          <p className="text-xl sm:text-2xl font-bold tabular-nums text-slate-900">
            {formatDotNumber(analytics.totalPosts)}
          </p>
          <p className="text-[11px] text-slate-500 tabular-nums">
            {formatDotNumber(analytics.reelCount)} Reels · {formatDotNumber(analytics.carouselCount)} Carousel ·{' '}
            {formatDotNumber(analytics.imageCount)} Gambar
          </p>
        </Card>

        <Card className="p-4 space-y-1">
          <span className="text-[11px] font-medium text-slate-500">Total Tayangan (Views)</span>
          <p className="text-xl sm:text-2xl font-bold tabular-nums text-indigo-600">
            {formatDotNumber(analytics.totalViews)}
          </p>
          <p className="text-[11px] text-slate-500 tabular-nums">
            Rata-rata {formatDotNumber(analytics.avgViews)} · Replay {analytics.avgReplayRatio}x
          </p>
        </Card>

        <Card className="p-4 space-y-1">
          <span className="text-[11px] font-medium text-slate-500">Total Jangkauan (Reach)</span>
          <p className="text-xl sm:text-2xl font-bold tabular-nums text-slate-900">
            {formatDotNumber(analytics.totalReach)}
          </p>
          <p className="text-[11px] text-slate-500 tabular-nums">
            Rata-rata {formatDotNumber(analytics.avgReach)} akun / konten
          </p>
        </Card>

        <Card className="p-4 space-y-1">
          <span className="text-[11px] font-medium text-slate-500">Engagement Rate (ERR)</span>
          <p className="text-xl sm:text-2xl font-bold tabular-nums text-amber-700">
            {analytics.avgErrPercent}%
          </p>
          <p className="text-[11px] text-slate-500 tabular-nums">
            {formatDotNumber(analytics.totalLikes)} suka · {formatDotNumber(analytics.totalShares)} share ·{' '}
            {formatDotNumber(analytics.totalSaves)} save · +{formatDotNumber(analytics.totalFollows)} follow
          </p>
        </Card>
      </div>

      {/* 3. Bar Filter Terpadu (5 Kolom Grid) */}
      <Card className="p-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 items-center">
          <div className="lg:col-span-2">
            <TextInput
              placeholder="Cari judul konten atau hashtag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="py-2 text-xs"
            />
          </div>

          <SelectInput
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="py-2 text-xs"
          >
            <option value="ALL">Semua Periode</option>
            {monthOptions.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </SelectInput>

          <SelectInput
            value={formatFilter}
            onChange={(e) => setFormatFilter(e.target.value as IgPostFormat | 'ALL')}
            className="py-2 text-xs"
          >
            <option value="ALL">Semua Format</option>
            <option value="Reel IG">Reel IG</option>
            <option value="Carousel IG">Carousel IG</option>
            <option value="Gambar IG">Gambar IG</option>
          </SelectInput>

          <div className="flex items-center gap-2">
            <SelectInput
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as IgPostCategory | 'ALL')}
              className="py-2 text-xs flex-1"
            >
              <option value="ALL">Semua Kategori</option>
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </SelectInput>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={resetFilters}
                className="shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* 4. Panel Analisis Performa & Tren */}
      <LapIgCharts
        analytics={analytics}
        activeCategory={categoryFilter}
        activeSearch={search}
        onSelectCategory={(cat) =>
          setCategoryFilter((prev) => (prev === cat ? 'ALL' : cat))
        }
        onSelectHashtag={(tag) =>
          setSearch((prev) => (prev.toLowerCase() === tag.toLowerCase() ? '' : tag))
        }
      />

      {/* 4b. Rekomendasi Konten Ke Depan */}
      <LapIgRecommendations
        recommendations={analytics.recommendations}
        accountLabel={accountLabel}
      />

      {/* 5. Daftar Konten */}
      <Card className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Daftar Konten ({formatDotNumber(filteredPosts.length)})
            </h2>
            <p className="text-xs text-slate-500">
              Klik konten untuk membuka live preview embed Instagram & rincian metrik.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SelectInput
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="w-auto py-1.5 text-xs"
            >
              <option value="newest">Terbaru</option>
              <option value="views">Tayangan Tertinggi</option>
              <option value="reach">Jangkauan Tertinggi</option>
              <option value="err">ERR Tertinggi</option>
              <option value="likes">Suka Terbanyak</option>
              <option value="shares">Dibagikan Terbanyak</option>
              <option value="saves">Disimpan Terbanyak</option>
              <option value="follows">Follow Baru Terbanyak</option>
            </SelectInput>

            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`rounded-md px-3 py-1.5 transition ${
                  viewMode === 'cards' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                Kartu
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`rounded-md px-3 py-1.5 transition ${
                  viewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                Tabel
              </button>
            </div>
          </div>
        </div>

        {paginatedPosts.length === 0 ? (
          <EmptyState
            title="Tidak ada konten yang cocok"
            desc="Coba ubah filter pencarian, periode, atau kategori di atas."
          />
        ) : viewMode === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {paginatedPosts.map((p) => (
              <button
                key={p.post_id}
                type="button"
                onClick={() => setPreviewPost(p)}
                className="text-left rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-400 hover:shadow-sm transition flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                      {p.post_type}
                      {p.duration_sec > 0 ? ` · ${p.duration_sec}s` : ''}
                    </span>
                    <span className="text-slate-500">{p.category}</span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 line-clamp-2 leading-snug">
                    {p.title}
                  </h3>

                  <p className="text-[11px] text-slate-500">
                    {selectedAccount === 'ALL' ? `@${p.username} · ` : ''}
                    {p.publishedWibDisplay}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-2.5 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-400 block">Tayangan</span>
                    <span className="font-bold tabular-nums text-indigo-600">
                      {formatDotNumber(p.views)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block">Jangkauan</span>
                    <span className="font-bold tabular-nums text-slate-800">
                      {formatDotNumber(p.reach)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block">ERR</span>
                    <span className="font-bold tabular-nums text-amber-700">
                      {p.errPercent}%
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Judul / Hook</th>
                  <th className="py-2.5 px-3 font-semibold">Format</th>
                  <th className="py-2.5 px-3 font-semibold">Waktu (WIB)</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Tayangan</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Jangkauan</th>
                  <th className="py-2.5 px-3 font-semibold text-right">ERR</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Suka</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Share</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Save</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedPosts.map((p) => (
                  <tr
                    key={p.post_id}
                    onClick={() => setPreviewPost(p)}
                    className="cursor-pointer hover:bg-slate-50 transition"
                  >
                    <td className="py-2.5 px-3 max-w-xs">
                      <p className="font-semibold text-slate-900 truncate">{p.title}</p>
                      <p className="text-[11px] text-slate-500">
                        {selectedAccount === 'ALL' ? `@${p.username} · ` : ''}
                        {p.category}
                      </p>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-700">
                      {p.post_type}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-500">
                      {p.publishedWibDisplay}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-indigo-600">
                      {formatDotNumber(p.views)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-slate-800">
                      {formatDotNumber(p.reach)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-amber-700">
                      {p.errPercent}%
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-slate-700">
                      {formatDotNumber(p.likes)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-slate-700">
                      {formatDotNumber(p.shares)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-slate-700">
                      {formatDotNumber(p.saves)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginasi */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
            <span className="text-slate-500">
              Halaman {page} dari {totalPages}
            </span>
            <div className="flex gap-2">
              <SecondaryButton
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="py-1.5 px-3 text-xs"
              >
                Sebelumnya
              </SecondaryButton>
              <SecondaryButton
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="py-1.5 px-3 text-xs"
              >
                Berikutnya
              </SecondaryButton>
            </div>
          </div>
        )}
      </Card>

      {/* Modals */}
      <CsvUploadModal
        isOpen={showUploadModal}
        existingPosts={posts}
        onClose={() => setShowUploadModal(false)}
        onConfirmImport={handleImportCsv}
      />

      <ManualPostModal
        isOpen={showManualModal}
        knownAccounts={accounts}
        onClose={() => setShowManualModal(false)}
        onSubmit={handleAddManual}
      />

      <PostPreviewModal
        post={previewPost}
        onClose={() => setPreviewPost(null)}
        onDelete={handleDeletePost}
      />
    </div>
  );
}
