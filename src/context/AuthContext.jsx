import { createContext, useContext, useState, useEffect } from "react";
import { encryptTokenForHeader } from "../services/apiService";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const API_TOKEN = import.meta.env.VITE_API_TOKEN;
const NUSA_URL = import.meta.env.VITE_NUSA_URL;
const ADMIN_API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const AUTH_STORAGE_KEYS = {
  adminToken: "auth_admin_token",
  ssoToken: "auth_sso_token",
};

const LEGACY_AUTH_STORAGE_KEYS = {
  user: "user",
  userProfile: "userProfile",
  ssoToken: "sso_token",
  adminAuth: "admin_auth",
  adminToken: "admin_token",
};

const isAdminUser = (userData) =>
  userData?.role === "Super Admin" || userData?.role === "Admin";

const sanitizeUser = (userData) => {
  if (!userData) return null;
  const { token, ...safeUser } = userData;
  return safeUser;
};

const readAuthStorageItem = (key, legacyKey = key) => {
  const sessionValue = sessionStorage.getItem(key);
  if (sessionValue !== null) return sessionValue;

  const legacyValue = localStorage.getItem(legacyKey);
  if (legacyValue !== null) {
    // migrate only admin token from legacy storage
    if (key === AUTH_STORAGE_KEYS.adminToken) {
      sessionStorage.setItem(key, legacyValue);
    }
    localStorage.removeItem(legacyKey);
    return legacyValue;
  }

  return null;
};

const writeAuthStorageItem = (key, value, legacyKey = key) => {
  // only persist admin token and SSO token per new policy
  if (
    key === AUTH_STORAGE_KEYS.adminToken ||
    key === AUTH_STORAGE_KEYS.ssoToken
  ) {
    sessionStorage.setItem(key, value);
    localStorage.removeItem(legacyKey);
  }
};

const clearAuthStorage = () => {
  // remove admin token and legacy keys
  sessionStorage.removeItem(AUTH_STORAGE_KEYS.adminToken);
  sessionStorage.removeItem(AUTH_STORAGE_KEYS.ssoToken);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Note: Per new policy we do not persist user/SSO data or lastActivity.
  // Only admin token is persisted in sessionStorage; session expiry is driven by token verification with the server.

  // Check if admin or SSO token exists and verify
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const storedAdminToken = readAuthStorageItem(
          AUTH_STORAGE_KEYS.adminToken,
          LEGACY_AUTH_STORAGE_KEYS.adminToken,
        );
        const storedSSOToken = readAuthStorageItem(
          AUTH_STORAGE_KEYS.ssoToken,
          LEGACY_AUTH_STORAGE_KEYS.ssoToken,
        );

        // Check admin token first
        if (storedAdminToken) {
          const data = await verifyAdminToken(storedAdminToken);
          if (data && data.success && data.data && data.data.payload) {
            const payload = data.data.payload;
            const adminUser = buildAdminUser(payload, payload.email);
            setUser(adminUser);
            setIsAuthenticated(true);
            sessionStorage.removeItem("self_logout");
          } else {
            clearAuthStorage();
          }
        }
        // Check SSO token
        else if (storedSSOToken) {
          const data = await verifyToken(storedSSOToken);
          if (data && data.status === true && data.user) {
            setUser(data.user);
            setIsAuthenticated(true);
            sessionStorage.removeItem("self_logout");
          } else {
            clearAuthStorage();
            window.location.href = `${NUSA_URL}/dashboard`;
          }
        }
      } catch (error) {
        console.error("Auth check error:", error);
        clearAuthStorage();
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const verifyToken = async (token) => {
    try {
      console.log("Verifying SSO token...");
      const encryptedToken = await encryptTokenForHeader(API_TOKEN, {
        salt: API_TOKEN,
      });
      const response = await fetch(`${API_BASE_URL}/api/sso/verify/${encodeURIComponent(token)}`, {
        method: "GET",
        mode: "cors",
        credentials: "include",
        headers: {
          "X-Api-Token": encryptedToken,
        },
      });

      const data = await response.json().catch(() => null);
      return data;
    } catch (error) {
      console.error("Token verification error:", error);
      return null;
    }
  };

  // Verify admin JWT using ADMIN API and return server response
  const verifyAdminToken = async (adminToken) => {
    try {
      if (!ADMIN_API_BASE_URL) return null;
      const encryptedToken = await encryptTokenForHeader(API_TOKEN, {
        salt: API_TOKEN,
      });
      const response = await fetch(`${ADMIN_API_BASE_URL}/api/admin/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(encryptedToken ? { "X-API-TOKEN": encryptedToken } : {}),
          ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
        },
        body: JSON.stringify({}),
      });

      const data = await response.json().catch(() => null);
      return data;
    } catch (error) {
      console.error("Admin token verification error:", error);
      return null;
    }
  };

  const fetchUserData = async (nip) => {
    try {
      const encryptedToken = await encryptTokenForHeader(API_TOKEN, {
        salt: API_TOKEN,
      });
      const response = await fetch(`${API_BASE_URL}/api/pegawai/${nip}`, {
        headers: {
          "X-API-Token": encryptedToken,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch user data");
      }

      const userData = await response.json();
      return userData;
    } catch (error) {
      console.error("Fetch user data error:", error);
      throw error;
    }
  };

  const buildAdminUser = (adminData, fallbackEmail) => {
    const email = adminData?.email || fallbackEmail || "";
    const role =
      adminData?.type === "admin" ? "Admin" : adminData?.type || "Admin";

    return {
      email,
      name: email || "Admin",
      nama: email || "Admin",
      role,
      type: adminData?.type || "admin",
    };
  };

  const login = async (token, nip) => {
    try {
      const userData = await fetchUserData(nip);
      const safeUser = sanitizeUser(userData);
      setUser(safeUser);
      setIsAuthenticated(true);
      sessionStorage.removeItem("self_logout");
      // Persist only SSO token (not user data) per policy
      writeAuthStorageItem(
        AUTH_STORAGE_KEYS.ssoToken,
        token,
        LEGACY_AUTH_STORAGE_KEYS.ssoToken,
      );
      return true;
    } catch (error) {
      console.error("Login error:", error);
      return false;
    }
  };

  const logout = async () => {
    const isAdminAuth = isAdminUser(user);
    const adminToken = readAuthStorageItem(
      AUTH_STORAGE_KEYS.adminToken,
      LEGACY_AUTH_STORAGE_KEYS.adminToken,
    );

    // Mark that this logout was initiated by the user (self-logout)
    try {
      sessionStorage.setItem("self_logout", "true");
    } catch (e) {
      // ignore storage errors
    }

    if (isAdminAuth && ADMIN_API_BASE_URL) {
      try {
        const encryptedToken = await encryptTokenForHeader(API_TOKEN, {
          salt: API_TOKEN,
        });
        await fetch(`${ADMIN_API_BASE_URL}/api/admin/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...(encryptedToken ? { "X-API-TOKEN": encryptedToken } : {}),
            ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
          },
        });
      } catch (error) {
        console.error("Admin logout error:", error);
      }
    }

    setUser(null);
    setIsAuthenticated(false);
    clearAuthStorage();

    // Redirect admin to /admin, others to NUSA
    if (isAdminAuth) {
      window.location.href = "/admin";
    } else {
      window.location.href = `${NUSA_URL}/dashboard`;
    }
  };

  const adminLogin = async (email, password) => {
    try {
      if (!ADMIN_API_BASE_URL) {
        throw new Error("Admin API base URL is not configured");
      }

      // Encrypt email and password
      const encryptedEmail = await encryptTokenForHeader(email, {
        salt: email,
      });
      const encryptedPassword = await encryptTokenForHeader(password, {
        salt: password,
      });

      const encryptedToken = await encryptTokenForHeader(API_TOKEN, {
        salt: API_TOKEN,
      });
      const response = await fetch(`${ADMIN_API_BASE_URL}/api/admin/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(encryptedToken ? { "X-API-TOKEN": encryptedToken } : {}),
        },
        body: JSON.stringify({
          email: encryptedEmail,
          password: encryptedPassword,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success || !result?.data?.token) {
        console.error(
          "Admin login failed:",
          result?.message || response.statusText,
        );
        return false;
      }

      const adminUser = buildAdminUser(result.data, email);

      setUser(adminUser);
      setIsAuthenticated(true);
      // Persist only admin token
      writeAuthStorageItem(
        AUTH_STORAGE_KEYS.adminToken,
        result.data.token,
        LEGACY_AUTH_STORAGE_KEYS.adminToken,
      );
      sessionStorage.removeItem("admin_logout_redirect");
      return true;
    } catch (error) {
      console.error("Admin login error:", error);
      return false;
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    verifyToken,
    login,
    logout,
    adminLogin,
    NUSA_URL,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
