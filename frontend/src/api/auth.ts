import api from './axios';
import type { UserProfile } from '../types';

export const authApi = {
  register: async (data: any) => {
    const res = await api.post<{ message: string }>('/users/register', data);
    return res.data;
  },
  login: async (data: any) => {
    const res = await api.post<{ access_token: string; token_type: string }>('/users/login', data);
    return res.data;
  },
  getProfile: async () => {
    const res = await api.get<UserProfile>('/users/me');
    return res.data;
  },
};
