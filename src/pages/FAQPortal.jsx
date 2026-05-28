import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, X, Search, Clock, ThumbsUp, ThumbsDown, 
  AlertTriangle, Check, ChevronDown, ChevronUp, AlertCircle 
} from 'lucide-react';
import { useApp } from '../store/AppContext';
import { 
  getFAQs, getOnboardingFAQs, getFAQHistory, askAI, voteFAQ,
  getAdminPopular
} from '../services/api';

export function FAQPortal() {
  const { isLoading, setIsLoading } = useApp();
  
  // Onboarding Checklist
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingFaqs, setOnboardingFaqs] = useState([]);
  
  // Search Bar
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);

  // FAQ Bento Grid
  const [faqs, setFaqs] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [expandedFaqId, setExpandedFaqId] = useState(null);

  // Version History Modal
  const [historyModalFaq, setHistoryModalFaq] = useState(null);
  const [faqHistoryData, setFaqHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Voting Status Tracker ({ [faqId]: 'upvoted' | 'downvoted_pending' | 'voted_done' })
  const [votesState, setVotesState] = useState({});

  // Popular / Frequently Asked FAQs
  const [popularFaqs, setPopularFaqs] = useState([]);

  // 1. Fetch Onboarding and FAQs
  useEffect(() => {
    const isDismissed = localStorage.getItem('onboarding_dismissed');
    if (!isDismissed) {
      setShowOnboarding(true);
      fetchOnboarding();
    }
    fetchFAQs();
    fetchPopular();
  }, []);

  const fetchOnboarding = async () => {
    try {
      const res = await getOnboardingFAQs();
      if (res.success) {
        setOnboardingFaqs(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchFAQs = async () => {
    setIsLoading(true);
    try {
      const res = await getFAQs();
      if (res.success) {
        setFaqs(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPopular = async () => {
    try {
      const res = await getAdminPopular();
      if (res.success && res.data.length > 0) {
        setPopularFaqs(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDismissOnboarding = () => {
    localStorage.setItem('onboarding_dismissed', 'true');
    setShowOnboarding(false);
  };

  // 2. Debounced search bar
  const performSearch = useCallback(
    debounce(async (queryText) => {
      if (!queryText.trim()) {
        setSuggestions([]);
        return;
      }
      try {
        const res = await askAI(queryText);
        if (res.success && res.confidence > 0.4) {
          // If we got a direct hit or semantic match
          setSuggestions([
            {
              id: res.matched_faq_id || 'ai-match',
              question: queryText,
              answer: res.answer || 'I am sorry, I do not have a confident answer in my records.',
              category: res.source === 'db' ? 'Verified FAQ' : 'Generative AI',
              confidence_score: res.confidence,
              isAiPrompt: true
            }
          ]);
        } else {
          // Let's filter local faqs to show standard autocomplete
          const localFiltered = faqs.filter(faq => 
            faq.question.toLowerCase().includes(queryText.toLowerCase())
          ).slice(0, 5).map(faq => ({ ...faq, confidence_score: 0.95 }));
          
          setSuggestions(localFiltered);
        }
      } catch (err) {
        // Fallback to local filtering on error
        const localFiltered = faqs.filter(faq => 
          faq.question.toLowerCase().includes(queryText.toLowerCase())
        ).slice(0, 5).map(faq => ({ ...faq, confidence_score: 0.9 }));
        setSuggestions(localFiltered);
      }
    }, 300),
    [faqs]
  );

  useEffect(() => {
    performSearch(searchQuery);
  }, [searchQuery, performSearch]);

  // Helper debounce
  function debounce(func, wait) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  // 3. Stale indicator check (more than 90 days ago)
  const isStale = (dateStr) => {
    if (!dateStr) return false;
    const updatedAt = new Date(dateStr);
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    return updatedAt < ninetyDaysAgo;
  };

  // 4. View history logic
  const handleOpenHistory = async (faq) => {
    setHistoryModalFaq(faq);
    setLoadingHistory(true);
    setFaqHistoryData([]);
    try {
      const res = await getFAQHistory(faq.id);
      if (res.success) {
        setFaqHistoryData(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // 5. Vote triggers
  const handleVoteUp = async (id) => {
    try {
      await voteFAQ(id, { helpful: true });
      setVotesState(prev => ({ ...prev, [id]: 'upvoted' }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleVoteDownTrigger = (id) => {
    setVotesState(prev => ({ ...prev, [id]: 'downvoted_pending' }));
  };

  const handleVoteDownSubmit = async (id, reason) => {
    try {
      await voteFAQ(id, { helpful: false, reason });
      setVotesState(prev => ({ ...prev, [id]: 'voted_done' }));
    } catch (err) {
      console.error(err);
    }
  };

  // Unique categories extraction
  const categories = ['All', ...new Set(faqs.map(faq => faq.category).filter(Boolean))];

  // Filtering
  const filteredFaqs = faqs.filter(faq => {
    if (selectedCategory === 'All') return true;
    return faq.category === selectedCategory;
  });

  return (
    <div className="space-y-12">
      {/* SECTION A: ONBOARDING CHECKLIST */}
      <AnimatePresence>
        {showOnboarding && onboardingFaqs.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden bg-gray-50 border border-gray-200 rounded-lg p-6 relative"
          >
            <button 
              onClick={handleDismissOnboarding}
              className="absolute top-4 right-4 text-gray-400 hover:text-[#111827] transition"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-[#111827] text-white rounded">
                <BookOpen className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-semibold tracking-tight">Start Here</h2>
            </div>
            
            <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {onboardingFaqs.map((faq) => (
                <div 
                  key={faq.id}
                  onClick={() => {
                    setSelectedSuggestion(faq);
                    setSearchQuery('');
                    setShowSuggestions(false);
                  }}
                  className="bg-white border border-gray-200 hover:border-[#111827] p-4 rounded-md shadow-sm cursor-pointer transition-all duration-200"
                >
                  <p className="font-medium text-sm text-[#111827] line-clamp-2">{faq.question}</p>
                  <span className="text-[11px] text-gray-500 mt-2 inline-block bg-gray-100 px-2 py-0.5 rounded">
                    {faq.category}
                  </span>
                </div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SECTION B: HERO SEARCH BAR */}
      <div className="space-y-4 max-w-2xl mx-auto text-center relative z-40">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#111827]">
          VINS Knowledge Vault
        </h1>
        <p className="text-gray-500 text-sm md:text-base">
          By the community, for the community — search VINS internships, NOC, Zoom, ViBe, Rosetta...
        </p>
        
        <div className="relative mt-6">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400">
            <Search className="w-5 h-5" />
          </div>
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSuggestions(true);
            }}
            placeholder="Search questions about VINS, NOC, Zoom, ViBe..."
            className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-[#111827] focus:border-[#111827] text-sm text-[#111827] transition"
            disabled={isLoading}
          />
          
          {/* Search suggestions dropdown */}
          <AnimatePresence>
            {showSuggestions && searchQuery && suggestions.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden text-left"
              >
                {suggestions.map((item) => (
                  <div 
                    key={item.id}
                    onClick={() => {
                      setSelectedSuggestion(item);
                      setShowSuggestions(false);
                      setSearchQuery('');
                    }}
                    className="p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0 transition"
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-semibold text-sm text-[#111827] line-clamp-1">{item.question}</span>
                      <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-0.5 rounded shrink-0 ml-4">
                        {item.category}
                      </span>
                    </div>
                    {item.confidence_score && (
                      <div className="mt-1 flex items-center space-x-2 text-[11px] text-gray-400">
                        <span>Confidence match:</span>
                        <span className="font-semibold text-[#111827]">{Math.round(item.confidence_score * 100)}%</span>
                      </div>
                    )}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Selected suggestion preview panel */}
        <AnimatePresence>
          {selectedSuggestion && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="mt-4 p-5 bg-white border border-[#111827] rounded-lg shadow-md text-left relative"
            >
              <button 
                onClick={() => setSelectedSuggestion(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-[#111827] transition"
              >
                <X className="w-4 h-4" />
              </button>
              <span className="bg-[#111827] text-white text-[10px] px-2 py-0.5 rounded font-medium tracking-wide uppercase">
                {selectedSuggestion.category || 'FAQ Result'}
              </span>
              <h3 className="font-bold text-base text-[#111827] mt-2 mb-3">{selectedSuggestion.question}</h3>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                {selectedSuggestion.answer || selectedSuggestion.short_answer}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* SECTION C: FREQUENTLY ASKED — PRIORITY TIERS */}
      {popularFaqs.length > 0 && (
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#111827]">Frequently Asked</h2>
            <span className="text-xs text-gray-400 border-b border-gray-200 pb-0.5">Ranked by search volume</span>
          </div>

          {/* TIER 1 — Most searched */}
          {popularFaqs.slice(0, 1).length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Most Searched</span>
                <span className="text-[10px] text-gray-400">{popularFaqs.slice(0, 1).length} question</span>
              </div>
              {popularFaqs.slice(0, 1).map((faq, i) => (
                <div
                  key={faq.id}
                  onClick={() => {
                    setSelectedSuggestion(faq);
                    setShowSuggestions(false);
                    setSearchQuery('');
                  }}
                  className="px-4 py-3.5 hover:bg-gray-50 cursor-pointer transition border-b border-gray-100 last:border-0 flex items-start gap-3"
                >
                  <span className="text-gray-300 text-xs font-mono mt-0.5 w-4 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#111827] font-medium leading-snug">{faq.question}</p>
                    <p className="text-[11px] text-gray-400 mt-1">{faq.category} &middot; {Number(faq.search_count)} searches</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TIER 2 — Frequently asked */}
          {popularFaqs.slice(1, 4).length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Frequently Asked</span>
                <span className="text-[10px] text-gray-400">{popularFaqs.slice(1, 4).length} questions</span>
              </div>
              {popularFaqs.slice(1, 4).map((faq, i) => (
                <div
                  key={faq.id}
                  onClick={() => {
                    setSelectedSuggestion(faq);
                    setShowSuggestions(false);
                    setSearchQuery('');
                  }}
                  className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition border-b border-gray-100 last:border-0 flex items-start gap-3"
                >
                  <span className="text-gray-300 text-xs font-mono mt-0.5 w-4 shrink-0">{String(i + 2).padStart(2, '0')}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#111827] leading-snug">{faq.question}</p>
                    <p className="text-[11px] text-gray-400 mt-1">{faq.category} &middot; {Number(faq.search_count)} searches</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TIER 3 — Others */}
          {popularFaqs.slice(4).length > 0 && (
            <div className="border border-gray-100 rounded-lg overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-100 px-4 py-2.5 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Other Popular</span>
                <span className="text-[10px] text-gray-300">{popularFaqs.slice(4).length} questions</span>
              </div>
              {popularFaqs.slice(4).map((faq, i) => (
                <div
                  key={faq.id}
                  onClick={() => {
                    setSelectedSuggestion(faq);
                    setShowSuggestions(false);
                    setSearchQuery('');
                  }}
                  className="px-4 py-2.5 hover:bg-gray-50 cursor-pointer transition border-b border-gray-100 last:border-0 flex items-start gap-3"
                >
                  <span className="text-gray-200 text-xs font-mono mt-0.5 w-4 shrink-0">{String(i + 5).padStart(2, '0')}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-600 leading-snug">{faq.question}</p>
                    <p className="text-[11px] text-gray-300 mt-0.5">{faq.category}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION D: FAQ BENTO GRID */}
      <div className="space-y-6">
        <div className="flex justify-between items-center border-b border-gray-200 pb-4">
          <h2 className="text-xl font-bold tracking-tight text-[#111827]">Browse by Category</h2>
          <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-1 rounded">
            {faqs.length} answers and growing
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* LEFT SIDEBAR: Category filters */}
          <div className="lg:col-span-1 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Browse by Category</h3>
            <div className="flex flex-wrap lg:flex-col gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`text-left px-3 py-2 text-xs rounded-md transition font-medium border ${
                    selectedCategory === cat
                      ? 'bg-[#111827] text-white border-[#111827]'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* RIGHT: FAQ Cards Grid */}
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <AnimatePresence>
              {filteredFaqs.map((faq) => {
                const isExpanded = expandedFaqId === faq.id;
                const status = votesState[faq.id];
                const risk = faq.risk_level?.toLowerCase() || 'low';
                const stale = isStale(faq.updated_at);

                return (
                  <motion.div 
                    layout="position"
                    key={faq.id}
                    className="bg-white border border-gray-200 hover:border-gray-300 rounded-lg p-5 shadow-sm space-y-4 transition flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      {/* Badge Row */}
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-0.5 rounded font-medium">
                          {faq.category}
                        </span>
                        
                        {/* Risk level badge */}
                        <span className={`text-[10px] px-2 py-0.5 rounded font-semibold border ${
                          risk === 'high' 
                            ? 'bg-red-50 text-red-700 border-red-100' 
                            : risk === 'medium'
                            ? 'bg-amber-50 text-amber-700 border-amber-100'
                            : 'bg-green-50 text-green-700 border-green-100'
                        }`}>
                          {risk}
                        </span>

                        {/* Stale info badge */}
                        {stale && (
                          <span className="bg-orange-50 text-orange-700 border border-orange-100 text-[10px] px-2 py-0.5 rounded font-medium flex items-center space-x-1">
                            <AlertTriangle className="w-3 h-3 text-orange-600" />
                            <span>Stale Info</span>
                          </span>
                        )}
                      </div>

                      {/* Question */}
                      <h4 className="font-medium text-[#111827] text-sm leading-snug">{faq.question}</h4>
                      
                      {/* Short summary always shown */}
                      {faq.short_answer && !isExpanded && (
                        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{faq.short_answer}</p>
                      )}

                      {/* Full Answer expanded */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="text-xs text-gray-600 whitespace-pre-line leading-relaxed border-t border-gray-100 pt-3"
                          >
                            {faq.answer || 'No description available.'}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Bottom toolbar */}
                    <div className="border-t border-gray-100 pt-4 flex flex-col space-y-3">
                      <div className="flex justify-between items-center text-xs text-gray-400">
                        {/* Expand answer toggle */}
                        <button 
                          onClick={() => setExpandedFaqId(isExpanded ? null : faq.id)}
                          className="text-[#111827] hover:underline font-semibold flex items-center space-x-1"
                        >
                          <span>{isExpanded ? 'Show less' : 'Read full answer'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {/* Version history button */}
                        <button
                          onClick={() => handleOpenHistory(faq)}
                          className="hover:text-[#111827] transition flex items-center space-x-1"
                          title="View Changelog"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>History</span>
                        </button>
                      </div>

                      {/* Feedback row */}
                      <div className="bg-gray-50 p-2 rounded flex justify-between items-center">
                        <span className="text-[11px] text-gray-500 font-medium">Was this helpful?</span>
                        
                        <div className="flex items-center space-x-1 relative">
                          {status === 'upvoted' ? (
                            <span className="text-green-600 text-[11px] font-semibold flex items-center space-x-1 px-2 py-1 bg-green-50 rounded border border-green-200">
                              <Check className="w-3 h-3" />
                              <span>Thank you!</span>
                            </span>
                          ) : status === 'voted_done' ? (
                            <span className="text-gray-500 text-[11px] font-semibold px-2 py-1 bg-gray-100 rounded">
                              Feedback recorded
                            </span>
                          ) : status === 'downvoted_pending' ? (
                            <div className="flex items-center space-x-1">
                              {['Outdated', 'Confusing', 'Broken'].map(reason => (
                                <button
                                  key={reason}
                                  onClick={() => handleVoteDownSubmit(faq.id, reason)}
                                  className="bg-white border border-gray-200 hover:border-red-400 text-gray-600 hover:text-red-600 px-2 py-1 rounded text-[10px] font-semibold transition"
                                >
                                  {reason}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center space-x-1">
                              <button 
                                onClick={() => handleVoteUp(faq.id)}
                                className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition"
                                title="Helpful"
                              >
                                <ThumbsUp className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleVoteDownTrigger(faq.id)}
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                                title="Not Helpful"
                              >
                                <ThumbsDown className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* VERSION HISTORY MODAL */}
      <AnimatePresence>
        {historyModalFaq && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white border border-gray-200 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col relative"
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-lg text-[#111827]">Version Changelog</h3>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-1">{historyModalFaq.question}</p>
                </div>
                <button 
                  onClick={() => setHistoryModalFaq(null)}
                  className="p-1 text-gray-400 hover:text-[#111827] rounded transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Scrollable Contents */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-gray-50">
                {loadingHistory ? (
                  <div className="py-8 text-center text-xs text-gray-500">Loading version logs...</div>
                ) : faqHistoryData.length === 0 ? (
                  <div className="text-center py-10 bg-white border border-dashed rounded p-6">
                    <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-gray-600">No revisions found</p>
                    <p className="text-xs text-gray-400 mt-1">This FAQ has not been updated since creation.</p>
                  </div>
                ) : (
                  faqHistoryData.map((hist, index) => (
                    <div key={index} className="space-y-2">
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                        Revision dated: {new Date(hist.changed_at).toLocaleString()}
                      </p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Previous */}
                        <div className="bg-[#FFF5F5] border border-red-100 rounded-md p-4 flex flex-col justify-between">
                          <div>
                            <span className="text-[9px] bg-red-100 text-red-800 font-bold px-1.5 py-0.5 rounded tracking-wide uppercase">
                              Previous
                            </span>
                            <p className="text-xs text-red-950 mt-3 whitespace-pre-line leading-relaxed">
                              {hist.previous_answer}
                            </p>
                          </div>
                        </div>

                        {/* Current */}
                        <div className="bg-[#F5FFF7] border border-green-100 rounded-md p-4 flex flex-col justify-between">
                          <div>
                            <span className="text-[9px] bg-green-100 text-green-800 font-bold px-1.5 py-0.5 rounded tracking-wide uppercase">
                              Current
                            </span>
                            <p className="text-xs text-green-950 mt-3 whitespace-pre-line leading-relaxed">
                              {historyModalFaq.answer}
                            </p>
                          </div>
                          <p className="text-[10px] text-green-700 font-medium mt-3 border-t border-green-200/50 pt-2">
                            Updated: {new Date(historyModalFaq.updated_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default FAQPortal;
