import React, { useState } from 'react';
import { useDashboardStats } from '../hooks/useDashboard';
import { Briefcase, FileText, CheckSquare, Award, Target, Trophy, ChevronRight, PieChart as PieChartIcon, Sparkles } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Skeleton } from '../components/Skeleton';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } }
};

export const Dashboard: React.FC = () => {
  const { data: statsData, isLoading, error } = useDashboardStats();
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((n) => (
            <Skeleton key={n} className="h-28 border border-white/5" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-80 border border-white/5 lg:col-span-2" />
          <Skeleton className="h-80 border border-white/5" />
        </div>
      </div>
    );
  }

  if (error || !statsData?.data) {
    return (
      <div className="p-6 text-center glass-card rounded-2xl">
        <h3 className="text-lg font-bold text-red-400">Database connection offline</h3>
        <p className="text-slate-400 text-sm mt-1">Make sure backend is connected to the database.</p>
      </div>
    );
  }

  const { overview, score_distribution, top_candidates } = statsData.data;

  const COLORS = ['#EF4444', '#F59E0B', '#00E5FF', '#10B981'];
  
  const chartData = [
    { name: 'Weak (0-30)', value: score_distribution['0-30'] || 0 },
    { name: 'Average (30-60)', value: score_distribution['30-60'] || 0 },
    { name: 'Good (60-80)', value: score_distribution['60-80'] || 0 },
    { name: 'Strong (80-100)', value: score_distribution['80-100'] || 0 },
  ].filter(d => d.value > 0);

  const statsCards = [
    { label: 'Open Jobs', value: overview.total_jobs, icon: Briefcase, color: 'text-brand-cyan border-brand-cyan/20 bg-brand-cyan/5 shadow-[0_0_10px_rgba(0,229,255,0.05)]' },
    { label: 'Candidates', value: overview.total_resumes, icon: FileText, color: 'text-brand-purple border-brand-purple/20 bg-brand-purple/5 shadow-[0_0_10px_rgba(110,86,207,0.05)]' },
    { label: 'Scored Resumes', value: overview.total_scores, icon: CheckSquare, color: 'text-brand-violet border-brand-violet/20 bg-brand-violet/5 shadow-[0_0_10px_rgba(124,58,237,0.05)]' },
    { label: 'Avg Match', value: `${overview.average_score}%`, icon: Target, color: 'text-accent-cyan border-accent-cyan/20 bg-accent-cyan/5 shadow-[0_0_10px_rgba(34,211,238,0.05)]' },
    { label: 'Top Score', value: `${overview.top_score}%`, icon: Award, color: 'text-accent-purple border-accent-purple/20 bg-accent-purple/5 shadow-[0_0_10px_rgba(168,85,247,0.05)]' },
  ];

  return (
    <div className="space-y-8">
      {/* Upper header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-b from-slate-100 to-slate-400 bg-clip-text text-transparent flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-brand-cyan" />
            AI Assessment Overview
          </h1>
          <p className="text-slate-450 text-sm mt-1">
            Real-time recruiter pipeline analytics & candidate matching engine metrics
          </p>
        </div>
      </motion.div>

      {/* Grid of Stats Cards */}
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {statsCards.map((card, idx) => (
          <motion.div variants={itemVariants} key={idx} className="glass-card glass-card-hover p-5 rounded-2xl flex items-center gap-4 relative overflow-hidden group">
            <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 border transition-transform duration-300 group-hover:scale-110 ${card.color}`}>
              <card.icon className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{card.label}</p>
              <h3 className="text-2xl font-extrabold text-white mt-1">{card.value}</h3>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Distribution & Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Score Distribution Donut Chart */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-6 rounded-3xl space-y-6 lg:col-span-2 relative overflow-hidden"
        >
          <div className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5 text-brand-cyan" />
            <h3 className="text-lg font-bold text-slate-200">Score Distribution Curves</h3>
          </div>
          
          {chartData.length === 0 ? (
             <div className="h-72 w-full flex items-center justify-center text-slate-500 text-sm">No distribution data available yet.</div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip 
                    contentStyle={{ 
                      background: 'rgba(15, 23, 42, 0.9)', 
                      borderColor: 'rgba(255,255,255,0.08)',
                      borderRadius: '12px',
                      color: '#fff',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
                    }}
                    itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                  />
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    onMouseEnter={(_, index) => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(undefined)}
                    stroke="none"
                  >
                    {chartData.map((_, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS[index % COLORS.length]} 
                        style={{ 
                          filter: activeIndex === index ? `drop-shadow(0px 0px 10px ${COLORS[index % COLORS.length]})` : 'none',
                          transition: 'all 0.3s ease',
                          opacity: activeIndex === undefined || activeIndex === index ? 1 : 0.6
                        }}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.div>

        {/* Leaderboard Card */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-6 rounded-3xl flex flex-col justify-between"
        >
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-accent-purple" />
              <h3 className="text-lg font-bold text-slate-200">AI Match Leaderboard</h3>
            </div>
            
            <motion.div variants={containerVariants} initial="hidden" animate="show" className="divide-y divide-white/5">
              {top_candidates.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-10">No scores generated yet.</p>
              ) : (
                top_candidates.map((cand, idx) => (
                  <motion.div variants={itemVariants} key={idx} className="flex items-center justify-between py-4 first:pt-0 last:pb-0 hover:bg-white/5 px-2 -mx-2 rounded-lg cursor-default transition-colors">
                    <div className="min-w-0 pr-3">
                      <p className="text-sm font-bold text-slate-200 truncate" title={cand.resume}>
                        {cand.resume}
                      </p>
                      <p className="text-xs text-slate-450 truncate mt-0.5">{cand.job}</p>
                    </div>
                    <span className={`inline-flex items-center justify-center text-xs font-extrabold h-8 w-12 rounded-lg shrink-0 border ${
                      cand.score >= 80
                        ? 'bg-emerald-500/10 text-emerald-450 border-emerald-500/25 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                        : cand.score >= 60
                        ? 'bg-brand-cyan/10 text-brand-cyan border-brand-cyan/25 shadow-[0_0_10px_rgba(0,229,255,0.2)]'
                        : 'bg-amber-500/10 text-amber-450 border-amber-500/25 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                    }`}>
                      {cand.score}%
                    </span>
                  </motion.div>
                ))
              )}
            </motion.div>
          </div>

          <div className="pt-4 border-t border-white/5">
            <Link
              to="/all-resumes"
              className="w-full btn-gradient-cyan flex items-center justify-center gap-1.5 text-xs font-bold py-2.5 rounded-xl cursor-pointer"
            >
              Parse More Applicants
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </motion.div>

      </div>
    </div>
  );
};

