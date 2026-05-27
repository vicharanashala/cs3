import React, { createContext, useContext, useState } from 'react';

const AppContext = createContext(undefined);

export function AppProvider({ children }) {
  const [lastFailedQuery, setLastFailedQuery] = useState('');
  const [confidenceHistory, setConfidenceHistory] = useState([]);
  const [activeView, setActiveView] = useState('faq'); // 'faq' | 'yaksha' | 'escalation' | 'admin'
  const [isLoading, setIsLoading] = useState(false);

  const pushConfidence = (score) => {
    const parsedScore = parseFloat(score);
    if (!isNaN(parsedScore)) {
      setConfidenceHistory((prev) => [...prev, parsedScore]);
    }
  };

  const value = {
    lastFailedQuery,
    setLastFailedQuery,
    confidenceHistory,
    setConfidenceHistory,
    pushConfidence,
    activeView,
    setActiveView,
    isLoading,
    setIsLoading,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

export default AppProvider;
