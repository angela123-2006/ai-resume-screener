import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboard';

export const useDashboardStats = (enabled = true) => {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: dashboardApi.getStats,
    enabled,
  });
};

export const useDashboardInsights = (enabled = true) => {
  return useQuery({
    queryKey: ['dashboard-insights'],
    queryFn: dashboardApi.getInsights,
    enabled,
  });
};

export const useJobAnalytics = (jobId: number, enabled = true) => {
  return useQuery({
    queryKey: ['job-analytics', jobId],
    queryFn: () => dashboardApi.getJobAnalytics(jobId),
    enabled: enabled && !isNaN(jobId),
  });
};
