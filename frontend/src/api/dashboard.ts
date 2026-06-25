import api from './axios';
import type { DashboardStatsResponse, DashboardInsightsResponse, JobAnalyticsResponse } from '../types';

export const dashboardApi = {
  getStats: async () => {
    const res = await api.get<DashboardStatsResponse>('/dashboard/stats');
    return res.data;
  },
  getInsights: async () => {
    const res = await api.get<DashboardInsightsResponse>('/dashboard/insights');
    return res.data;
  },
  getJobAnalytics: async (jobId: number) => {
    const res = await api.get<JobAnalyticsResponse>(`/dashboard/job/${jobId}/analytics`);
    return res.data;
  },
};
