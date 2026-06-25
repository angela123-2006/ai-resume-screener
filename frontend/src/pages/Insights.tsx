import React from 'react';
import { useDashboardInsights } from '../hooks/useDashboard';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { AlertCircle, FileSpreadsheet, TrendingDown, RefreshCw } from 'lucide-react';

export const Insights: React.FC = () => {
  const { data: insightsData, isLoading, error, refetch } = useDashboardInsights();

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-48 bg-slate-800 rounded"></div>
        <div className="h-96 bg-slate-900/50 border border-white/5 rounded-3xl"></div>
      </div>
    );
  }

  if (error || !insightsData?.data) {
    return (
      <div className="p-6 text-center glass-card rounded-2xl">
        <h3 className="text-lg font-bold text-red-400">Error Loading Insights</h3>
        <p className="text-slate-400 text-sm mt-1 mb-4">Please make sure the server database is connected.</p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-purple text-white font-semibold hover:bg-brand-violet transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  const { top_missing_skills, total_evaluations } = insightsData.data;

  const chartData = top_missing_skills.map((item) => ({
    skill: item.skill.charAt(0).toUpperCase() + item.skill.slice(1),
    count: item.count,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-b from-slate-100 to-slate-400 bg-clip-text text-transparent flex items-center gap-2">
            <TrendingDown className="h-7 w-7 text-red-400" />
            Skill Gap Analytics
          </h1>
          <p className="text-slate-450 text-sm mt-1">
            Aggregated missing competencies derived from all processed evaluations
          </p>
        </div>
        
        <div className="glass-card rounded-xl px-4 py-2 flex items-center gap-2 border border-white/5">
          <FileSpreadsheet className="h-4.5 w-4.5 text-brand-cyan" />
          <span className="text-xs font-bold text-slate-300">
            Assessments Logged: {total_evaluations}
          </span>
        </div>
      </div>

      <div className="glass-card p-6 rounded-3xl space-y-6">
        <div className="flex items-center gap-2 border-b border-white/5 pb-4">
          <TrendingDown className="h-5 w-5 text-red-400" />
          <h3 className="text-lg font-bold text-slate-200">Competency Deficits</h3>
        </div>

        {chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-slate-500 space-y-3">
            <AlertCircle className="h-8 w-8 text-slate-600" />
            <p className="font-bold text-slate-300">No Deficit Data Logged</p>
            <p className="text-xs text-slate-450 max-w-xs leading-relaxed">
              Skill gaps generate dynamically once you perform matches on applicant profiles.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-400 leading-relaxed max-w-2xl">
              This chart catalogs the frequency of missing qualifications. Recruiters can leverage this data to refine targeting stack or adjust candidate requirements.
            </p>
            
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 40, bottom: 10 }}
                >
                  <defs>
                    <linearGradient id="deficit-grad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#6E56CF" stopOpacity={0.2}/>
                      <stop offset="100%" stopColor="#EF4444" stopOpacity={0.8}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.03)" />
                  <XAxis type="number" fontSize={11} stroke="#64748b" tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis
                    dataKey="skill"
                    type="category"
                    fontSize={11}
                    stroke="#64748b"
                    tickLine={false}
                    axisLine={false}
                    width={100}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'rgba(15, 23, 42, 0.9)', 
                      borderColor: 'rgba(255,255,255,0.08)',
                      borderRadius: '12px',
                      color: '#fff' 
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18}>
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill="url(#deficit-grad)" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
