// src/components/auth/AuthForm.jsx
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const AuthForm = ({ mode = 'login', role }) => {
  const [formData, setFormData] = useState({
    user_name: '',
    email: '',
    password: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, register, error } = useAuth();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (mode === 'login') {
      // Special handling for admin login
      let loginRole = role;
      if (formData.email === 'admin@mail.com' && formData.password === 'admin') {
        loginRole = 'admin'; // Override role if admin credentials are used
      }

      const result = await login(formData.email, formData.password, loginRole);
      if (result.success) {
        // Redirect based on role
        let redirectPath = '/';
        if (loginRole === 'driver') {
          redirectPath = '/dashboard/driver';
        } else if (loginRole === 'passenger') {
          redirectPath = '/dashboard/passenger';
        } else if (loginRole === 'admin') {
          redirectPath = '/dashboard/admin'; // Add this route
        }
        window.location.href = redirectPath;
      }
    } else {
      // Registration logic remains the same
      const result = await register({ ...formData, role });
      if (result.success) {
        alert('Registration successful! Please log in.');
        window.location.href = `/auth-${role}`;
      }
    }

    setIsSubmitting(false);
  };

  // Show different message for admin
  const isLoginPage = mode === 'login';
  const isLoginPageForAdmin = isLoginPage && role === 'admin';

  return (
    <div className="w-full max-w-md bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700 shadow-2xl">
      <h2 className="text-3xl font-bold text-center mb-2">
        {isLoginPageForAdmin ? 'Admin Sign In' : (
          isLoginPage ? 'Sign In' : 'Create Account'
        )} as {isLoginPageForAdmin ? 'Admin' : (role === 'driver' ? 'Driver' : 'Passenger')}
      </h2>
      <p className="text-slate-400 text-center mb-8">
        {isLoginPageForAdmin
          ? 'Enter your admin credentials.'
          : isLoginPage
            ? `Welcome back, ${role}!`
            : `Join BusTracker as a ${role}`
        }
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 text-red-300 rounded-lg text-center">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {mode === 'register' && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Full Name</label>
            <input
              type="text"
              name="user_name"
              value={formData.user_name}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 bg-slate-900/70 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white"
              placeholder="e.g., Ram Sharma"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 bg-slate-900/70 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            minLength="6"
            className="w-full px-4 py-3 bg-slate-900/70 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full py-3 px-4 rounded-xl font-semibold transition-all ${isSubmitting
            ? 'bg-slate-600 cursor-not-allowed'
            : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-lg hover:shadow-cyan-500/30'
            }`}
        >
          {isSubmitting ? 'Processing...' : mode === 'register' ? 'Register' : 'Sign In'}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-slate-500">
        {mode === 'login' ? (
          <>
            {role !== 'admin' && ( // Don't show register link on admin page
              <>
                New here?{' '}
                <button
                  type="button"
                  onClick={() => (window.location.href = `/auth-${role}?mode=register`)}
                  className="text-cyan-400 hover:underline"
                >
                  Create an account
                </button>
              </>
            )}
          </>
        ) : (
          <>
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => (window.location.href = `/auth-${role}`)}
              className="text-cyan-400 hover:underline"
            >
              Sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthForm;
