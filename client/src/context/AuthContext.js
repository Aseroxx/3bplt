import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import axios from 'axios';

import apiConfig from '../config/api';
axios.defaults.baseURL = apiConfig;

const AuthContext = createContext();

// Simple JWT decode function (without verification)
const decodeJWT = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (error) {
    return null;
  }
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef(null);

  // Function to refresh token
  const refreshToken = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return false;

      const response = await axios.post('/api/auth/refresh', {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const { token: newToken, user: userData } = response.data;
      localStorage.setItem('token', newToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      setUser(userData);
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      // If refresh fails, try to fetch user with current token
      // If that also fails, user will be logged out
      return false;
    }
  };

  // Function to check token expiration and refresh if needed
  const checkAndRefreshToken = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const decoded = decodeJWT(token);
      if (!decoded || !decoded.exp) {
        // If we can't decode or no expiration, try to refresh
        await refreshToken();
        return;
      }

      const currentTime = Date.now() / 1000;
      const timeUntilExpiry = decoded.exp - currentTime;

      // Refresh token if it expires in less than 2 minutes (or if already expired)
      if (timeUntilExpiry < 120) {
        await refreshToken();
      }
    } catch (error) {
      // If token is invalid, try to refresh it anyway
      await refreshToken();
    }
  };

  // Set up axios interceptor to refresh token on 403 errors
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // If error is 403 and we haven't already retried
        if (error.response && error.response.status === 403 && !originalRequest._retry) {
          originalRequest._retry = true;

          // Try to refresh the token
          const refreshed = await refreshToken();
          if (refreshed) {
            // Retry the original request with new token
            originalRequest.headers['Authorization'] = `Bearer ${localStorage.getItem('token')}`;
            return axios(originalRequest);
          }
        }

        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  // Set up automatic token refresh
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // Check and refresh immediately
      checkAndRefreshToken();

      // Set up interval to check every minute
      refreshTimerRef.current = setInterval(() => {
        checkAndRefreshToken();
      }, 60000); // Check every minute

      return () => {
        if (refreshTimerRef.current) {
          clearInterval(refreshTimerRef.current);
        }
      };
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUser = async () => {
    try {
      const response = await axios.get('/api/auth/me');
      setUser(response.data.user);
    } catch (error) {
      // If token expired, try to refresh it
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        const refreshed = await refreshToken();
        if (refreshed) {
          // Retry fetching user after refresh
          try {
            const retryResponse = await axios.get('/api/auth/me');
            setUser(retryResponse.data.user);
          } catch (retryError) {
            localStorage.removeItem('token');
            delete axios.defaults.headers.common['Authorization'];
            setUser(null);
          }
        } else {
          localStorage.removeItem('token');
          delete axios.defaults.headers.common['Authorization'];
          setUser(null);
        }
      } else {
        // For network errors or other issues, keep the token and try to continue
        console.error('Error fetching user:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      const response = await axios.post('/api/auth/login', { username, password });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
      
      // Set up token refresh interval after login
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
      refreshTimerRef.current = setInterval(() => {
        checkAndRefreshToken();
      }, 60000); // Check every minute
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed'
      };
    }
  };

  const register = async (username, password) => {
    try {
      const response = await axios.post('/api/auth/register', { username, password });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
      
      // Set up token refresh interval after registration
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
      refreshTimerRef.current = setInterval(() => {
        checkAndRefreshToken();
      }, 60000); // Check every minute
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Registration failed'
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    
    // Clear refresh timer
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  };

  const value = {
    user,
    login,
    register,
    logout,
    loading
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

