const ANJAB_API_BASE_URL = import.meta.env.VITE_ANJAB_API_BASE_URL;
const API_EMAIL = import.meta.env.VITE_ANJAB_API_EMAIL;
const API_PASSWORD = import.meta.env.VITE_ANJAB_API_PASSWORD;

// CMB API Configuration
const CMB_API_BASE_URL = import.meta.env.VITE_API_CMB_URL;
const CMB_API_TOKEN = import.meta.env.VITE_API_TOKEN;

// Indikator API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

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
    const token = await getValidToken();

    const response = await fetch(`${ANJAB_API_BASE_URL}/peta-jabatan`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      // If unauthorized, try to login again
      if (response.status === 401) {
        localStorage.removeItem("anjab_token");
        localStorage.removeItem("anjab_token_expiry");
        authToken = null;

        // Retry with new token
        const newToken = await getValidToken();
        const retryResponse = await fetch(`${ANJAB_API_BASE_URL}/peta-jabatan`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${newToken}`,
            "Content-Type": "application/json",
          },
        });

        if (!retryResponse.ok) {
          throw new Error("Failed to fetch peta jabatan");
        }

        return await retryResponse.json();
      }

      throw new Error("Failed to fetch peta jabatan");
    }

    return await response.json();
  } catch (error) {
    console.error("Fetch peta jabatan error:", error);
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
    if (params.unit_organisasi)
      queryParams.append("unit_organisasi", params.unit_organisasi);
    if (params.jabatan) queryParams.append("jabatan", params.jabatan);
    if (params.jenis_jabatan)
      queryParams.append("jenis_jabatan", params.jenis_jabatan);
    if (params.role) queryParams.append("role", params.role);
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

// ==================== INDIKATOR API FUNCTIONS ====================

/**
 * Fetch all indikators
 */
export const fetchIndikators = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/indikators`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
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
    const response = await fetch(`${API_BASE_URL}/api/statistik`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
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
 * Fetch pegawai list with filter key, pagination and optional search query
 * Returns { data: [...], meta: { current_page, per_page, last_page, total } }
 */
export const fetchPegawaiList = async ({ filter, page = 1, per_page = 20, q = "" } = {}) => {
  try {
    const base = API_BASE_URL || "http://192.168.0.111:8000";
    const params = new URLSearchParams();
    if (filter) params.append("filter", filter);
    if (page) params.append("page", page);
    if (per_page) params.append("per_page", per_page);
    if (q) params.append("q", q);

    const url = `${base}/api/pegawai${params.toString() ? "?" + params.toString() : ""}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
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
    const response = await fetch(`${API_BASE_URL}/api/indikators`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
    const response = await fetch(
      `${API_BASE_URL}/api/indikators/${id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      }
    );

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
    const response = await fetch(
      `${API_BASE_URL}/api/indikators/${id}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

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
    const response = await fetch(
      `${API_BASE_URL}/api/subindikators`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      }
    );

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
    const response = await fetch(
      `${API_BASE_URL}/api/subindikators/${id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      }
    );

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
    const response = await fetch(
      `${API_BASE_URL}/api/subindikators/${id}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

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
   * Trigger sync for peta jabatan on the remote service
   */
  export const syncPetaJabatan = async () => {
    try {
      const token = await getValidToken();

      const response = await fetch(`${API_BASE_URL}/api/peta-jabatan/sync`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errResp = await response.json().catch(() => null);
        throw new Error(errResp?.message || 'Failed to sync peta jabatan');
      }

      return await response.json().catch(() => ({}));
    } catch (error) {
      console.error('Sync peta jabatan error:', error);
      throw error;
    }
  };

/**
 * Trigger sync for pegawai on the remote service
 */
export const syncPegawai = async () => {
  try {
    // This endpoint uses the same API base URL from the main service
    const response = await fetch(`${API_BASE_URL}/api/pegawai/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errResp = await response.json().catch(() => null);
      throw new Error(errResp?.message || 'Failed to sync pegawai');
    }

    return await response.json().catch(() => ({}));
  } catch (error) {
    console.error('Sync pegawai error:', error);
    throw error;
  }
};
