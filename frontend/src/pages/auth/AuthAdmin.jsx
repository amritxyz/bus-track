// src/pages/auth/AuthAdmin.jsx
import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import AuthForm from '../../components/auth/AuthForm'; // Reuse the existing form component

export default function AuthAdmin() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') === 'register' ? 'register' : 'login';

  // Admins are predefined, so we only show login
  useEffect(() => {
    document.title = 'Admin Login';
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-4xl md:text-5xl font-black text-white">BusTracker Admin</h1>
        <p className="text-slate-400 mt-2">Butwal's Bus Tracking System</p>
      </div>
      {/* Force mode to 'login' and role to 'admin' for this page */}
      <AuthForm mode="login" role="admin" />
      <p className="mt-8 text-slate-500">
        Driver?{' '}
        <a href="/auth-driver" className="text-cyan-400 hover:underline">
          Switch here
        </a>
      </p>
    </div>
  );
}
