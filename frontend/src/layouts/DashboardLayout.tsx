import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  LayoutDashboard,
  FileText,
  UploadCloud,
  Briefcase,
  TrendingUp,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatCopilot } from '../components/ChatCopilot';

export const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isRecruiter = user?.role === 'recruiter';
  const displayEmail = user?.email || '';
  const displayLabel = displayEmail.split('@')[0];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = isRecruiter
    ? [
        { label: 'Overview', path: '/dashboard', icon: LayoutDashboard },
        { label: 'Postings', path: '/jobs', icon: Briefcase },
        { label: 'All Resumes', path: '/all-resumes', icon: FileText },
        { label: 'Skill Gap Insights', path: '/insights', icon: TrendingUp },
      ]
    : [
        { label: 'My Profiles', path: '/my-resumes', icon: FileText },
        { label: 'AI Skill Parser', path: '/upload', icon: UploadCloud },
        { label: 'Search Careers', path: '/jobs', icon: Briefcase },
      ];

  return (
    <div className="flex h-screen overflow-hidden text-slate-100 relative">
      {/* Mesh Glow Background */}
      <div className="ai-glow-bg" />

      {/* Sidebar Desktop */}
      <aside className="hidden md:flex md:flex-col md:w-64 bg-slate-950/40 backdrop-blur-md border-r border-white/5 shrink-0">
        <div className="flex items-center h-16 px-6 border-b border-white/5 gap-2">
          <div className="h-8 w-8 bg-slate-900 border border-brand-purple/30 text-brand-cyan rounded-lg flex items-center justify-center shadow-[0_0_10px_rgba(0,229,255,0.1)]">
            <Sparkles className="h-4.5 w-4.5" />
          </div>
          <span className="font-bold text-base tracking-tight text-gradient-ai">
            RECRUIT.AI
          </span>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 gap-3 border ${
                  isActive
                    ? 'bg-brand-purple/20 text-brand-cyan border-brand-cyan/20 shadow-[0_0_15px_rgba(0,229,255,0.05)]'
                    : 'text-slate-400 border-transparent hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <item.icon className="h-4.5 w-4.5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Footer info */}
        <div className="p-4 border-t border-white/5 bg-slate-950/20">
          <div className="flex items-center justify-between mb-4">
            <div className="truncate pr-2">
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Access Profile</p>
              <p className="text-xs font-bold truncate text-slate-200" title={displayEmail}>
                {displayLabel}
              </p>
              <span className="inline-flex items-center px-2 py-0.5 mt-1 rounded text-[9px] font-bold bg-white/5 text-brand-cyan border border-brand-cyan/20 uppercase tracking-wide">
                {user?.role}
              </span>
            </div>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
            >
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
          </div>
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Layout Area */}
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        {/* Navbar */}
        <header className="flex items-center justify-between h-16 px-4 md:px-8 bg-slate-950/20 border-b border-white/5 backdrop-blur-md shrink-0">
          <div className="flex items-center md:hidden gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-lg hover:bg-white/5"
            >
              <Menu className="h-6 w-6" />
            </button>
            <span className="font-bold text-base tracking-tight text-gradient-ai">
              RECRUIT.AI
            </span>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase">
              Authenticated Session
            </span>
            <span className="text-xs font-bold text-brand-cyan border border-brand-cyan/20 bg-brand-cyan/5 px-2 py-0.5 rounded">
              {displayEmail}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-2xs font-bold bg-white/5 border border-white/10 uppercase tracking-wider text-slate-300">
              Workspace: {user?.role}
            </span>
            <button
              onClick={toggleTheme}
              className="md:hidden p-2 rounded-lg bg-white/5 text-slate-450"
            >
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden bg-slate-950/60 backdrop-blur-sm">
            <div className="relative w-80 max-w-sm flex flex-col bg-slate-950 border-r border-white/10 h-full p-6">
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/5"
              >
                <X className="h-6 w-6" />
              </button>

              <div className="flex items-center gap-2 mb-8 mt-2">
                <div className="h-8 w-8 bg-slate-900 border border-brand-purple/30 text-brand-cyan rounded-lg flex items-center justify-center">
                  <Sparkles className="h-4.5 w-4.5" />
                </div>
                <span className="font-bold text-base tracking-tight text-gradient-ai">
                  RECRUIT.AI
                </span>
              </div>

              <nav className="flex-1 space-y-1.5">
                {navItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all gap-3 border ${
                        isActive
                          ? 'bg-brand-purple/20 text-brand-cyan border-brand-cyan/20'
                          : 'text-slate-400 border-transparent hover:bg-white/5'
                      }`
                    }
                  >
                    <item.icon className="h-4.5 w-4.5" />
                    {item.label}
                  </NavLink>
                ))}
              </nav>

              <div className="pt-6 border-t border-white/5">
                <div className="flex items-center gap-3 mb-6">
                  <div className="truncate flex-1">
                    <p className="text-[10px] text-slate-500 font-semibold uppercase">Access Profile</p>
                    <p className="text-sm font-bold truncate text-slate-200">
                      {displayEmail}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="min-h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Recruiter Chat Copilot Floating panel */}
      {isRecruiter && <ChatCopilot />}
    </div>
  );
};
