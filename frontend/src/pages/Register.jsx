import { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useNavigate, Link } from 'react-router-dom';

export default function Register() {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'employee',
    timezone: 'Asia/Manila',
    start: '09:00',
    end: '18:00'
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const getFriendlyErrorMessage = (errorCode) => {
    switch (errorCode) {
      case 'auth/email-already-in-use':
        return 'This email address is already registered.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters.';
      default:
        return 'Something went wrong. Please try again.';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const userCred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      await setDoc(doc(db, 'users', userCred.user.uid), {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        role: form.role,
        timezone: form.timezone,
        schedule: { start: form.start, end: form.end }
      });
      navigate('/');
    } catch (err) {
      setError(getFriendlyErrorMessage(err.code || err.message));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center bg-white p-6 antialiased">
      <div className="w-full max-w-xl flex flex-col justify-between min-h-[580px]">
        
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-600 rounded-xl mb-4 shadow-md shadow-indigo-100">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Create account</h2>
          <p className="text-slate-500 text-sm mt-2">Sign up to get started with your account</p>
        </div>

        {/* Input/Form Area - Left Aligned */}
        <div className="flex-1 text-left">
          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-start gap-2.5">
              <svg className="w-5 h-5 shrink-0 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
            <div>
              <label className="block text-slate-700 text-sm font-medium mb-1.5 text-left">First name</label>
              <input
                type="text"
                disabled={isLoading}
                placeholder="John"
                value={form.firstName}
                onChange={(e) => setForm({...form, firstName: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 border border-transparent rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition disabled:opacity-60 disabled:cursor-not-allowed text-sm text-left"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 text-sm font-medium mb-1.5 text-left">Last name</label>
              <input
                type="text"
                disabled={isLoading}
                placeholder="Doe"
                value={form.lastName}
                onChange={(e) => setForm({...form, lastName: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 border border-transparent rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition disabled:opacity-60 disabled:cursor-not-allowed text-sm text-left"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 text-sm font-medium mb-1.5 text-left">Email address</label>
              <input
                type="email"
                disabled={isLoading}
                placeholder="you@company.com"
                value={form.email}
                onChange={(e) => setForm({...form, email: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 border border-transparent rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition disabled:opacity-60 disabled:cursor-not-allowed text-sm text-left"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 text-sm font-medium mb-1.5 text-left">Password</label>
              <input
                type="password"
                disabled={isLoading}
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({...form, password: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 border border-transparent rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition disabled:opacity-60 disabled:cursor-not-allowed text-sm text-left"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 text-sm font-medium mb-1.5 text-left">Role</label>
              <select
                disabled={isLoading}
                value={form.role}
                onChange={(e) => setForm({...form, role: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 border border-transparent rounded-xl text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition disabled:opacity-60 disabled:cursor-not-allowed text-sm text-left appearance-none"
              >
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 text-sm font-medium mb-1.5 text-left">Timezone</label>
              <input
                type="text"
                disabled={isLoading}
                value={form.timezone}
                onChange={(e) => setForm({...form, timezone: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 border border-transparent rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition disabled:opacity-60 disabled:cursor-not-allowed text-sm text-left"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 text-sm font-medium mb-1.5 text-left">Shift start (HH:MM)</label>
              <input
                type="text"
                disabled={isLoading}
                value={form.start}
                onChange={(e) => setForm({...form, start: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 border border-transparent rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition disabled:opacity-60 disabled:cursor-not-allowed text-sm text-left"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 text-sm font-medium mb-1.5 text-left">Shift end (HH:MM)</label>
              <input
                type="text"
                disabled={isLoading}
                value={form.end}
                onChange={(e) => setForm({...form, end: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 border border-transparent rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition disabled:opacity-60 disabled:cursor-not-allowed text-sm text-left"
                required
              />
            </div>

            <div className="md:col-span-2 mt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-semibold rounded-xl transition-all duration-150 shadow-sm hover:shadow-md shadow-indigo-200 disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100 flex justify-center items-center gap-2 text-sm pt-3"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creating account...
                  </>
                ) : (
                  'Register'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Global Footer Actions */}
        <div className="mt-8 text-center space-y-4">
          <p className="text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-500 transition">
              Sign in
            </Link>
          </p>
          <p className="text-slate-400 text-xs">Secure login system</p>
        </div>

      </div>
    </div>
  );
}
