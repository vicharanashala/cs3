import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { 
  Send, Bot, TrendingUp, AlertTriangle, Clipboard, Check, Info, X, ThumbsUp, ThumbsDown, Sparkles
} from 'lucide-react';
import { useApp } from '../store/AppContext';
import { askAI } from '../services/api';

// Helper component for copying code block contents
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 text-gray-500 dark:text-gray-400 hover:text-[#111827] dark:hover:text-gray-100 rounded shadow-xs transition duration-150 z-10"
      title="Copy to clipboard"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Clipboard className="w-3.5 h-3.5" />}
    </button>
  );
}

export function YakshaAI() {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    isLoading, setIsLoading, 
    confidenceHistory, pushConfidence, 
    setLastFailedQuery 
  } = useApp();

  const [inputVal, setInputVal] = useState('');

  // Check for pre-fill parameters on load
  useEffect(() => {
    if (location.state?.query) {
      setInputVal(location.state.query);
      // Clear location state after consumption to prevent refilling on reload
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // Message shape: { role, content, confidence, relatedFaqs: [{id, question, short_answer, category, confidence}] }
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello. I am **Yaksha**, your VINS knowledge assistant. Ask me anything about internships, NOC, Zoom, ViBe, or any other topic. I will find the best answers from our community knowledge base.', confidence: 1.0, relatedFaqs: [] }
  ]);

  // Suggested questions for empty state
  const suggestedQuestions = [
    'How to apply for VINS internship?',
    'How to get NOC certificate?',
    'What is ViBe event?',
    'How to join Zoom sessions?'
  ];
  const [showSuggestions, setShowSuggestionPills] = useState(true);

  // Escape Hatch tracking states
  const [lastQueryTime, setLastQueryTime] = useState(0);
  const [queryCount, setQueryCount] = useState(0);
  const [showEscapeBanner, setShowEscapeBanner] = useState(false);
  const [failedQueryText, setFailedQueryText] = useState('');

  // Selected related FAQ from chat (click to preview)
  const [selectedRelatedFaq, setSelectedRelatedFaq] = useState(null);

  const chatEndRef = useRef(null);

  // Auto-scroll chat window smoothly but avoid scrolling past the answer
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [messages, isLoading]);

  // 1. Submit Question to Yaksha AI
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputVal.trim() || isLoading) return;

    const userQuery = inputVal.trim();
    setShowSuggestionPills(false);
    setInputVal('');

    // Update messages history with user's question
    const updatedMessages = [...messages, { role: 'user', content: userQuery }];
    setMessages(updatedMessages);
    setIsLoading(true);

    // Escape hatch check 2: 3 or more queries in 8 seconds
    const now = Date.now();
    let currentQueryCount = queryCount + 1;
    if (now - lastQueryTime > 8000) {
      currentQueryCount = 1;
    }
    setQueryCount(currentQueryCount);
    setLastQueryTime(now);

    try {
      const response = await askAI(userQuery);
      
      if (response.success) {
        const aiScore = parseFloat(response.confidence) || 0.0;
        
        // Push confidence score to global history
        pushConfidence(aiScore);

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: response.answer || 'No matched FAQ answers could be extracted.',
          confidence: aiScore,
          relatedFaqs: response.related_faqs || []
        }]);

        // Reset escape banner on high-confidence queries
        if (aiScore >= 0.70) {
          setShowEscapeBanner(false);
        } else {
          // Escape hatch triggers:
          const meetsThresholdEscape = aiScore < 0.50;
          const meetsRageEscape = currentQueryCount >= 3 && (now - lastQueryTime <= 8000);
          const meetsBackendEscalation = response.source === 'escalation';

          if (meetsThresholdEscape || meetsRageEscape || meetsBackendEscalation) {
            setShowEscapeBanner(true);
            setFailedQueryText(userQuery);
            setLastFailedQuery(userQuery);
          }
        }
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'An error occurred while connecting to the server. Please try again in a moment, or raise a ticket and our team will help you out.',
        confidence: 0.0
      }]);
      setShowEscapeBanner(true);
      setLastFailedQuery(userQuery);
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger escape hatch navigation
  const handleEscapeHatch = () => {
    setLastFailedQuery(failedQueryText);
    navigate('/escalate');
  };

  // Sparkline coordinates mapping helper
  const renderSparkline = () => {
    if (confidenceHistory.length === 0) {
      return <polyline points="5,16 115,16" stroke="#E5E7EB" strokeWidth="1.5" fill="none" />;
    }
    
    // Map each confidence score into SVG view coordinates
    const points = confidenceHistory.map((score, index) => {
      const x = confidenceHistory.length > 1 
        ? (index / (confidenceHistory.length - 1)) * 110 + 5 
        : 60;
      const y = 32 - (score * 28) + 2; // scale 0-1 into viewBox height 2-30
      return `${x},${y}`;
    }).join(' ');

    return <polyline points={points} stroke="#111827" strokeWidth="1.5" fill="none" />;
  };

  const getLatestConfidencePct = () => {
    if (confidenceHistory.length === 0) return '0%';
    const latest = confidenceHistory[confidenceHistory.length - 1];
    return `${Math.round(latest * 100)}%`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-8">
      {/* LEFT COLUMN: CHAT INTERFACE */}
      <div className="lg:col-span-3 space-y-4 flex flex-col h-[60vh] lg:h-[75vh]">
        {/* Escape Hatch Banner */}
        <AnimatePresence>
          {showEscapeBanner && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-[#FEF9C3] border border-yellow-200 text-yellow-900 px-4 py-3 rounded-lg flex items-center justify-between text-xs md:text-sm shadow-sm"
            >
              <div className="flex items-center space-x-2 flex-1">
                <AlertTriangle className="w-4 h-4 text-yellow-700 shrink-0" />
                <span className="font-medium">Need more help? Our support team is here for you.</span>
              </div>
              <div className="flex items-center space-x-2 shrink-0 ml-2">
                <button
                  onClick={handleEscapeHatch}
                  className="bg-[#111827] dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-black font-semibold px-3 py-1.5 rounded transition text-xs sm:text-sm"
                >
                  Raise a Ticket →
                </button>
                <button
                  onClick={() => setShowEscapeBanner(false)}
                  className="text-yellow-700 hover:text-yellow-900 transition p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Message logs area */}
        <div className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg p-5 overflow-y-auto bg-white dark:bg-gray-800 space-y-6">
          {messages.map((msg, index) => (
            <div 
              key={index}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center space-x-1.5 text-xs text-gray-400 mb-1">
                {msg.role === 'assistant' ? (
                  <>
                    <Bot className="w-3.5 h-3.5 text-[#111827] dark:text-gray-100" />
                    <span className="font-semibold text-gray-500 dark:text-gray-400">Yaksha AI</span>
                    {msg.confidence !== undefined && (
                      <span className="bg-gray-100 dark:bg-gray-800 text-[10px] text-gray-500 dark:text-gray-400 px-1 rounded">
                        conf: {Math.round(msg.confidence * 100)}%
                      </span>
                    )}
                  </>
                ) : (
                  <span className="font-semibold">You</span>
                )}
              </div>
              
              <div className={`p-4 rounded-lg text-sm max-w-[85%] leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#111827] dark:bg-gray-100 text-white dark:text-gray-900'
                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-[#111827] dark:text-gray-100 shadow-sm'
              }`}>
                {msg.role === 'assistant' ? (
                  <ReactMarkdown 
                    rehypePlugins={[rehypeSanitize]}
                    components={{
                      code({ node, inline, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        const isInline = !match && !String(children).includes('\n');
                        const codeText = String(children).replace(/\n$/, '');

                        return !isInline ? (
                          <div className="relative group my-3">
                            <CopyButton text={codeText} />
                            <pre className="bg-gray-50 dark:bg-gray-900/50 border border-gray-150 dark:border-gray-700 rounded-md p-3 text-xs overflow-x-auto text-[#111827] dark:text-gray-100 font-mono">
                              <code className={className} {...props}>
                                {children}
                              </code>
                            </pre>
                          </div>
                        ) : (
                          <code className="bg-gray-100 dark:bg-gray-800 text-red-600 px-1.5 py-0.5 rounded font-mono text-xs" {...props}>
                            {children}
                          </code>
                        );
                      }
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  <p className="whitespace-pre-line">{msg.content}</p>
                )}
              </div>

              {/* Chat Feedback Buttons */}
              {msg.role === 'assistant' && msg.content !== 'Finding the best answer for you... ✨' && msg.confidence > 0 && (
                <div className="flex items-center space-x-3 mt-1.5 ml-1">
                  <button 
                    className="flex items-center space-x-1 text-xs text-gray-400 hover:text-green-600 transition group"
                    onClick={() => {
                      // Fire and forget feedback API call could go here
                      alert('Thanks for the feedback!');
                    }}
                  >
                    <ThumbsUp className="w-3.5 h-3.5 group-hover:fill-green-600" />
                    <span className="text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity">Helpful</span>
                  </button>
                  <button 
                    className="flex items-center space-x-1 text-xs text-gray-400 hover:text-red-500 transition group"
                    onClick={() => {
                      setShowEscapeBanner(true);
                      setFailedQueryText("I didn't find Yaksha's answer helpful.");
                    }}
                  >
                    <ThumbsDown className="w-3.5 h-3.5 group-hover:fill-red-500" />
                    <span className="text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity">Not Helpful</span>
                  </button>
                </div>
              )}

              {/* Related FAQs — top 3 matches shown as clickable cards */}
              {msg.role === 'assistant' && msg.relatedFaqs?.length > 0 && (
                <div className="mt-2 w-full max-w-[85%] space-y-1.5">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1">
                    Related FAQs
                  </p>
                  {msg.relatedFaqs.map((faq, i) => (
                    <div
                      key={faq.id}
                      onClick={() => setSelectedRelatedFaq(faq)}
                      className="w-full text-left bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 hover:border-[#111827] dark:hover:border-gray-100 p-3 rounded-lg cursor-pointer transition group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <span className="text-[10px] font-mono text-gray-300 mt-0.5 shrink-0">
                            #{i + 1}
                          </span>
                          <p className="text-xs font-semibold text-[#111827] dark:text-gray-100 line-clamp-1 group-hover:text-black">
                            {faq.question}
                          </p>
                        </div>
                        {faq.confidence !== undefined && (
                          <span className={`text-[10px] font-mono shrink-0 ${
                            faq.confidence >= 0.7 ? 'text-green-600' :
                            faq.confidence >= 0.3 ? 'text-yellow-600' : 'text-gray-400'
                          }`}>
                            {Math.round(faq.confidence * 100)}%
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 ml-5 line-clamp-2">
                        {faq.short_answer}
                      </p>
                      {faq.category && (
                        <span className="mt-1.5 ml-5 inline-block text-[9px] font-medium text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                          {faq.category}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Skeleton loading preview */}
          {isLoading && (
            <div className="flex flex-col items-start space-y-2">
              <div className="flex items-center space-x-1.5 text-xs text-gray-400">
                <Bot className="w-3.5 h-3.5 text-[#111827] dark:text-gray-100" />
                <span>Finding the best answer for you...</span>
              </div>
              <div className="bg-white dark:bg-gray-800 border border-gray-100 rounded-lg p-4 w-[60%] shadow-sm space-y-3">
                <div className="animate-pulse w-[100%]" style={{ background: '#E5E7EB', borderRadius: '4px', height: '16px', filter: 'blur(3px)' }} />
                <div className="animate-pulse w-[80%]" style={{ background: '#E5E7EB', borderRadius: '4px', height: '16px', filter: 'blur(3px)' }} />
                <div className="animate-pulse w-[60%]" style={{ background: '#E5E7EB', borderRadius: '4px', height: '16px', filter: 'blur(3px)' }} />
              </div>
            </div>
          )}

          {/* Selected related FAQ preview panel */}
          <AnimatePresence>
            {selectedRelatedFaq && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                className="mt-2 p-5 bg-white dark:bg-gray-800 border border-[#111827] dark:border-gray-100 rounded-lg shadow-md text-left relative"
              >
                <button
                  onClick={() => setSelectedRelatedFaq(null)}
                  className="absolute top-3 right-3 text-gray-400 hover:text-[#111827] dark:hover:text-gray-100 transition"
                >
                  <X className="w-4 h-4" />
                </button>
                <span className="bg-[#111827] dark:bg-gray-100 text-white dark:text-gray-900 text-[10px] px-2 py-0.5 rounded font-medium tracking-wide uppercase">
                  {selectedRelatedFaq.category || 'FAQ Result'}
                </span>
                <h3 className="font-bold text-base text-[#111827] dark:text-gray-100 mt-2 mb-3">{selectedRelatedFaq.question}</h3>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                  {selectedRelatedFaq.short_answer}
                </p>
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className={`text-[10px] font-mono ${
                    selectedRelatedFaq.confidence >= 0.7 ? 'text-green-600' :
                    selectedRelatedFaq.confidence >= 0.3 ? 'text-yellow-600' : 'text-gray-400'
                  }`}>
                    match: {Math.round((selectedRelatedFaq.confidence || 0) * 100)}%
                  </span>
                  <button
                    onClick={() => {
                      setMessages(prev => [...prev, { role: 'user', content: `Tell me more about: ${selectedRelatedFaq.question}` }]);
                      setInputVal(`Tell me more about: ${selectedRelatedFaq.question}`);
                      setSelectedRelatedFaq(null);
                    }}
                    className="text-xs font-semibold text-[#111827] dark:text-gray-100 hover:text-black border border-[#111827] dark:border-gray-100 hover:bg-[#111827] dark:hover:bg-gray-100 hover:text-white dark:text-gray-900 px-3 py-1.5 rounded transition"
                  >
                    Ask more →
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Suggested Questions — shown only at start */}
          {showSuggestions && messages.length <= 1 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {suggestedQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInputVal(q);
                    setShowSuggestionPills(false);
                  }}
                  className="flex items-center space-x-1.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 hover:border-[#111827] dark:hover:border-gray-100 text-xs text-gray-600 dark:text-gray-400 hover:text-[#111827] dark:hover:text-gray-100 px-3 py-2 rounded-full transition"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>{q}</span>
                </button>
              ))}
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input box */}
        <form onSubmit={handleSubmit} className="flex items-center space-x-2">
          <textarea
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Ask me anything..."
            className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg py-3 px-3 sm:px-4 text-sm text-[#111827] dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#111827] dark:focus:ring-gray-100 focus:border-[#111827] dark:focus:border-gray-100 resize-none h-12 min-h-[48px] max-h-[120px]"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !inputVal.trim()}
            className="p-3 bg-[#111827] dark:bg-gray-100 hover:bg-black text-white dark:text-gray-900 rounded-lg disabled:opacity-40 transition shrink-0"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>

      {/* RIGHT COLUMN: CONFIDENCE SPARKLINE */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 border-b border-gray-100 pb-3">
            <TrendingUp className="w-4 h-4 text-[#111827] dark:text-gray-100" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Confidence Analysis</h3>
          </div>

          <div className="space-y-4">
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Real-time vector search accuracy matching your user query sessions.
            </p>

            <div className="flex justify-center py-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 rounded">
              <svg width="120" height="32" viewBox="0 0 120 32" className="overflow-visible">
                {renderSparkline()}
              </svg>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-400 font-medium">Latest Score:</span>
              <span className="font-bold text-[#111827] dark:text-gray-100 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                {getLatestConfidencePct()}
              </span>
            </div>
            
            <div className="border-t border-gray-100 pt-3 text-[10px] text-gray-400 flex items-start space-x-1.5 leading-relaxed">
              <Info className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
              <span>
                Scores above 96% use direct db answers. Scores between 70-95% trigger LLM refinement. Scores under 70% escalate to ticket review.
              </span>
            </div>
          </div>
        </div>

        {/* Permanent Escalation Option */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm">
          <div className="flex flex-col items-center text-center space-y-3">
             <Clipboard className="w-5 h-5 text-gray-400" />
             <h3 className="text-sm font-semibold text-[#111827] dark:text-gray-100">Need Human Help?</h3>
             <p className="text-xs text-gray-500 dark:text-gray-400">If Yaksha isn't solving your problem, you can manually raise a query to our support engineers.</p>
             <button onClick={() => navigate('/escalate')} className="bg-white dark:bg-gray-800 border border-[#111827] dark:border-gray-100 text-[#111827] dark:text-gray-100 hover:bg-gray-50 dark:bg-gray-900/50 font-semibold px-4 py-2 text-xs rounded transition mt-2 w-full">
               Raise a Query
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default YakshaAI;
