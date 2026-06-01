import React from 'react';

export function QualityMeter({ description = '', subject = '' }) {
  // Relaxed scoring — friendlier, more inclusive checks
  const getScore = () => {
    let score = 0;
    // Basic length check — just needs some substance
    if (description.split(' ').length > 10) score += 1;
    // Has enough detail to be understandable
    if (description.length > 50) score += 1;
    // Subject line has context
    if (subject.split(' ').length >= 2) score += 1;
    // Contains any specific detail (numbers, paths, feature names, etc.)
    if (/\d|\/|error|issue|problem|page|button|login|not working|help|crash/i.test(description)) score += 1;
    // Bonus: longer, detailed description
    if (description.length > 150) score += 1;
    return score;
  };

  const score = getScore();

  const getHint = () => {
    if (score <= 0) {
      return {
        text: "Tell us what's going on — even a short description helps!",
        colorClass: "text-gray-500 font-medium"
      };
    }
    if (score <= 2) {
      return {
        text: "Good start! Adding a bit more detail will help us resolve it faster.",
        colorClass: "text-amber-600 font-medium"
      };
    }
    return {
      text: "Great description! Our team will be able to help you quickly. 🎯",
      colorClass: "text-green-600 font-semibold"
    };
  };

  const hint = getHint();

  return (
    <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-150 dark:border-gray-700 rounded-md p-4 space-y-2.5">
      <div className="flex justify-between items-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        <span>Description Quality</span>
        <span className="text-[#111827] dark:text-gray-100">{score}/5</span>
      </div>

      {/* 5 Dots Indicators */}
      <div className="flex space-x-1.5 items-center">
        {[...Array(5)].map((_, index) => {
          const isFilled = index < score;
          return (
            <div
              key={index}
              className={`w-3 h-3 rounded-full border transition-all duration-200 ${
                isFilled
                  ? 'bg-[#111827] dark:bg-gray-100 border-[#111827] dark:border-gray-100 scale-110'
                  : 'bg-transparent border-gray-300 dark:border-gray-600'
              }`}
            />
          );
        })}
      </div>

      {/* Contextual Hint Text */}
      <p className={`text-xs leading-relaxed ${hint.colorClass}`}>
        {hint.text}
      </p>
    </div>
  );
}

export default QualityMeter;
