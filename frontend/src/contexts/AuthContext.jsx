// src/context/AuthContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

export const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);         // { id, email, name, role }
  const [isLogged, setIsLogged] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isTokenExpired = (token) => {
    if (!token) return true;
    try {
      const decoded = jwtDecode(token);
      return decoded.exp ? decoded.exp * 1000 < Date.now() : false;
    } catch {
      return true;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setIsLogged(false);
    setError(null);
  };

  // Get auth headers with token
  const getAuthHeader = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token && !isTokenExpired(token)) {
      try {
        const decoded = jwtDecode(token);
        setUser({
          id: decoded.id,
          email: decoded.email,
          name: decoded.name,
          role: decoded.role, // 👈 crucial
        });
        setIsLogged(true);
      } catch (err) {
        console.error('Invalid token', err);
        logout();
      }
    } else {
      logout();
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (res) => res,
      (err) => {
        if (err.response?.status === 401) {
          logout();
          if (!window.location.pathname.startsWith('/auth')) {
            window.location.href = '/'; // or redirect to home
          }
        }
        return Promise.reject(err);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  // login with optional role (for role-specific endpoints or validation)
  const login = async (email, password, role = null) => {
    try {
      setError(null);
      //   use same /login endpoint and infer role from JWT claim, OR
      const response = await axios.post('http://localhost:5000/login', { email, password });

      const { token } = response.data;
      localStorage.setItem('token', token);

      const decoded = jwtDecode(token);
      const userData = {
        id: decoded.id,
        email: decoded.email,
        name: decoded.name,
        role: decoded.role, // e.g., 'driver' or 'passenger'
      };

      setUser(userData);
      setIsLogged(true);
      return { success: true, user: userData };
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed';
      setError(msg);
      return { success: false, message: msg };
    }
  };

  // register with role
  const register = async ({ user_name, email, password, role }) => {
    try {
      setError(null);
      // Send role to backend during registration!
      const response = await axios.post('http://localhost:5000/register', {
        user_name,
        email,
        password,
        role,
      });
      return { success: true, message: response.data.message || 'Registration successful' };
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed';
      setError(msg);
      return { success: false, message: msg };
    }
  };

  const value = {
    user,
    isLogged,
    loading,
    error,
    login,
    register,
    logout,
    getAuthHeader, // convenient for API calls
  };

  return (
    <AuthContext.Provider value={value}>
      {loading ? <div className="min-h-screen flex items-center justify-center text-white">Loading...</div> : children}
    </AuthContext.Provider>
  );
};
