import React from 'react';

export function QualityMeter({ description = '', subject = '' }) {
  // Score computation logic on every render
  const getScore = () => {
    let score = 0;
    const descWords = description.trim().split(/\s+/).filter(Boolean);
    const subjWords = subject.trim().split(/\s+/).filter(Boolean);

    if (descWords.length > 20) score += 1;
    if (description.includes('?')) score += 1;
    if (/expected|actual|should|but/i.test(description)) score += 1;
    if (description.length > 100) score += 1;
    if (subjWords.length >= 3) score += 1;

    return score;
  };

  const score = getScore();

  const getHint = () => {
    if (score <= 1) {
      return {
        text: "Add more detail to help the team understand your issue.",
        colorClass: "text-red-600 font-semibold"
      };
    }
    if (score <= 3) {
      return {
        text: "Good start. Adding expected vs actual behaviour helps.",
        colorClass: "text-amber-600 font-semibold"
      };
    }
    return {
      text: "Great description. Your query will be resolved faster.",
      colorClass: "text-green-600 font-semibold"
    };
  };

  const hint = getHint();

  return (
    <div className="bg-gray-50 border border-gray-150 rounded-md p-4 space-y-2.5">
      <div className="flex justify-between items-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
        <span>Description Quality</span>
        <span className="text-[#111827]">{score}/5</span>
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
                  ? 'bg-[#111827] border-[#111827] scale-110'
                  : 'bg-transparent border-gray-300'
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
