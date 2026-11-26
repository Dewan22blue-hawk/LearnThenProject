import {
  Activity,
  BarChart3,
  BookOpen,
  NotebookPen,
  Trophy,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  shortLabel: string;
  description: string;
  prompt: string;
  keywords: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: 'Belajar',
    shortLabel: 'Belajar',
    description: 'Materi belajar, progres siklus, dan catatan',
    prompt: 'Lagi belajar apa hari ini?',
    keywords: 'belajar materi kursus catatan progres beranda home',
    icon: BookOpen,
  },
  {
    to: '/diary',
    label: 'Diary',
    shortLabel: 'Diary',
    description: 'Jurnal harian dan refleksi proses belajar',
    prompt: 'Tulis refleksi & catatan harian.',
    keywords: 'diary jurnal catatan harian refleksi',
    icon: NotebookPen,
  },
  {
    to: '/keuangan',
    label: 'Keuangan',
    shortLabel: 'Keuangan',
    description: 'Arus kas, akun, utang, dan perencanaan',
    prompt: 'Pantau arus kas & tabunganmu.',
    keywords: 'keuangan uang transaksi tabungan utang cfp budget',
    icon: Wallet,
  },
  {
    to: '/hasil',
    label: 'Hasil',
    shortLabel: 'Hasil',
    description: 'Output nyata dan portofolio dari belajarmu',
    prompt: 'Lihat output yang sudah dihasilkan.',
    keywords: 'hasil output proyek portofolio karya',
    icon: Trophy,
  },
  {
    to: '/jejak',
    label: 'Jejak',
    shortLabel: 'Jejak',
    description: 'Streak, konsistensi, dan riwayat aktivitas',
    prompt: 'Cek konsistensi & streak belajarmu.',
    keywords: 'jejak streak aktivitas riwayat kalender',
    icon: Activity,
  },
  {
    to: '/lap-ig',
    label: 'Lap. IG',
    shortLabel: 'Lap. IG',
    description: 'Analisis performa dan laporan Instagram',
    prompt: 'Analisa insight & performa IG.',
    keywords: 'instagram ig laporan insight analitik konten',
    icon: BarChart3,
  },
];

export function isNavActive(pathname: string, to: string): boolean {
  if (to === '/') {
    return pathname === '/' || pathname.startsWith('/materi');
  }
  return pathname === to || pathname.startsWith(`${to}/`);
}
