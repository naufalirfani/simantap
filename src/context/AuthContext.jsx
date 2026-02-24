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

const API_BASE_URL = import.meta.env.VITE_API_CMB_URL;
const API_TOKEN = import.meta.env.VITE_API_TOKEN;
const NUSA_URL = import.meta.env.VITE_NUSA_URL;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Session timeout: 1 hour (in milliseconds)
  const SESSION_TIMEOUT = 60 * 60 * 1000; // 1 hour

  // Update last activity time
  const updateLastActivity = () => {
    if (isAuthenticated) {
      localStorage.setItem("lastActivity", Date.now().toString());
    }
  };

  // Check if session has expired
  const checkSessionExpiry = () => {
    const lastActivity = localStorage.getItem("lastActivity");
    if (!lastActivity || !isAuthenticated) return;

    const timeSinceLastActivity = Date.now() - parseInt(lastActivity);

    if (timeSinceLastActivity > SESSION_TIMEOUT) {
      console.log("Session expired due to inactivity");
      logout();
    }
  };

  // Track user activity for session timeout
  useEffect(() => {
    if (!isAuthenticated) return;

    // Update last activity on mount
    updateLastActivity();

    // Activity event handlers
    const activityEvents = ["mousedown", "keydown", "scroll", "touchstart"];

    activityEvents.forEach((event) => {
      window.addEventListener(event, updateLastActivity);
    });

    // Check session expiry every minute
    const intervalId = setInterval(checkSessionExpiry, 60000);

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, updateLastActivity);
      });
      clearInterval(intervalId);
    };
  }, [isAuthenticated]);

  // Check if user is already logged in and verify token
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const storedUser = localStorage.getItem("user");
        const storedToken = localStorage.getItem("sso_token");
        const isAdminAuth = localStorage.getItem("admin_auth");
        const lastActivity = localStorage.getItem("lastActivity");

        // Check for admin authentication first
        if (isAdminAuth === "true" && storedUser) {
          // Check session expiry for admin
          if (lastActivity) {
            const timeSinceLastActivity = Date.now() - parseInt(lastActivity);
            if (timeSinceLastActivity > SESSION_TIMEOUT) {
              console.log("Admin session expired due to inactivity");
              localStorage.removeItem("user");
              localStorage.removeItem("admin_auth");
              localStorage.removeItem("lastActivity");
              setLoading(false);
              return;
            }
          }
          setUser(JSON.parse(storedUser));
          setIsAuthenticated(true);
          setLoading(false);
          return;
        }

        if (storedUser && storedToken) {
          // Check session expiry for SSO users
          if (lastActivity) {
            const timeSinceLastActivity = Date.now() - parseInt(lastActivity);
            if (timeSinceLastActivity > SESSION_TIMEOUT) {
              console.log("SSO session expired due to inactivity");
              localStorage.removeItem("user");
              localStorage.removeItem("sso_token");
              localStorage.removeItem("lastActivity");
              window.location.href = `${NUSA_URL}/dashboard`;
              return;
            }
          }

          // Verify token on every page load/reload
          const isValid = await verifyToken(storedToken);

          if (isValid) {
            setUser(JSON.parse(storedUser));
            setIsAuthenticated(true);
          } else {
            // Token expired or invalid, clear and redirect
            console.log("Token expired or invalid, redirecting to NUSA");
            localStorage.removeItem("user");
            localStorage.removeItem("sso_token");
            localStorage.removeItem("lastActivity");
            setUser(null);
            setIsAuthenticated(false);
            window.location.href = `${NUSA_URL}/dashboard`;
            return;
          }
        }
      } catch (error) {
        console.error("Auth check error:", error);
        localStorage.removeItem("user");
        localStorage.removeItem("sso_token");
        localStorage.removeItem("lastActivity");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const verifyToken = async (token) => {
    try {
      console.log("Verifying token...");
      const encryptedToken = await encryptTokenForHeader(API_TOKEN, {
        salt: API_TOKEN,
      });
      const response = await fetch(`${API_BASE_URL}/sso/verify/${token}`, {
        headers: {
          "X-API-Token": encryptedToken,
        },
      });

      const data = await response.json();
      return data.status === true;
    } catch (error) {
      console.error("Token verification error:", error);
      return false;
    }
  };

  const fetchUserData = async (nip) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/pegawai/${nip}`, {
        headers: {
          "X-API-Token": API_TOKEN,
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

  const login = async (token, nip) => {
    try {
      const userData = await fetchUserData(nip);
      setUser(userData);
      setIsAuthenticated(true);
      localStorage.setItem("user", JSON.stringify(userData));
      localStorage.setItem("sso_token", token);
      localStorage.setItem("lastActivity", Date.now().toString());
      return true;
    } catch (error) {
      console.error("Login error:", error);
      return false;
    }
  };

  const logout = () => {
    // Check localStorage for admin auth BEFORE clearing
    const isAdminAuth = localStorage.getItem("admin_auth") === "true";

    // Set temporary flag in sessionStorage for admin logout redirect
    if (isAdminAuth) {
      sessionStorage.setItem("admin_logout_redirect", "true");
    }

    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem("user");
    localStorage.removeItem("userProfile");
    localStorage.removeItem("sso_token");
    localStorage.removeItem("admin_auth");
    localStorage.removeItem("lastActivity");

    // Redirect admin to /admin, others to NUSA
    if (isAdminAuth) {
      window.location.href = "/admin";
    } else {
      window.location.href = `${NUSA_URL}/dashboard`;
    }
  };

  const adminLogin = async (email, password) => {
    try {
      // Admin credentials from environment variables
      const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;
      const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;

      if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        const adminUser = {
          nip: ADMIN_EMAIL,
          nama: "Super Admin",
          email: ADMIN_EMAIL,
          role: "Super Admin",
        };

        setUser(adminUser);
        setIsAuthenticated(true);
        localStorage.setItem("user", JSON.stringify(adminUser));
        localStorage.setItem("admin_auth", "true");
        localStorage.setItem("lastActivity", Date.now().toString());
        sessionStorage.setItem("admin_logout_redirect", "true");
        return true;
      }

      return false;
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
