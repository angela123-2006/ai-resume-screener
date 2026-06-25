import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jobsApi } from '../api/jobs';

export const useJobs = () => {
  return useQuery({
    queryKey: ['jobs'],
    queryFn: jobsApi.getAll,
  });
};

export const useMyJobs = () => {
  return useQuery({
    queryKey: ['my-jobs'],
    queryFn: jobsApi.getMyJobs,
  });
};

export const useJob = (jobId: number, enabled = true) => {
  return useQuery({
    queryKey: ['jobs', jobId],
    queryFn: () => jobsApi.getById(jobId),
    enabled: enabled && !isNaN(jobId),
  });
};

export const useCreateJob = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: jobsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
};

export const useDeleteJob = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: jobsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
};
