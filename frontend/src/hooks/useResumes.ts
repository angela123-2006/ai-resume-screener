import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { resumesApi } from '../api/resumes';

export const useMyResumes = (enabled = true) => {
  return useQuery({
    queryKey: ['my-resumes'],
    queryFn: resumesApi.getMyResumes,
    enabled,
  });
};

export const useAllResumes = (enabled = true) => {
  return useQuery({
    queryKey: ['all-resumes'],
    queryFn: resumesApi.getAllResumes,
    enabled,
  });
};

export const useResume = (resumeId: number | null) => {
  return useQuery({
    queryKey: ['resume', resumeId],
    queryFn: () => resumesApi.getResume(resumeId!),
    enabled: !!resumeId,
  });
};

export const useUploadResume = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resumesApi.upload,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-resumes'] });
      queryClient.invalidateQueries({ queryKey: ['all-resumes'] });
    },
  });
};

export const useDeleteResume = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resumesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-resumes'] });
      queryClient.invalidateQueries({ queryKey: ['all-resumes'] });
    },
  });
};

export const useReExtractSkills = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resumesApi.reExtractSkills,
    onSuccess: (_, resumeId) => {
      queryClient.invalidateQueries({ queryKey: ['resume-scores', resumeId] });
      queryClient.invalidateQueries({ queryKey: ['my-resumes'] });
    },
  });
};

export const useUpdateResumeStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ resumeId, status, sendEmail }: { resumeId: number; status: string; sendEmail?: boolean }) =>
      resumesApi.updateStatus(resumeId, status, sendEmail),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['job-rankings'] });
      queryClient.invalidateQueries({ queryKey: ['my-resumes'] });
      queryClient.invalidateQueries({ queryKey: ['resume-notifications', variables.resumeId] });
    },
  });
};

export const useResumeNotifications = (resumeId: number) => {
  return useQuery({
    queryKey: ['resume-notifications', resumeId],
    queryFn: () => resumesApi.getNotifications(resumeId),
    enabled: !isNaN(resumeId) && resumeId > 0,
  });
};
