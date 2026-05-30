import React, { createContext, useContext, useState, useEffect } from 'react';

const AppContext = createContext(undefined);

export function AppProvider({ children }) {
  const [lastFailedQuery, setLastFailedQuery] = useState('');
  const [confidenceHistory, setConfidenceHistory] = useState([]);
  const [activeView, setActiveView] = useState('faq'); // 'faq' | 'yaksha' | 'escalation' | 'admin'
  const [isLoading, setIsLoading] = useState(false);
  const [theme, setTheme] = useState('light');

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    setTheme(initialTheme);
  }, []);

  // Apply theme class to document
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

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
    theme,
    toggleTheme,
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
