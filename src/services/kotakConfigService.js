/**
 * Service untuk mengelola konfigurasi Matriks 9 Kotak
 * Data disimpan di localStorage sebagai JSON
 */

import CryptoJS from 'crypto-js';
import { PRIMARY_COLORS } from '../config/colors';

/**
 * Encrypt token for secure header transmission
 * @param {string} token - The token to encrypt
 * @param {Object} opts - Options for encryption
 * @returns {string} Encrypted token with v1.aes: prefix
 */
export async function encryptTokenForHeader(token, opts = {}) {
  try {
    if (!token) return '';

    // Salt (static / env-based, JANGAN dari token itself)
    const saltStr = opts.salt || 'nusa-dpd-salt';

    // 🔑 FAST key derivation (SHA-256)
    // 256-bit key, langsung cocok untuk AES-256
    const key = CryptoJS.SHA256(
      CryptoJS.enc.Utf8.parse(token + saltStr)
    );

    // Random 16-byte IV
    const iv = CryptoJS.lib.WordArray.random(16);

    const encrypted = CryptoJS.AES.encrypt(
      CryptoJS.enc.Utf8.parse(token),
      key,
      {
        iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      }
    );

    // IV + ciphertext → base64
    const combined = iv.concat(encrypted.ciphertext);
    const b64 = CryptoJS.enc.Base64.stringify(combined);

    return 'v1.aes:' + b64;
  } catch (e) {
    console.error('Error encrypting token for header:', e);
    return token;
  }
}

// Default configuration untuk 9 kotak
const DEFAULT_CONFIG = {
  intervals: {
    potensial: [
      { min: 0, max: 60, label: '0-60' },
      { min: 61, max: 80, label: '61-80' },
      { min: 81, max: 100, label: '81-100' }
    ],
    kinerja: [
      { min: 0, max: 60, label: '0-60' },
      { min: 61, max: 80, label: '61-80' },
      { min: 81, max: 100, label: '81-100' }
    ]
  },
  kotak: [
    {
      id: 1,
      kategori: 'Kinerja di Bawah Ekspektasi dan Potensial Rendah',
      warna: '#EF4444',
      potensialRange: { min: 0, max: 60 },
      kinerjaRange: { min: 0, max: 60 },
      rekomendasi: [
        'Diproses sesuai ketentuan peraturan perundangan'
      ]
    },
    {
      id: 2,
      kategori: 'Kinerja Sesuai Ekspektasi dan Potensial Rendah',
      warna: '#F97316',
      potensialRange: { min: 0, max: 60 },
      kinerjaRange: { min: 61, max: 80 },
      rekomendasi: [
        'Bimbingan kinerja',
        'Pengembangan kompetensi',
        'Penempatan yang sesuai'
      ]
    },
    {
      id: 3,
      kategori: 'Kinerja di Bawah Ekspektasi dan Potensial Menengah',
      warna: '#F59E0B',
      potensialRange: { min: 61, max: 80 },
      kinerjaRange: { min: 0, max: 60 },
      rekomendasi: [
        'Bimbingan kinerja',
        'Konseling kinerja',
        'Pengembangan kompetensi',
        'Penempatan yang sesuai'
      ]
    },
    {
      id: 4,
      kategori: 'Kinerja di Atas Ekspektasi dan Potensial Rendah',
      warna: '#F59E0B',
      potensialRange: { min: 0, max: 60 },
      kinerjaRange: { min: 81, max: 100 },
      rekomendasi: [
        'Rotasi',
        'Pengembangan kompetensi'
      ]
    },
    {
      id: 5,
      kategori: 'Kinerja Sesuai Ekspektasi dan Potensial Menengah',
      warna: '#EAB308',
      potensialRange: { min: 61, max: 80 },
      kinerjaRange: { min: 61, max: 80 },
      rekomendasi: [
        'Penempatan yang sesuai',
        'Bimbingan kinerja',
        'Pengembangan kompetensi'
      ]
    },
    {
      id: 6,
      kategori: 'Kinerja di Bawah Ekspektasi dan Potensial Tinggi',
      warna: '#84CC16',
      potensialRange: { min: 81, max: 100 },
      kinerjaRange: { min: 0, max: 60 },
      rekomendasi: [
        'Penempatan yang sesuai',
        'Bimbingan kinerja',
        'Konseling kinerja'
      ]
    },
    {
      id: 7,
      kategori: 'Kinerja di Atas Ekspektasi dan Potensial Menengah',
      warna: '#84CC16',
      potensialRange: { min: 61, max: 80 },
      kinerjaRange: { min: 81, max: 100 },
      rekomendasi: [
        'Dipertahankan',
        'Masuk Kelompok Rencana Suksesi Instansi',
        'Rotasi/Pengayaan jabatan',
        'Pengembangan kompetensi',
        'Tugas belajar'
      ]
    },
    {
      id: 8,
      kategori: 'Kinerja Sesuai Ekspektasi dan Potensial Tinggi',
      warna: '#22C55E',
      potensialRange: { min: 81, max: 100 },
      kinerjaRange: { min: 61, max: 80 },
      rekomendasi: [
        'Dipertahankan',
        'Masuk Kelompok Rencana Suksesi Instansi',
        'Rotasi/Perluasan jabatan',
        'Bimbingan kinerja'
      ]
    },
    {
      id: 9,
      kategori: 'Kinerja di Atas Ekspektasi dan Potensial Tinggi',
      warna: '#10B981',
      potensialRange: { min: 81, max: 100 },
      kinerjaRange: { min: 81, max: 100 },
      rekomendasi: [
        'Dipromosikan dan dipertahankan',
        'Masuk Kelompok Rencana Suksesi Instansi/Nasional',
        'Penghargaan'
      ]
    }
  ]
};

/**
 * Load konfigurasi.
 * Implementation note: to keep the existing synchronous API used across the app,
 * we keep an in-memory cache (`cachedConfig`) that is returned synchronously.
 * On module init we attempt to fetch the config from the API and update the
 * cache when the network response arrives. If the API is unreachable, the
 * `DEFAULT_CONFIG` will be used.
 * @returns {Object} Konfigurasi kotak (cached, may be DEFAULT_CONFIG initially)
 */
const API_URL = (import.meta && import.meta.env && import.meta.env.VITE_API_BASE_URL)
  ? `${import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')}/api/daftar-kotak`
  : '/api/daftar-kotak';

// API token untuk endpoint Indikator/API utama
const API_TOKEN = (import.meta && import.meta.env && import.meta.env.VITE_API_TOKEN) || null;

let cachedConfig = DEFAULT_CONFIG;

const fetchConfig = async () => {
  try {
    const encryptedToken = await encryptTokenForHeader(API_TOKEN, { salt: API_TOKEN });
    const res = await fetch(API_URL, { method: 'GET', headers: { 'Accept': 'application/json', 'X-API-TOKEN': encryptedToken } });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        cachedConfig = data;
        try {
          if (typeof window !== 'undefined' && window.dispatchEvent) {
            const ev = new CustomEvent('kotakConfigChanged', { detail: cachedConfig });
            window.dispatchEvent(ev);
          }
        } catch (e) {
          // ignore event dispatch errors
        }
      }
    } else {
      console.warn('Failed fetching kotak config, status:', res.status);
    }
  } catch (error) {
    console.error('Error fetching kotak config:', error);
  }
};

// Attempt initial fetch in background
fetchConfig();

export const loadKotakConfig = () => cachedConfig;

/**
 * Save konfigurasi ke localStorage
 * @param {Object} config - Konfigurasi yang akan disimpan
 * @returns {boolean} Success status
 */
export const saveKotakConfig = (config) => {
  try {
    // update cache immediately so callers get the latest data synchronously
    cachedConfig = config;

    // fire-and-forget async call to persist to backend
    (async () => {
      try {
        const encryptedToken = await encryptTokenForHeader(API_TOKEN, { salt: API_TOKEN });
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-API-TOKEN': encryptedToken },
          body: JSON.stringify(config)
        });
        if (!res.ok) {
          console.warn('Failed saving kotak config to API, status:', res.status);
        }
      } catch (err) {
        console.error('Error saving kotak config to API:', err);
      }
    })();

    try {
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        const ev = new CustomEvent('kotakConfigChanged', { detail: config });
        window.dispatchEvent(ev);
      }
    } catch (e) {
      // ignore
    }

    return true;
  } catch (error) {
    console.error('Error saving kotak config:', error);
    return false;
  }
};

/**
 * Reset konfigurasi ke default
 * @returns {Object} Default configuration
 */
export const resetKotakConfig = () => {
  try {
    // Use a deep clone so the DEFAULT_CONFIG constant isn't mutated elsewhere
    const defaultCopy = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

    // Recompute kotak ranges based on the default intervals so they stay consistent
    const intervals = defaultCopy.intervals;
    const mapping = [
      [0, 0],
      [0, 1],
      [1, 0],
      [0, 2],
      [1, 1],
      [2, 0],
      [1, 2],
      [2, 1],
      [2, 2],
    ];

    if (Array.isArray(defaultCopy.kotak)) {
      defaultCopy.kotak = defaultCopy.kotak.map((k, idx) => {
        const map = mapping[idx] || [0, 0];
        const p = (intervals && intervals.potensial && intervals.potensial[map[0]]) || { min: 0, max: 100 };
        const kf = (intervals && intervals.kinerja && intervals.kinerja[map[1]]) || { min: 0, max: 100 };
        return {
          ...k,
          potensialRange: { min: p.min, max: p.max },
          kinerjaRange: { min: kf.min, max: kf.max },
        };
      });
    }

    // Use saveKotakConfig to update cache, persist and dispatch change events
    saveKotakConfig(defaultCopy);

    return defaultCopy;
  } catch (error) {
    console.error('Error resetting kotak config:', error);
    return DEFAULT_CONFIG;
  }
};

/**
 * Get konfigurasi untuk kotak tertentu
 * @param {number} kotakId - ID kotak (1-9)
 * @returns {Object|null} Konfigurasi kotak
 */
export const getKotakById = (kotakId) => {
  const config = loadKotakConfig();
  return config.kotak.find(k => k.id === kotakId) || null;
};

/**
 * Update konfigurasi untuk kotak tertentu
 * @param {number} kotakId - ID kotak (1-9)
 * @param {Object} updates - Update data
 * @returns {boolean} Success status
 */
export const updateKotak = (kotakId, updates) => {
  try {
    const config = loadKotakConfig();
    const index = config.kotak.findIndex(k => k.id === kotakId);
    if (index !== -1) {
      config.kotak[index] = { ...config.kotak[index], ...updates };
      return saveKotakConfig(config);
    }
    return false;
  } catch (error) {
    console.error('Error updating kotak:', error);
    return false;
  }
};

/**
 * Update interval konfigurasi
 * @param {Object} intervals - Interval data
 * @returns {boolean} Success status
 */
export const updateIntervals = (intervals) => {
  try {
    const config = loadKotakConfig();
    config.intervals = intervals;

    // Recompute kotak ranges to reflect new interval boundaries.
    // Mapping follows existing default ordering so IDs keep semantics:
    // id 1: potensial[0], kinerja[0]
    // id 2: potensial[0], kinerja[1]
    // id 3: potensial[1], kinerja[0]
    // id 4: potensial[0], kinerja[2]
    // id 5: potensial[1], kinerja[1]
    // id 6: potensial[2], kinerja[0]
    // id 7: potensial[1], kinerja[2]
    // id 8: potensial[2], kinerja[1]
    // id 9: potensial[2], kinerja[2]
    const mapping = [
      [0, 0],
      [0, 1],
      [1, 0],
      [0, 2],
      [1, 1],
      [2, 0],
      [1, 2],
      [2, 1],
      [2, 2],
    ];

    if (Array.isArray(config.kotak)) {
      config.kotak = config.kotak.map((k, idx) => {
        const map = mapping[idx] || [0, 0];
        const p = intervals.potensial[map[0]] || { min: 0, max: 100 };
        const kf = intervals.kinerja[map[1]] || { min: 0, max: 100 };
        return {
          ...k,
          potensialRange: { min: p.min, max: p.max },
          kinerjaRange: { min: kf.min, max: kf.max },
        };
      });
    }

    return saveKotakConfig(config);
  } catch (error) {
    console.error('Error updating intervals:', error);
    return false;
  }
};

/**
 * Compute kotak berdasarkan nilai potensial dan kinerja dengan konfigurasi dinamis
 * @param {number} potensial - Nilai potensial (0-100)
 * @param {number} kinerja - Nilai kinerja (0-100)
 * @returns {number} Kotak ID (1-9)
 */
export const computeQuadrantDynamic = (potensial, kinerja) => {
  const config = loadKotakConfig();
  
  // Find matching kotak
  for (const kotak of config.kotak) {
    const potensialMatch = 
      potensial >= kotak.potensialRange.min && 
      potensial <= kotak.potensialRange.max;
    
    const kinerjaMatch = 
      kinerja >= kotak.kinerjaRange.min && 
      kinerja <= kotak.kinerjaRange.max;
    
    if (potensialMatch && kinerjaMatch) {
      return kotak.id;
    }
  }
  
  return 0; // Unknown
};

export default {
  loadKotakConfig,
  saveKotakConfig,
  resetKotakConfig,
  getKotakById,
  updateKotak,
  updateIntervals,
  computeQuadrantDynamic,
  DEFAULT_CONFIG
};
