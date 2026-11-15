import { useRef, useState } from 'react';
import type { LearningNote } from '../../types';
import { formatJakarta } from '../../lib/time';
import { Button, ConfirmDialog, Field, SecondaryButton, TextArea } from '../ui';

interface LearningNotesSectionProps {
  notes: LearningNote[];
  onCreateNote: (input: {
    understanding: string;
    critical_comment: string | null;
    ideas: string | null;
    questions: string | null;
  }) => Promise<void>;
  onUpdateNote: (
    noteId: string,
    input: {
      understanding: string;
      critical_comment: string | null;
      ideas: string | null;
      questions: string | null;
    }
  ) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
}

/** Render inline markdown-lite (**bold**, *italic*, `code`) sebagai elemen React yang aman. */
function renderInlineFormatting(text: string): React.ReactNode[] {
  const tokenRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={i} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={i} className="italic">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={i}
          className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] text-slate-800"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

/** Render teks catatan dengan dukungan paragraf, bullet list (- / *), dan numbered list (1. ). */
export function FormattedNoteText({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Bullet list (- item, * item, • item)
    if (/^[-*•]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="list-disc pl-5 space-y-1 text-slate-800">
          {items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInlineFormatting(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list (1. item, 2. item)
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push(
        <ol key={`ol-${i}`} className="list-decimal pl-5 space-y-1 text-slate-800">
          {items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {renderInlineFormatting(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Paragraph (gabungkan baris berturut-turut yang bukan list atau baris kosong)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^[-*•]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }

    blocks.push(
      <p key={`p-${i}`} className="leading-relaxed text-slate-800">
        {paraLines.map((pLine, idx) => (
          <span key={idx}>
            {idx > 0 && <br />}
            {renderInlineFormatting(pLine)}
          </span>
        ))}
      </p>
    );
  }

  return <div className="space-y-2 text-sm">{blocks}</div>;
}

function buildPlainNoteText(n: LearningNote): string {
  const parts = [`[Pemahaman]\n${n.understanding ?? ''}`];
  if (n.critical_comment) parts.push(`[Komentar Kritis / Opini]\n${n.critical_comment}`);
  if (n.ideas) parts.push(`[Ide Proyek]\n${n.ideas}`);
  if (n.questions) parts.push(`[Pertanyaan Terbuka]\n${n.questions}`);
  return parts.join('\n\n');
}

interface FormatToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (val: string) => void;
  showPreview: boolean;
  onTogglePreview: () => void;
}

function FormatToolbar({
  textareaRef,
  value,
  onChange,
  showPreview,
  onTogglePreview,
}: FormatToolbarProps) {
  const applyInlineWrap = (wrapper: string, placeholder: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const selected = value.slice(start, end) || placeholder;
    const next = `${value.slice(0, start)}${wrapper}${selected}${wrapper}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursorStart = start + wrapper.length;
      el.setSelectionRange(cursorStart, cursorStart + selected.length);
    });
  };

  const applyListPrefix = (ordered: boolean) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;

    const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    const lineEndIdx = value.indexOf('\n', end);
    const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;

    const block = value.slice(lineStart, lineEnd);
    const lines = block ? block.split('\n') : [''];
    const formatted = lines
      .map((line, idx) => {
        const cleaned = line.replace(/^(\s*)([-*•]|\d+\.)\s+/, '$1');
        const prefix = ordered ? `${idx + 1}. ` : '- ';
        return `${prefix}${cleaned}`;
      })
      .join('\n');

    const next = `${value.slice(0, lineStart)}${formatted}${value.slice(lineEnd)}`;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(lineStart, lineStart + formatted.length);
    });
  };

  const btnCls =
    'rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition';

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-lg border border-b-0 border-slate-300 bg-slate-50 px-2.5 py-1.5">
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => applyInlineWrap('**', 'teks tebal')}
          disabled={showPreview}
          className={`${btnCls} font-bold disabled:opacity-40`}
          title="Tebal (**teks**)"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => applyInlineWrap('*', 'teks miring')}
          disabled={showPreview}
          className={`${btnCls} italic disabled:opacity-40`}
          title="Miring (*teks*)"
        >
          I
        </button>
        <button
          type="button"
          onClick={() => applyListPrefix(false)}
          disabled={showPreview}
          className={`${btnCls} disabled:opacity-40`}
          title="Daftar poin (- item)"
        >
          • List
        </button>
        <button
          type="button"
          onClick={() => applyListPrefix(true)}
          disabled={showPreview}
          className={`${btnCls} disabled:opacity-40`}
          title="Daftar bernomor (1. item)"
        >
          1. List
        </button>
      </div>

      <button
        type="button"
        onClick={onTogglePreview}
        className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
          showPreview
            ? 'bg-slate-900 text-white'
            : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
        }`}
      >
        {showPreview ? 'Kembali Edit' : 'Pratinjau'}
      </button>
    </div>
  );
}

interface NoteEditorFormProps {
  title: string;
  initialValues?: {
    understanding: string;
    critical_comment: string;
    ideas: string;
    questions: string;
  };
  submitLabel: string;
  onSubmit: (values: {
    understanding: string;
    critical_comment: string | null;
    ideas: string | null;
    questions: string | null;
  }) => Promise<void>;
  onCancel: () => void;
}

function NoteEditorForm({
  title,
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
}: NoteEditorFormProps) {
  const [understanding, setUnderstanding] = useState(initialValues?.understanding ?? '');
  const [criticalComment, setCriticalComment] = useState(initialValues?.critical_comment ?? '');
  const [ideas, setIdeas] = useState(initialValues?.ideas ?? '');
  const [questions, setQuestions] = useState(initialValues?.questions ?? '');
  const [showAdvanced, setShowAdvanced] = useState(
    Boolean(
      initialValues?.critical_comment || initialValues?.ideas || initialValues?.questions
    )
  );
  const [showPreview, setShowPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const understandingRef = useRef<HTMLTextAreaElement | null>(null);

  const handleSave = async () => {
    setErrorMsg('');
    if (understanding.trim().length < 100) {
      setErrorMsg(
        `Pemahaman masih ${understanding.trim().length} karakter, minimal 100 karakter.`
      );
      return;
    }
    setBusy(true);
    try {
      await onSubmit({
        understanding: understanding.trim(),
        critical_comment: criticalComment.trim() || null,
        ideas: ideas.trim() || null,
        questions: questions.trim() || null,
      });
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Gagal menyimpan catatan.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <span className="text-xs tabular-nums text-slate-500">
          {understanding.trim().length}/100 min. karakter
        </span>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          Pemahaman Inti *
        </label>
        <FormatToolbar
          textareaRef={understandingRef}
          value={understanding}
          onChange={setUnderstanding}
          showPreview={showPreview}
          onTogglePreview={() => setShowPreview((p) => !p)}
        />
        {showPreview ? (
          <div className="min-h-[140px] rounded-b-lg border border-slate-300 bg-slate-50/60 p-3">
            {understanding.trim() ? (
              <FormattedNoteText text={understanding} />
            ) : (
              <p className="text-sm text-slate-400">Belum ada tulisan untuk dipratinjau.</p>
            )}
          </div>
        ) : (
          <textarea
            ref={understandingRef}
            rows={6}
            value={understanding}
            onChange={(e) => setUnderstanding(e.target.value)}
            placeholder={
              'Tulis inti materi dengan bahasamu sendiri.\n- Gunakan tanda minus (-) untuk daftar poin\n1. Atau angka untuk daftar bernomor\nGunakan **tebal** dan *miring* bila perlu.'
            }
            className="w-full rounded-b-lg border border-slate-300 bg-white px-3 py-2.5 text-base sm:text-sm leading-relaxed outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
          />
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced((p) => !p)}
        className="text-xs font-medium text-slate-600 underline hover:text-slate-900"
      >
        {showAdvanced
          ? '− Sembunyikan opini, ide & pertanyaan'
          : '+ Tambah komentar kritis / opini, ide proyek, atau pertanyaan'}
      </button>

      {showAdvanced && (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
          <Field
            label="Komentar Kritis / Opini Pribadi"
            hint="Mendukung daftar (- item / 1. item) dan **tebal**."
          >
            <TextArea
              rows={3}
              value={criticalComment}
              onChange={(e) => setCriticalComment(e.target.value)}
              placeholder="Apakah ada kelebihan, batasan, atau pandangan pribadimu terhadap materi ini?"
            />
          </Field>
          <Field label="Ide Proyek / Bentuk Karya Nyata" hint="Mini project apa yang bisa dibuat?">
            <TextArea
              rows={2}
              value={ideas}
              onChange={(e) => setIdeas(e.target.value)}
              placeholder="cth: Buat prototipe atau catatan perbandingan BM25 vs Dense Retrieval..."
            />
          </Field>
          <Field
            label="Pertanyaan Terbuka / Yang Masih Membingungkan"
            hint="Hal yang perlu dieksplorasi lebih lanjut."
          >
            <TextArea
              rows={2}
              value={questions}
              onChange={(e) => setQuestions(e.target.value)}
              placeholder="cth: Bagaimana strategi re-ranking yang paling hemat latensi?"
            />
          </Field>
        </div>
      )}

      {errorMsg && <p className="text-xs font-medium text-rose-600">{errorMsg}</p>}

      <div className="flex gap-2 pt-1">
        <SecondaryButton type="button" onClick={onCancel} className="flex-1" disabled={busy}>
          Batal
        </SecondaryButton>
        <Button type="button" onClick={handleSave} disabled={busy} className="flex-1">
          {busy ? 'Menyimpan...' : submitLabel}
        </Button>
      </div>
    </div>
  );
}

export function LearningNotesSection({
  notes,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
}: LearningNotesSectionProps) {
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (n: LearningNote) => {
    navigator.clipboard.writeText(buildPlainNoteText(n)).then(() => {
      setCopiedId(n.id);
      setTimeout(() => setCopiedId((prev) => (prev === n.id ? null : prev)), 1500);
    });
  };

  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    setDeleting(true);
    try {
      await onDeleteNote(deletingId);
      setDeletingId(null);
      if (editingId === deletingId) setEditingId(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mt-3 space-y-3">
      {notes.map((n, idx) =>
        editingId === n.id ? (
          <NoteEditorForm
            key={n.id}
            title={`Ubah Catatan ${idx + 1}`}
            initialValues={{
              understanding: n.understanding ?? '',
              critical_comment: n.critical_comment ?? '',
              ideas: n.ideas ?? '',
              questions: n.questions ?? '',
            }}
            submitLabel="Simpan Perubahan"
            onSubmit={async (values) => {
              await onUpdateNote(n.id, values);
              setEditingId(null);
            }}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <article
            key={n.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Catatan {idx + 1}
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs text-slate-500">
                  {formatJakarta(n.updated_at || n.created_at)}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleCopy(n)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                    copiedId === n.id
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {copiedId === n.id ? 'Disalin' : 'Salin'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewForm(false);
                    setEditingId(n.id);
                  }}
                  className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Ubah
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingId(n.id)}
                  className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition"
                >
                  Hapus
                </button>
              </div>
            </div>

            <FormattedNoteText text={n.understanding ?? ''} />

            {(n.critical_comment || n.ideas || n.questions) && (
              <div className="space-y-3 border-t border-slate-100 pt-3">
                {n.critical_comment && (
                  <div className="border-l-2 border-slate-300 pl-3 space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Komentar Kritis / Opini
                    </p>
                    <FormattedNoteText text={n.critical_comment} />
                  </div>
                )}
                {n.ideas && (
                  <div className="border-l-2 border-indigo-300 pl-3 space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Ide Proyek
                    </p>
                    <FormattedNoteText text={n.ideas} />
                  </div>
                )}
                {n.questions && (
                  <div className="border-l-2 border-amber-300 pl-3 space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Pertanyaan Terbuka
                    </p>
                    <FormattedNoteText text={n.questions} />
                  </div>
                )}
              </div>
            )}
          </article>
        )
      )}

      {showNewForm ? (
        <NoteEditorForm
          title={`Catatan ${notes.length + 1}`}
          submitLabel="Simpan Catatan"
          onSubmit={async (values) => {
            await onCreateNote(values);
            setShowNewForm(false);
          }}
          onCancel={() => setShowNewForm(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setShowNewForm(true);
          }}
          className="w-full rounded-xl border border-dashed border-slate-300 bg-slate-50/50 py-3 text-sm font-medium text-slate-600 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900 transition"
        >
          + Tambah catatan {notes.length > 0 ? notes.length + 1 : ''}
        </button>
      )}

      {deletingId && (
        <ConfirmDialog
          title="Hapus Catatan"
          message="Yakin ingin menghapus catatan ini? Tindakan ini tidak bisa dibatalkan."
          confirmLabel="Hapus Catatan"
          busy={deleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </div>
  );
}

