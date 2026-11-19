import { useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { formatDotNumber } from '../../lib/igCsvParser';
import type { IgAnalyticsSummary, IgPostCategory } from '../../types/lapIg';
import { Card } from '../ui';

interface LapIgChartsProps {
  analytics: IgAnalyticsSummary;
  activeCategory: IgPostCategory | 'ALL';
  activeSearch: string;
  onSelectCategory: (cat: IgPostCategory) => void;
  onSelectHashtag: (tag: string) => void;
}

type ChartTab = 'monthly' | 'format' | 'category' | 'timing';

function IgChartTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur-sm text-xs space-y-1.5 min-w-[180px]">
      <p className="font-bold text-slate-900 border-b border-slate-100 pb-1">{label}</p>
      {payload.map((entry: any, idx: number) => {
        const isPercent =
          entry.dataKey === 'errPercent' || entry.dataKey === 'avgErrPercent';
        const val = Number(entry.value) || 0;
        const formatted = isPercent ? `${val}%` : formatDotNumber(val);

        return (
          <div key={idx} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: entry.color || entry.fill }}
              />
              {entry.name}
            </span>
            <span className="font-bold tabular-nums text-slate-900">{formatted}</span>
          </div>
        );
      })}
    </div>
  );
}

export function LapIgCharts({
  analytics,
  activeCategory,
  activeSearch,
  onSelectCategory,
  onSelectHashtag,
}: LapIgChartsProps) {
  const [tab, setTab] = useState<ChartTab>('monthly');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Kolom Kiri (8 Kolom): Grafik 4 Tab */}
      <Card className="lg:col-span-8 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Analisis Performa & Tren</h2>
            <p className="text-xs text-slate-500">
              Visualisasi tayangan, jangkauan, interaksi, dan pola waktu optimal (WIB).
            </p>
          </div>

          <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 text-xs font-medium self-start sm:self-auto">
            {(
              [
                { id: 'monthly', label: 'Tren Bulanan' },
                { id: 'format', label: 'Format' },
                { id: 'category', label: 'Kategori Topik' },
                { id: 'timing', label: 'Waktu & Durasi' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-lg px-2.5 py-1.5 transition ${
                  tab === t.id
                    ? 'bg-white text-slate-900 shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {analytics.totalPosts === 0 ? (
          <div className="h-72 flex items-center justify-center text-sm text-slate-400">
            Tidak ada data untuk filter ini.
          </div>
        ) : tab === 'monthly' ? (
          <div className="h-72 sm:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={analytics.monthlyTrend}
                margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: '#475569' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="left"
                  width={56}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatDotNumber(v)}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  width={42}
                  tick={{ fontSize: 11, fill: '#D97706' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip content={<IgChartTooltip />} />
                <Legend
                  verticalAlign="top"
                  height={32}
                  formatter={(v) => <span className="text-xs text-slate-700">{v}</span>}
                />
                <Bar
                  yAxisId="left"
                  dataKey="views"
                  name="Tayangan"
                  fill="#4f46e5"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
                <Bar
                  yAxisId="left"
                  dataKey="reach"
                  name="Jangkauan"
                  fill="#94A3B8"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="errPercent"
                  name="ERR %"
                  stroke="#D97706"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : tab === 'format' ? (
          <div className="space-y-4">
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={analytics.formatComparison}
                  margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="format"
                    tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <YAxis
                    width={56}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => formatDotNumber(v)}
                  />
                  <Tooltip content={<IgChartTooltip />} />
                  <Legend
                    verticalAlign="top"
                    height={32}
                    formatter={(v) => <span className="text-xs text-slate-700">{v}</span>}
                  />
                  <Bar
                    dataKey="avgViews"
                    name="Rata-rata Tayangan"
                    fill="#4f46e5"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={44}
                  />
                  <Bar
                    dataKey="avgReach"
                    name="Rata-rata Jangkauan"
                    fill="#94A3B8"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={44}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3 font-semibold">Format</th>
                    <th className="py-2 px-3 font-semibold text-right">Konten</th>
                    <th className="py-2 px-3 font-semibold text-right">Rata-rata Tayangan</th>
                    <th className="py-2 px-3 font-semibold text-right">Rata-rata Jangkauan</th>
                    <th className="py-2 px-3 font-semibold text-right">Rata-rata ERR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analytics.formatComparison.map((f) => (
                    <tr key={f.format} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-semibold text-slate-800">{f.format}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-slate-600">
                        {formatDotNumber(f.count)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums font-medium text-slate-900">
                        {formatDotNumber(f.avgViews)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-slate-700">
                        {formatDotNumber(f.avgReach)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums font-semibold text-amber-700">
                        {f.avgErrPercent}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : tab === 'category' ? (
          <div className="h-72 sm:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={analytics.categoryPerformance}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                  tickFormatter={(v) => formatDotNumber(v)}
                />
                <YAxis
                  type="category"
                  dataKey="category"
                  width={130}
                  tick={{ fontSize: 11, fill: '#334155', fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<IgChartTooltip />} />
                <Bar
                  dataKey="avgViews"
                  name="Rata-rata Tayangan"
                  fill="#4f46e5"
                  radius={[0, 4, 4, 0]}
                  barSize={22}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-2">
                  Rata-rata Tayangan per Hari (WIB)
                </p>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analytics.dayPerformance}
                      margin={{ top: 5, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 10, fill: '#475569' }}
                        tickFormatter={(d: string) => d.slice(0, 3)}
                        axisLine={{ stroke: '#cbd5e1' }}
                        tickLine={false}
                      />
                      <YAxis
                        width={56}
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => formatDotNumber(v)}
                      />
                      <Tooltip content={<IgChartTooltip />} />
                      <Bar
                        dataKey="avgViews"
                        name="Rata-rata Tayangan"
                        fill="#4f46e5"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-700 mb-2">
                  Rata-rata Tayangan per Jam (WIB)
                </p>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analytics.hourSlotPerformance}
                      margin={{ top: 5, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis
                        dataKey="slot"
                        tick={{ fontSize: 10, fill: '#475569' }}
                        axisLine={{ stroke: '#cbd5e1' }}
                        tickLine={false}
                      />
                      <YAxis
                        width={56}
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => formatDotNumber(v)}
                      />
                      <Tooltip content={<IgChartTooltip />} />
                      <Bar
                        dataKey="avgViews"
                        name="Rata-rata Tayangan"
                        fill="#94A3B8"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {analytics.durationPerformance.length > 0 && (
              <div className="border-t border-slate-100 pt-3">
                <p className="text-xs font-semibold text-slate-700 mb-2">
                  Rata-rata Tayangan per Durasi Reels
                </p>
                <div className="h-40 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analytics.durationPerformance}
                      margin={{ top: 5, right: 12, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis
                        dataKey="bucket"
                        tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
                        axisLine={{ stroke: '#cbd5e1' }}
                        tickLine={false}
                      />
                      <YAxis
                        width={56}
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => formatDotNumber(v)}
                      />
                      <Tooltip content={<IgChartTooltip />} />
                      <Bar
                        dataKey="avgViews"
                        name="Rata-rata Tayangan"
                        fill="#4f46e5"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={44}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Kolom Kanan (4 Kolom): Ringkasan Analitik */}
      <Card className="lg:col-span-4 p-5 space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900">Ringkasan Analitik</h2>
          <p className="text-xs text-slate-500">Temuan otomatis dari data terfilter.</p>
        </div>

        <div className="space-y-3.5 text-xs">
          {/* 1. Format Paling Efektif */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Format Paling Efektif
            </span>
            {analytics.bestFormat ? (
              <>
                <p className="text-sm font-bold text-slate-900">{analytics.bestFormat.format}</p>
                <p className="text-slate-600 tabular-nums">
                  Rata-rata {formatDotNumber(analytics.bestFormat.avgViews)} tayangan · ERR{' '}
                  {analytics.bestFormat.avgErrPercent}%
                </p>
              </>
            ) : (
              <p className="text-slate-500">-</p>
            )}
          </div>

          {/* 2. Topik Tertinggi (Klik untuk filter) */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Topik Tertinggi (Klik untuk filter)
            </span>
            {analytics.bestCategory ? (
              <button
                type="button"
                onClick={() => onSelectCategory(analytics.bestCategory!.category)}
                className={`w-full text-left rounded-md px-2.5 py-2 border transition ${
                  activeCategory === analytics.bestCategory.category
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white hover:border-slate-300 text-slate-900'
                }`}
              >
                <span className="font-bold text-sm block">{analytics.bestCategory.category}</span>
                <span
                  className={`tabular-nums ${
                    activeCategory === analytics.bestCategory.category
                      ? 'text-slate-200'
                      : 'text-slate-600'
                  }`}
                >
                  Rata-rata {formatDotNumber(analytics.bestCategory.avgViews)} tayangan
                </span>
              </button>
            ) : (
              <p className="text-slate-500">-</p>
            )}
          </div>

          {/* 3. Waktu & Durasi Optimal */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Waktu & Durasi Optimal (WIB)
            </span>
            <p className="font-semibold text-slate-900">
              {analytics.bestDay ? analytics.bestDay.day : '-'} ·{' '}
              {analytics.bestHourSlot ? `${analytics.bestHourSlot.slot} WIB` : '-'}
            </p>
            {analytics.bestDuration && (
              <p className="text-slate-600 tabular-nums">
                Durasi Reels optimal: <strong>{analytics.bestDuration.bucket}</strong> (rata-rata{' '}
                {formatDotNumber(analytics.bestDuration.avgViews)} tayangan)
              </p>
            )}
          </div>

          {/* 4. 6 Hashtag Performa Terbaik (Klik untuk filter) */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
              Hashtag Performa Terbaik (Klik filter)
            </span>
            {analytics.topHashtags.length === 0 ? (
              <p className="text-slate-500">Belum ada hashtag tercatat.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {analytics.topHashtags.map((h) => {
                  const isSelected = activeSearch.toLowerCase() === h.tag.toLowerCase();
                  return (
                    <button
                      key={h.tag}
                      type="button"
                      onClick={() => onSelectHashtag(h.tag)}
                      className={`rounded-md border px-2 py-1 text-[11px] font-medium tabular-nums transition ${
                        isSelected
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                      title={`Rata-rata ${formatDotNumber(h.avgViews)} tayangan (${h.count} konten)`}
                    >
                      {h.tag} ({formatDotNumber(h.avgViews)})
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
