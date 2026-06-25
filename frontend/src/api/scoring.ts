import api from './axios';
import type { RawScoreResponse, UnifiedScoreItem, JobRankingItem, ScoreExplanation } from '../types';

export function normalizeScore(raw: any): UnifiedScoreItem {
  return {
    id: raw.id ?? raw.score_id ?? 0,
    resume_id: raw.resume_id ?? 0,
    job_id: raw.job_id ?? 0,
    match_score: raw.match_score ?? 0,
    strengths: typeof raw.strengths === 'string' ? JSON.parse(raw.strengths || '[]') : (raw.strengths || []),
    missing_skills: typeof raw.missing_skills === 'string' ? JSON.parse(raw.missing_skills || '[]') : (raw.missing_skills || []),
    summary: raw.summary || '',
    explanation: raw.explanation || null,
    status: raw.status || 'applied',
    confidence: raw.confidence || 'medium',
    recruiter_flagged: raw.recruiter_flagged || false,
    recruiter_override_note: raw.recruiter_override_note || null,
    created_at: raw.created_at || raw.scored_at || '',
  };
}

export const scoringApi = {
  scoreResume: async (resumeId: number, jobId: number) => {
    const res = await api.post<RawScoreResponse>(`/scoring/${resumeId}/score/${jobId}`);
    return normalizeScore(res.data);
  },
  getResumeScores: async (resumeId: number) => {
    const res = await api.get<any[]>(`/scoring/${resumeId}/scores`);
    return res.data.map(normalizeScore);
  },
  getJobRankings: async (jobId: number) => {
    const res = await api.get<JobRankingItem[]>(`/scoring/job/${jobId}/rankings`);
    return res.data;
  },
  explainScore: async (resumeId: number, jobId: number) => {
    const res = await api.get<{
      resume_id: number;
      job_id: number;
      match_score: number;
      explanation: ScoreExplanation | null;
    }>(`/scoring/${resumeId}/score/${jobId}/explain`);
    return res.data;
  },
  updateStatus: async (resumeId: number, jobId: number, status: string) => {
    const res = await api.patch<RawScoreResponse>(`/scoring/${resumeId}/${jobId}/status`, { status });
    return normalizeScore(res.data);
  },
  inviteCandidate: async (resumeId: number, jobId: number) => {
    const res = await api.post<RawScoreResponse>(`/scoring/${resumeId}/invite/${jobId}`);
    return normalizeScore(res.data);
  },
  overrideScore: async (resumeId: number, jobId: number, flagged: boolean, note: string | null) => {
    const res = await api.patch<RawScoreResponse>(`/scoring/${resumeId}/${jobId}/override`, { flagged, note });
    return normalizeScore(res.data);
  },
};
