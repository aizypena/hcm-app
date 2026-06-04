import { useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { addDoc, collection, doc, getDoc } from 'firebase/firestore';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const PROJECT_ID = 'hcm-time-tracking-897ad';
const API_URL = `http://localhost:5001/${PROJECT_ID}/us-central1/api`;

export default function Dashboard() {
  const { role } = useAuth();
  const [todaySummary, setTodaySummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [message, setMessage] = useState('');
  const [userName, setUserName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0,10);
  const userId = auth.currentUser?.uid;

  const fetchTodaySummary = async () => {
    if (!userId) return;
    const docRef = doc(db, 'dailySummary', `${userId}_${today}`);
    const snap = await getDoc(docRef);
    if (snap.exists()) setTodaySummary(snap.data());
    else setTodaySummary(null);
  };

  const fetchHistory = async () => {
    if (!userId) return;
    try {
      const res = await axios.get(`${API_URL}/dailySummaries/${userId}`);
      setHistory(res.data);
    } catch (err) {
      console.error('Failed to load history:', err);
      setHistory([]);
    }
  };

  const fetchUserName = async () => {
    if (!userId) return;
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      const data = userDoc.data();
      setUserName(`${data.firstName} ${data.lastName}`);
    }
  };

  const punchIn = async () => {
    setIsLoading(true);
    try {
      await addDoc(collection(db, 'attendance'), { userId, type: 'in', timestamp: new Date() });
      setMessage('Punched in successfully');
      setTimeout(() => setMessage(''), 4000);
      fetchTodaySummary();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const punchOut = async () => {
    setIsLoading(true);
    try {
      await addDoc(collection(db, 'attendance'), { userId, type: 'out', timestamp: new Date() });
      await axios.post(`${API_URL}/computeDailySummary`, { userId, dateStr: today });
      setMessage('Punched out successfully • Summary updated');
      setTimeout(() => {
        fetchTodaySummary();
        fetchHistory();
        setIsLoading(false);
      }, 1000);
    } catch (err) {
      console.error(err);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchTodaySummary();
      fetchHistory();
      fetchUserName();
    }
  }, [userId]);

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen w-full bg-white text-slate-900 antialiased">
      
      {/* Full Width Navigation Header */}
      <nav className="w-full px-6 md:px-8 xl:px-12 py-6 flex flex-row justify-between items-center border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-indigo-600" />
            <h1 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Workspace Dashboard</h1>
          </div>
          {userName && <p className="text-xs text-slate-500 font-medium mt-0.5">{userName}</p>}
        </div>
        <div className="flex items-center gap-5">
          {role === 'admin' && (
            <button 
              onClick={() => navigate('/admin')} 
              className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition cursor-pointer"
            >
              Admin Panel
            </button>
          )}
          <button 
            onClick={handleLogout} 
            className="text-sm font-semibold text-red-600 hover:text-red-500 transition cursor-pointer"
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Main Fluid Grid Split Content Layout */}
      <main className="w-full px-6 md:px-8 xl:px-12 py-10 grid grid-cols-1 lg:grid-cols-12 gap-12">
        
        {/* LEFT COLUMN: Actions and Today Metrics (Fluid 5/12 Width) */}
        <div className="lg:col-span-5 lg:border-r lg:border-slate-100 lg:pr-10">
          <h2 className="text-lg font-bold tracking-tight text-slate-900 mb-5">Shift Tracking</h2>
          
          {/* Main Attendance Buttons */}
          <div className="flex flex-row items-center gap-3 mb-8">
            <button
              onClick={punchIn}
              disabled={isLoading}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-semibold rounded-xl text-sm transition-all duration-150 shadow-sm shadow-indigo-100 disabled:opacity-50 flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              Punch In
            </button>
            <button
              onClick={punchOut}
              disabled={isLoading}
              className="px-6 py-3 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-900 font-semibold rounded-xl text-sm transition-all duration-150 disabled:opacity-50 flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              Punch Out
            </button>
          </div>

          {/* Inline Notification Banner */}
          {message && (
            <div className="mb-8 p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-100/40 text-indigo-700 text-sm flex items-center gap-2.5 max-w-md animate-fade-in">
              <svg className="w-4 h-4 shrink-0 text-indigo-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">{message}</span>
            </div>
          )}

          {/* Today Summary Stack Layout */}
          <div className="mt-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-5">Today's Summary</h3>
            {todaySummary ? (
              <div className="space-y-5 border-t border-slate-100 pt-5">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-medium text-slate-500">Regular hours</span>
                  <span className="text-2xl font-bold text-slate-900">{todaySummary.regularHours?.toFixed(2)}<span className="text-xs text-slate-400 ml-0.5">h</span></span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-medium text-slate-500">Overtime hours</span>
                  <span className="text-2xl font-bold text-slate-900">{todaySummary.overtimeHours?.toFixed(2)}<span className="text-xs text-slate-400 ml-0.5">h</span></span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-medium text-slate-500">Night differential</span>
                  <span className="text-2xl font-bold text-slate-900">{todaySummary.nightDiffHours?.toFixed(2)}<span className="text-xs text-slate-400 ml-0.5">h</span></span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-medium text-slate-500">Late arrivals</span>
                  <span className="text-2xl font-bold text-amber-600">{todaySummary.lateMinutes?.toFixed(0)}<span className="text-xs text-slate-400 ml-0.5">m</span></span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-medium text-slate-500">Undertime balance</span>
                  <span className="text-2xl font-bold text-slate-900">{todaySummary.undertimeMinutes?.toFixed(0)}<span className="text-xs text-slate-400 ml-0.5">m</span></span>
                </div>
              </div>
            ) : (
              <div className="text-left text-slate-400 text-sm font-medium pt-2">
                No timestamps logged for today. Start activity recording with the parameters above.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Historical Log Matrix (Fluid 7/12 Width) */}
        <div className="lg:col-span-7">
          <h2 className="text-lg font-bold tracking-tight text-slate-900 mb-5">Daily History</h2>
          
          {history.length === 0 ? (
            <div className="border-t border-slate-100 pt-5 text-left text-slate-400 text-sm font-medium">
              No previous lifecycle metrics compiled for this profile node.
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Date</th>
                    <th className="pb-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Regular</th>
                    <th className="pb-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">OT</th>
                    <th className="pb-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Night Diff</th>
                    <th className="pb-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Late</th>
                    <th className="pb-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Undertime</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {history.map(day => (
                    <tr key={day.date} className="hover:bg-slate-50/40 transition">
                      <td className="py-3 text-slate-900 font-medium text-left">{day.date}</td>
                      <td className="py-3 text-slate-600 text-left">{day.regularHours?.toFixed(2)}h</td>
                      <td className="py-3 text-slate-600 text-left">{day.overtimeHours?.toFixed(2)}h</td>
                      <td className="py-3 text-slate-600 text-left">{day.nightDiffHours?.toFixed(2)}h</td>
                      <td className="py-3 text-slate-600 text-left text-amber-600 font-medium">{day.lateMinutes?.toFixed(0)}m</td>
                      <td className="py-3 text-slate-600 text-left">{day.undertimeMinutes?.toFixed(0)}m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
