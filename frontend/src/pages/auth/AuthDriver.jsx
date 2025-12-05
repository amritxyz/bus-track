import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import AuthForm from '../../components/auth/AuthForm';

export default function AuthDriver() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') === 'register' ? 'register' : 'login';

  useEffect(() => {
    document.title = mode === 'register' ? 'Register as Driver' : 'Driver Login';
  }, [mode]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-4xl md:text-5xl font-black text-white">🚌 BusTracker</h1>
        <p className="text-slate-400 mt-2">Butwal’s Bus Tracking System</p>
      </div>
      <AuthForm mode={mode} role="driver" />
      <p className="mt-8 text-slate-500">
        Passenger?{' '}
        <a href="/auth-passenger" className="text-cyan-400 hover:underline">
          Switch here
        </a>
      </p>
    </div>
  );
}
