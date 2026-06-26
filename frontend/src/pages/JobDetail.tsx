import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useJob } from '../hooks/useJobs';
import { useAuth } from '../contexts/AuthContext';
import { useJobRankings, useOverrideScore, useScoreResume } from '../hooks/useScoring';
import { useMyResumes, useResume } from '../hooks/useResumes';
import { useJobAnalytics } from '../hooks/useDashboard';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { resumesApi } from '../api/resumes';
import { Briefcase, ArrowLeft, ChevronRight, BarChart2, Flag, FileText, X, GripVertical } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';

const COLUMNS = [
  { id: 'pending', title: 'Pending', color: 'border-slate-800' },
  { id: 'shortlisted', title: 'Shortlisted', color: 'border-blue-500/30' },
  { id: 'interview', title: 'Interviewing', color: 'border-brand-purple/30' },
  { id: 'hired', title: 'Hired', color: 'border-emerald-500/30' },
  { id: 'rejected', title: 'Rejected', color: 'border-red-500/30' }
];

export const JobDetail: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const idNum = parseInt(jobId || '0', 10);
  const { user } = useAuth();
  
  const { data: job, isLoading: jobLoading } = useJob(idNum);
  const isRecruiter = user?.role === 'recruiter';
  
  const { data: rankings, isLoading: rankingsLoading } = useJobRankings(idNum, isRecruiter);
  const { data: analytics, isLoading: analyticsLoading } = useJobAnalytics(idNum, isRecruiter);
  const overrideMutation = useOverrideScore();
  const scoreMutation = useScoreResume();
  const queryClient = useQueryClient();

  // 1. Optimistic Update and Rollback status update mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ resumeId, status, sendEmail }: { resumeId: number; status: string; sendEmail?: boolean }) =>
      resumesApi.updateStatus(resumeId, status, sendEmail),
    onMutate: async ({ resumeId, status }) => {
      // Cancel any outgoing query refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['job-rankings', idNum, user?.company_id] });

      // Snapshot the previous rankings state
      const previousRankings = queryClient.getQueryData(['job-rankings', idNum, user?.company_id]);

      // Optimistically update the cache to prevent snapping back
      queryClient.setQueryData(['job-rankings', idNum, user?.company_id], (old: any[] | undefined) => {
        if (!old) return [];
        return old.map(r => r.resume_id === resumeId ? { ...r, status } : r);
      });

      // Return context containing previous value for rollback
      return { previousRankings };
    },
    onError: (_err, _variables, context: any) => {
      // Rollback to the snapshotted state on API failure
      if (context?.previousRankings) {
        queryClient.setQueryData(['job-rankings', idNum, user?.company_id], context.previousRankings);
      }
      alert('Failed to update candidate status. Please try again.');
    },
    onSuccess: () => {
      // Refetch rankings to sync with the database confirmed state
      queryClient.invalidateQueries({ queryKey: ['job-rankings', idNum, user?.company_id] });
      queryClient.invalidateQueries({ queryKey: ['my-resumes'] });
    }
  });

  const [activeTab, setActiveTab] = useState<'details' | 'rankings' | 'analytics'>('details');
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [selectedResumeToApply, setSelectedResumeToApply] = useState<number | ''>('');
  const [viewResumeId, setViewResumeId] = useState<number | null>(null);
  const [sendEmailOnDrag, setSendEmailOnDrag] = useState(true);

  // Kanban State
  const [boardData, setBoardData] = useState<Record<string, any[]>>({
    pending: [], shortlisted: [], interview: [], hired: [], rejected: []
  });

  useEffect(() => {
    if (rankings) {
      const grouped: Record<string, any[]> = {
        pending: [], shortlisted: [], interview: [], hired: [], rejected: []
      };
      rankings.forEach(r => {
        const status = r.status || 'pending';
        if (grouped[status]) {
          grouped[status].push(r);
        } else {
          grouped['pending'].push(r);
        }
      });
      // Sort each column by rank
      Object.keys(grouped).forEach(k => {
        grouped[k].sort((a, b) => a.rank - b.rank);
      });
      setBoardData(grouped);
    }
  }, [rankings]);

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    
    const sourceCol = source.droppableId;
    const destCol = destination.droppableId;
    
    const newBoard = { ...boardData };
    const sourceList = [...newBoard[sourceCol]];
    const destList = sourceCol === destCol ? sourceList : [...newBoard[destCol]];
    
    const [draggedItem] = sourceList.splice(source.index, 1);
    
    // Local optimistic update
    draggedItem.status = destCol;
    destList.splice(destination.index, 0, draggedItem);
    
    newBoard[sourceCol] = sourceList;
    if (sourceCol !== destCol) {
      newBoard[destCol] = destList;
      // Trigger status update API call on drop
      updateStatusMutation.mutate({ 
        resumeId: Number(draggableId), 
        status: destCol, 
        sendEmail: sendEmailOnDrag 
      });
    }
    
    setBoardData(newBoard);
  };

  const { data: myResumes } = useMyResumes(!isRecruiter);
  const { data: viewedResume, isLoading: viewedResumeLoading } = useResume(viewResumeId);

  const handleApply = async () => {
    if (!selectedResumeToApply) return;
    try {
      await scoreMutation.mutateAsync({ resumeId: Number(selectedResumeToApply), jobId: idNum });
      setShowApplyModal(false);
      alert('Application submitted successfully!');
    } catch (e) {
      alert('Failed to apply or you have already applied with this resume.');
    }
  };

  if (jobLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-48 bg-slate-800 rounded"></div>
        <div className="h-64 bg-slate-900/50 border border-white/5 rounded-2xl"></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-bold text-red-400">Position Details Unavailable</h3>
        <Link to="/jobs" className="text-sm text-brand-cyan font-semibold underline mt-2 inline-block">
          Back to Career Directory
        </Link>
      </div>
    );
  }

  const distributionData = analytics?.data?.score_distribution
    ? [
        { name: 'Weak (0-30)', count: analytics.data.score_distribution['0-30'], gradient: 'url(#weak-grad)' },
        { name: 'Avg (30-60)', count: analytics.data.score_distribution['30-60'], gradient: 'url(#avg-grad)' },
        { name: 'Good (60-80)', count: analytics.data.score_distribution['60-80'], gradient: 'url(#good-grad)' },
        { name: 'Strong (80-100)', count: analytics.data.score_distribution['80-100'], gradient: 'url(#strong-grad)' },
      ]
    : [];

  return (
    <div className="max-w-5xl mx-auto space-y-6 flex flex-col h-full">
      {/* Header back navigation */}
      <Link
        to="/jobs"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-wider shrink-0"
      >
        <ArrowLeft className="h-4 w-4" />
        Return to Open Positions
      </Link>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-slate-950/40 backdrop-blur-md border border-white/5 rounded-2xl shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-brand-purple/10 text-brand-purple border border-brand-purple/20 rounded-xl flex items-center justify-center shrink-0">
            <Briefcase className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">{job.title}</h1>
            <p className="text-xs text-slate-500 mt-1">
              Active Assessment Pipeline since {new Date(job.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        {!isRecruiter && (
          <button
            onClick={() => setShowApplyModal(true)}
            className="flex items-center gap-2 px-6 py-3 rounded-xl btn-gradient font-bold text-white shadow-lg shadow-brand-cyan/20 hover:shadow-brand-cyan/40 transition-all cursor-pointer"
          >
            Apply to Position
          </button>
        )}
      </div>

      {/* Segmented controls tabs if recruiter */}
      {isRecruiter && (
        <div className="flex border-b border-white/5 gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeTab === 'details'
                ? 'border-brand-cyan text-brand-cyan'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Role Scope
          </button>
          <button
            onClick={() => setActiveTab('rankings')}
            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeTab === 'rankings'
                ? 'border-brand-cyan text-brand-cyan'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Pipeline Standings
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeTab === 'analytics'
                ? 'border-brand-cyan text-brand-cyan'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Assessment Metrics
          </button>
        </div>
      )}

      {/* Details Tab */}
      {(activeTab === 'details' || !isRecruiter) && (
        <div className="glass-card p-6 rounded-3xl space-y-4 shrink-0">
          <h3 className="font-bold text-lg border-b border-white/5 pb-3 text-slate-200">Requirements & Description</h3>
          <p className="text-slate-400 leading-relaxed whitespace-pre-wrap text-sm">
            {job.description}
          </p>
        </div>
      )}

      {/* Rankings Kanban Tab */}
      {isRecruiter && activeTab === 'rankings' && (
        <div className="flex-1 flex flex-col overflow-hidden min-h-[500px]">
          <div className="flex justify-end mb-4 px-2 shrink-0">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-350 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={sendEmailOnDrag}
                onChange={(e) => setSendEmailOnDrag(e.target.checked)}
                className="rounded border-white/10 bg-slate-950 accent-brand-cyan h-4 w-4"
              />
              Notify Candidates on Drag & Drop Status Change
            </label>
          </div>
          {rankingsLoading ? (
            <div className="p-12 text-center text-slate-500">Retrieving standings...</div>
          ) : !rankings || rankings.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-2 glass-card rounded-3xl">
              <p className="font-bold text-slate-300">No Evaluations Logged</p>
              <p className="text-xs text-slate-450">
                Score candidate profiles from the 'All Resumes' tab to populate standings here.
              </p>
            </div>
          ) : (
            <DragDropContext onDragEnd={onDragEnd}>
              <div className="flex gap-4 overflow-x-auto pb-4 h-full custom-scrollbar items-start">
                {COLUMNS.map(column => (
                  <div key={column.id} className={`flex-shrink-0 w-80 glass-card rounded-2xl flex flex-col border-t-4 ${column.color}`}>
                    <div className="px-4 py-3 border-b border-white/5 flex justify-between items-center bg-slate-950/40 rounded-t-xl">
                      <h3 className="font-bold text-sm text-slate-200 uppercase tracking-wider">{column.title}</h3>
                      <span className="bg-slate-800 text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {boardData[column.id]?.length || 0}
                      </span>
                    </div>
                    
                    <Droppable droppableId={column.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex-1 p-3 space-y-3 overflow-y-auto custom-scrollbar min-h-[150px] transition-colors ${snapshot.isDraggingOver ? 'bg-white/5' : ''}`}
                        >
                          {boardData[column.id]?.map((rank, index) => (
                            <Draggable key={rank.resume_id.toString()} draggableId={rank.resume_id.toString()} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`bg-slate-900 border border-white/10 p-4 rounded-xl shadow-lg relative group transition-all ${snapshot.isDragging ? 'shadow-brand-cyan/20 ring-1 ring-brand-cyan/50 scale-105 z-50' : 'hover:border-white/20 hover:shadow-xl'}`}
                                  style={{...provided.draggableProps.style}}
                                >
                                  <div className="flex justify-between items-start mb-2">
                                    <div className="flex flex-col min-w-0 pr-2">
                                      <div className="flex items-center gap-2">
                                        <GripVertical className="h-4 w-4 text-slate-650 opacity-50 group-hover:opacity-100 shrink-0" />
                                        <span className="font-bold text-slate-200 text-sm truncate" title={rank.candidate_name || `Resume #${rank.resume_id}`}>
                                          {rank.candidate_name || `Resume #${rank.resume_id}`}
                                        </span>
                                      </div>
                                      {rank.candidate_email && (
                                        <span className="text-[10px] text-slate-500 font-medium ml-6 truncate" title={rank.candidate_email}>
                                          {rank.candidate_email}
                                        </span>
                                      )}
                                    </div>
                                    <span className={`inline-flex items-center justify-center h-6 w-10 rounded text-[10px] font-extrabold border ${
                                      rank.score >= 80 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                      rank.score >= 60 ? 'bg-brand-cyan/10 text-brand-cyan border-brand-cyan/20' :
                                      'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                    }`}>
                                      {rank.score}%
                                    </span>
                                  </div>
                                  
                                  <p className="text-xs text-slate-400 line-clamp-3 mb-3 leading-relaxed">
                                    {rank.summary}
                                  </p>
                                  
                                  <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/5">
                                    <button
                                      onClick={() => {
                                        const note = prompt('Enter a note for flagging this score:', rank.recruiter_override_note || '');
                                        if (note !== null) {
                                          overrideMutation.mutate({ resumeId: rank.resume_id, jobId: idNum, flagged: !rank.recruiter_flagged, note });
                                        }
                                      }}
                                      className={`p-1.5 rounded-lg transition-colors ${
                                        rank.recruiter_flagged ? 'text-red-400 bg-red-500/10' : 'text-slate-500 hover:bg-white/5 hover:text-white'
                                      }`}
                                      title={rank.recruiter_flagged ? 'Remove flag' : 'Flag profile'}
                                    >
                                      <Flag className="h-3.5 w-3.5" />
                                    </button>
                                    
                                    <div className="flex gap-1.5">
                                      <button
                                        onClick={() => setViewResumeId(rank.resume_id)}
                                        className="p-1.5 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 transition-colors"
                                        title="View PDF Document"
                                      >
                                        <FileText className="h-3.5 w-3.5" />
                                      </button>
                                      <Link
                                        to={`/resumes/${rank.resume_id}/job/${idNum}`}
                                        className="p-1.5 bg-brand-cyan/10 text-brand-cyan rounded hover:bg-brand-cyan/20 transition-colors"
                                        title="View AI Report"
                                      >
                                        <ChevronRight className="h-3.5 w-3.5" />
                                      </Link>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                ))}
              </div>
            </DragDropContext>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {isRecruiter && activeTab === 'analytics' && (
        <div className="space-y-6">
          {analyticsLoading ? (
            <div className="h-80 bg-slate-905 bg-slate-900/40 rounded-2xl animate-pulse"></div>
          ) : !analytics?.data ? (
            <div className="p-8 text-center text-slate-505">Analytics report currently offline.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Stats overview */}
              <div className="glass-card p-6 rounded-3xl space-y-4">
                <h3 className="font-bold text-lg text-slate-200">Performance Metrics</h3>
                <div className="grid grid-cols-1 gap-4 pt-2">
                  <div className="p-4 rounded-xl bg-slate-950/50 border border-white/5">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">Evaluations Run</span>
                    <span className="text-2xl font-extrabold block mt-1 text-white">{analytics.data.overview.total_candidates}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950/50 border border-white/5">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">Average Match</span>
                    <span className="text-2xl font-extrabold text-brand-cyan block mt-1">{analytics.data.overview.average_score}%</span>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950/50 border border-white/5">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">Highest Competency</span>
                    <span className="text-2xl font-extrabold text-emerald-400 block mt-1">{analytics.data.overview.top_score}%</span>
                  </div>
                </div>
              </div>

              {/* Distribution */}
              <div className="glass-card p-6 rounded-3xl md:col-span-2 space-y-4">
                <div className="flex items-center gap-2">
                  <BarChart2 className="h-5 w-5 text-brand-cyan" />
                  <h3 className="font-bold text-lg text-slate-200">Applicant Score Distribution</h3>
                </div>
                
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distributionData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="weak-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#EF4444" stopOpacity={0.8}/>
                          <stop offset="100%" stopColor="#EF4444" stopOpacity={0.2}/>
                        </linearGradient>
                        <linearGradient id="avg-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.8}/>
                          <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.2}/>
                        </linearGradient>
                        <linearGradient id="good-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#00E5FF" stopOpacity={0.8}/>
                          <stop offset="100%" stopColor="#6E56CF" stopOpacity={0.2}/>
                        </linearGradient>
                        <linearGradient id="strong-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10B981" stopOpacity={0.8}/>
                          <stop offset="100%" stopColor="#10B981" stopOpacity={0.2}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                      <XAxis dataKey="name" fontSize={11} stroke="#64748b" tickLine={false} axisLine={false} />
                      <YAxis fontSize={11} stroke="#64748b" tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip 
                        contentStyle={{ 
                          background: 'rgba(15, 23, 42, 0.9)', 
                          borderColor: 'rgba(255,255,255,0.08)',
                          borderRadius: '12px',
                          color: '#fff' 
                        }}
                      />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={35}>
                        {distributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.gradient} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Apply Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm px-4">
          <div className="w-full max-w-md glass-card rounded-3xl p-6 space-y-4">
            <h3 className="font-bold text-xl text-white">Apply to {job.title}</h3>
            <p className="text-sm text-slate-400">Select which of your uploaded resumes you would like to use for this application. Our AI will assess your match instantly.</p>
            
            <select
              value={selectedResumeToApply}
              onChange={(e) => setSelectedResumeToApply(Number(e.target.value))}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-cyan"
            >
              <option value="" disabled>Select a resume...</option>
              {myResumes?.map(r => (
                <option key={r.resume_id} value={r.resume_id}>{r.filename}</option>
              ))}
            </select>
            
            <div className="flex justify-end gap-3 pt-4">
              <button onClick={() => setShowApplyModal(false)} className="px-4 py-2 text-sm font-bold text-slate-300 hover:text-white">Cancel</button>
              <button
                onClick={handleApply}
                disabled={!selectedResumeToApply || scoreMutation.isPending}
                className="px-6 py-2 rounded-xl btn-gradient font-bold text-white disabled:opacity-50"
              >
                {scoreMutation.isPending ? 'Applying...' : 'Apply & Assess'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Resume Modal */}
      {viewResumeId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm px-4">
          <div className="w-full max-w-3xl glass-card rounded-3xl p-6 space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <div>
                <h3 className="font-bold text-xl text-white">Candidate Resume</h3>
                {viewedResume && <p className="text-sm text-brand-cyan mt-1">{viewedResume.filename}</p>}
              </div>
              <button onClick={() => setViewResumeId(null)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg">
                <X className="h-5 w-5 text-white" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {viewedResumeLoading ? (
                <div className="flex justify-center items-center h-48 text-slate-500">Loading document...</div>
              ) : viewedResume ? (
                <div className="whitespace-pre-wrap text-sm text-slate-300 leading-relaxed font-mono bg-slate-950/50 p-4 rounded-xl border border-white/5">
                  {viewedResume.extracted_text}
                </div>
              ) : (
                <div className="text-red-400 p-4">Failed to load resume.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
