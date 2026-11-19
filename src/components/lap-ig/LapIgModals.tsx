import { useState } from 'react';
import { formatDotNumber } from '../../lib/igCsvParser';
import { previewCsvMerge } from '../../services/lapIg';
import type { IgPostFormat, IgPostItem } from '../../types/lapIg';
import {
  Button,
  DangerButton,
  Field,
  SecondaryButton,
  SelectInput,
  TextArea,
  TextInput,
} from '../ui';

interface CsvUploadModalProps {
  isOpen: boolean;
  existingPosts: IgPostItem[];
  onClose: () => void;
  onConfirmImport: (csvText: string) => Promise<void>;
}

export function CsvUploadModal({
  isOpen,
  existingPosts,
  onClose,
  onConfirmImport,
}: CsvUploadModalProps) {
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const preview = csvText ? previewCsvMerge(existingPosts, csvText) : null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    const check = previewCsvMerge(existingPosts, text);
    if (check.incomingCount === 0) {
      setError('File CSV tidak berisi baris postingan yang valid.');
      setCsvText('');
      return;
    }
    setCsvText(text);
  };

  const handleSubmit = async () => {
    if (!csvText) return;
    setBusy(true);
    setError('');
    try {
      await onConfirmImport(csvText);
      setCsvText('');
      setFileName('');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengimpor CSV.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Upload CSV Meta Business Suite</h3>
            <p className="text-xs text-slate-500">
              Data baru akan digabung (upsert) berdasarkan ID Postingan / Permalink.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          <label className="block rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-5 text-center cursor-pointer hover:border-slate-400 transition">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <p className="text-sm font-semibold text-slate-800">
              {fileName || 'Pilih file CSV ekspor Meta Business Suite'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Mendukung header Bahasa Inggris & Indonesia (18 kolom standar).
            </p>
          </label>

          {preview && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs">
              <p className="font-semibold text-slate-800">Pratinjau Gabung Data (Merge)</p>
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="rounded-lg bg-white border border-slate-200 p-2.5 text-center">
                  <span className="text-slate-500 block">Konten Baru</span>
                  <span className="text-base font-bold tabular-nums text-emerald-700">
                    +{formatDotNumber(preview.addedCount)}
                  </span>
                </div>
                <div className="rounded-lg bg-white border border-slate-200 p-2.5 text-center">
                  <span className="text-slate-500 block">Diperbarui</span>
                  <span className="text-base font-bold tabular-nums text-indigo-600">
                    {formatDotNumber(preview.updatedCount)}
                  </span>
                </div>
                <div className="rounded-lg bg-white border border-slate-200 p-2.5 text-center">
                  <span className="text-slate-500 block">Total Akhir</span>
                  <span className="text-base font-bold tabular-nums text-slate-900">
                    {formatDotNumber(preview.totalCount)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {error && <p className="text-xs font-medium text-rose-600">{error}</p>}

          <div className="flex gap-2.5 pt-2 border-t border-slate-100">
            <SecondaryButton type="button" onClick={onClose} className="flex-1" disabled={busy}>
              Batal
            </SecondaryButton>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!preview || busy}
              className="flex-1"
            >
              {busy ? 'Mengimpor...' : 'Terapkan & Simpan'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ManualPostModalProps {
  isOpen: boolean;
  knownAccounts: Array<{ username: string; account_name: string }>;
  onClose: () => void;
  onSubmit: (input: {
    username: string;
    account_name: string;
    description: string;
    post_type: IgPostFormat;
    duration_sec: number;
    published_at_local: string;
    permalink: string;
    views: number;
    reach: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    follows: number;
  }) => Promise<void>;
}

export function ManualPostModal({
  isOpen,
  knownAccounts,
  onClose,
  onSubmit,
}: ManualPostModalProps) {
  const defaultAcc = knownAccounts[0] ?? { username: 'joyoalkes', account_name: 'Joyo Alkes' };
  const [username, setUsername] = useState(defaultAcc.username);
  const [accountName, setAccountName] = useState(defaultAcc.account_name);
  const [postType, setPostType] = useState<IgPostFormat>('Reel IG');
  const [durationSec, setDurationSec] = useState('30');
  const [publishedLocal, setPublishedLocal] = useState(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(
      now.getHours()
    )}:${pad(now.getMinutes())}`;
  });
  const [permalink, setPermalink] = useState('');
  const [description, setDescription] = useState('');
  const [views, setViews] = useState('0');
  const [reach, setReach] = useState('0');
  const [likes, setLikes] = useState('0');
  const [comments, setComments] = useState('0');
  const [shares, setShares] = useState('0');
  const [saves, setSaves] = useState('0');
  const [follows, setFollows] = useState('0');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!description.trim()) {
      setError('Caption / deskripsi konten wajib diisi.');
      return;
    }
    setBusy(true);
    try {
      await onSubmit({
        username,
        account_name: accountName,
        description,
        post_type: postType,
        duration_sec: Number(durationSec) || 0,
        published_at_local: publishedLocal,
        permalink,
        views: Number(views) || 0,
        reach: Number(reach) || 0,
        likes: Number(likes) || 0,
        comments: Number(comments) || 0,
        shares: Number(shares) || 0,
        saves: Number(saves) || 0,
        follows: Number(follows) || 0,
      });
      setDescription('');
      setPermalink('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menambahkan data.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Tambah Laporan Konten Manual</h3>
            <p className="text-xs text-slate-500">
              Menghasilkan entri yang kompatibel dengan struktur CSV Meta Business Suite.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Username Akun">
              <TextInput
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="cth: joyoalkes"
                required
              />
            </Field>
            <Field label="Nama Akun">
              <TextInput
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="cth: Joyo Alkes"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Format Konten">
              <SelectInput
                value={postType}
                onChange={(e) => setPostType(e.target.value as IgPostFormat)}
              >
                <option value="Reel IG">Reel IG</option>
                <option value="Carousel IG">Carousel IG</option>
                <option value="Gambar IG">Gambar IG</option>
              </SelectInput>
            </Field>
            <Field label="Durasi (detik)">
              <TextInput
                type="number"
                min="0"
                value={postType === 'Reel IG' ? durationSec : '0'}
                onChange={(e) => setDurationSec(e.target.value)}
                disabled={postType !== 'Reel IG'}
              />
            </Field>
            <Field label="Waktu Tayang (WIB)">
              <TextInput
                type="datetime-local"
                value={publishedLocal}
                onChange={(e) => setPublishedLocal(e.target.value)}
                required
              />
            </Field>
          </div>

          <Field label="Permalink Instagram">
            <TextInput
              value={permalink}
              onChange={(e) => setPermalink(e.target.value)}
              placeholder="https://www.instagram.com/reel/..."
            />
          </Field>

          <Field label="Caption / Deskripsi *">
            <TextArea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tulis hook baris pertama diikuti isi caption dan #hashtag..."
              required
            />
          </Field>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
            <Field label="Tayangan">
              <TextInput type="number" min="0" value={views} onChange={(e) => setViews(e.target.value)} />
            </Field>
            <Field label="Jangkauan">
              <TextInput type="number" min="0" value={reach} onChange={(e) => setReach(e.target.value)} />
            </Field>
            <Field label="Suka">
              <TextInput type="number" min="0" value={likes} onChange={(e) => setLikes(e.target.value)} />
            </Field>
            <Field label="Komentar">
              <TextInput type="number" min="0" value={comments} onChange={(e) => setComments(e.target.value)} />
            </Field>
            <Field label="Dibagikan">
              <TextInput type="number" min="0" value={shares} onChange={(e) => setShares(e.target.value)} />
            </Field>
            <Field label="Disimpan">
              <TextInput type="number" min="0" value={saves} onChange={(e) => setSaves(e.target.value)} />
            </Field>
            <Field label="Follow Baru">
              <TextInput type="number" min="0" value={follows} onChange={(e) => setFollows(e.target.value)} />
            </Field>
          </div>

          {error && <p className="text-xs font-medium text-rose-600">{error}</p>}

          <div className="flex gap-2.5 pt-3 border-t border-slate-100">
            <SecondaryButton type="button" onClick={onClose} className="flex-1" disabled={busy}>
              Batal
            </SecondaryButton>
            <Button type="submit" disabled={busy} className="flex-1">
              {busy ? 'Menyimpan...' : 'Simpan Konten'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface PostPreviewModalProps {
  post: IgPostItem | null;
  onClose: () => void;
  onDelete: (postId: string) => Promise<void>;
}

export function PostPreviewModal({ post, onClose, onDelete }: PostPreviewModalProps) {
  const [copied, setCopied] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!post) return null;

  const handleCopyCaption = () => {
    navigator.clipboard.writeText(post.description || '').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(post.post_id);
      setConfirmingDelete(false);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-3.5">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
              @{post.username}
            </span>
            <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
              {post.post_type}
            </span>
            <span className="text-xs text-slate-500">{post.publishedWibDisplay}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 shrink-0 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 text-lg"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
          {/* Kiri (5 Kolom): Live Embed Instagram */}
          <div className="lg:col-span-5 flex flex-col gap-2">
            {post.embedUrl ? (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                <iframe
                  src={post.embedUrl}
                  title={post.title}
                  className="h-[460px] w-full bg-white"
                  loading="lazy"
                  allowTransparency
                />
              </div>
            ) : (
              <div className="h-[320px] rounded-xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center p-4 text-center text-xs text-slate-500">
                Preview embed tidak tersedia (permalink Instagram belum diisi).
              </div>
            )}
            {post.permalink && (
              <a
                href={post.permalink}
                target="_blank"
                rel="noreferrer"
                className="text-center text-xs font-medium text-slate-700 hover:underline py-1"
              >
                Buka langsung di Instagram →
              </a>
            )}
          </div>

          {/* Kanan (7 Kolom): Metrik & Caption */}
          <div className="lg:col-span-7 space-y-5">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {post.category}
              </span>
              <h3 className="mt-1 text-lg font-bold text-slate-900 leading-snug">{post.title}</h3>
            </div>

            {/* 4 Kotak Metrik Utama */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <span className="text-[11px] text-slate-500 block">Tayangan</span>
                <span className="text-base font-bold tabular-nums text-indigo-600">
                  {formatDotNumber(post.views)}
                </span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <span className="text-[11px] text-slate-500 block">Jangkauan</span>
                <span className="text-base font-bold tabular-nums text-slate-900">
                  {formatDotNumber(post.reach)}
                </span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <span className="text-[11px] text-slate-500 block">ERR %</span>
                <span className="text-base font-bold tabular-nums text-amber-700">
                  {post.errPercent}%
                </span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <span className="text-[11px] text-slate-500 block">Replay Ratio</span>
                <span className="text-base font-bold tabular-nums text-slate-900">
                  {post.replayRatio}x
                </span>
              </div>
            </div>

            {/* Baris Metrik Sekunder */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 rounded-xl border border-slate-200 p-3 text-center text-xs">
              <div>
                <span className="text-slate-400 block">Suka</span>
                <span className="font-bold tabular-nums text-slate-800">
                  {formatDotNumber(post.likes)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Komentar</span>
                <span className="font-bold tabular-nums text-slate-800">
                  {formatDotNumber(post.comments)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Bagikan</span>
                <span className="font-bold tabular-nums text-slate-800">
                  {formatDotNumber(post.shares)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Disimpan</span>
                <span className="font-bold tabular-nums text-slate-800">
                  {formatDotNumber(post.saves)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Follow</span>
                <span className="font-bold tabular-nums text-slate-800">
                  +{formatDotNumber(post.follows)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">ERV %</span>
                <span className="font-bold tabular-nums text-slate-800">{post.ervPercent}%</span>
              </div>
            </div>

            {/* Caption Lengkap */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Caption Lengkap
                </span>
                <button
                  type="button"
                  onClick={handleCopyCaption}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                    copied
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {copied ? 'Disalin' : 'Salin Caption'}
                </button>
              </div>
              <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs leading-relaxed text-slate-800 whitespace-pre-wrap">
                {post.description || '-'}
              </div>
            </div>

            {/* Hashtags */}
            {post.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {post.hashtags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Hapus Entri */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
              {confirmingDelete ? (
                <>
                  <span className="text-xs text-slate-600 mr-auto">Hapus entri ini?</span>
                  <SecondaryButton
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="py-1.5 px-3 text-xs"
                    disabled={deleting}
                  >
                    Batal
                  </SecondaryButton>
                  <DangerButton
                    type="button"
                    onClick={handleDelete}
                    className="py-1.5 px-3 text-xs"
                    disabled={deleting}
                  >
                    {deleting ? 'Menghapus...' : 'Ya, Hapus'}
                  </DangerButton>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 transition"
                >
                  Hapus Entri
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
