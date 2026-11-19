import type { IgRecommendationItem } from '../../types/lapIg';
import { Card } from '../ui';

interface LapIgRecommendationsProps {
  recommendations: IgRecommendationItem[];
  accountLabel: string;
}

const PRIORITY_STYLE: Record<IgRecommendationItem['priority'], string> = {
  Tinggi: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Sedang: 'bg-amber-50 text-amber-800 border-amber-200',
  Peluang: 'bg-emerald-50 text-emerald-800 border-emerald-200',
};

export function LapIgRecommendations({
  recommendations,
  accountLabel,
}: LapIgRecommendationsProps) {
  if (recommendations.length === 0) return null;

  return (
    <Card className="p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Rekomendasi Konten Ke Depan
          </h2>
          <p className="text-xs text-slate-500">
            Rencana eksekusi berbasis performa historis untuk {accountLabel}.
          </p>
        </div>
        <span className="text-xs font-medium text-slate-500">
          {recommendations.length} fokus prioritas
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {recommendations.map((rec) => (
          <div
            key={rec.id}
            className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2.5 flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {rec.focusArea}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                    PRIORITY_STYLE[rec.priority]
                  }`}
                >
                  Prioritas {rec.priority}
                </span>
              </div>

              <h3 className="text-sm font-bold text-slate-900 leading-snug">{rec.title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{rec.rationale}</p>
            </div>

            <div className="border-t border-slate-200/80 pt-2.5 space-y-1.5">
              <p className="text-xs text-slate-800 leading-relaxed">
                <span className="font-semibold text-slate-900">Langkah berikutnya: </span>
                {rec.actionPlan}
              </p>

              {(rec.suggestedFormat || rec.suggestedTiming) && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {rec.suggestedFormat && (
                    <span className="rounded bg-white border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                      Format: {rec.suggestedFormat}
                    </span>
                  )}
                  {rec.suggestedTiming && (
                    <span className="rounded bg-white border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                      Jadwal: {rec.suggestedTiming}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
