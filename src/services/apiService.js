import CryptoJS from 'crypto-js';

const ANJAB_API_BASE_URL = import.meta.env.VITE_ANJAB_API_BASE_URL;
const API_EMAIL = import.meta.env.VITE_ANJAB_API_EMAIL;
const API_PASSWORD = import.meta.env.VITE_ANJAB_API_PASSWORD;

// CMB API Configuration
const CMB_API_BASE_URL = import.meta.env.VITE_API_CMB_URL;
const CMB_API_TOKEN = import.meta.env.VITE_API_TOKEN;

// Indikator API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const API_TOKEN = import.meta.env.VITE_API_TOKEN;

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

// Store token in memory (could be moved to context or localStorage)
let authToken = null;

/**
 * Login to get access token
 */
export const login = async () => {
  try {
    const response = await fetch(`${ANJAB_API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: API_EMAIL,
        password: API_PASSWORD,
      }),
    });

    if (!response.ok) {
      throw new Error("Login failed");
    }

    const data = await response.json();
    authToken = data.access_token;

    // Store token expiry time
    const expiryTime = Date.now() + data.expires_in * 1000;
    localStorage.setItem("anjab_token", authToken);
    localStorage.setItem("anjab_token_expiry", expiryTime.toString());

    return data;
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
};

/**
 * Get valid token (login if needed)
 */
const getValidToken = async () => {
  const storedToken = localStorage.getItem("anjab_token");
  const expiryTime = localStorage.getItem("anjab_token_expiry");

  // Check if token exists and is not expired
  if (storedToken && expiryTime && Date.now() < parseInt(expiryTime)) {
    authToken = storedToken;
    return authToken;
  }

  // Token expired or doesn't exist, login again
  await login();
  return authToken;
};

/**
 * Fetch peta jabatan data
 */
export const fetchPetaJabatan = async () => {
  try {
    const encryptedToken = await encryptTokenForHeader(API_TOKEN, { salt: API_TOKEN });
    const response = await fetch(
      `${API_BASE_URL}/api/peta-jabatan?with_pagination=false`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-API-TOKEN": encryptedToken,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch peta jabatan");
    }

    const result = await response.json();
    if (result && result.success === false) {
      throw new Error(result.message || "Failed to fetch peta jabatan");
    }

    return result.data || [];
  } catch (error) {
    console.error("Fetch peta jabatan error:", error);
    throw error;
  }
};

/**
 * Fetch peta jabatan as hierarchical tree (by unit kerja)
 */
export const fetchPetaJabatanTree = async () => {
  try {
    const base = API_BASE_URL || "http://192.168.0.111:8000";
    const url = `${base}/api/peta-jabatan/tree-by-unit-kerja`;
    const encryptedToken = await encryptTokenForHeader(API_TOKEN, { salt: API_TOKEN });
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-API-TOKEN": encryptedToken,
      },
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(result?.message || "Failed to fetch peta jabatan tree");
    }

    if (!result || result.success === false) {
      throw new Error(result?.message || "Invalid peta jabatan tree response");
    }

    return result.data || [];
  } catch (error) {
    console.error("fetchPetaJabatanTree error:", error);
    throw error;
  }
};

/**
 * Fetch peta jabatan kosong data for succession planning
 */
export const fetchPetaJabatanKosong = async () => {
  try {
    const encryptedToken = await encryptTokenForHeader(API_TOKEN, { salt: API_TOKEN });
    const response = await fetch(
      `${API_BASE_URL}/api/peta-jabatan?with_pagination=false&jabatan_kosong=true`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-API-TOKEN": encryptedToken,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch peta jabatan kosong");
    }

    const result = await response.json();
    if (result && result.success === false) {
      throw new Error(result.message || "Failed to fetch peta jabatan kosong");
    }

    return result.data || [];
  } catch (error) {
    console.error("Fetch peta jabatan kosong error:", error);
    throw error;
  }
};

/**
 * Get unique unit kerja from peta jabatan data
 */
export const getUniqueUnitKerja = (petaJabatanData) => {
  const uniqueUnits = new Map();

  petaJabatanData.forEach((item) => {
    if (item.unit_kerja && !uniqueUnits.has(item.unit_kerja)) {
      uniqueUnits.set(item.unit_kerja, {
        id: item.id,
        unit_kerja: item.unit_kerja,
        slug: item.slug,
        is_pusat: item.is_pusat,
        kelas_jabatan: Number.parseInt(item.kelas_jabatan, 10),
      });
    }
  });

  return Array.from(uniqueUnits.values());
};

/**
 * Get all jabatan from peta jabatan data
 */
export const getUniqueJabatan = (petaJabatanData) => {
  return petaJabatanData.map((item) => ({
    id: item.id,
    nama_jabatan: item.nama_jabatan,
    jenis_jabatan: item.jenis_jabatan,
    kelas_jabatan: Number.parseInt(item.kelas_jabatan, 10),
    unit_kerja: item.unit_kerja,
    kebutuhan_pegawai: item.kebutuhan_pegawai,
    bezetting: item.bezetting,
    selisih: item.kebutuhan_pegawai - item.bezetting,
  }));
};

/**
 * Fetch pegawai data with pagination, search, and filters
 */
export const fetchPegawai = async (params = {}) => {
  try {
    const queryParams = new URLSearchParams();

    // Add pagination params
    if (params.page) queryParams.append("page", params.page);
    if (params.per_page) queryParams.append("per_page", params.per_page);

    // Add search param
    if (params.q) queryParams.append("q", params.q);

    // Add filter params
    if (params.unit_organisasi_name)
      queryParams.append("unit_organisasi_name", params.unit_organisasi_name);
    if (params.jabatan_name)
      queryParams.append("jabatan_name", params.jabatan_name);
    if (params.jenis_jabatan)
      queryParams.append("jenis_jabatan", params.jenis_jabatan);
    if (params.golongan) queryParams.append("golongan", params.golongan);

    // Add sort params
    if (params.sort_by) queryParams.append("sort_by", params.sort_by);
    if (params.sort_order) queryParams.append("sort_order", params.sort_order);

    queryParams.append("include_avatar", true);

    const url = `${CMB_API_BASE_URL}/api/pegawai${
      queryParams.toString() ? "?" + queryParams.toString() : ""
    }`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-api-token": CMB_API_TOKEN,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch pegawai data");
    }

    return await response.json();
  } catch (error) {
    console.error("Fetch pegawai error:", error);
    throw error;
  }
};

/**
 * Fetch single pegawai by NIP from main API
 */
export const fetchPegawaiByNip = async (nip, with_penilaian = false) => {
  try {
    const base = API_BASE_URL || "http://192.168.0.111:8000";
    const params = new URLSearchParams();
    if (with_penilaian) params.append("with_penilaian", "true");

    const url = `${base}/api/pegawai/${nip}${
      params.toString() ? "?" + params.toString() : ""
    }`;

    const encryptedToken = await encryptTokenForHeader(API_TOKEN, { salt: API_TOKEN });
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-API-TOKEN": encryptedToken,
      },
    });

    const result = await response.json();
    if (result && result.success === false) {
      throw new Error(result.message || "Failed to fetch pegawai by NIP");
    }

    return result.data || [];
  } catch (error) {
    console.error("fetchPegawaiByNip error:", error);
    throw error;
  }
};

/**
 * Fetch rekomendasi pegawai for succession planning
 */
export const fetchRekomendasiPegawai = async (petaJabatanId, isRotasi = false) => {
  try {
    const base = API_BASE_URL || "http://192.168.0.111:8000";
    const params = isRotasi ? "?retensi=true" : "";
    const url = `${base}/api/pegawai/rekomendasi/${petaJabatanId}${params}`;

    const encryptedToken = await encryptTokenForHeader(API_TOKEN, { salt: API_TOKEN });
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-API-TOKEN": encryptedToken,
      },
    });

    const result = await response.json();
    if (result && result.success === false) {
      throw new Error(result.message || "Failed to fetch rekomendasi pegawai");
    }

    return result.data || [];
  } catch (error) {
    console.error("fetchRekomendasiPegawai error:", error);
    throw error;
  }
};

// ==================== INDIKATOR API FUNCTIONS ====================

/**
 * Fetch all indikators
 */
export const fetchIndikators = async () => {
  try {
    const encryptedToken = await encryptTokenForHeader(API_TOKEN, { salt: API_TOKEN });
    const response = await fetch(`${API_BASE_URL}/api/indikators`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-API-TOKEN": encryptedToken,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch indikators");
    }

    const result = await response.json();
    if (result && result.success === false) {
      throw new Error(result.message || "Failed to fetch indikators");
    }

    return result.data || [];
  } catch (error) {
    console.error("Fetch indikators error:", error);
    throw error;
  }
};

/**
 * Fetch statistik pegawai
 * Response expected: { success: true, data: { ... } }
 */
export const fetchStatistik = async () => {
  try {
    const encryptedToken = await encryptTokenForHeader(API_TOKEN, { salt: API_TOKEN });
    const response = await fetch(`${API_BASE_URL}/api/statistik`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-API-TOKEN": encryptedToken,
      },
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(result?.message || "Failed to fetch statistik");
    }

    if (!result || result.success === false) {
      throw new Error(result?.message || "Invalid statistik response");
    }

    return result.data || {};
  } catch (error) {
    console.error("Fetch statistik error:", error);
    throw error;
  }
};

/**
 * Fetch statistik pengembangan (kompetensi & potensi breakdown per subindikator, golongan, unit kerja)
 * Endpoint: GET /api/pengembangan/statistik
 * Query params:
 *   - unit_organisasi_name  (optional)
 *   - jabatan_name          (optional)  
 *   - jenis_jabatan         (optional)
 */
export const 


























































fetchPengembanganStatistik = async (params = {}) => {
  try {
    const base = API_BASE_URL || "http://192.168.0.111:8000";
    const urlParams = new URLSearchParams();
    if (params.unit_organisasi_name) urlParams.append("unit_organisasi_name", params.unit_organisasi_name);
    if (params.jabatan_name) urlParams.append("jabatan_name", params.jabatan_name);
    if (params.jenis_jabatan) urlParams.append("jenis_jabatan", params.jenis_jabatan);

    const url = `${base}/api/pengembangan/statistik${urlParams.toString() ? "?" + urlParams.toString() : ""}`;
    const encryptedToken = await encryptTokenForHeader(API_TOKEN, { salt: API_TOKEN });
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-API-TOKEN": encryptedToken,
      },
    });

    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.message || "Failed to fetch pengembangan statistik");
    if (!result || result.success === false) throw new Error(result?.message || "Invalid response");

    return result.data || {};
  } catch (error) {
    console.error("fetchPengembanganStatistik error:", error);
    throw error;
  }
};

/**
 * Fetch pegawai list with filter key, pagination and optional search query
 * Returns { data: [...], meta: { current_page, per_page, last_page, total } }
 */
export const fetchPegawaiList = async ({
  filter,
  kuadran,
  page = 1,
  per_page = 20,
  q = "",
  with_penilaian = false,
  with_pagination = true,
} = {}) => {
  try {
    const base = API_BASE_URL || "http://192.168.0.111:8000";
    const params = new URLSearchParams();
    if (filter) params.append("jenis_jabatan", filter);
    if (kuadran) params.append("kuadran", kuadran);
    if (with_penilaian) params.append("with_penilaian", "true");
    if (!with_pagination) params.append("with_pagination", "false");
    if (page) params.append("page", page);
    if (per_page) params.append("per_page", per_page);
    if (q) params.append("q", q);

    const url = `${base}/api/pegawai${
      params.toString() ? "?" + params.toString() : ""
    }`;

    const encryptedToken = await encryptTokenForHeader(API_TOKEN, { salt: API_TOKEN });
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-API-TOKEN": encryptedToken,
      },
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(result?.message || "Failed to fetch pegawai list");
    }

    if (!result || result.success === false) {
      throw new Error(result?.message || "Invalid pegawai response");
    }

    return {
      data: result.data || [],
      meta: result.meta || null,
    };
  } catch (error) {
    console.error("fetchPegawaiList error:", error);
    throw error;
  }
};

/**
 * Create a new indikator
 */
export const createIndikator = async (data) => {
  try {
    const encryptedToken = await encryptTokenForHeader(API_TOKEN, { salt: API_TOKEN });
    const response = await fetch(`${API_BASE_URL}/api/indikators`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-TOKEN": encryptedToken,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error("Failed to create indikator");
    }

    const result = await response.json();
    if (result && result.success === false) {
      throw new Error(result.message || "Failed to create indikator");
    }

    return result;
  } catch (error) {
    console.error("Create indikator error:", error);
    throw error;
  }
};

/**
 * Update an indikator
 */
export const updateIndikator = async (id, data) => {
  try {
    const encryptedToken = await encryptTokenForHeader(API_TOKEN, { salt: API_TOKEN });
    const response = await fetch(`${API_BASE_URL}/api/indikators/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-API-TOKEN": encryptedToken,
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || "Failed to update indikator");
    }

    return result;
  } catch (error) {
    console.error("Update indikator error:", error);
    throw error;
  }
};

/**
 * Delete an indikator
 */
export const deleteIndikator = async (id) => {
  try {
    const encryptedToken = await encryptTokenForHeader(API_TOKEN, { salt: API_TOKEN });
    const response = await fetch(`${API_BASE_URL}/api/indikators/${id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "X-API-TOKEN": encryptedToken,
      },
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || "Failed to delete indikator");
    }

    return result;
  } catch (error) {
    console.error("Delete indikator error:", error);
    throw error;
  }
};

/**
 * Create a new subindikator
 */
export const createSubIndikator = async (data) => {
  try {
    const encryptedToken = await encryptTokenForHeader(API_TOKEN, { salt: API_TOKEN });
    const response = await fetch(`${API_BASE_URL}/api/subindikators`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-TOKEN": encryptedToken,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error("Failed to create subindikator");
    }

    const result = await response.json();
    if (result && result.success === false) {
      throw new Error(result.message || "Failed to create subindikator");
    }

    return result;
  } catch (error) {
    console.error("Create subindikator error:", error);
    throw error;
  }
};

/**
 * Update a subindikator
 */
export const updateSubIndikator = async (id, data) => {
  try {
    const encryptedToken = await encryptTokenForHeader(API_TOKEN, { salt: API_TOKEN });
    const response = await fetch(`${API_BASE_URL}/api/subindikators/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-API-TOKEN": encryptedToken,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error("Failed to update subindikator");
    }

    const result = await response.json();
    if (result && result.success === false) {
      throw new Error(result.message || "Failed to update subindikator");
    }

    return result;
  } catch (error) {
    console.error("Update subindikator error:", error);
    throw error;
  }
};

/**
 * Delete a subindikator
 */
export const deleteSubIndikator = async (id) => {
  try {
    const encryptedToken = await encryptTokenForHeader(API_TOKEN, { salt: API_TOKEN });
    const response = await fetch(`${API_BASE_URL}/api/subindikators/${id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "X-API-TOKEN": encryptedToken,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to delete subindikator");
    }

    const result = await response.json();
    if (result && result.success === false) {
      throw new Error(result.message || "Failed to delete subindikator");
    }

    return result;
  } catch (error) {
    console.error("Delete subindikator error:", error);
    throw error;
  }
};

/**
 * Bulk update bobot for subindikators
 * Expected payload: { subindikators: [{ id, bobot }, ...] }
 */
export const bulkUpdateSubBobot = async (subindikators) => {
  try {
    const encryptedToken = await encryptTokenForHeader(API_TOKEN, { salt: API_TOKEN });
    const response = await fetch(
      `${API_BASE_URL}/api/subindikators/bulk-bobot`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-TOKEN": encryptedToken,
        },
        body: JSON.stringify({ subindikators }),
      }
    );

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        result?.message || "Failed to bulk update subindikator bobot"
      );
    }

    if (result && result.success === false) {
      throw new Error(
        result.message || "Failed to bulk update subindikator bobot"
      );
    }

    return result;
  } catch (error) {
    console.error("Bulk update subindikator bobot error:", error);
    throw error;
  }
};

/**
 * Fetch all subindikators
 */
export const fetchSubIndikators = async () => {
  try {
    const encryptedToken = await encryptTokenForHeader(API_TOKEN, { salt: API_TOKEN });
    const response = await fetch(`${API_BASE_URL}/api/subindikators`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-API-TOKEN": encryptedToken,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch subindikators");
    }

    const result = await response.json().catch(() => null);
    if (!result || result.success === false) {
      throw new Error(result?.message || "Invalid subindikator response");
    }

    return result.data || [];
  } catch (error) {
    console.error("fetchSubIndikators error:", error);
    throw error;
  }
};

/**
 * Bulk upload penilaian entries
 * Expected payload: { penilaians: [ { nip, nama, subindikator1: value, ... }, ... ] }
 * Endpoint: VITE_API_BASE_URL/penilaians/bulk
 */
export const bulkUploadPenilaian = async (payload) => {
  try {
    const url = `${API_BASE_URL}/api/penilaians/bulk`;
    // payload can be either an array (penilaians) or an object { penilaians, headers }
    let body = null;
    if (Array.isArray(payload)) {
      body = { penilaians: payload };
    } else if (payload && typeof payload === "object") {
      body = payload;
    } else {
      throw new Error("Invalid payload for bulkUploadPenilaian");
    }

    const encryptedToken = await encryptTokenForHeader(API_TOKEN, { salt: API_TOKEN });
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-TOKEN": encryptedToken,
      },
      body: JSON.stringify(body),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(result?.message || "Failed to upload penilaian bulk");
    }

    return result;
  } catch (error) {
    console.error("bulkUploadPenilaian error:", error);
    throw error;
  }
};

/**
 * Fetch standar kompetensi MSK
 * Endpoint: VITE_API_BASE_URL/api/standar-kompetensi-msk
 */
export const fetchStandarKompetensiMSK = async (jenisJabatanId = null) => {
  try {
    const url = new URL(`${API_BASE_URL}/api/standar-kompetensi-msk`);
    if (jenisJabatanId)
      url.searchParams.append("jenis_jabatan_id", jenisJabatanId);

    const encryptedToken = await encryptTokenForHeader(API_TOKEN, { salt: API_TOKEN });
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-API-TOKEN": encryptedToken,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch standar kompetensi MSK");
    }

    const result = await response.json().catch(() => null);
    if (!result) {
      throw new Error("Invalid standar kompetensi MSK response");
    }

    // Return the data array, handling both { data: [...] } and [...] formats
    return result.data || result;
  } catch (error) {
    console.error("fetchStandarKompetensiMSK error:", error);
    throw error;
  }
};

// ==================== INSTRUMEN API FUNCTIONS ====================

/**
 * Fetch all instrumens
 */
export const fetchInstrumens = async () => {
  try {
    const encryptedToken = await encryptTokenForHeader(API_TOKEN, { salt: API_TOKEN });
    const response = await fetch(`${API_BASE_URL}/api/instrumens`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-API-TOKEN": encryptedToken,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch instrumens");
    }

    const result = await response.json();
    if (result && result.success === false) {
      throw new Error(result.message || "Failed to fetch instrumens");
    }

    return result.data || [];
  } catch (error) {
    console.error("Fetch instrumens error:", error);
    throw error;
  }
};

/**
 * Create a new instrumen
 */
export const createInstrumen = async (data) => {
  try {
    const encryptedToken = await encryptTokenForHeader(API_TOKEN, { salt: API_TOKEN });
    const response = await fetch(`${API_BASE_URL}/api/instrumens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-TOKEN": encryptedToken,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      throw new Error(result?.message || "Failed to create instrumen");
    }

    const result = await response.json();
    if (result && result.success === false) {
      throw new Error(result.message || "Failed to create instrumen");
    }

    return result;
  } catch (error) {
    console.error("Create instrumen error:", error);
    throw error;
  }
};

/**
 * Update an instrumen
 */
export const updateInstrumen = async (id, data) => {
  try {
    const encryptedToken = await encryptTokenForHeader(API_TOKEN, { salt: API_TOKEN });
    const response = await fetch(`${API_BASE_URL}/api/instrumens/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-API-TOKEN": encryptedToken,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      throw new Error(result?.message || "Failed to update instrumen");
    }

    const result = await response.json();
    if (result && result.success === false) {
      throw new Error(result.message || "Failed to update instrumen");
    }

    return result;
  } catch (error) {
    console.error("Update instrumen error:", error);
    throw error;
  }
};

/**
 * Delete an instrumen
 */
export const deleteInstrumen = async (id) => {
  try {
    const encryptedToken = await encryptTokenForHeader(API_TOKEN, { salt: API_TOKEN });
    const response = await fetch(`${API_BASE_URL}/api/instrumens/${id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "X-API-TOKEN": encryptedToken,
      },
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      throw new Error(result?.message || "Failed to delete instrumen");
    }

    const result = await response.json();
    if (result && result.success === false) {
      throw new Error(result.message || "Failed to delete instrumen");
    }

    return result;
  } catch (error) {
    console.error("Delete instrumen error:", error);
    throw error;
  }
};

/**
 * Trigger sync for peta jabatan on the remote service
 */
export const syncPetaJabatan = async () => {
  try {
    const encryptedToken = await encryptTokenForHeader(API_TOKEN, { salt: API_TOKEN });
    const response = await fetch(`${API_BASE_URL}/api/peta-jabatan/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-TOKEN": encryptedToken,
      },
    });

    if (!response.ok) {
      const errResp = await response.json().catch(() => null);
      throw new Error(errResp?.message || "Failed to sync peta jabatan");
    }

    return await response.json().catch(() => ({}));
  } catch (error) {
    console.error("Sync peta jabatan error:", error);
    throw error;
  }
};

/**
 * Trigger sync for pegawai on the remote service
 */
export const syncPegawai = async () => {
  try {
    // This endpoint uses the same API base URL from the main service
    const encryptedToken = await encryptTokenForHeader(API_TOKEN, { salt: API_TOKEN });
    const response = await fetch(`${API_BASE_URL}/api/pegawai/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-TOKEN": encryptedToken,
      },
    });

    if (!response.ok) {
      const errResp = await response.json().catch(() => null);
      throw new Error(errResp?.message || "Failed to sync pegawai");
    }

    return await response.json().catch(() => ({}));
  } catch (error) {
    console.error("Sync pegawai error:", error);
    throw error;
  }
};

/**
 * Trigger sync for penilaian on the remote service
 */
export const syncPenilaian = async (nips = null) => {
  try {
    const encryptedToken = await encryptTokenForHeader(API_TOKEN, { salt: API_TOKEN });

    const body = {};
    if (nips && nips.length > 0) {
      body.nip = nips.length === 1 ? nips[0] : nips;
    }

    const response = await fetch(`${API_BASE_URL}/api/penilaians/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-TOKEN": encryptedToken,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errResp = await response.json().catch(() => null);
      throw new Error(errResp?.message || "Failed to sync penilaian");
    }

    return await response.json().catch(() => ({}));
  } catch (error) {
    console.error("Sync penilaian error:", error);
    throw error;
  }
};

// ==================== PENILAIAN API FUNCTIONS ====================

/**
 * Fetch penilaian data for a specific pegawai
 */
export const fetchPenilaianByNip = async (nip) => {
  try {
    const encryptedToken = await encryptTokenForHeader(API_TOKEN, { salt: API_TOKEN });
    const response = await fetch(`${API_BASE_URL}/api/penilaians/${nip}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-API-TOKEN": encryptedToken,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch penilaian data");
    }

    const result = await response.json();
    if (result && result.success === false) {
      throw new Error(result.message || "Failed to fetch penilaian data");
    }

    return result || null;
  } catch (error) {
    console.error("Fetch penilaian error:", error);
    throw error;
  }
};

/**
 * Submit penilaian data for a pegawai
 */
export const submitPenilaian = async (data) => {
  try {
    const encryptedToken = await encryptTokenForHeader(API_TOKEN, { salt: API_TOKEN });
    const response = await fetch(`${API_BASE_URL}/api/penilaians`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-TOKEN": encryptedToken,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      throw new Error(result?.message || "Failed to submit penilaian");
    }

    const result = await response.json();
    if (result && result.success === false) {
      throw new Error(result.message || "Failed to submit penilaian");
    }

    return result;
  } catch (error) {
    console.error("Submit penilaian error:", error);
    throw error;
  }
};

/**
 * Update penilaian data for a pegawai
 */
export const updatePenilaian = async (nip, data) => {
  try {
    const encryptedToken = await encryptTokenForHeader(API_TOKEN, { salt: API_TOKEN });
    const response = await fetch(`${API_BASE_URL}/api/penilaians/${nip}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-API-TOKEN": encryptedToken,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      throw new Error(result?.message || "Failed to update penilaian");
    }

    const result = await response.json();
    if (result && result.success === false) {
      throw new Error(result.message || "Failed to update penilaian");
    }

    return result;
  } catch (error) {
    console.error("Update penilaian error:", error);
    throw error;
  }
};

/**
 * Fetch syarat suksesi by jabatan ID
 */
export const fetchSyaratSuksesi = async (jabatanId) => {
  try {
    const encryptedToken = await encryptTokenForHeader(API_TOKEN, { salt: API_TOKEN });
    const response = await fetch(
      `${API_BASE_URL}/api/syarat-suksesi/${jabatanId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-API-TOKEN": encryptedToken,
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Fetch syarat suksesi error:", error);
    return null;
  }
};

/**
 * Create syarat suksesi
 */
export const createSyaratSuksesi = async (data) => {
  try {
    const encryptedToken = await encryptTokenForHeader(API_TOKEN, { salt: API_TOKEN });
    const response = await fetch(
      `${API_BASE_URL}/api/syarat-suksesi`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-TOKEN": encryptedToken,
        },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      throw new Error(result?.message || "Gagal menyimpan syarat suksesi");
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Create syarat suksesi error:", error);
    throw error;
  }
};

/**
 * Update syarat suksesi
 */
export const updateSyaratSuksesi = async (id, data) => {
  try {
    const encryptedToken = await encryptTokenForHeader(API_TOKEN, { salt: API_TOKEN });
    const response = await fetch(
      `${API_BASE_URL}/api/syarat-suksesi/${id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-API-TOKEN": encryptedToken,
        },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      throw new Error(result?.message || "Gagal mengupdate syarat suksesi");
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Update syarat suksesi error:", error);
    throw error;
  }
};
