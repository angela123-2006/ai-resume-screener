import api from './axios';
import type { JobItem } from '../types';

export const jobsApi = {
  create: async (data: { title: string; description: string }) => {
    const res = await api.post<JobItem>('/jobs/create', data);
    return res.data;
  },
  getAll: async () => {
    const res = await api.get<JobItem[]>('/jobs/all');
    return res.data;
  },
  getMyJobs: async () => {
    const res = await api.get<JobItem[]>('/jobs/my');
    return res.data;
  },
  getById: async (jobId: number) => {
    const res = await api.get<JobItem>(`/jobs/${jobId}`);
    return res.data;
  },
  delete: async (jobId: number) => {
    const res = await api.delete<{ message: string }>(`/jobs/${jobId}`);
    return res.data;
  },
  update: async (jobId: number, data: { title: string; description: string; location_type?: string; location?: string }) => {
    const res = await api.put<JobItem>(`/jobs/${jobId}`, data);
    return res.data;
  },
};
