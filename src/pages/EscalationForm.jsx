import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, Lightbulb, CheckCircle, AlertCircle } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { askAI, submitQuery } from '../services/api';
import QualityMeter from '../components/QualityMeter';

export function EscalationForm() {
  const navigate = useNavigate();
  const { 
    isLoading, setIsLoading, 
    lastFailedQuery, setLastFailedQuery 
  } = useApp();

  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  
  // Prefill check banner
  const [prefilled, setPrefilled] = useState(false);

  // Duplicate detection state
  const [duplicateFaq, setDuplicateFaq] = useState(null);
  const [showDuplicatePanel, setShowDuplicatePanel] = useState(false);

  // Success message
  const [ticketId, setTicketId] = useState(null);

  // 1. Pass-Through check on mount
  useEffect(() => {
    if (lastFailedQuery) {
      setDescription(lastFailedQuery);
      setPrefilled(true);
      // Reset after pre-filling so it doesn't persist forever across tabs
      setLastFailedQuery('');
    }
  }, [lastFailedQuery, setLastFailedQuery]);

  // Calculate score locally for submit button validation
  const calculateScore = (subj, desc) => {
    let score = 0;
    if (!subj || !desc) return 0;
    if (desc.split(' ').length > 20) score += 1;
    if (desc.includes('?')) score += 1;
    if (/expected|actual|should|but/i.test(desc)) score += 1;
    if (desc.length > 100) score += 1;
    if (subj.split(' ').length >= 3) score += 1;
    return score;
  };

  const score = calculateScore(subject, description);

  // 2. Debounced Live Duplicate Detection
  const checkDuplicate = useCallback(
    debounce(async (subjectValue) => {
      if (!subjectValue.trim() || subjectValue.length < 5) {
        setDuplicateFaq(null);
        setShowDuplicatePanel(false);
        return;
      }
      try {
        const res = await askAI(subjectValue);
        if (res.success && res.confidence > 0.60 && res.source !== 'escalation') {
          // Find matching FAQ text locally in the search logs or fallback
          setDuplicateFaq({
            question: subjectValue,
            matchedQuestion: res.answer ? 'A similar topic is matching in our system' : 'Similar FAQ topic resolved'
          });
          setShowDuplicatePanel(true);
        } else {
          setDuplicateFaq(null);
          setShowDuplicatePanel(false);
        }
      } catch (err) {
        console.error(err);
      }
    }, 400),
    []
  );

  useEffect(() => {
    checkDuplicate(subject);
  }, [subject, checkDuplicate]);

  function debounce(func, wait) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  // 3. Submit handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading || score < 2) return;

    setIsLoading(true);
    setTicketId(null);

    try {
      const res = await submitQuery({ email, subject, description });
      if (res.success) {
        setTicketId(res.data.id);
        // Clear fields
        setEmail('');
        setSubject('');
        setDescription('');
        setPrefilled(false);
        setShowDuplicatePanel(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewAnswer = () => {
    navigate('/yaksha', { state: { query: subject } });
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#111827] dark:text-gray-100">Submit a Support Query</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Our technical coordinators will vector and resolve this within hours.</p>
      </div>

      {/* Success banner */}
      <AnimatePresence>
        {ticketId && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg flex items-start space-x-3 text-sm shadow-sm"
          >
            <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Query submitted successfully.</p>
              <p className="text-xs text-green-700 mt-1">Your tracking reference ID is:</p>
              <code className="text-xs bg-green-100 px-1.5 py-0.5 rounded font-mono font-bold mt-1.5 block select-all w-fit">
                {ticketId}
              </code>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prefill Info Banner */}
      <AnimatePresence>
        {prefilled && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-blue-50 border border-blue-100 text-blue-800 px-4 py-3 rounded-lg flex items-center space-x-2.5 text-xs shadow-xs"
          >
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="font-medium">Form pre-filled from your last AI chat session. Feel free to revise.</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm">
        {/* Email Field */}
        <div className="space-y-1">
          <label htmlFor="email" className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="devops@samagama.org"
            className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-[#111827] dark:focus:ring-gray-100 focus:border-[#111827] dark:focus:border-gray-100 text-sm text-[#111827] dark:text-gray-100"
            disabled={isLoading}
          />
        </div>

        {/* Subject Field */}
        <div className="space-y-1 relative">
          <label htmlFor="subject" className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Query Subject
          </label>
          <input
            id="subject"
            type="text"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="E.g., Connection pool leak on Neon DB"
            className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-[#111827] dark:focus:ring-gray-100 focus:border-[#111827] dark:focus:border-gray-100 text-sm text-[#111827] dark:text-gray-100"
            disabled={isLoading}
          />

          {/* Duplicate Detection Alert Slider */}
          <AnimatePresence>
            {showDuplicatePanel && duplicateFaq && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mt-2 bg-[#FEF9C3] border border-yellow-200 text-yellow-900 rounded-md p-3.5 flex flex-col space-y-2 text-xs md:text-sm"
              >
                <div className="flex items-center space-x-2">
                  <Lightbulb className="w-4 h-4 text-yellow-700 shrink-0" />
                  <span className="font-semibold text-yellow-950">Similar issue already solved.</span>
                </div>
                <p className="text-[11px] text-yellow-800">
                  We found a resolved knowledge base match matching your subject line.
                </p>
                <button
                  type="button"
                  onClick={handleViewAnswer}
                  className="bg-[#111827] dark:bg-gray-100 hover:bg-black text-white dark:text-gray-900 px-3 py-1.5 rounded text-[11px] font-semibold w-fit transition"
                >
                  View Answer →
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Description Field */}
        <div className="space-y-1">
          <label htmlFor="description" className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Detailed Description
          </label>
          <textarea
            id="description"
            required
            rows="5"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Please enter expected behavior versus actual error logs (minimum 20 characters)..."
            className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-[#111827] dark:focus:ring-gray-100 focus:border-[#111827] dark:focus:border-gray-100 text-sm text-[#111827] dark:text-gray-100 resize-y min-h-[100px]"
            disabled={isLoading}
          />
        </div>

        {/* Quality Meter Component */}
        <QualityMeter description={description} subject={subject} />

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading || score < 2}
          className="w-full py-3 bg-[#111827] dark:bg-gray-100 hover:bg-black text-white dark:text-gray-900 font-bold rounded-lg text-sm transition disabled:opacity-40"
        >
          {isLoading ? 'Submitting Query...' : 'Submit Support Ticket'}
        </button>
      </form>
    </div>
  );
}

export default EscalationForm;
