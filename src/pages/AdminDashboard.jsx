import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lock, LayoutDashboard, Flame, PenLine, X, 
  AlertTriangle, RefreshCw, CheckCircle, TrendingUp,
  ShieldCheck, Trash2, MessageSquare, Eye, EyeOff, ChevronDown
} from 'lucide-react';
import { useApp } from '../store/AppContext';
import { 
  getAdminHeatmap, getAdminGaps, getAdminRageSessions, createFAQ,
  getAdminQueue, adminReviewAnswer, getAdminIssues, adminResolveIssue
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
  const [communityTab, setCommunityTab] = useState('unclear'); // 'spam' | 'unclear' | 'issues'
  const [queueItems, setQueueItems] = useState([]);
  const [issueItems, setIssueItems] = useState([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [queueLoadingId, setQueueLoadingId] = useState(null); // id being actioned

  // Modal and Toast states
  const [draftFaq, setDraftFaq] = useState(null); // FAQ record being drafted { question, answer, category, risk_level, is_onboarding_faq }
  const [toastMessage, setToastMessage] = useState('');

  // 1. Auth Gate Verification on mount
  useEffect(() => {
    const key = localStorage.getItem('adminKey');
    if (key) {
      fetchDashboardData();
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!adminKey.trim()) return;
    
    // Store temporarily and test fetching dashboard data
    localStorage.setItem('adminKey', adminKey);
    await fetchDashboardData(adminKey);
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
      
      // Only authorize AFTER successful verification
      setIsAuthorized(true);
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

  // ── Community Queue Fetchers ──────────────────────────────────────────────
  const fetchQueue = async (tab) => {
    setLoadingQueue(true);
    try {
      const res = await getAdminQueue(tab);
      if (res.success) setQueueItems(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingQueue(false);
    }
  };

  const fetchIssues = async () => {
    try {
      const res = await getAdminIssues();
      if (res.success) setIssueItems(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch queue whenever tab changes (only after authorized)
  useEffect(() => {
    if (isAuthorized) {
      if (communityTab === 'issues') {
        fetchIssues();
      } else {
        fetchQueue(communityTab);
      }
    }
  }, [communityTab, isAuthorized]);

  const handleReviewAnswer = async (id, action) => {
    setQueueLoadingId(id);
    try {
      await adminReviewAnswer(id, action);
      showToast(`Answer ${action}d successfully`);
      // Remove from list
      setQueueItems(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      console.error(err);
      showToast('Action failed. Try again.');
    } finally {
      setQueueLoadingId(null);
    }
  };

  const handleResolveIssue = async (id, status) => {
    setQueueLoadingId(id);
    try {
      await adminResolveIssue(id, status);
      showToast(`Issue ${status}`);
      setIssueItems(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      console.error(err);
      showToast('Action failed. Try again.');
    } finally {
      setQueueLoadingId(null);
    }
  };

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

      {/* COMMUNITY QUEUE — Spam / Unclear / Issues */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-[#111827]" />
            <h3 className="text-sm font-bold uppercase tracking-tight text-gray-500">Community Queue</h3>
          </div>

          {/* Tab switcher */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5 space-x-0.5">
            {[
              { key: 'unclear', label: 'Unclear' },
              { key: 'spam',    label: 'Spam'    },
              { key: 'issues',  label: 'Issues'  },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setCommunityTab(tab.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  communityTab === tab.key
                    ? 'bg-white text-[#111827] shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── UNCLEAR / SPAM tabs ── */}
        {communityTab !== 'issues' && (
          <div>
            {loadingQueue ? (
              <div className="py-8 text-center text-xs text-gray-400">Loading...</div>
            ) : queueItems.length === 0 ? (
              <div className="py-8 text-center">
                <div className="mx-auto w-8 h-8 border-2 border-gray-200 rounded-full flex items-center justify-center mb-2">
                  <CheckCircle className="w-4 h-4 text-gray-300" />
                </div>
                <p className="text-xs text-gray-400">Queue is empty — nothing to review.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {queueItems.map(item => (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                    {/* Card header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${
                            item.yaksha_decision === 'approved' ? 'bg-green-100 text-green-700' :
                            item.yaksha_decision === 'spam'     ? 'bg-red-100 text-red-700' :
                                                                 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {item.yaksha_decision}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            conf {Math.round((item.yaksha_confidence || 0) * 100)}%
                          </span>
                          {item.display_name && (
                            <span className="text-[10px] text-gray-400">by {item.display_name}</span>
                          )}
                          {item.reputation > 0 && (
                            <span className="text-[10px] text-gray-400">★ {item.reputation}</span>
                          )}
                        </div>

                        {/* FAQ context */}
                        {item.faq_question && (
                          <p className="text-[11px] text-gray-500 mb-1">
                            FAQ: <span className="font-medium text-[#111827]">{item.faq_question}</span>
                          </p>
                        )}

                        <p className="text-sm text-[#111827] font-medium">{item.answer_text}</p>
                      </div>
                    </div>

                    {/* Yaksha reasoning */}
                    {item.yaksha_reasoning && (
                      <p className="text-[11px] text-gray-400 italic bg-gray-50 border border-gray-100 rounded px-2.5 py-1.5">
                        Yaksha: {item.yaksha_reasoning}
                      </p>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center justify-end space-x-2 pt-1 border-t border-gray-100">
                      <button
                        onClick={() => handleReviewAnswer(item.id, 'approve')}
                        disabled={queueLoadingId === item.id}
                        className="flex items-center space-x-1.5 text-xs font-semibold text-green-700 hover:text-green-800 border border-green-200 hover:bg-green-50 px-3 py-1.5 rounded transition disabled:opacity-40"
                      >
                        {queueLoadingId === item.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => handleReviewAnswer(item.id, 'reject')}
                        disabled={queueLoadingId === item.id}
                        className="flex items-center space-x-1.5 text-xs font-semibold text-red-700 hover:text-red-800 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded transition disabled:opacity-40"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ISSUES tab ── */}
        {communityTab === 'issues' && (
          <div>
            {issueItems.length === 0 ? (
              <div className="py-8 text-center">
                <div className="mx-auto w-8 h-8 border-2 border-gray-200 rounded-full flex items-center justify-center mb-2">
                  <CheckCircle className="w-4 h-4 text-gray-300" />
                </div>
                <p className="text-xs text-gray-400">No open issues — all clear!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {issueItems.map(issue => (
                  <div key={issue.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1 flex-wrap">
                          {issue.faq_question && (
                            <span className="text-[10px] font-medium bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                              FAQ: {issue.faq_question}
                            </span>
                          )}
                          <span className="text-[10px] text-gray-400">
                            Reported by {issue.reporter_username}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {new Date(issue.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        {issue.suggested_question ? (
                          <div className="space-y-1.5">
                            <p className="text-[11px] text-gray-400 uppercase tracking-wide font-semibold">Suggested FAQ</p>
                            <p className="text-sm font-semibold text-[#111827]">{issue.suggested_question}</p>
                          </div>
                        ) : null}

                        <p className="text-sm text-[#111827]">{issue.reason}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-end space-x-2 pt-1 border-t border-gray-100">
                      {/* Convert suggested FAQ → Draft FAQ */}
                      {issue.suggested_question && (
                        <button
                          onClick={() => setDraftFaq({
                            question: issue.suggested_question,
                            answer: '',
                            category: categoryOptions[0] || 'General',
                            risk_level: 'low',
                            is_onboarding_faq: false,
                          })}
                          className="flex items-center space-x-1.5 text-xs font-semibold text-[#111827] hover:text-black border border-[#111827] hover:bg-[#111827] hover:text-white px-3 py-1.5 rounded transition"
                        >
                          <PenLine className="w-3.5 h-3.5" />
                          <span>Draft FAQ</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleResolveIssue(issue.id, 'resolved')}
                        disabled={queueLoadingId === issue.id}
                        className="flex items-center space-x-1.5 text-xs font-semibold text-green-700 hover:text-green-800 border border-green-200 hover:bg-green-50 px-3 py-1.5 rounded transition disabled:opacity-40"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Resolve</span>
                      </button>
                      <button
                        onClick={() => handleResolveIssue(issue.id, 'dismissed')}
                        disabled={queueLoadingId === issue.id}
                        className="flex items-center space-x-1.5 text-xs font-semibold text-gray-600 hover:text-gray-800 border border-gray-200 hover:bg-gray-50 px-3 py-1.5 rounded transition disabled:opacity-40"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Dismiss</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
    </div>
  );
}

export default AdminDashboard;
