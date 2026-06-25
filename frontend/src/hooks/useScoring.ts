import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { scoringApi } from '../api/scoring';

export const useScoreResume = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ resumeId, jobId }: { resumeId: number; jobId: number }) =>
      scoringApi.scoreResume(resumeId, jobId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['resume-scores', data.resume_id] });
      queryClient.invalidateQueries({ queryKey: ['job-rankings', data.job_id] });
      queryClient.invalidateQueries({ queryKey: ['score-explanation', data.resume_id, data.job_id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['job-analytics', data.job_id] });
    },
  });
};

export const useResumeScores = (resumeId: number, enabled = true) => {
  return useQuery({
    queryKey: ['resume-scores', resumeId],
    queryFn: () => scoringApi.getResumeScores(resumeId),
    enabled: enabled && !isNaN(resumeId),
  });
};

import { useAuth } from '../contexts/AuthContext';

export const useJobRankings = (jobId: number, enabled = true) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['job-rankings', jobId, user?.company_id],
    queryFn: () => scoringApi.getJobRankings(jobId),
    enabled: enabled && !isNaN(jobId),
  });
};

export const useExplainScore = (resumeId: number, jobId: number, enabled = true) => {
  return useQuery({
    queryKey: ['score-explanation', resumeId, jobId],
    queryFn: () => scoringApi.explainScore(resumeId, jobId),
    enabled: enabled && !isNaN(resumeId) && !isNaN(jobId),
    retry: false, // Handled empty or missing score gracefully
  });
};

export const useUpdateScoreStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ resumeId, jobId, status }: { resumeId: number; jobId: number; status: string }) =>
      scoringApi.updateStatus(resumeId, jobId, status),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['resume-scores', data.resume_id] });
      queryClient.invalidateQueries({ queryKey: ['job-rankings', data.job_id] });
    },
  });
};

export const useInviteCandidate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ resumeId, jobId }: { resumeId: number; jobId: number }) =>
      scoringApi.inviteCandidate(resumeId, jobId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['resume-scores', data.resume_id] });
      queryClient.invalidateQueries({ queryKey: ['job-rankings', data.job_id] });
    },
  });
};

export const useOverrideScore = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ resumeId, jobId, flagged, note }: { resumeId: number; jobId: number; flagged: boolean; note: string | null }) =>
      scoringApi.overrideScore(resumeId, jobId, flagged, note),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['resume-scores', data.resume_id] });
      queryClient.invalidateQueries({ queryKey: ['job-rankings', data.job_id] });
      queryClient.invalidateQueries({ queryKey: ['score-explanation', data.resume_id, data.job_id] });
    },
  });
};
