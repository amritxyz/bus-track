// src/context/AuthContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../lib/supabase';

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

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen for changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const setSession = async (session) => {
    if (session?.user) {
      // Fetch profile to get role and name if not in metadata
      // Ideally, we trust metadata for speed or fetch profile for accuracy.
      // Let's fetch profile to be sure.
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      setUser({
        id: session.user.id,
        email: session.user.email,
        name: profile?.user_name || session.user.user_metadata?.full_name || session.user.email,
        role: profile?.role || session.user.user_metadata?.role || 'passenger',
      });
      setIsLogged(true);
    } else {
      setUser(null);
      setIsLogged(false);
    }
    setLoading(false);
  };

  const login = async (email, password) => {
    try {
      setError(null);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      return { success: true, user: data.user };
    } catch (err) {
      setError(err.message);
      return { success: false, message: err.message };
    }
  };

  const register = async ({ user_name, email, password, role }) => {
    try {
      setError(null);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: user_name,
            role: role,
          },
        },
      });

      if (error) throw error;

      // Note: If email confirmation is enabled, the user won't be logged in immediately.
      // But for this migration, we assume auto-confirm or user handles it.
      return { success: true, message: 'Registration successful! Please check your email if confirmation is required.' };
    } catch (err) {
      setError(err.message);
      return { success: false, message: err.message };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsLogged(false);
  };

  const value = {
    user,
    isLogged,
    loading,
    error,
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {loading ? <div className="min-h-screen flex items-center justify-center text-white">Loading...</div> : children}
    </AuthContext.Provider>
  );
};
