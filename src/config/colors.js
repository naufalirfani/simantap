/**
 * Color Palette Configuration
 * Palet warna terpusat untuk seluruh aplikasi
 */

// Primary Colors - Warna utama aplikasi
export const PRIMARY_COLORS = {
  green: '#2fa84f',      // Hijau - untuk success, positive actions
  purple: '#7a5cd6',     // Ungu - untuk secondary actions, special features
  yellow: '#f4c430',     // Kuning - untuk warnings, highlights
  orange: '#f39c12',     // Orange - untuk alerts, important info
  blue: '#3085d6',       // Biru - untuk primary actions, links
  teal: '#14B8A6',       // Teal - untuk info, secondary actions
  red: '#d33',           // Merah - untuk danger, errors
};

// Secondary Colors - Versi lebih terang untuk backgrounds, hovers
export const SECONDARY_COLORS = {
  green: '#3dbd5f',      // Lighter green
  purple: '#8a6de6',     // Lighter purple
  yellow: '#f5cf50',     // Lighter yellow
  orange: '#f5ad32',     // Lighter orange
  blue: '#4095e6',       // Lighter blue
  teal: '#28d0b8',       // Lighter teal
  red: '#e44',           // Lighter red
};

// Darker variants untuk hover states
export const DARK_COLORS = {
  green: '#258a3f',      // Darker green
  purple: '#6a4cc6',     // Darker purple
  yellow: '#d4a420',     // Darker yellow
  orange: '#d38c02',     // Darker orange
  blue: '#2075c6',       // Darker blue
  teal: '#0D9488',       // Darker teal
  red: '#c22',           // Darker red
};

// Neutral colors - untuk teks, background, borders (dipertahankan dari sistem)
export const NEUTRAL_COLORS = {
  white: '#FFFFFF',
  black: '#000000',
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },
};

// Dark mode colors
export const DARK_MODE_COLORS = {
  bg: {
    primary: '#0F172A',
    secondary: '#1F2937',
    tertiary: '#374151',
  },
  text: {
    primary: '#F3F4F6',
    secondary: '#E5E7EB',
    tertiary: '#D1D5DB',
  },
  border: {
    primary: '#374151',
    secondary: '#4B5563',
  },
};

// Chart colors - untuk grafik dan visualisasi
export const CHART_COLORS = {
  primary: [
    PRIMARY_COLORS.green,
    PRIMARY_COLORS.purple,
    PRIMARY_COLORS.yellow,
    PRIMARY_COLORS.orange,
    PRIMARY_COLORS.teal,
    PRIMARY_COLORS.red,
  ],
  gender: [PRIMARY_COLORS.teal, '#EC4899'], // Biru & Pink untuk gender chart
  point: PRIMARY_COLORS.teal,
};

// Status colors untuk badge, alerts, notifications
export const STATUS_COLORS = {
  success: PRIMARY_COLORS.green,
  warning: PRIMARY_COLORS.yellow,
  error: PRIMARY_COLORS.red,
  info: PRIMARY_COLORS.teal,
  pending: PRIMARY_COLORS.orange,
  special: PRIMARY_COLORS.purple,
};

// Background colors - Warna background yang lebih terang untuk teks/label/badge/alert
export const BG_COLORS = {
  green: {
    light: '#E9F7EF',        // bg-green-100 equivalent
    DEFAULT: '#a7e9c5',      // bg-green-200 equivalent
  },
  purple: {
    light: '#F3E8FF',        // bg-purple-100 equivalent
    DEFAULT: '#d8b4fe',      // bg-purple-200 equivalent
  },
  yellow: {
    light: '#FFF8E1',        // bg-yellow-100 equivalent
    DEFAULT: '#fde68a',      // bg-yellow-200 equivalent
  },
  orange: {
    light: '#ffedd5',        // bg-orange-100 equivalent
    DEFAULT: '#fed7aa',      // bg-orange-200 equivalent
  },
  blue: {
    light: '#E7F3FF',        // bg-blue-100 equivalent
    DEFAULT: '#bfdbfe',      // bg-blue-200 equivalent
  },
  red: {
    light: '#FDECEA',        // bg-red-100 equivalent
    DEFAULT: '#fecaca',      // bg-red-200 equivalent
  },
  teal: {
    light: '#CCFBF1',        // bg-teal-100 equivalent
    DEFAULT: '#99F6E4',      // bg-teal-200 equivalent
  },
};

// Text colors untuk digunakan dengan BG_COLORS
export const TEXT_ON_BG_COLORS = {
  green: '#2fa84f',      // Hijau - untuk success, positive actions
  purple: '#7a5cd6',     // Ungu - untuk secondary actions, special features
  yellow: '#f4c430',     // Kuning - untuk warnings, highlights
  orange: '#f39c12',     // Orange - untuk alerts, important info
  blue: '#3085d6',       // Biru - untuk primary actions, links
  teal: '#0D9488',       // Teal - untuk secondary actions, special features
  red: '#d33333',  
};

// Export default color configuration
export default {
  primary: PRIMARY_COLORS,
  secondary: SECONDARY_COLORS,
  dark: DARK_COLORS,
  neutral: NEUTRAL_COLORS,
  darkMode: DARK_MODE_COLORS,
  chart: CHART_COLORS,
  status: STATUS_COLORS,
  bg: BG_COLORS,
  textOnBg: TEXT_ON_BG_COLORS,
};
