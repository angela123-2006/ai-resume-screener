import api from './axios';

export const chatbotApi = {
  sendMessage: async (message: string, history: Array<{ sender: string; text: string }>) => {
    const res = await api.post<{ reply: string }>('/chat', { message, history });
    return res.data;
  },
  sendDraft: async (data: { email: string; subject: string; body: string; resume_id?: number | null }) => {
    const res = await api.post<{ message: string }>('/chat/send-draft', data);
    return res.data;
  },
  sendMessageStream: async (
    message: string,
    history: Array<{ sender: string; text: string }>,
    onChunk: (chunk: string) => void
  ) => {
    const token = localStorage.getItem('access_token');
    const baseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000') + '/api';

    const response = await fetch(`${baseUrl}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ message, history })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to connect to stream');
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No readable stream available');

    const decoder = new TextDecoder('utf-8');
    let done = false;
    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        const chunk = decoder.decode(value, { stream: !done });
        onChunk(chunk);
      }
    }
  },
  sendBulk: async (data: {
    emails: string[];
    subject: string;
    body_template: string;
    resume_ids: number[];
    status: string;
  }) => {
    const res = await api.post<{ message: string }>('/chat/send-bulk', data);
    return res.data;
  }
};
