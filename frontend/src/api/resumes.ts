import api from './axios';
import type { ResumeItem, ResumeUploadResponse, ExtractedSkills } from '../types';

export interface ResumeDetail extends ResumeItem {
  extracted_text: string;
  extracted_skills: ExtractedSkills;
}

export const resumesApi = {
  upload: async ({ file, jobId }: { file: File; jobId: number }) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('job_id', jobId.toString());
    const res = await api.post<ResumeUploadResponse>('/resume/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },
  getMyResumes: async () => {
    const res = await api.get<ResumeItem[]>('/resume/my-resumes');
    return res.data;
  },
  getAllResumes: async () => {
    const res = await api.get<ResumeItem[]>('/resume/all');
    return res.data;
  },
  getResume: async (resumeId: number) => {
    const res = await api.get<ResumeDetail>(`/resume/${resumeId}`);
    return res.data;
  },
  delete: async (resumeId: number) => {
    const res = await api.delete<{ message: string }>(`/resume/${resumeId}`);
    return res.data;
  },
  reExtractSkills: async (resumeId: number) => {
    const res = await api.post<{ resume_id: number; extracted_skills: any }>(
      `/resume/${resumeId}/extract-skills`
    );
    return res.data;
  },
  updateStatus: async (resumeId: number, status: string, sendEmail = true) => {
    const res = await api.patch<{ resume_id: number; status: string; message: string }>(
      `/resume/${resumeId}/status`,
      { status, send_email: sendEmail }
    );
    return res.data;
  },
  getNotifications: async (resumeId: number) => {
    const res = await api.get<any[]>(`/notifications/resume/${resumeId}`);
    return res.data;
  },
};
