import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, Lightbulb, CheckCircle, AlertCircle, ImagePlus, X } from 'lucide-react';
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

  // Image upload
  const [attachedImages, setAttachedImages] = useState([]); // array of { file, preview }
  const fileInputRef = useRef(null);

  // 1. Pass-Through check on mount
  useEffect(() => {
    if (lastFailedQuery) {
      setDescription(lastFailedQuery);
      setPrefilled(true);
      // Reset after pre-filling so it doesn't persist forever across tabs
      setLastFailedQuery('');
    }
  }, [lastFailedQuery, setLastFailedQuery]);

  // Relaxed score calculation — matches the updated QualityMeter
  const calculateScore = (subj, desc) => {
    let score = 0;
    if (!subj || !desc) return 0;
    if (desc.split(' ').length > 10) score += 1;
    if (desc.length > 50) score += 1;
    if (subj.split(' ').length >= 2) score += 1;
    if (/\d|\/|error|issue|problem|page|button|login|not working|help|crash/i.test(desc)) score += 1;
    if (desc.length > 150) score += 1;
    return score;
  };

  const score = calculateScore(subject, description);

  // Submit is allowed if the user has provided a basic subject, description, and valid email
  const canSubmit = description.length > 10 && subject.length > 3 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

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

  // Image upload handler
  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    const maxImages = 3;
    const remaining = maxImages - attachedImages.length;
    
    if (remaining <= 0) return;

    const newImages = files.slice(0, remaining).map(file => ({
      file,
      preview: URL.createObjectURL(file),
      name: file.name,
      size: (file.size / 1024).toFixed(1) + ' KB'
    }));

    setAttachedImages(prev => [...prev, ...newImages]);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index) => {
    setAttachedImages(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  // Cleanup previews on unmount
  useEffect(() => {
    return () => {
      attachedImages.forEach(img => URL.revokeObjectURL(img.preview));
    };
  }, []);

  // 3. Submit handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading || !canSubmit) return;

    setIsLoading(true);
    setTicketId(null);

    try {
      // Build description with image info if attached
      let fullDescription = description;
      if (attachedImages.length > 0) {
        fullDescription += `\n\n--- Attached Screenshots (${attachedImages.length}) ---\n`;
        
        const base64Promises = attachedImages.map(img => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve({ name: img.name, size: img.size, data: reader.result });
            reader.onerror = reject;
            reader.readAsDataURL(img.file);
          });
        });
        
        const base64Images = await Promise.all(base64Promises);
        
        base64Images.forEach((img, i) => {
          fullDescription += `\n**Image ${i + 1}: ${img.name} (${img.size})**\n![${img.name}](${img.data})\n`;
        });
      }

      const res = await submitQuery({ email, subject, description: fullDescription });
      if (res.success) {
        setTicketId(res.data.id);
        // Clear fields
        setEmail('');
        setSubject('');
        setDescription('');
        setPrefilled(false);
        setShowDuplicatePanel(false);
        setAttachedImages([]);
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
    <div className="max-w-xl mx-auto space-y-6 px-4 sm:px-0">
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#111827] dark:text-gray-100">Submit a Support Query</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Describe your issue and our team will help you out. No formalities needed.</p>
      </div>

      {/* Success banner */}
      <AnimatePresence>
        {ticketId && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800/50 text-green-800 dark:text-green-200 p-4 rounded-lg flex items-start space-x-3 text-sm shadow-sm"
          >
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Query submitted successfully.</p>
              <p className="text-xs text-green-700 dark:text-green-300 mt-1">Your tracking reference ID is:</p>
              <code className="text-xs bg-green-100 dark:bg-green-800/50 px-1.5 py-0.5 rounded font-mono font-bold mt-1.5 block select-all w-fit">
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
            className="bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800/50 text-blue-800 dark:text-blue-200 px-4 py-3 rounded-lg flex items-center space-x-2.5 text-xs shadow-xs"
          >
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="font-medium">Form pre-filled from your last AI chat session. Feel free to revise.</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 sm:p-6 shadow-sm">
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
            placeholder="your@email.com"
            className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-[#111827] dark:focus:ring-gray-100 focus:border-[#111827] dark:focus:border-gray-100 text-sm text-[#111827] dark:text-gray-100"
            disabled={isLoading}
          />
        </div>

        {/* Subject Field */}
        <div className="space-y-1 relative">
          <label htmlFor="subject" className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            What's the issue about?
          </label>
          <input
            id="subject"
            type="text"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="E.g., Can't access my NOC certificate"
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
                className="overflow-hidden mt-2 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800/50 text-yellow-900 dark:text-yellow-200 rounded-md p-3.5 flex flex-col space-y-2 text-xs md:text-sm"
              >
                <div className="flex items-center space-x-2">
                  <Lightbulb className="w-4 h-4 text-yellow-700 dark:text-yellow-400 shrink-0" />
                  <span className="font-semibold text-yellow-950 dark:text-yellow-100">Similar issue already solved!</span>
                </div>
                <p className="text-[11px] text-yellow-800 dark:text-yellow-300">
                  We found a resolved knowledge base match. Check if this answers your question first!
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
            Tell us more
          </label>
          <textarea
            id="description"
            required
            rows="4"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what happened, what you expected, or what you need help with..."
            className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-[#111827] dark:focus:ring-gray-100 focus:border-[#111827] dark:focus:border-gray-100 text-sm text-[#111827] dark:text-gray-100 resize-y min-h-[100px]"
            disabled={isLoading}
          />
        </div>

        {/* Image Upload */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Screenshots <span className="text-gray-400 normal-case">(optional, max 3)</span>
            </label>
            {attachedImages.length < 3 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center space-x-1.5 text-xs font-semibold text-[#111827] dark:text-gray-100 hover:text-black border border-gray-200 dark:border-gray-700 hover:border-[#111827] dark:hover:border-gray-100 px-3 py-1.5 rounded transition"
              >
                <ImagePlus className="w-3.5 h-3.5" />
                <span>Add Image</span>
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageSelect}
            className="hidden"
          />

          {/* Attached images preview */}
          {attachedImages.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {attachedImages.map((img, index) => (
                <div key={index} className="relative group rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                  <img
                    src={img.preview}
                    alt={img.name}
                    className="w-full h-20 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-1 right-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <p className="text-[9px] text-gray-500 dark:text-gray-400 p-1 truncate">{img.name}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quality Meter Component */}
        <QualityMeter description={description} subject={subject} />

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading || !canSubmit}
          className="w-full py-3 bg-[#111827] dark:bg-gray-100 hover:bg-black text-white dark:text-gray-900 font-bold rounded-lg text-sm transition disabled:opacity-40"
        >
          {isLoading ? 'Submitting...' : 'Submit Support Ticket'}
        </button>

        {!canSubmit && description.length > 0 && (
          <p className="text-[11px] text-gray-400 text-center">
            Add a bit more detail to enable submission
          </p>
        )}
      </form>
    </div>
  );
}

export default EscalationForm;
