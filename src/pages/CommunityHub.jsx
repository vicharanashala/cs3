import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Award, MessageSquare, PlusCircle } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { getCommunityStats, getCommunityLeaderboard, getCommunityContributions } from '../services/api';

export function CommunityHub() {
  const { isLoading, setIsLoading } = useApp();
  const [stats, setStats] = useState({ total_contributors: 0, total_approved: 0, total_submissions: 0 });
  const [leaderboard, setLeaderboard] = useState([]);
  const [recentContributions, setRecentContributions] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, lbRes, contribRes] = await Promise.all([
        getCommunityStats(),
        getCommunityLeaderboard(),
        getCommunityContributions()
      ]);
      if (statsRes.success) setStats(statsRes.data);
      if (lbRes.success) setLeaderboard(lbRes.data);
      if (contribRes.success) setRecentContributions(contribRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
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
          The knowledge base is powered by students like you. Suggest edits, help others, and climb the leaderboard.
        </p>
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

        {/* Recent Contributions */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-[#111827] dark:text-white border-b border-gray-200 dark:border-gray-800 pb-2">
            Recent Approved Edits
          </h2>
          <div className="space-y-4">
            {recentContributions.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No recent edits.</p>
            ) : (
              recentContributions.map(contrib => (
                <div key={contrib.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 flex flex-col justify-between hover:border-[#111827] dark:hover:border-gray-100 transition shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="bg-[#111827] dark:bg-gray-100 text-white dark:text-gray-900 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded flex items-center space-x-1">
                      <CheckCircleIcon className="w-3 h-3" />
                      <span>Approved</span>
                    </span>
                    <span className="text-xs text-gray-500 font-mono">
                      {new Date(contrib.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="font-medium text-[#111827] dark:text-white text-sm leading-snug">{contrib.question}</h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 leading-relaxed">{contrib.answer_text}</p>
                  
                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 flex justify-between items-center">
                    <span>By <strong className="text-[#111827] dark:text-white">{contrib.contributor_name}</strong></span>
                    {contrib.hash_id && (
                      <span className="font-mono bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded">#{contrib.hash_id}</span>
                    )}
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

// Simple internal icon for CheckCircle since we only imported Check from lucide in App usually
function CheckCircleIcon(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

export default CommunityHub;
