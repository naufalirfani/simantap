import { createContext, useContext, useState, useEffect } from 'react';
import { encryptTokenForHeader } from '../services/apiService';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
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

  // Check if user is already logged in and verify token
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const storedUser = localStorage.getItem('user');
        const storedToken = localStorage.getItem('sso_token');

        if (storedUser && storedToken) {
          // Verify token on every page load/reload
          const isValid = await verifyToken(storedToken);
          
          if (isValid) {
            setUser(JSON.parse(storedUser));
            setIsAuthenticated(true);
          } else {
            // Token expired or invalid, clear and redirect
            console.log('Token expired or invalid, redirecting to NUSA');
            localStorage.removeItem('user');
            localStorage.removeItem('sso_token');
            setUser(null);
            setIsAuthenticated(false);
            window.location.href = `${NUSA_URL}/dashboard`;
            return;
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('sso_token');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const verifyToken = async (token) => {
    try {
      console.log('Verifying token...');
      const encryptedToken = await encryptTokenForHeader(API_TOKEN, { salt: API_TOKEN });
      const response = await fetch(`${API_BASE_URL}/sso/verify/${token}`, {
        headers: {
          'X-API-Token': encryptedToken,
        },
      });

      const data = await response.json();
      return data.status === true;
    } catch (error) {
      console.error('Token verification error:', error);
      return false;
    }
  };

  const fetchUserData = async (nip) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/pegawai/${nip}`, {
        headers: {
          'X-API-Token': API_TOKEN,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }

      const userData = await response.json();
      return userData;
    } catch (error) {
      console.error('Fetch user data error:', error);
      throw error;
    }
  };

  const login = async (token, nip) => {
    try {
      const userData = await fetchUserData(nip);
      setUser(userData);
      setIsAuthenticated(true);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('sso_token', token);
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('user');
    localStorage.removeItem('sso_token');
    window.location.href = `${NUSA_URL}/dashboard`;
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    verifyToken,
    login,
    logout,
    NUSA_URL,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
