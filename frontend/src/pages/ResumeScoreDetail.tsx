import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMyResumes, useReExtractSkills, useResumeNotifications } from '../hooks/useResumes';
import { useJobs } from '../hooks/useJobs';
import { useScoreResume, useResumeScores, useExplainScore } from '../hooks/useScoring';
import { useAuth } from '../contexts/AuthContext';
import {
  FileText,
  ArrowLeft,
  Play,
  Loader2,
  AlertCircle,
  Award,
  CheckCircle2,
  XCircle,
  TrendingUp,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis, Tooltip } from 'recharts';

export const ResumeScoreDetail: React.FC = () => {
  const { resumeId, jobId } = useParams<{ resumeId: string; jobId?: string }>();
  const resumeIdNum = parseInt(resumeId || '0', 10);
  const jobIdNum = jobId ? parseInt(jobId, 10) : undefined;
  
  const { user } = useAuth();
  const isCandidate = user?.role === 'candidate';

  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [scoring, setScoring] = useState(false);
  const [selectedScoreIndex, setSelectedScoreIndex] = useState<number | null>(null);

  const { data: myResumes } = useMyResumes(isCandidate);
  const { data: jobs } = useJobs();
  const { data: previousScores, isLoading: scoresLoading } = useResumeScores(resumeIdNum, !jobIdNum);
  const { data: notificationLogs } = useResumeNotifications(resumeIdNum);
  const { data: singleJobExplanation, isLoading: explainLoading, error: explainError } = useExplainScore(
    resumeIdNum,
    jobIdNum || 0,
    !!jobIdNum
  );

  const reExtractMutation = useReExtractSkills();
  const scoreMutation = useScoreResume();

  const currentResume = myResumes?.find((r) => r.resume_id === resumeIdNum);
  const resumeFilename = currentResume?.filename || `Resume #${resumeIdNum}`;

  const handleReExtract = async () => {
    if (confirm('Are you sure you want to re-extract skills? This will re-run the AI analyzer on the resume text.')) {
      try {
        await reExtractMutation.mutateAsync(resumeIdNum);
        alert('Skills re-extracted successfully!');
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleScore = async () => {
    if (!selectedJobId) return;
    setScoring(true);
    try {
      await scoreMutation.mutateAsync({ resumeId: resumeIdNum, jobId: selectedJobId });
      setSelectedJobId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setScoring(false);
    }
  };

  const RenderExplanationReport = ({ explanation, score, jobTitle }: { explanation: any; score: number; jobTitle?: string }) => {
    if (!explanation) {
      return (
        <div className="p-6 bg-slate-950/40 rounded-xl text-center text-slate-500 border border-white/5">
          Scoring explanation details are missing.
        </div>
      );
    }

    const { experience_match, confirmed_strengths, unconfirmed_strengths, missing_skills, reasoning } = explanation;

    const radius = 50;
    const strokeWidth = 8;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (score / 100) * circumference;

    return (
      <div className="glass-card rounded-3xl p-6 space-y-6 relative overflow-hidden">
        {/* Top absolute glow line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-brand-purple/40 to-transparent" />

        <div className="flex flex-col md:flex-row items-center gap-6 border-b border-white/5 pb-6">
          {/* Circular Score Meter Redesign */}
          <div className="relative flex items-center justify-center shrink-0">
            <svg className="w-32 h-32 transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r={radius}
                className="stroke-white/5 fill-none"
                strokeWidth={strokeWidth}
              />
              <circle
                cx="64"
                cy="64"
                r={radius}
                className={`fill-none transition-all duration-1000 ease-out ${
                  score >= 80
                    ? 'stroke-emerald-400'
                    : score >= 60
                    ? 'stroke-brand-cyan'
                    : 'stroke-amber-400'
                }`}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-3xl font-extrabold text-white">{score}%</span>
              <span className="text-[9px] text-slate-500 uppercase font-extrabold tracking-widest">Match</span>
            </div>
          </div>

          <div className="flex-1 space-y-2 text-center md:text-left">
            <h3 className="text-xl font-bold text-slate-100">
              {jobTitle ? `Assessment Analysis: ${jobTitle}` : 'Assessment Match Score'}
            </h3>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-sm">
              <span className="text-slate-450 text-xs font-semibold uppercase tracking-wider">Experience Level:</span>
              <span className={`inline-flex px-2.5 py-0.5 rounded-lg text-xs font-extrabold uppercase border ${
                experience_match === 'good'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : experience_match === 'partial'
                  ? 'bg-brand-cyan/10 text-brand-cyan border-brand-cyan/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}>
                {experience_match}
              </span>
            </div>
          </div>
        </div>

        {/* Radar Chart & Strengths Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Radar Chart */}
          <div className="p-5 rounded-2xl border border-white/5 bg-slate-950/30 flex flex-col items-center">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-200 self-start mb-4">Competency Footprint Map</h4>
            <div className="w-full h-64">
              {(() => {
                const radarData = [
                  ...(confirmed_strengths || []).map((s: string) => ({ subject: s.length > 15 ? s.substring(0, 15) + '...' : s, Candidate: 100, Required: 100, fullMark: 100 })),
                  ...(unconfirmed_strengths || []).map((s: string) => ({ subject: s.length > 15 ? s.substring(0, 15) + '...' : s, Candidate: 50, Required: 100, fullMark: 100 })),
                  ...(missing_skills || []).map((s: string) => ({ subject: s.length > 15 ? s.substring(0, 15) + '...' : s, Candidate: 0, Required: 100, fullMark: 100 })),
                ];
                
                if (radarData.length === 0) return <div className="h-full flex items-center justify-center text-xs text-slate-500">No specific skills to map</div>;
                
                return (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                      <PolarGrid stroke="rgba(255,255,255,0.1)" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <Radar name="Required" dataKey="Required" stroke="#334155" fill="#334155" fillOpacity={0.2} />
                      <Radar name="Candidate" dataKey="Candidate" stroke="#00E5FF" fill="#00E5FF" fillOpacity={0.5} />
                      <Tooltip contentStyle={{ background: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(255,255,255,0.08)', borderRadius: '12px', color: '#fff', fontSize: '12px' }} />
                    </RadarChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>
          </div>

          <div className="space-y-6">
            <div className="p-5 rounded-2xl border border-white/5 bg-slate-950/30 space-y-3">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-200">Confirmed Strengths</h4>
              </div>
            <ul className="space-y-2">
              {confirmed_strengths?.map((skill: string, idx: number) => (
                <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0 mt-1.5" />
                  <span>{skill}</span>
                </li>
              ))}
              {unconfirmed_strengths?.map((skill: string, idx: number) => (
                <li key={idx} className="text-xs text-slate-500 flex items-start gap-2 italic">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-700 shrink-0 mt-1.5" />
                  <span>{skill} (Not explicitly matching)</span>
                </li>
              ))}
              {!confirmed_strengths?.length && !unconfirmed_strengths?.length && (
                <li className="text-xs text-slate-500">No specific strengths found</li>
              )}
            </ul>
          </div>

          <div className="p-5 rounded-2xl border border-white/5 bg-slate-950/30 space-y-3">
            <div className="flex items-center gap-2 text-red-400">
              <XCircle className="h-5 w-5" />
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-200">Competency Gaps</h4>
            </div>
            <ul className="space-y-2">
              {missing_skills?.map((skill: string, idx: number) => (
                <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0 mt-1.5" />
                  <span>{skill}</span>
                </li>
              ))}
              {!missing_skills?.length && (
                <li className="text-xs text-emerald-450 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  Possesses all required capabilities!
                </li>
              )}
            </ul>
          </div>
        </div>
        </div>

        {/* Detailed Reasoning */}
        <div className="space-y-3 pt-2">
          <h4 className="font-bold text-base flex items-center gap-2 text-slate-200">
            <TrendingUp className="h-5 w-5 text-brand-purple" />
            AI Diagnostic Explanation
          </h4>
          <p className="text-slate-400 text-sm leading-relaxed whitespace-pre-wrap">
            {reasoning}
          </p>
        </div>
      </div>
    );
  };

  if (jobIdNum) {
    if (explainLoading) {
      return (
        <div className="space-y-6 animate-pulse">
          <div className="h-10 w-48 bg-slate-800 rounded"></div>
          <div className="h-80 bg-slate-900/50 border border-white/5 rounded-2xl"></div>
        </div>
      );
    }

    if (explainError || !singleJobExplanation) {
      return (
        <div className="space-y-6">
          <Link
            to={isCandidate ? '/my-resumes' : '/all-resumes'}
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-450"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="p-6 text-center glass-card rounded-2xl space-y-2">
            <AlertCircle className="h-8 w-8 text-amber-500 mx-auto" />
            <h3 className="text-lg font-bold text-slate-200">Assessment Report Unavailable</h3>
            <p className="text-slate-450 text-xs">Calculate the score for this candidate first.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <Link
          to={`/jobs/${jobIdNum}`}
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-455 text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Return to Standings
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-extrabold bg-gradient-to-b from-slate-100 to-slate-400 bg-clip-text text-transparent">Assessment Diagnostics</h1>
          <span className="text-xs text-slate-500 font-mono">ASSESS-ID: R{resumeIdNum}-J{jobIdNum}</span>
        </div>
        <RenderExplanationReport
          explanation={singleJobExplanation.explanation}
          score={singleJobExplanation.match_score}
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link
        to="/my-resumes"
        className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Return to My Profiles
      </Link>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-slate-950/40 border border-white/5 rounded-2xl shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20 rounded-xl flex items-center justify-center shrink-0">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white truncate max-w-md" title={resumeFilename}>
              {resumeFilename}
            </h1>
            <p className="text-xs text-slate-550 mt-1">
              Resource ID: #{resumeIdNum}
            </p>
          </div>
        </div>

        {isCandidate && (
          <button
            onClick={handleReExtract}
            disabled={reExtractMutation.isPending}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-xs font-bold hover:bg-white/5 transition-all disabled:opacity-50 cursor-pointer"
          >
            {reExtractMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Re-run Parser
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Run evaluations trigger list */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card p-5 rounded-2xl space-y-4">
            <h3 className="font-bold text-sm uppercase tracking-wider text-slate-200">Calculate Match</h3>
            <p className="text-xs text-slate-450 leading-relaxed">
              Calculate matching score against any open position in the system directory.
            </p>

            <div className="space-y-3">
              <select
                value={selectedJobId || 0}
                onChange={(e) => setSelectedJobId(parseInt(e.target.value, 10) || null)}
                className="w-full text-xs rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2.5 text-slate-350 focus:outline-none focus:ring-1 focus:ring-brand-cyan"
              >
                <option value={0}>Select open role...</option>
                {jobs?.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                  </option>
                ))}
              </select>

              <button
                onClick={handleScore}
                disabled={!selectedJobId || scoring}
                className="w-full btn-gradient-cyan flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer"
              >
                {scoring ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Calculating Match...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-current" />
                    Calculate Match
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Past evaluations list */}
          <div className="glass-card p-5 rounded-2xl space-y-4">
            <h3 className="font-bold text-sm uppercase tracking-wider text-slate-200">Assessments</h3>
            
            {scoresLoading ? (
              <p className="text-xs text-slate-500">Loading history...</p>
            ) : !previousScores || previousScores.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No evaluations logged.</p>
            ) : (
              <div className="space-y-2">
                {previousScores.map((scoreObj, idx) => {
                  const jobName = jobs?.find((j) => j.id === scoreObj.job_id)?.title || `Job ID #${scoreObj.job_id}`;
                  return (
                    <button
                      key={scoreObj.id}
                      onClick={() => setSelectedScoreIndex(idx)}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                        selectedScoreIndex === idx
                          ? 'border-brand-cyan bg-brand-cyan/5 text-brand-cyan'
                          : 'border-white/5 hover:bg-white/5'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-bold truncate text-slate-255 text-slate-200">{jobName}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{new Date(scoreObj.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                          scoreObj.status === 'hired' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          scoreObj.status === 'rejected' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                          scoreObj.status === 'interview_invited' ? 'bg-brand-purple/10 text-brand-purple border-brand-purple/20' :
                          scoreObj.status === 'under_review' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          'bg-slate-500/10 text-slate-400 border-slate-500/20'
                        }`}>
                          {scoreObj.status?.replace('_', ' ') || 'applied'}
                        </span>
                        <div className="flex flex-col items-center gap-1">
                          <span className={`h-8 w-11 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                            scoreObj.match_score >= 80
                              ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20'
                              : scoreObj.match_score >= 60
                              ? 'bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20'
                              : 'bg-amber-500/10 text-amber-405 border border-amber-500/20'
                          }`}>
                            {scoreObj.match_score}%
                          </span>
                        </div>
                        {scoreObj.recruiter_flagged && (
                          <div title="This score has been flagged by a recruiter" className="ml-1 text-red-400 bg-red-400/10 p-1.5 rounded-full border border-red-500/20">
                            <AlertTriangle className="h-3.5 w-3.5" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Email History Timeline */}
          {!isCandidate && (
            <div className="glass-card p-5 rounded-2xl space-y-4">
              <h3 className="font-bold text-sm uppercase tracking-wider text-slate-200">Email History Log</h3>
              {!notificationLogs || notificationLogs.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No emails sent yet.</p>
              ) : (
                <div className="space-y-4 relative before:absolute before:inset-y-0 before:left-3 before:w-[1px] before:bg-white/5 pl-2">
                  {notificationLogs.map((log: any) => (
                    <div key={log.id} className="relative pl-6 space-y-1">
                      {/* Timeline dot */}
                      <span className={`absolute left-[9px] top-1.5 h-2 w-2 rounded-full border ${
                        log.delivery_status === 'sent' 
                          ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]' 
                          : 'bg-red-500 border-red-400 shadow-[0_0_8px_rgba(239,68,68,0.4)]'
                      }`} />
                      
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-slate-200 truncate max-w-[140px]">{log.email_subject}</span>
                        <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${
                          log.delivery_status === 'sent' 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`} title={log.error_message || undefined}>
                          {log.delivery_status}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium">Type: <span className="text-brand-cyan uppercase font-bold">{log.status}</span></p>
                      <p className="text-[9px] text-slate-500">{new Date(log.sent_at).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Detailed Assessment Panel */}
        <div className="lg:col-span-2">
          {selectedScoreIndex !== null && previousScores && previousScores[selectedScoreIndex] ? (
            <RenderExplanationReport
              explanation={previousScores[selectedScoreIndex].explanation || previousScores[selectedScoreIndex]}
              score={previousScores[selectedScoreIndex].match_score}
              jobTitle={jobs?.find((j) => j.id === previousScores[selectedScoreIndex].job_id)?.title}
            />
          ) : (
            <div className="border border-dashed border-white/10 rounded-3xl p-12 text-center text-slate-500 flex flex-col items-center justify-center space-y-2 h-full min-h-[400px]">
              <Award className="h-10 w-10 text-slate-655 text-slate-600" />
              <h4 className="font-bold text-slate-300 text-sm">Select Diagnostic Report</h4>
              <p className="text-xs text-slate-450 max-w-xs leading-relaxed">
                Choose a matched open position from your diagnostics list on the left or run a fresh assessment calculation to generate an evaluation report here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
