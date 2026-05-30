import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Bot, MessageSquare, LayoutDashboard } from 'lucide-react';
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
  const { isLoading } = useApp();

  const menuItems = [
    { path: '/', label: 'FAQ', icon: BookOpen },
    { path: '/yaksha', label: 'Yaksha AI', icon: Bot },
    { path: '/admin', label: 'Admin', icon: LayoutDashboard },
  ];

  return (
    <nav className="border-b border-gray-200 bg-[#FDFDFD] sticky top-0 z-50 select-none shadow-sm">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-[#111827] tracking-tight font-sans text-xl">SAMAGAMA</span>
            <span className="bg-[#111827] text-white text-[10px] px-1.5 py-0.5 rounded font-medium">FAQ</span>
          </div>
          <div className="flex space-x-6">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-1.5 h-16 px-1 border-b-2 text-sm transition-all duration-200 ${
                    isActive
                      ? 'border-[#111827] text-[#111827] font-semibold'
                      : 'border-transparent text-gray-500 hover:text-[#111827] hover:border-gray-300'
                  } ${isLoading ? 'pointer-events-none opacity-50' : ''}`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
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
        <div className="min-h-screen bg-[#FDFDFD] font-sans text-[#111827] flex flex-col">
          <Navbar />
          <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-8">
            <AnimatedRoutes />
          </main>
        </div>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
