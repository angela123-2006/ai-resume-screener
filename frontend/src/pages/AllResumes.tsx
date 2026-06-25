import React, { useState } from 'react';
import { useAllResumes } from '../hooks/useResumes';
import { useMyJobs } from '../hooks/useJobs';
import { useScoreResume } from '../hooks/useScoring';
import { useNavigate } from 'react-router-dom';
import { FileText, Calendar, User, Briefcase, Play, Loader2, AlertCircle } from 'lucide-react';

export const AllResumes: React.FC = () => {
  const { data: resumes, isLoading: resumesLoading, error: resumesError } = useAllResumes();
  const { data: jobs, isLoading: jobsLoading } = useMyJobs();
  const scoreMutation = useScoreResume();
  const navigate = useNavigate();

  const [selectedJobs, setSelectedJobs] = useState<Record<number, number>>({});
  const [scoringId, setScoringId] = useState<number | null>(null);

  const handleJobSelect = (resumeId: number, jobId: number) => {
    setSelectedJobs((prev) => ({ ...prev, [resumeId]: jobId }));
  };

  const handleRunScoring = async (resumeId: number, resumeJobId?: number | null) => {
    const jobId = resumeJobId || selectedJobs[resumeId];
    if (!jobId) return;

    setScoringId(resumeId);
    try {
      await scoreMutation.mutateAsync({ resumeId, jobId });
      navigate(`/resumes/${resumeId}/job/${jobId}`);
    } catch (err) {
      console.error(err);
      alert('AI Evaluation failed. Please try again.');
    } finally {
      setScoringId(null);
    }
  };

  if (resumesLoading || jobsLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-48 bg-slate-800 rounded"></div>
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-20 bg-slate-905 bg-slate-900/40 rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-b from-slate-100 to-slate-400 bg-clip-text text-transparent">
          Talent Pool & Parser
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Review candidate profiles, map them to postings, and trigger neural match scoring
        </p>
      </div>

      {resumesError && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 flex gap-2">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>Failed to load applicant database.</span>
        </div>
      )}

      {resumes?.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-white/5 bg-slate-900/25 rounded-3xl p-16 text-center space-y-4">
          <div className="h-14 w-14 bg-slate-950 border border-white/5 text-slate-500 rounded-full flex items-center justify-center">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-200">No Applicants Registered</h3>
            <p className="text-slate-400 text-sm mt-1 max-w-xs leading-relaxed">
              Once candidates upload their resumes, they will automatically register in this master database.
            </p>
          </div>
        </div>
      ) : (
        <div className="glass-card rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/45 text-xs font-semibold text-slate-450 uppercase border-b border-white/5">
                  <th className="px-6 py-4">Filename</th>
                  <th className="px-6 py-4">Applicant Email</th>
                  <th className="px-6 py-4">Upload Date</th>
                  <th className="px-6 py-4">Map to Open Role</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {resumes?.map((resume) => {
                  const chosenJobId = resume.job_id || selectedJobs[resume.resume_id] || 0;
                  const isScoringThis = scoringId === resume.resume_id;

                  return (
                    <tr key={resume.resume_id} className="hover:bg-white/2 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-brand-cyan shrink-0" />
                          <span className="font-bold text-slate-200 truncate max-w-xs" title={resume.filename}>
                            {resume.filename}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-sm text-slate-300">
                          <User className="h-4 w-4 text-slate-500" />
                          <span>{resume.uploaded_by}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Calendar className="h-4 w-4" />
                          <span>{new Date(resume.uploaded_at).toLocaleDateString()}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-slate-500 shrink-0" />
                          {resume.job_id ? (
                            <span className="text-xs font-bold text-brand-cyan bg-brand-cyan/15 border border-brand-cyan/20 px-2.5 py-1 rounded-full uppercase tracking-wider">
                              {resume.job_title || 'Applied Role'}
                            </span>
                          ) : (
                            <select
                              value={chosenJobId}
                              onChange={(e) => handleJobSelect(resume.resume_id, parseInt(e.target.value, 10))}
                              className="text-xs rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-slate-350 focus:outline-none focus:ring-1 focus:ring-brand-cyan max-w-xs animate-pulse-slow"
                            >
                              <option value={0}>Select open role...</option>
                              {jobs?.map((job) => (
                                <option key={job.id} value={job.id}>
                                  {job.title}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                            resume.status === 'hired' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            resume.status === 'rejected' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                            resume.status === 'interview' || resume.status === 'interview_invited' ? 'bg-brand-purple/10 text-brand-purple border-brand-purple/20' :
                            resume.status === 'shortlisted' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                            'bg-slate-500/10 text-slate-400 border-slate-500/20'
                          }`}>
                            {resume.status || 'pending'}
                          </span>
                          <button
                            onClick={() => handleRunScoring(resume.resume_id, resume.job_id)}
                            disabled={!chosenJobId || isScoringThis}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white btn-gradient disabled:bg-slate-800 disabled:text-slate-500 hover:scale-102 hover:shadow-[0_0_10px_rgba(110,86,207,0.3)] transition-all cursor-pointer"
                            title="Evaluate Match"
                          >
                            {isScoringThis ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 fill-current" />}
                            Score
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
