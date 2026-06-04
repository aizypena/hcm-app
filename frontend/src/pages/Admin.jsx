import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';

const PROJECT_ID = 'hcm-time-tracking-897ad';
const API_URL = `http://localhost:5001/${PROJECT_ID}/us-central1/api`;

const getToken = async () => {
  const user = auth.currentUser;
  if (!user) return null;
  return await user.getIdToken();
};

const toLocalDatetimeLocal = (utcDate) => {
  const d = new Date(utcDate);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const toUTCISO = (localDateTime) => {
  if (!localDateTime.includes('T')) return new Date(localDateTime).toISOString();
  const [datePart, timePart] = localDateTime.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  const localDate = new Date(year, month - 1, day, hour, minute);
  return localDate.toISOString();
};

export default function Admin() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [report, setReport] = useState([]);
  const [punches, setPunches] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [editingPunch, setEditingPunch] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [isPunchesLoading, setIsPunchesLoading] = useState(false);
  const navigate = useNavigate();

  const fetchUsers = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await axios.get(`${API_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const users = res.data.map(u => ({ id: u.id, name: `${u.firstName} ${u.lastName}` }));
      setUsersList(users);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const loadWeeklyReport = async () => {
    if (!startDate || !endDate) return;
    setIsReportLoading(true);
    try {
      const token = await getToken();
      const res = await axios.get(`${API_URL}/admin/weeklyReport`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { startDate, endDate }
      });
      setReport(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsReportLoading(false);
    }
  };

  const loadPunches = async () => {
    setIsPunchesLoading(true);
    const params = {};
    if (selectedUserId) params.userId = selectedUserId;
    if (selectedDate) params.date = selectedDate;
    try {
      const token = await getToken();
      const res = await axios.get(`${API_URL}/admin/punches`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      setPunches(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsPunchesLoading(false);
    }
  };

  const updatePunch = async (id, type, localDateTime) => {
    try {
      const token = await getToken();
      const utcTimestamp = toUTCISO(localDateTime);
      await axios.put(`${API_URL}/admin/punch/${id}`, { type, timestamp: utcTimestamp }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEditingPunch(null);
      loadPunches();
    } catch (err) {
      console.error(err);
    }
  };

  const deletePunch = async (id) => {
    if (!window.confirm('Delete this punch?')) return;
    try {
      const token = await getToken();
      await axios.delete(`${API_URL}/admin/punch/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadPunches();
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <div className="min-h-screen w-full bg-white text-slate-900 antialiased">
      
      {/* Navigation Header */}
      <nav className="max-w-[1600px] mx-auto px-6 py-6 flex flex-row justify-between items-center border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-indigo-600" />
            <h1 className="text-base font-bold text-slate-900 uppercase tracking-wider">Reports Console</h1>
          </div>
          <p className="text-sm text-slate-500 font-medium mt-0.5">Global operations panel</p>
        </div>
        <div>
          <button
            onClick={() => navigate('/')}
            className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>
      </nav>

      {/* Main Workspace Multi-column Grid Split */}
      <main className="max-w-[1600px] mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* LEFT COLUMN: Weekly Reports Section (Takes 7/12 Width) */}
        <div className="lg:col-span-7 border-r border-slate-100 pr-2 lg:pr-8">
          <h2 className="text-lg font-bold tracking-tight text-slate-900 mb-4">Weekly Time Summary</h2>
          
          {/* Filters Row */}
          <div className="flex flex-wrap gap-3 items-end mb-8">
            <input 
              type="date" 
              className="px-3 py-1.5 bg-slate-50 border border-transparent rounded-xl text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition text-sm cursor-pointer" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)} 
            />
            <input 
              type="date" 
              className="px-3 py-1.5 bg-slate-50 border border-transparent rounded-xl text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition text-sm cursor-pointer" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)} 
            />
            <button 
              onClick={loadWeeklyReport} 
              disabled={isReportLoading || !startDate || !endDate}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition shadow-sm shadow-indigo-100 cursor-pointer disabled:opacity-50"
            >
              {isReportLoading ? 'Loading...' : 'Generate'}
            </button>
          </div>

          {/* Report Data Matrix Display */}
          {report.map(emp => (
            <div key={emp.userId} className="mb-10 animate-fade-in">
              <h3 className="text-base font-bold text-slate-800 mb-3 text-left">{emp.firstName} {emp.lastName}</h3>
              <div className="w-full overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Date</th>
                      <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Regular</th>
                      <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">OT</th>
                      <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">ND</th>
                      <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Late</th>
                      <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Undertime</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {emp.days.map(day => (
                      <tr key={day.date} className="hover:bg-slate-50/30 transition">
                        <td className="py-2.5 text-slate-900 font-medium text-left">{day.date}</td>
                        <td className="py-2.5 text-slate-600 text-left">{day.regularHours?.toFixed(2)}h</td>
                        <td className="py-2.5 text-slate-600 text-left">{day.overtimeHours?.toFixed(2)}h</td>
                        <td className="py-2.5 text-slate-600 text-left">{day.nightDiffHours?.toFixed(2)}h</td>
                        <td className="py-2.5 text-slate-600 text-left">{day.lateMinutes?.toFixed(0)}m</td>
                        <td className="py-2.5 text-slate-600 text-left">{day.undertimeMinutes?.toFixed(0)}m</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {report.length === 0 && (
            <div className="text-left text-slate-400 text-sm font-medium mt-6">
              Enter start and end bounds to compile systemic employee performance logs.
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Punches Management Node (Takes 5/12 Width) */}
        <div className="lg:col-span-5">
          <h2 className="text-lg font-bold tracking-tight text-slate-900 mb-4">Manage Punches</h2>
          
          {/* Direct Controls Form Row */}
          <div className="flex flex-wrap gap-3 items-end mb-8">
            <select
              className="px-3 py-1.5 bg-slate-50 border border-transparent rounded-xl text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition text-sm cursor-pointer appearance-none"
              value={selectedUserId}
              onChange={e => setSelectedUserId(e.target.value)}
            >
              <option value="">All Users</option>
              {usersList.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <input
              type="date"
              className="px-3 py-1.5 bg-slate-50 border border-transparent rounded-xl text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition text-sm cursor-pointer"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
            />
            <button 
              onClick={loadPunches} 
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold rounded-xl text-sm transition cursor-pointer"
            >
              {isPunchesLoading ? 'Loading...' : 'Load'}
            </button>
          </div>

          {/* Activity Logs Table */}
          {punches.length > 0 ? (
            <div className="w-full overflow-x-auto animate-fade-in">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">User ID</th>
                    <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Type</th>
                    <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Timestamp</th>
                    <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {punches.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/30 transition">
                      <td className="py-3 text-slate-500 text-left font-mono">{p.userId.slice(0, 8)}...</td>
                      <td className="py-3 text-left font-medium">
                        {editingPunch === p.id ? (
                          <select
                            className="px-2 py-1 border border-slate-200 rounded-lg text-xs cursor-pointer bg-white"
                            value={p.type}
                            onChange={e =>
                              setPunches(prev =>
                                prev.map(pc => (pc.id === p.id ? { ...pc, type: e.target.value } : pc))
                              )
                            }
                          >
                            <option value="in">In</option>
                            <option value="out">Out</option>
                          </select>
                        ) : (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold uppercase tracking-wider ${p.type === 'in' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                            {p.type}
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-slate-600 text-left">
                        {editingPunch === p.id ? (
                          <input
                            type="datetime-local"
                            className="px-2 py-1 border border-slate-200 rounded-lg text-xs cursor-pointer bg-white focus:outline-none"
                            defaultValue={toLocalDatetimeLocal(p.timestamp)}
                            onChange={e =>
                              setPunches(prev =>
                                prev.map(pc => (pc.id === p.id ? { ...pc, timestamp: e.target.value } : pc))
                              )
                            }
                          />
                        ) : (
                          new Date(p.timestamp).toLocaleString()
                        )}
                      </td>
                      <td className="py-3 text-right space-x-2 text-xs font-semibold">
                        {editingPunch === p.id ? (
                          <button
                            onClick={() => updatePunch(p.id, p.type, p.timestamp)}
                            className="text-green-600 hover:text-green-700 cursor-pointer"
                          >
                            Save
                          </button>
                        ) : (
                          <button
                            onClick={() => setEditingPunch(p.id)}
                            className="text-indigo-600 hover:text-indigo-700 cursor-pointer"
                          >
                            Edit
                          </button>
                        )}
                        <button 
                          onClick={() => deletePunch(p.id)} 
                          className="text-red-500 hover:text-red-600 cursor-pointer"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-left text-slate-400 text-sm font-medium mt-6">
              Query structural parameters above to view or manipulate target timestamps.
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
