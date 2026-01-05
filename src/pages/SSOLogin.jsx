import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SSOLogin = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { verifyToken, login, NUSA_URL } = useAuth();
  const [status, setStatus] = useState('verifying'); // verifying, success, failed
  const hasRun = useRef(false);

  useEffect(() => {
    // Prevent duplicate execution
    if (hasRun.current) return;
    hasRun.current = true;

    const handleSSO = async () => {
      try {
        // Extract NIP from JWT token payload first
        const nip = extractNIPFromToken(token);
        
        if (!nip) {
          console.error('Failed to extract NIP from token');
          setStatus('failed');
          return;
        }

        // Verify token with NIP
        const isValid = await verifyToken(token);

        if (!isValid) {
          setStatus('failed');
          return;
        }

        // Login with the NIP
        const loginSuccess = await login(token, nip);

        if (loginSuccess) {
          setStatus('success');
          // Redirect to previous page or dashboard
          const from = location.state?.from?.pathname || '/';
          setTimeout(() => {
            navigate(from, { replace: true });
          }, 1500);
        } else {
          setStatus('failed');
        }
      } catch (error) {
        console.error('SSO Error:', error);
        setStatus('failed');
      }
    };

    handleSSO();
  }, [token]);

  // Helper function to decode JWT and extract NIP from payload
  const extractNIPFromToken = (token) => {
    try {
      // JWT format: header.payload.signature
      const parts = token.split('.');
      
      if (parts.length !== 3) {
        // Not a JWT token, maybe token IS the NIP?
        console.warn('Token is not JWT format');
        return token; // fallback: assume token is NIP itself
      }

      // Decode base64 payload
      const payload = parts[1];
      const decodedPayload = JSON.parse(atob(payload));
      
      // Extract NIP from payload (adjust field name based on your token structure)
      // Common field names: nip, user_id, sub, id, employee_id
      const nip = decodedPayload.nip || 
                  decodedPayload.user_id || 
                  decodedPayload.sub || 
                  decodedPayload.id || 
                  decodedPayload.employee_id;
      
      console.log('Extracted NIP from token:', nip);
      return nip;
    } catch (error) {
      console.error('Failed to extract NIP from token:', error);
      return null;
    }
  };

  const handleBackToNUSA = () => {
    window.location.href = `${NUSA_URL}/dashboard`;
  };

  if (status === 'verifying') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl max-w-md">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto"></div>
          <h2 className="mt-6 text-2xl font-bold text-gray-800 dark:text-white">
            Memverifikasi Token
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Mohon tunggu sebentar...
          </p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl max-w-md">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900">
            <svg
              className="h-10 w-10 text-green-600 dark:text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="mt-6 text-2xl font-bold text-gray-800 dark:text-white">
            Login Berhasil!
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Anda akan dialihkan ke dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-pink-100 dark:from-gray-900 dark:to-gray-800">
      <div className="text-center bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl max-w-md">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 dark:bg-red-900">
          <svg
            className="h-10 w-10 text-red-600 dark:text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
        <h2 className="mt-6 text-2xl font-bold text-gray-800 dark:text-white">
          Login Gagal
        </h2>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Token tidak valid atau telah kadaluarsa
        </p>
        <button
          onClick={handleBackToNUSA}
          className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 cursor-pointer"
        >
          Kembali ke NUSA
        </button>
      </div>
    </div>
  );
};

export default SSOLogin;
