import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Award, MessageSquare, Target, Bot, SearchX, Hash } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { getCommunityStats, getCommunityLeaderboard, getCommunityBounties, getCommunityFeed, checkCommunitySuggestionStatus } from '../services/api';

export function CommunityHub() {
  const { isLoading, setIsLoading } = useApp();
  const [stats, setStats] = useState({ total_contributors: 0, total_approved: 0, total_submissions: 0 });
  const [leaderboard, setLeaderboard] = useState([]);
  const [bounties, setBounties] = useState([]);
  const [feed, setFeed] = useState([]);
  
  const [trackHash, setTrackHash] = useState('');
  const [trackResult, setTrackResult] = useState(null);
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, lbRes, bountiesRes, feedRes] = await Promise.all([
        getCommunityStats(),
        getCommunityLeaderboard(),
        getCommunityBounties(),
        getCommunityFeed()
      ]);
      if (statsRes.success) setStats(statsRes.data);
      if (lbRes.success) setLeaderboard(lbRes.data);
      if (bountiesRes.success) setBounties(bountiesRes.data);
      if (feedRes.success) setFeed(feedRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTrackHash = async (e) => {
    e.preventDefault();
    if (!trackHash.trim()) return;
    setIsTracking(true);
    setTrackResult(null);
    try {
      const res = await checkCommunitySuggestionStatus(trackHash.trim());
      if (res.success) setTrackResult(res.data);
    } catch (err) {
      setTrackResult({ error: 'Suggestion not found or invalid hash.' });
    } finally {
      setIsTracking(false);
    }
  };

  return (
    <div className="space-y-10 px-4 sm:px-0 max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-3 pb-6 border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#111827] dark:text-gray-100">
          Community Hub
        </h1>
        <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
          The knowledge base is powered by students like you. Hunt bounties, suggest edits, and climb the leaderboard.
        </p>

        {/* Track Suggestion Bar */}
        <div className="max-w-md mx-auto mt-6">
          <form onSubmit={handleTrackHash} className="flex items-center space-x-2">
            <div className="relative flex-1">
              <Hash className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Track your suggestion hash (e.g. a1b2c3d4)"
                value={trackHash}
                onChange={(e) => setTrackHash(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:border-[#111827] dark:focus:border-gray-100 bg-gray-50 dark:bg-gray-900/50"
              />
            </div>
            <button
              type="submit"
              disabled={!trackHash.trim() || isTracking}
              className="bg-[#111827] dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-bold px-4 py-2 rounded-md hover:bg-black transition disabled:opacity-50"
            >
              Track
            </button>
          </form>
          
          <AnimatePresence>
            {trackResult && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className={`mt-3 p-3 rounded-md border text-left text-xs ${
                  trackResult.error 
                    ? 'bg-red-50 border-red-100 text-red-700'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}
              >
                {trackResult.error ? (
                  <p className="font-semibold">{trackResult.error}</p>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-500 dark:text-gray-400">Status:</span>
                      <span className={`font-bold uppercase tracking-wider px-2 py-0.5 rounded text-[10px] ${
                        trackResult.yaksha_decision === 'approved' ? 'bg-green-100 text-green-800'
                        : trackResult.yaksha_decision === 'admin_review' ? 'bg-amber-100 text-amber-800'
                        : 'bg-red-100 text-red-800'
                      }`}>
                        {trackResult.yaksha_decision.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300">
                      <span className="font-semibold">FAQ:</span> {trackResult.question}
                    </p>
                    <p className="text-gray-500 italic mt-1 bg-gray-50 dark:bg-gray-900 p-2 rounded">
                      "Yaksha reasoning: {trackResult.yaksha_reasoning}"
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 flex flex-col items-center justify-center space-y-2 shadow-sm">
          <Users className="w-6 h-6 text-gray-400 dark:text-gray-500" />
          <span className="text-3xl font-bold text-[#111827] dark:text-white">{stats.total_contributors}</span>
          <span className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Contributors</span>
        </div>
        <div className="bg-[#111827] dark:bg-gray-100 border border-gray-800 dark:border-gray-200 rounded-lg p-6 flex flex-col items-center justify-center space-y-2 shadow-sm">
          <Award className="w-6 h-6 text-gray-400 dark:text-gray-500" />
          <span className="text-3xl font-bold text-white dark:text-[#111827]">{stats.total_approved}</span>
          <span className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-600 font-semibold">Approved Edits</span>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 flex flex-col items-center justify-center space-y-2 shadow-sm">
          <MessageSquare className="w-6 h-6 text-gray-400 dark:text-gray-500" />
          <span className="text-3xl font-bold text-[#111827] dark:text-white">{stats.total_submissions}</span>
          <span className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Total Suggestions</span>
        </div>
      </div>

      {/* Knowledge Bounties Section */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2 border-b border-gray-200 dark:border-gray-800 pb-2">
          <Target className="w-5 h-5 text-[#111827] dark:text-gray-100" />
          <h2 className="text-lg font-bold text-[#111827] dark:text-white">
            Knowledge Bounties
          </h2>
          <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded font-medium">Unanswered Queries</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {bounties.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No open bounties at the moment.</p>
          ) : (
            bounties.map((bounty, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col justify-between hover:border-[#111827] dark:hover:border-gray-100 transition shadow-sm group">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded">
                      Open Bounty
                    </span>
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center space-x-1">
                      <SearchX className="w-3 h-3" />
                      <span>{bounty.frequency} searches</span>
                    </span>
                  </div>
                  <p className="font-semibold text-sm text-[#111827] dark:text-gray-100 leading-snug">"{bounty.query_text}"</p>
                </div>
                <button className="mt-4 w-full bg-[#111827] dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-semibold py-1.5 rounded opacity-0 group-hover:opacity-100 transition disabled:opacity-50">
                  Solve Bounty
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Leaderboard */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-lg font-bold text-[#111827] dark:text-white border-b border-gray-200 dark:border-gray-800 pb-2">
            Top Contributors
          </h2>
          <div className="space-y-3">
            {leaderboard.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No contributors yet.</p>
            ) : (
              leaderboard.map((person, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:border-[#111827] dark:hover:border-gray-100 transition">
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-mono font-bold text-gray-400 dark:text-gray-500 w-5 text-center">#{i + 1}</span>
                    <span className="font-semibold text-sm text-[#111827] dark:text-gray-100">{person.contributor_name}</span>
                  </div>
                  <span className="text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-[#111827] dark:text-white px-2 py-1 rounded">
                    {person.approved_count}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Yaksha Live Feed */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center space-x-2 border-b border-gray-200 dark:border-gray-800 pb-2">
            <Bot className="w-5 h-5 text-[#111827] dark:text-gray-100" />
            <h2 className="text-lg font-bold text-[#111827] dark:text-white">
              Yaksha Live Feed
            </h2>
          </div>
          <div className="space-y-4">
            {feed.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No recent activity.</p>
            ) : (
              feed.map(item => (
                <div key={item.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col justify-between hover:border-[#111827] dark:hover:border-gray-100 transition shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${
                        item.yaksha_decision === 'approved' 
                          ? 'bg-gray-100 text-[#111827] border-gray-300 dark:bg-gray-700 dark:text-white dark:border-gray-600'
                          : item.yaksha_decision === 'admin_review'
                          ? 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
                          : 'bg-white text-gray-400 border-gray-100 dark:bg-gray-900 dark:border-gray-800'
                      }`}>
                        {item.yaksha_decision.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-gray-500 font-semibold">
                        @{(item.contributor_name || 'anonymous').toLowerCase()}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">On: {item.question}</p>
                    <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded border border-gray-100 dark:border-gray-800 text-xs text-[#111827] dark:text-gray-300 italic">
                      "Yaksha {item.yaksha_decision === 'approved' ? 'approved' : item.yaksha_decision === 'admin_review' ? 'queued' : 'rejected'} this edit because: {item.yaksha_reasoning || 'No specific reason provided.'}"
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CommunityHub;
