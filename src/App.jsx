import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Bot, MessageSquare, LayoutDashboard, Moon, Sun } from 'lucide-react';
import { AppProvider, useApp } from './store/AppContext';
import FAQPortal from './pages/FAQPortal';
import YakshaAI from './pages/YakshaAI';
import EscalationForm from './pages/EscalationForm';
import AdminDashboard from './pages/AdminDashboard';

// Page animation wrapper
function PageWrapper({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="w-full"
    >
      {children}
    </motion.div>
  );
}

// Navigation Bar
function Navbar() {
  const location = useLocation();
  const { isLoading, theme, toggleTheme } = useApp();

  const menuItems = [
    { path: '/', label: 'FAQ', icon: BookOpen },
    { path: '/yaksha', label: 'Yaksha AI', icon: Bot },
    { path: '/admin', label: 'Admin', icon: LayoutDashboard },
  ];

  return (
    <nav className="border-b border-gray-200 dark:border-gray-800 bg-[#FDFDFD] dark:bg-gray-900 sticky top-0 z-50 select-none shadow-sm transition-colors duration-200">
      <div className="max-w-6xl mx-auto px-3 sm:px-6">
        <div className="flex justify-between items-center h-14 sm:h-16">
          <div className="flex items-center space-x-1.5 sm:space-x-2">
            <span className="font-bold text-[#111827] dark:text-gray-50 tracking-tight font-sans text-base sm:text-xl">SAMAGAMA</span>
            <span className="bg-[#111827] dark:bg-gray-100 text-white dark:text-gray-900 text-[8px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded font-medium">FAQ</span>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-6">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-1 sm:space-x-1.5 h-14 sm:h-16 px-0.5 sm:px-1 border-b-2 text-xs sm:text-sm transition-all duration-200 ${
                    isActive
                      ? 'border-[#111827] dark:border-gray-100 text-[#111827] dark:text-gray-100 font-semibold'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-[#111827] dark:hover:text-gray-100 hover:border-gray-300 dark:hover:border-gray-600'
                  } ${isLoading ? 'pointer-events-none opacity-50' : ''}`}
                >
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden xs:inline sm:inline">{item.label}</span>
                </Link>
              );
            })}
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 my-auto rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
              aria-label="Toggle Dark Mode"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

// Animated routes container
function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageWrapper><FAQPortal /></PageWrapper>} />
        <Route path="/yaksha" element={<PageWrapper><YakshaAI /></PageWrapper>} />
        <Route path="/escalate" element={<PageWrapper><EscalationForm /></PageWrapper>} />
        <Route path="/admin" element={<PageWrapper><AdminDashboard /></PageWrapper>} />
      </Routes>
    </AnimatePresence>
  );
}

export function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-[#FDFDFD] dark:bg-gray-900 font-sans text-[#111827] dark:text-gray-100 flex flex-col transition-colors duration-200">
          <Navbar />
          <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
            <AnimatedRoutes />
          </main>
        </div>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
