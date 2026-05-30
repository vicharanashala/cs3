import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lock, LayoutDashboard, Flame, PenLine, X, 
  AlertTriangle, RefreshCw, CheckCircle, TrendingUp, Search, Hash, UserCheck, Trash2 
} from 'lucide-react';
import { useApp } from '../store/AppContext';
import { 
  getAdminHeatmap, getAdminGaps, getAdminRageSessions, createFAQ,
  getAdminQueue, adminReviewQueueItem, adminDeleteCommunityHash
} from '../services/api';

export function AdminDashboard() {
  const { isLoading, setIsLoading } = useApp();
  
  // Auth Gate state
  const [adminKey, setAdminKey] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authError, setAuthError] = useState('');

  // Dashboard Data states
  const [heatmapData, setHeatmapData] = useState([]);
  const [gapsData, setGapsData] = useState([]);
  const [rageSessions, setRageSessions] = useState([]);

  // Community Queue states
  const [queueItems, setQueueItems] = useState([]);
  const [hashSearch, setHashSearch] = useState('');
  const [queueLoading, setQueueLoading] = useState(false);

  // Modal and Toast states
  const [draftFaq, setDraftFaq] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  // 1. Auth Gate Verification on mount
  useEffect(() => {
    const key = localStorage.getItem('adminKey');
    if (key) {
      setIsAuthorized(true);
      fetchDashboardData();
      fetchQueue();
    }
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (!adminKey.trim()) return;
    
    // Store temporarily and test fetching dashboard data
    localStorage.setItem('adminKey', adminKey);
    setIsAuthorized(true);
    fetchDashboardData(adminKey);
    fetchQueue();
  };

  const handleLogout = () => {
    localStorage.removeItem('adminKey');
    setIsAuthorized(false);
    setAdminKey('');
    setHeatmapData([]);
    setGapsData([]);
    setRageSessions([]);
  };

  // 2. Fetch Dashboard Analytics
  const fetchDashboardData = async (testedKey = null) => {
    setIsLoading(true);
    setAuthError('');
    try {
      const [heatmapRes, gapsRes, rageRes] = await Promise.all([
        getAdminHeatmap(),
        getAdminGaps(),
        getAdminRageSessions()
      ]);

      if (heatmapRes.success) setHeatmapData(heatmapRes.data);
      if (gapsRes.success) setGapsData(gapsRes.data);
      if (rageRes.success) setRageSessions(rageRes.data);
    } catch (err) {
      console.error(err);
      setAuthError('Unauthorized or invalid admin key.');
      // If error occurs, clear localStorage and force login prompt
      localStorage.removeItem('adminKey');
      setIsAuthorized(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch Community Queue
  const fetchQueue = async (hash) => {
    setQueueLoading(true);
    try {
      const res = await getAdminQueue(hash || undefined);
      if (res.success) setQueueItems(res.data);
    } catch (err) {
      console.error('Queue fetch failed:', err);
    } finally {
      setQueueLoading(false);
    }
  };

  const handleQueueAction = async (id, action) => {
    try {
      await adminReviewQueueItem(id, action);
      showToast(action === 'approve' ? 'Answer approved & written to FAQ!' : 'Answer rejected.');
      fetchQueue(hashSearch || undefined);
    } catch (err) {
      showToast('Action failed.');
    }
  };

  const handleDeleteHash = async (hash) => {
    try {
      await adminDeleteCommunityHash(hash);
      showToast(`Hash ${hash} deleted.`);
      fetchQueue(hashSearch || undefined);
    } catch (err) {
      showToast('Delete failed.');
    }
  };

  // 3. Rage Sessions auto-refresh (60 seconds)
  useEffect(() => {
    if (!isAuthorized) return;

    const interval = setInterval(async () => {
      try {
        const rageRes = await getAdminRageSessions();
        if (rageRes.success) {
          setRageSessions(rageRes.data);
        }
      } catch (err) {
        console.error('Rage session auto-refresh failed:', err);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [isAuthorized]);

  // 4. Draft FAQ Submission
  const handleDraftSubmit = async (e) => {
    e.preventDefault();
    if (!draftFaq.question || !draftFaq.answer) return;

    setIsLoading(true);
    try {
      const res = await createFAQ({
        question: draftFaq.question,
        answer: draftFaq.answer,
        category: draftFaq.category,
        risk_level: draftFaq.risk_level,
        is_onboarding_faq: draftFaq.is_onboarding_faq
      });

      if (res.success) {
        setDraftFaq(null);
        showToast('FAQ created successfully');
        // Refresh knowledge gaps
        const gapsRes = await getAdminGaps();
        if (gapsRes.success) setGapsData(gapsRes.data);
      }
    } catch (err) {
      console.error(err);
      showToast('Error creating FAQ. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  // Extract unique categories for draft FAQ dropdown
  const categoryOptions = Array.from(new Set([
    ...heatmapData.map(h => h.category),
    'General', 'Database', 'Authentication', 'API', 'Deployment'
  ])).filter(Boolean);

  // Render Auth Gate Prompt
  if (!isAuthorized) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white border border-gray-200 rounded-lg p-8 shadow-md w-full max-w-sm text-center space-y-6"
        >
          <div className="mx-auto w-12 h-12 bg-gray-50 border border-gray-200 flex items-center justify-center rounded-full text-[#111827]">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#111827]">Commander Access</h2>
            <p className="text-xs text-gray-400 mt-1">Please enter your system access key to unlock dashboard parameters.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              placeholder="Enter admin key"
              className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] text-sm text-center"
              required
            />
            {authError && <p className="text-xs text-red-600 font-semibold">{authError}</p>}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-[#111827] hover:bg-black text-white rounded-md text-sm font-bold transition"
            >
              Verify Credentials
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Dashboard Sticky Header */}
      <div className="flex justify-between items-center border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#111827]">Admin Metrics & Analytics</h1>
          <p className="text-xs text-gray-500 mt-1">Semantic vector accuracy logs, knowledge gap metrics, and rage detectors.</p>
        </div>
        <div className="flex space-x-3 items-center">
          <button 
            onClick={() => fetchDashboardData()}
            className="p-2 border border-gray-200 rounded-md hover:bg-gray-50 transition text-gray-500"
            title="Reload Data"
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleLogout}
            className="px-3.5 py-1.5 border border-red-200 text-red-700 rounded-md hover:bg-red-50 text-xs font-semibold transition"
          >
            Lock Terminal
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-20 right-6 z-50 bg-[#F5FFF7] border border-green-200 text-green-800 p-4 rounded-lg flex items-center space-x-2 text-sm shadow-md"
          >
            <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
            <span className="font-medium">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SECTION 3: RAGE SESSIONS ALERT (Renders only if active) */}
      <AnimatePresence>
        {rageSessions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-red-50 border border-red-200 text-red-950 p-6 rounded-lg shadow-sm space-y-3"
          >
            <div className="flex items-center space-x-2.5">
              <Flame className="w-5 h-5 text-red-600 animate-bounce" />
              <h3 className="font-bold text-sm tracking-tight uppercase">Stuck Users Detected (Rage Sessions)</h3>
            </div>
            <p className="text-xs text-red-700">
              The following users have queried the vectors repeatedly without receiving successful matches (confidence &lt; 70%):
            </p>
            <div className="space-y-2.5 mt-2 bg-white/40 border border-red-100 rounded-md p-4">
              {rageSessions.map((session, index) => (
                <div key={index} className="flex justify-between items-center text-xs border-b border-red-100 last:border-0 pb-2 last:pb-0">
                  <span className="font-semibold text-red-950">"{session.query_text}"</span>
                  <span className="bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded text-[10px]">
                    {session.attempts} attempts — Started: {new Date(session.start_time).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SECTION 1: CONFIDENCE HEATMAP */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm space-y-4">
        <div className="flex items-center space-x-2 border-b border-gray-100 pb-3">
          <TrendingUp className="w-4 h-4 text-[#111827]" />
          <h3 className="text-sm font-bold uppercase tracking-tight text-gray-500">Confidence Heatmap</h3>
        </div>

        {heatmapData.length === 0 ? (
          <p className="text-xs text-gray-400 py-4 text-center">No search query analytics found.</p>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-md">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 border-b border-gray-200 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Avg Confidence Match</th>
                  <th className="py-3 px-4">Volume</th>
                </tr>
              </thead>
              <tbody>
                {heatmapData.map((row, index) => {
                  const conf = parseFloat(row.avg_confidence);
                  let cellStyle = { backgroundColor: '#FFF5F5', color: '#991b1b' }; // red < 0.70
                  if (conf >= 0.85) cellStyle = { backgroundColor: '#F0FFF4', color: '#166534' }; // green
                  else if (conf >= 0.70) cellStyle = { backgroundColor: '#FFFBEB', color: '#92400e' }; // amber

                  return (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition">
                      <td className="py-3 px-4 font-semibold text-[#111827]">{row.category || 'General'}</td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 rounded-full font-bold" style={cellStyle}>
                          {Math.round(conf * 100)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-500 font-medium">{row.volume} matches</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 2: KNOWLEDGE GAPS */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm space-y-4">
        <div className="flex items-center space-x-2 border-b border-gray-100 pb-3">
          <AlertTriangle className="w-4 h-4 text-[#111827]" />
          <h3 className="text-sm font-bold uppercase tracking-tight text-gray-500">Knowledge Gaps (Failed Searches)</h3>
        </div>

        {gapsData.length === 0 ? (
          <p className="text-xs text-gray-400 py-4 text-center">No knowledge gaps detected. Vector indexing is healthy.</p>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-md">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 border-b border-gray-200 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Failed Search Query</th>
                  <th className="py-3 px-4">Frequency</th>
                  <th className="py-3 px-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {gapsData.map((row, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition">
                    <td className="py-3 px-4 font-medium text-[#111827]">"{row.query_text}"</td>
                    <td className="py-3 px-4 text-gray-500">{row.frequency} sessions</td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => setDraftFaq({
                          question: row.query_text,
                          answer: '',
                          category: categoryOptions[0] || 'General',
                          risk_level: 'low',
                          is_onboarding_faq: false
                        })}
                        className="flex items-center space-x-1.5 text-xs text-[#111827] hover:underline font-semibold"
                      >
                        <PenLine className="w-3.5 h-3.5" />
                        <span>Draft FAQ</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DRAFT FAQ MODAL */}
      <AnimatePresence>
        {draftFaq && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 12 }}
              className="bg-white border border-gray-200 rounded-lg shadow-xl w-full max-w-lg overflow-hidden relative"
            >
              <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                <h3 className="font-bold text-lg text-[#111827]">Draft New FAQ</h3>
                <button
                  onClick={() => setDraftFaq(null)}
                  className="p-1 text-gray-400 hover:text-[#111827] transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleDraftSubmit} className="p-6 space-y-4">
                {/* Question */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Question Text
                  </label>
                  <input
                    type="text"
                    value={draftFaq.question}
                    onChange={(e) => setDraftFaq(prev => ({ ...prev, question: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#111827] text-sm"
                    required
                    disabled={isLoading}
                  />
                </div>

                {/* Answer */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Answer Text
                  </label>
                  <textarea
                    rows="4"
                    value={draftFaq.answer}
                    onChange={(e) => setDraftFaq(prev => ({ ...prev, answer: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#111827] text-sm"
                    required
                    disabled={isLoading}
                  />
                </div>

                {/* Category & Risk grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Category
                    </label>
                    <select
                      value={draftFaq.category}
                      onChange={(e) => setDraftFaq(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#111827] text-sm"
                      disabled={isLoading}
                    >
                      {categoryOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Risk Level
                    </label>
                    <select
                      value={draftFaq.risk_level}
                      onChange={(e) => setDraftFaq(prev => ({ ...prev, risk_level: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#111827] text-sm"
                      disabled={isLoading}
                    >
                      <option value="low">Low Risk</option>
                      <option value="medium">Medium Risk</option>
                      <option value="high">High Risk</option>
                    </select>
                  </div>
                </div>

                {/* Toggle switch onboarding */}
                <div className="flex items-center space-x-3 py-2">
                  <input
                    type="checkbox"
                    id="is_onboarding_faq"
                    checked={draftFaq.is_onboarding_faq}
                    onChange={(e) => setDraftFaq(prev => ({ ...prev, is_onboarding_faq: e.target.checked }))}
                    className="w-4 h-4 accent-[#111827] border-gray-300 rounded focus:ring-0 cursor-pointer"
                    disabled={isLoading}
                  />
                  <label htmlFor="is_onboarding_faq" className="text-xs font-semibold text-gray-600 cursor-pointer">
                    Display in Onboarding checklist?
                  </label>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-[#111827] hover:bg-black text-white rounded-md text-sm font-bold transition disabled:opacity-40"
                >
                  {isLoading ? 'Generating Vector Embeddings...' : 'Publish Knowledge Record'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SECTION 4: COMMUNITY MODERATION QUEUE */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center space-x-2">
            <UserCheck className="w-4 h-4 text-[#111827]" />
            <h3 className="text-sm font-bold uppercase tracking-tight text-gray-500">Community Moderation Queue</h3>
          </div>
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Hash className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by hash..."
                value={hashSearch}
                onChange={(e) => setHashSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchQueue(hashSearch)}
                className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#111827] w-40"
              />
            </div>
            <button
              onClick={() => fetchQueue(hashSearch || undefined)}
              className="p-1.5 border border-gray-200 rounded-md hover:bg-gray-50 transition text-gray-500"
              title="Search Queue"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => { setHashSearch(''); fetchQueue(); }}
              className="text-[10px] text-gray-500 hover:text-[#111827] underline font-semibold"
            >
              Show All
            </button>
          </div>
        </div>

        {queueLoading ? (
          <p className="text-xs text-gray-400 py-4 text-center">Loading queue...</p>
        ) : queueItems.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-xs text-gray-400">No pending community answers to review.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {queueItems.map(item => (
              <div key={item.id} className="border border-amber-200 bg-amber-50/50 rounded-lg p-4 space-y-3">
                {/* Header row */}
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="bg-amber-100 text-amber-800 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded">Pending Review</span>
                      <span className="bg-gray-100 text-gray-600 text-[9px] font-mono px-2 py-0.5 rounded">#{item.hash_id}</span>
                      <span className="text-[10px] text-gray-400">conf: {Math.round((item.yaksha_confidence || 0) * 100)}%</span>
                    </div>
                    <p className="text-xs font-semibold text-[#111827] mt-1">FAQ: {item.question}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 shrink-0">{new Date(item.created_at).toLocaleDateString()}</span>
                </div>

                {/* Compare answers */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-white border border-gray-200 rounded p-3">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Current Answer</span>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-4 leading-relaxed">{item.current_answer}</p>
                  </div>
                  <div className="bg-white border border-green-200 rounded p-3">
                    <span className="text-[9px] font-bold text-green-700 uppercase tracking-wider">Suggested Answer</span>
                    <p className="text-xs text-[#111827] mt-1 line-clamp-4 leading-relaxed font-medium">{item.answer_text}</p>
                  </div>
                </div>

                {/* Yaksha reasoning */}
                {item.yaksha_reasoning && (
                  <div className="bg-gray-50 border border-gray-100 rounded p-2.5">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Yaksha's Reasoning</span>
                    <p className="text-[11px] text-gray-600 mt-1 italic">"{item.yaksha_reasoning}"</p>
                  </div>
                )}

                {/* Footer: contributor + actions */}
                <div className="flex items-center justify-between pt-2 border-t border-amber-100">
                  <span className="text-[10px] text-gray-500">Submitted by <strong className="text-gray-700">{item.contributor_name || 'Anonymous'}</strong></span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleQueueAction(item.id, 'approve')}
                      className="bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold px-3 py-1.5 rounded transition"
                    >
                      ✓ Approve & Write
                    </button>
                    <button
                      onClick={() => handleQueueAction(item.id, 'reject')}
                      className="bg-white border border-red-300 text-red-600 hover:bg-red-50 text-[10px] font-bold px-3 py-1.5 rounded transition"
                    >
                      ✗ Reject
                    </button>
                    <button
                      onClick={() => handleDeleteHash(item.hash_id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 transition"
                      title="Delete permanently"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;
