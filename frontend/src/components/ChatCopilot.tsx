import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, MessageSquare, Loader2, Mail, Mic, MicOff, Volume2, VolumeX, Users, CheckSquare, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { chatbotApi } from '../api/chatbot';
import { resumesApi } from '../api/resumes';
import type { ResumeItem } from '../types';

interface Message {
  sender: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: Date;
}

// Correspondence templates generator helper
const generateEmailContent = (
  type: string,
  candidateName: string,
  companyName: string,
  jobTitle: string,
  interviewMode: string,
  interviewDate: string,
  interviewLocation: string,
  startDate: string,
  compensation: string,
  customSubject: string,
  customBody: string,
  useSched = false,
  schedLink = ''
) => {
  if (type === 'custom') {
    return { subject: customSubject, body: customBody };
  }

  let subject = '';
  let body = '';

  const dateFormatted = interviewDate
    ? new Date(interviewDate).toLocaleString([], { dateStyle: 'long', timeStyle: 'short' })
    : '[Interview Date & Time]';
  const startFormatted = startDate
    ? new Date(startDate).toLocaleDateString([], { dateStyle: 'long' })
    : '[Start Date]';

  if (type === 'shortlist') {
    subject = `Interview Invitation: ${jobTitle} at ${companyName}`;
    body = `Dear ${candidateName},\n\n` +
      `Thank you for applying for the ${jobTitle} position at ${companyName}.\n\n` +
      `We were highly impressed with your credentials and would like to invite you for an interview to discuss your background and experience further.\n\n` +
      `Here are the interview details:\n` +
      `• Mode: ${interviewMode}\n` +
      (useSched 
        ? `• Scheduling Link: Please select a convenient time slot here: ${schedLink || '[Scheduling Link]'}\n`
        : `• Date & Time: ${dateFormatted}\n`) +
      `${interviewLocation ? `• Location/Link: ${interviewLocation}\n` : ''}\n` +
      `Please let us know if you have any questions before our conversation.\n\n` +
      `Best regards,\n` +
      `Hiring Team\n` +
      `${companyName}`;
  } else if (type === 'select') {
    subject = `Job Offer: ${jobTitle} position at ${companyName}`;
    body = `Dear ${candidateName},\n\n` +
      `We are thrilled to offer you the position of ${jobTitle} at ${companyName}!\n\n` +
      `After reviewing your qualifications and speaking with you, we are confident that your skills and experience will be a fantastic asset to our team.\n\n` +
      `Here are the offer details:\n` +
      `• Title: ${jobTitle}\n` +
      `• Start Date: ${startFormatted}\n` +
      `${compensation ? `• Compensation: ${compensation}\n` : ''}\n` +
      `We will follow up shortly with a formal offer letter detailing the terms of your employment. Please confirm your acceptance of this offer by replying to this email.\n\n` +
      `Welcome to the team!\n\n` +
      `Best regards,\n` +
      `Hiring Team\n` +
      `${companyName}`;
  } else if (type === 'reject') {
    subject = `Application Status Update: ${jobTitle} at ${companyName}`;
    body = `Dear ${candidateName},\n\n` +
      `Thank you for your interest in the ${jobTitle} position at ${companyName} and for taking the time to submit your application.\n\n` +
      `We received a high volume of qualified applications, and after careful consideration, we have decided to move forward with other candidates whose profiles more closely match our current requirements.\n\n` +
      `We will keep your resume on file for future opportunities that align with your skillset. We wish you the very best in your job search and future professional endeavors.\n\n` +
      `Best regards,\n` +
      `Hiring Team\n` +
      `${companyName}`;
  }

  return { subject, body };
};

const statusMapping: Record<string, 'interview' | 'hired' | 'rejected' | 'applied'> = {
  shortlist: 'interview',
  select: 'hired',
  reject: 'rejected',
  custom: 'applied'
};

export const ChatCopilot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'system',
      text: 'Welcome to your Recruiter Copilot. Ask me queries about candidates, active roles, or request communication drafts.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Dynamic suggestions state initialized with static defaults
  const [suggestions, setSuggestions] = useState<string[]>([
    'Who are the top candidates?',
    'Draft an interview invitation email',
    'Compare candidates for React Developer',
  ]);

  // Candidate state list for email selection
  const [candidates, setCandidates] = useState<ResumeItem[]>([]);

  // Email draft modal states
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [selectedResumeId, setSelectedResumeId] = useState<number | null>(null);
  const [isEmailSending, setIsEmailSending] = useState(false);
  const [emailStatusMessage, setEmailStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Dynamic template input variables
  const [emailType, setEmailType] = useState('custom'); // 'custom' | 'shortlist' | 'select' | 'reject'
  const [companyName, setCompanyName] = useState('Default Company');
  const [jobTitle, setJobTitle] = useState('Developer');
  const [candidateName, setCandidateName] = useState('Candidate');
  const [interviewMode, setInterviewMode] = useState('Online (Google Meet)');
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewLocation, setInterviewLocation] = useState('https://meet.google.com/abc-defg-hij');
  const [startDate, setStartDate] = useState('');
  const [compensation, setCompensation] = useState('');
  const [updatePipelineStatus, setUpdatePipelineStatus] = useState(true);

  // Raw AI drafts saved as fallbacks
  const [aiDraftSubject, setAiDraftSubject] = useState('');
  const [aiDraftBody, setAiDraftBody] = useState('');

  // Voice recognition & speech synthesis states
  const [isListening, setIsListening] = useState(false);
  const [speakingMsgIndex, setSpeakingMsgIndex] = useState<number | null>(null);
  const recognitionRef = useRef<any>(null);

  // Self-scheduling template states
  const [useSchedulingLink, setUseSchedulingLink] = useState(false);
  const [schedulingLink, setSchedulingLink] = useState('https://calendly.com/recruit-ai/interview');

  // Bulk actions states
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkSelectedEmails, setBulkSelectedEmails] = useState<string[]>([]);
  const [bulkResumeIds, setBulkResumeIds] = useState<number[]>([]);
  const [bulkJobTitle, setBulkJobTitle] = useState('Developer');
  const [bulkEmailSubject, setBulkEmailSubject] = useState('');
  const [bulkEmailBody, setBulkEmailBody] = useState('');
  const [bulkEmailType, setBulkEmailType] = useState('shortlist'); // shortlist | select | reject | custom
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [bulkStatusMessage, setBulkStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      const fetchCandidates = async () => {
        try {
          const list = await resumesApi.getAllResumes();
          setCandidates(list);
        } catch (error) {
          console.error('Error fetching candidates for Copilot selector:', error);
        }
      };
      fetchCandidates();
    }
  }, [messages, isOpen]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text) return;

    if (!textToSend) {
      setInput('');
    }

    const userMsg: Message = {
      sender: 'user',
      text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Pass conversation history
      const historyPayload = messages
        .filter((m) => m.sender !== 'system')
        .map((m) => ({ sender: m.sender, text: m.text }));

      // Create empty assistant message bubble to receive stream chunks
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: '',
          timestamp: new Date(),
        },
      ]);
      setIsLoading(false); // remove initial loader since we are streaming

      let fullText = '';
      await chatbotApi.sendMessageStream(text, historyPayload, (chunk) => {
        fullText += chunk;
        setMessages((prev) => {
          const list = [...prev];
          if (list.length > 0 && list[list.length - 1].sender === 'assistant') {
            list[list.length - 1] = {
              ...list[list.length - 1],
              text: fullText,
            };
          }
          return list;
        });
      });

      // Parse suggestions from final stream text
      let replyText = fullText;
      let parsedSuggestions: string[] = [];

      const suggestionsMatch = replyText.match(/<suggestions>([\s\S]*?)<\/suggestions>/i);
      if (suggestionsMatch && suggestionsMatch[1]) {
        parsedSuggestions = suggestionsMatch[1]
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        replyText = replyText.replace(/<suggestions>[\s\S]*?<\/suggestions>/i, '').trim();
      }

      // Update last message with stripped text
      setMessages((prev) => {
        const list = [...prev];
        if (list.length > 0 && list[list.length - 1].sender === 'assistant') {
          list[list.length - 1] = {
            ...list[list.length - 1],
            text: replyText,
          };
        }
        return list;
      });

      if (parsedSuggestions.length > 0) {
        setSuggestions(parsedSuggestions);
      } else {
        setSuggestions([
          'Who are the top candidates?',
          'Draft an interview invitation email',
          'Compare candidates for React Developer',
        ]);
      }

    } catch (error: any) {
      console.error('Chat error:', error);
      const errorMsg: Message = {
        sender: 'system',
        text: 'Sorry, I encountered an issue fetching data from Gemini. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  // Re-applies templates dynamically based on variables
  const applyTemplate = (
    type = emailType,
    cName = candidateName,
    comp = companyName,
    job = jobTitle,
    mode = interviewMode,
    date = interviewDate,
    loc = interviewLocation,
    sDate = startDate,
    compVal = compensation,
    useSched = useSchedulingLink,
    schedLink = schedulingLink
  ) => {
    const content = generateEmailContent(
      type,
      cName,
      comp,
      job,
      mode,
      date,
      loc,
      sDate,
      compVal,
      aiDraftSubject,
      aiDraftBody,
      useSched,
      schedLink
    );
    setEmailSubject(content.subject);
    setEmailBody(content.body);
  };

  // Voice dictation & transcription using Web Speech API
  const startListening = () => {
    if (isListening) {
      stopListening();
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please try Chrome, Edge, or Safari.");
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-US';

    rec.onstart = () => {
      setIsListening(true);
    };

    rec.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        setInput((prev) => prev + (prev ? ' ' : '') + transcript);
      }
    };

    rec.onerror = (err: any) => {
      console.error("Speech recognition error:", err);
      setIsListening(false);
    };

    rec.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = rec;
    rec.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  // Text-To-Speech audio reader using Web Speech API
  const speakText = (text: string, msgIndex: number) => {
    if (speakingMsgIndex === msgIndex) {
      window.speechSynthesis.cancel();
      setSpeakingMsgIndex(null);
      return;
    }

    window.speechSynthesis.cancel();

    // Clean suggestion & bulk action tags, and markdown links
    let cleanText = text
      .replace(/<suggestions>[\s\S]*?<\/suggestions>/gi, '')
      .replace(/<bulk_action[\s\S]*?>[\s\S]*?<\/bulk_action>/gi, '')
      .replace(/<bulk_action[\s\S]*?>/gi, '')
      .replace(/\[([^\]]+)\]\(candidate:\d+\)/g, '$1')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.onend = () => {
      setSpeakingMsgIndex(null);
    };
    utterance.onerror = () => {
      setSpeakingMsgIndex(null);
    };

    setSpeakingMsgIndex(msgIndex);
    window.speechSynthesis.speak(utterance);
  };

  // Bulk Actions Helper Modal triggers
  const openBulkModal = (candidatesStr: string, jobStr: string) => {
    const ids = candidatesStr.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    const emailsList = candidates
      .filter(c => ids.includes(c.resume_id))
      .map(c => c.uploaded_by || '')
      .filter(email => email.length > 0);

    setBulkResumeIds(ids);
    setBulkSelectedEmails(emailsList);
    setBulkJobTitle(jobStr || 'Developer');
    setBulkEmailType('shortlist');
    setBulkStatusMessage(null);
    
    const content = generateEmailContent(
      'shortlist',
      '{name}',
      'RECRUIT.AI',
      jobStr || 'Developer',
      'Online (Google Meet)',
      '',
      'https://meet.google.com/abc-defg-hij',
      '',
      '',
      '',
      '',
      useSchedulingLink,
      schedulingLink
    );
    setBulkEmailSubject(content.subject);
    setBulkEmailBody(content.body);
    setIsBulkModalOpen(true);
  };

  const applyBulkTemplate = (
    type = bulkEmailType,
    job = bulkJobTitle,
    useSched = useSchedulingLink,
    schedLink = schedulingLink
  ) => {
    const content = generateEmailContent(
      type,
      '{name}',
      'RECRUIT.AI',
      job,
      'Online (Google Meet)',
      '',
      'https://meet.google.com/abc-defg-hij',
      '',
      '',
      '',
      '',
      useSched,
      schedLink
    );
    setBulkEmailSubject(content.subject);
    setBulkEmailBody(content.body);
  };

  const handleSendBulkEmails = async () => {
    if (bulkSelectedEmails.length === 0) {
      setBulkStatusMessage({ type: 'error', text: 'No recipient candidates selected.' });
      return;
    }

    setIsBulkSending(true);
    setBulkStatusMessage(null);

    try {
      const targetStatus = statusMapping[bulkEmailType] || 'applied';

      await chatbotApi.sendBulk({
        emails: bulkSelectedEmails,
        subject: bulkEmailSubject,
        body_template: bulkEmailBody,
        resume_ids: bulkResumeIds,
        status: targetStatus
      });

      setBulkStatusMessage({ type: 'success', text: `Successfully sent bulk correspondence to ${bulkSelectedEmails.length} candidates!` });

      setMessages((prev) => [
        ...prev,
        {
          sender: 'system',
          text: `[SYSTEM] Bulk correspondence sent to ${bulkSelectedEmails.length} candidates with subject "${bulkEmailSubject}". Pipeline status updated to [${targetStatus.toUpperCase()}].`,
          timestamp: new Date()
        }
      ]);

      setTimeout(() => {
        setIsBulkModalOpen(false);
      }, 1500);

    } catch (err: any) {
      console.error('Send bulk error:', err);
      const errMsg = err.response?.data?.detail || 'SMTP bulk mailer service failed. Please check credentials.';
      setBulkStatusMessage({ type: 'error', text: errMsg });
    } finally {
      setIsBulkSending(false);
    }
  };

  // Parses subject line and body from the assistant's drafted email text
  const openEmailModal = (draftText: string) => {
    const subjectMatch = draftText.match(/subject:\s*(.*)/i);
    let subject = 'Application Update - RECRUIT.AI';
    let body = draftText;

    if (subjectMatch && subjectMatch[1]) {
      subject = subjectMatch[1].trim();
      body = draftText.replace(/subject:\s*(.*)/i, '').trim();
    }

    setAiDraftSubject(subject);
    setAiDraftBody(body);

    const emailMatch = draftText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    let emailStr = '';
    let resumeId: number | null = null;
    let jobTitleStr = 'Developer';
    let cNameStr = 'Candidate';

    if (emailMatch && emailMatch[0]) {
      emailStr = emailMatch[0];
      const matchCandidate = candidates.find(c => c.uploaded_by?.toLowerCase() === emailStr.toLowerCase());
      if (matchCandidate) {
        resumeId = matchCandidate.resume_id;
        jobTitleStr = matchCandidate.job_title || 'Developer';
        const emailUsername = matchCandidate.uploaded_by ? matchCandidate.uploaded_by.split('@')[0] : 'Candidate';
        cNameStr = emailUsername.charAt(0).toUpperCase() + emailUsername.slice(1);
      }
    } else if (candidates.length > 0) {
      emailStr = candidates[0].uploaded_by || '';
      resumeId = candidates[0].resume_id;
      jobTitleStr = candidates[0].job_title || 'Developer';
      const emailUsername = emailStr.split('@')[0];
      cNameStr = emailUsername.charAt(0).toUpperCase() + emailUsername.slice(1);
    }

    setSelectedEmail(emailStr);
    setSelectedResumeId(resumeId);
    setJobTitle(jobTitleStr);
    setCandidateName(cNameStr);
    setCompanyName('RECRUIT.AI');
    setEmailType('custom');
    setUpdatePipelineStatus(true);
    setInterviewDate('');
    setStartDate('');
    setCompensation('');

    setEmailSubject(subject);
    setEmailBody(body);
    setEmailStatusMessage(null);
    setIsEmailModalOpen(true);
  };

  const handleRecipientChange = (email: string) => {
    setSelectedEmail(email);
    const match = candidates.find(c => c.uploaded_by === email);
    if (match) {
      setSelectedResumeId(match.resume_id);
      const job = match.job_title || 'Developer';
      setJobTitle(job);
      const emailUsername = email.split('@')[0];
      const name = emailUsername.charAt(0).toUpperCase() + emailUsername.slice(1);
      setCandidateName(name);

      applyTemplate(
        emailType,
        name,
        companyName,
        job,
        interviewMode,
        interviewDate,
        interviewLocation,
        startDate,
        compensation
      );
    }
  };

  const handleTypeChange = (type: string) => {
    setEmailType(type);
    applyTemplate(
      type,
      candidateName,
      companyName,
      jobTitle,
      interviewMode,
      interviewDate,
      interviewLocation,
      startDate,
      compensation
    );
  };

  const handleInterviewModeChange = (mode: string) => {
    setInterviewMode(mode);
    let location = '';
    if (mode.includes('Google Meet')) {
      location = 'https://meet.google.com/abc-defg-hij';
    } else if (mode.includes('Zoom')) {
      location = 'https://zoom.us/j/1234567890';
    } else {
      location = 'Headquarters, 1st Floor Conference Room';
    }
    setInterviewLocation(location);
    applyTemplate(
      emailType,
      candidateName,
      companyName,
      jobTitle,
      mode,
      interviewDate,
      location,
      startDate,
      compensation
    );
  };

  const handleSendEmail = async () => {
    if (!selectedEmail) {
      setEmailStatusMessage({ type: 'error', text: 'Please select or enter a recipient email.' });
      return;
    }

    setIsEmailSending(true);
    setEmailStatusMessage(null);

    try {
      const targetStatus = statusMapping[emailType];
      if (updatePipelineStatus && selectedResumeId && targetStatus && targetStatus !== 'applied') {
        try {
          await resumesApi.updateStatus(selectedResumeId, targetStatus, false);
        } catch (statusErr) {
          console.warn('Failed to update candidate pipeline status:', statusErr);
        }
      }

      await chatbotApi.sendDraft({
        email: selectedEmail,
        subject: emailSubject,
        body: emailBody,
        resume_id: selectedResumeId
      });

      setEmailStatusMessage({ type: 'success', text: 'Email successfully sent and logged!' });
      
      setMessages((prev) => [
        ...prev,
        {
          sender: 'system',
          text: `[SYSTEM] Correspondence sent to ${selectedEmail} with subject "${emailSubject}". Pipeline status updated to [${targetStatus.toUpperCase()}].`,
          timestamp: new Date()
        }
      ]);

      setTimeout(() => {
        setIsEmailModalOpen(false);
      }, 1500);

    } catch (err: any) {
      console.error('Send draft error:', err);
      const errMsg = err.response?.data?.detail || 'SMTP mailer service failed. Please check credentials.';
      setEmailStatusMessage({ type: 'error', text: errMsg });
    } finally {
      setIsEmailSending(false);
    }
  };

  // Option 2: Parser helper to render clickable deep links for candidates in chat text
  const renderMessageText = (text: string) => {
    const regex = /(\[[^\]]+\]\(candidate:\d+\))/g;
    const parts = text.split(regex);
    
    return parts.map((part, idx) => {
      const match = part.match(/\[([^\]]+)\]\(candidate:(\d+)\)/);
      if (match) {
        const name = match[1];
        const resumeId = match[2];
        return (
          <Link
            key={idx}
            to={`/resumes/${resumeId}`}
            className="inline-flex items-center gap-0.5 px-2 py-0.5 mx-0.5 font-extrabold text-[11px] text-brand-cyan bg-brand-cyan/15 border border-brand-cyan/20 hover:border-brand-cyan hover:bg-brand-cyan/25 rounded transition-all cursor-pointer shadow-sm align-baseline"
            title={`View profile details for ${name}`}
          >
            <Sparkles className="h-2.5 w-2.5 shrink-0 text-brand-cyan" />
            {name}
          </Link>
        );
      }
      return part;
    });
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Floating Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="glass-card w-[380px] h-[520px] rounded-2xl flex flex-col overflow-hidden mb-4 border border-white/5 shadow-2xl backdrop-blur-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-slate-950/40">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-brand-purple/20 border border-brand-cyan/20 flex items-center justify-center text-brand-cyan">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Recruiter Copilot
                  </h3>
                  <span className="text-[10px] text-brand-cyan font-medium">Gemini 2.5 Flash</span>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                aria-label="Close panel"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Message Area */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 scroll-container bg-slate-950/10">
              {messages.map((msg, index) => {
                // Strip tags from visible text rendering
                const displayMsgText = msg.text
                  .replace(/<bulk_action[^>]*>([\s\S]*?)<\/bulk_action>/gi, '')
                  .replace(/<bulk_action[^>]*>/gi, '')
                  .trim();

                return (
                  <div
                    key={index}
                    className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap border relative group flex flex-col gap-1.5 ${
                      msg.sender === 'user'
                        ? 'self-end bg-brand-purple/95 border-brand-purple/30 text-white rounded-br-none'
                        : msg.sender === 'assistant'
                        ? 'self-start bg-brand-purple/10 border-brand-purple/20 text-slate-200 rounded-bl-none'
                        : 'self-start bg-white/5 border-white/5 text-slate-400 italic text-[11px]'
                    }`}
                  >
                    <div>{renderMessageText(displayMsgText)}</div>

                    {/* Inline Bulk Operations checklist widget */}
                    {msg.sender === 'assistant' && msg.text.includes('<bulk_action') && (() => {
                      const match = msg.text.match(/<bulk_action\s+candidates="([^"]+)"\s+job="([^"]+)"\s*\/?>/i);
                      if (match) {
                        const candidatesStr = match[1];
                        const jobStr = match[2];
                        const ids = candidatesStr.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
                        const matchingCands = candidates.filter(c => ids.includes(c.resume_id));

                        if (matchingCands.length > 0) {
                          return (
                            <div className="mt-3 p-3 bg-slate-900/60 rounded-xl border border-white/10 flex flex-col gap-2 shadow-inner w-full text-slate-300">
                              <div className="flex items-center gap-1.5 text-brand-cyan border-b border-white/5 pb-1.5 mb-1">
                                <Users className="h-4 w-4" />
                                <span className="font-bold text-[10px] uppercase tracking-wider">Bulk Hiring Action ({jobStr})</span>
                              </div>
                              <div className="flex flex-col gap-1.5 max-h-[120px] overflow-y-auto scroll-container pr-1">
                                {matchingCands.map(c => (
                                  <div key={c.resume_id} className="flex items-center justify-between text-[11px] py-0.5">
                                    <span className="text-slate-350 font-medium">{c.uploaded_by?.split('@')[0].toUpperCase() || 'Candidate'}</span>
                                    <span className="text-slate-500 text-[10px]">{c.job_title || 'General Pipeline'}</span>
                                  </div>
                                ))}
                              </div>
                              <button
                                type="button"
                                onClick={() => openBulkModal(candidatesStr, jobStr)}
                                className="mt-1 flex items-center justify-center gap-1.5 w-full text-[10px] font-bold text-white bg-brand-purple hover:bg-brand-purple/80 px-3 py-2 rounded-lg transition-all cursor-pointer shadow-md"
                              >
                                <Mail className="h-3.5 w-3.5" />
                                Configure Bulk Email Invite
                              </button>
                            </div>
                          );
                        }
                      }
                      return null;
                    })()}
                    
                    {msg.sender === 'assistant' && (
                      <div className="flex items-center justify-end border-t border-brand-purple/10 pt-1.5 mt-0.5 gap-2">
                        <button
                          type="button"
                          onClick={() => speakText(msg.text, index)}
                          className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded border transition-all cursor-pointer ${
                            speakingMsgIndex === index
                              ? 'text-brand-cyan bg-brand-cyan/20 border-brand-cyan animate-pulse'
                              : 'text-slate-450 hover:text-white bg-slate-950/40 border-white/10 hover:border-white/20'
                          }`}
                          title={speakingMsgIndex === index ? "Stop voice playback" : "Read response aloud"}
                        >
                          {speakingMsgIndex === index ? <VolumeX className="h-3.5 w-3.5 text-brand-cyan" /> : <Volume2 className="h-3.5 w-3.5" />}
                          {speakingMsgIndex === index ? "Stop" : "Listen"}
                        </button>

                        {displayMsgText.length > 30 && (
                          <button
                            type="button"
                            onClick={() => openEmailModal(msg.text)}
                            className="flex items-center gap-1 text-[10px] font-bold text-brand-cyan hover:text-white bg-slate-950/40 px-2 py-1 rounded border border-brand-cyan/20 hover:border-brand-cyan transition-all cursor-pointer"
                            title="Send this draft directly to a candidate"
                          >
                            <Mail className="h-3.5 w-3.5" />
                            Send as Email
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {isLoading && (
                <div className="self-start max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs bg-brand-purple/10 border border-brand-purple/20 text-slate-400 rounded-bl-none flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin text-brand-cyan" />
                  <span>Thinking...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggestions */}
            {suggestions.length > 0 && !isLoading && (
              <div className="px-4 py-2 flex flex-col gap-1.5 bg-slate-950/20 border-t border-white/5 shrink-0">
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                  Suggested Follow-Ups
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-[85px] overflow-y-auto scroll-container py-0.5">
                  {suggestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(q)}
                      className="text-left text-[10px] text-slate-300 hover:text-brand-cyan bg-slate-900/50 hover:bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5 hover:border-brand-cyan/20 transition-all cursor-pointer truncate max-w-full font-medium"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input area */}
            <div className="p-3 border-t border-white/5 flex gap-2 bg-slate-950/40 items-center">
              <button
                type="button"
                onClick={startListening}
                className={`p-2 rounded-xl border transition-all cursor-pointer ${
                  isListening
                    ? 'bg-red-500/20 text-red-550 border-red-500/40 animate-pulse'
                    : 'bg-slate-900/60 text-slate-400 hover:text-white border-white/5 hover:border-white/10'
                }`}
                title={isListening ? "Listening... click to stop" : "Start voice dictation"}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>

              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={isListening ? "Listening..." : "Ask about candidates or roles..."}
                disabled={isLoading}
                className="flex-1 bg-slate-900/60 border border-white/5 focus:border-brand-purple rounded-xl px-3 py-2 text-xs text-slate-200 outline-none transition-colors placeholder:text-slate-500"
              />
              <button
                onClick={() => handleSend()}
                disabled={isLoading || !input.trim()}
                className="btn-gradient p-2 rounded-xl text-white disabled:opacity-50 disabled:transform-none flex items-center justify-center cursor-pointer"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileHover={{ scale: 1.08, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="w-14 h-14 rounded-full bg-gradient-to-tr from-brand-purple to-brand-violet border-none shadow-[0_8px_24px_rgba(110,86,207,0.4)] hover:shadow-[0_12px_32px_rgba(110,86,207,0.55)] cursor-pointer flex items-center justify-center text-white z-40 transition-all duration-120 relative"
            aria-label="Open AI Recruiter Copilot"
          >
            <span className="absolute inset-0 rounded-full border border-brand-cyan/20 animate-ping opacity-30" />
            <MessageSquare className="h-6 w-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Email Draft Sending Modal */}
      <AnimatePresence>
        {isEmailModalOpen && (
          <div className="fixed inset-0 z-[1000] bg-slate-950/65 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="glass-card w-[460px] max-w-full rounded-2xl border border-white/10 shadow-2xl p-6 flex flex-col gap-4 bg-slate-900/95 max-h-[90vh] overflow-y-auto scroll-container"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <div className="flex items-center gap-2 text-brand-cyan">
                  <Mail className="h-4.5 w-4.5" />
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider">Send Candidate Correspondence</h4>
                </div>
                <button
                  onClick={() => setIsEmailModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
                  disabled={isEmailSending}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Correspondence Type Tab Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Correspondence Option</label>
                <div className="flex gap-1.5 p-1 bg-slate-950 rounded-xl border border-white/5">
                  {[
                    { id: 'custom', label: 'AI Draft' },
                    { id: 'shortlist', label: 'Shortlist / Invite' },
                    { id: 'select', label: 'Select / Offer' },
                    { id: 'reject', label: 'Reject' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => handleTypeChange(tab.id)}
                      className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all cursor-pointer ${
                        emailType === tab.id
                          ? 'bg-brand-purple text-white shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recipient Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Candidate Recipient</label>
                {candidates.length > 0 ? (
                  <select
                    value={selectedEmail}
                    onChange={(e) => handleRecipientChange(e.target.value)}
                    disabled={isEmailSending}
                    className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-slate-200 outline-none focus:border-brand-purple cursor-pointer w-full"
                  >
                    <option value="">Select Recipient Candidate...</option>
                    {candidates.map((c) => (
                      <option key={c.resume_id} value={c.uploaded_by}>
                        {c.uploaded_by} ({c.job_title || 'General Pipeline'})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="email"
                    value={selectedEmail}
                    onChange={(e) => handleRecipientChange(e.target.value)}
                    disabled={isEmailSending}
                    placeholder="candidate@email.com"
                    className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-slate-200 outline-none focus:border-brand-purple w-full"
                  />
                )}
              </div>

              {/* Conditional Input variables based on Type selection */}
              {emailType === 'shortlist' && (
                <div className="grid grid-cols-2 gap-3 bg-slate-950/40 p-3 rounded-xl border border-white/5">
                  <div className="col-span-2 flex items-center justify-between p-2 bg-slate-900 rounded-lg border border-white/5 mb-1">
                    <span className="text-[10px] font-bold text-slate-350">Use Self-Scheduling Link (Calendly)</span>
                    <button
                      type="button"
                      onClick={() => {
                        const newUseSched = !useSchedulingLink;
                        setUseSchedulingLink(newUseSched);
                        applyTemplate(emailType, candidateName, companyName, jobTitle, interviewMode, interviewDate, interviewLocation, startDate, compensation, newUseSched, schedulingLink);
                      }}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        useSchedulingLink ? 'bg-brand-purple' : 'bg-slate-800'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          useSchedulingLink ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {useSchedulingLink ? (
                    <div className="flex flex-col col-span-2 gap-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Self-Scheduling Link</label>
                      <input
                        type="url"
                        value={schedulingLink}
                        onChange={(e) => {
                          setSchedulingLink(e.target.value);
                          applyTemplate(emailType, candidateName, companyName, jobTitle, interviewMode, interviewDate, interviewLocation, startDate, compensation, useSchedulingLink, e.target.value);
                        }}
                        className="bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 w-full"
                        placeholder="https://calendly.com/your-company/interview"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Date & Time</label>
                      <input
                        type="datetime-local"
                        value={interviewDate}
                        onChange={(e) => {
                          setInterviewDate(e.target.value);
                          applyTemplate(emailType, candidateName, companyName, jobTitle, interviewMode, e.target.value, interviewLocation, startDate, compensation, useSchedulingLink, schedulingLink);
                        }}
                        className="bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 cursor-pointer w-full"
                      />
                    </div>
                  )}

                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase">Interview Mode</label>
                    <select
                      value={interviewMode}
                      onChange={(e) => handleInterviewModeChange(e.target.value)}
                      className="bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 cursor-pointer"
                    >
                      <option value="Online (Google Meet)">Online (Google Meet)</option>
                      <option value="Online (Zoom)">Online (Zoom)</option>
                      <option value="Offline (In-Person Office)">Offline (In-Person Office)</option>
                    </select>
                  </div>
                  <div className="flex flex-col col-span-2 gap-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase">Location / Link</label>
                    <input
                      type="text"
                      value={interviewLocation}
                      onChange={(e) => {
                        setInterviewLocation(e.target.value);
                        applyTemplate(emailType, candidateName, companyName, jobTitle, interviewMode, interviewDate, e.target.value, startDate, compensation, useSchedulingLink, schedulingLink);
                      }}
                      className="bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 w-full"
                      placeholder="Enter meeting link or address..."
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase">Company Name</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => {
                        setCompanyName(e.target.value);
                        applyTemplate(emailType, candidateName, e.target.value, jobTitle, interviewMode, interviewDate, interviewLocation, startDate, compensation);
                      }}
                      className="bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 w-full"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase">Job Title</label>
                    <input
                      type="text"
                      value={jobTitle}
                      onChange={(e) => {
                        setJobTitle(e.target.value);
                        applyTemplate(emailType, candidateName, companyName, e.target.value, interviewMode, interviewDate, interviewLocation, startDate, compensation);
                      }}
                      className="bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 w-full"
                    />
                  </div>
                </div>
              )}

              {emailType === 'select' && (
                <div className="grid grid-cols-2 gap-3 bg-slate-950/40 p-3 rounded-xl border border-white/5">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        applyTemplate(emailType, candidateName, companyName, jobTitle, interviewMode, interviewDate, interviewLocation, e.target.value, compensation);
                      }}
                      className="bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 cursor-pointer w-full"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase">Compensation</label>
                    <input
                      type="text"
                      value={compensation}
                      onChange={(e) => {
                        setCompensation(e.target.value);
                        applyTemplate(emailType, candidateName, companyName, jobTitle, interviewMode, interviewDate, interviewLocation, startDate, e.target.value);
                      }}
                      className="bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 w-full"
                      placeholder="e.g. $120,000 / year"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase">Company Name</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => {
                        setCompanyName(e.target.value);
                        applyTemplate(emailType, candidateName, e.target.value, jobTitle, interviewMode, interviewDate, interviewLocation, startDate, compensation);
                      }}
                      className="bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 w-full"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase">Job Title</label>
                    <input
                      type="text"
                      value={jobTitle}
                      onChange={(e) => {
                        setJobTitle(e.target.value);
                        applyTemplate(emailType, candidateName, companyName, e.target.value, interviewMode, interviewDate, interviewLocation, startDate, compensation);
                      }}
                      className="bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 w-full"
                    />
                  </div>
                </div>
              )}

              {emailType === 'reject' && (
                <div className="grid grid-cols-2 gap-3 bg-slate-950/40 p-3 rounded-xl border border-white/5">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase">Company Name</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => {
                        setCompanyName(e.target.value);
                        applyTemplate(emailType, candidateName, e.target.value, jobTitle, interviewMode, interviewDate, interviewLocation, startDate, compensation);
                      }}
                      className="bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 w-full"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase">Job Title</label>
                    <input
                      type="text"
                      value={jobTitle}
                      onChange={(e) => {
                        setJobTitle(e.target.value);
                        applyTemplate(emailType, candidateName, companyName, e.target.value, interviewMode, interviewDate, interviewLocation, startDate, compensation);
                      }}
                      className="bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 w-full"
                    />
                  </div>
                </div>
              )}

              {/* Subject Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Subject Line</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  disabled={isEmailSending}
                  placeholder="Enter email subject..."
                  className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-slate-200 outline-none focus:border-brand-purple w-full"
                />
              </div>

              {/* Body Text Editor */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Email Content</label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  disabled={isEmailSending}
                  rows={8}
                  className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-slate-200 outline-none focus:border-brand-purple w-full resize-none scroll-container whitespace-pre-wrap leading-relaxed"
                  placeholder="Draft email content..."
                />
              </div>

              {/* Pipeline Status Checkbox Update */}
              {selectedResumeId && emailType !== 'custom' && (
                <div className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    id="updateStatusChk"
                    checked={updatePipelineStatus}
                    onChange={(e) => setUpdatePipelineStatus(e.target.checked)}
                    disabled={isEmailSending}
                    className="rounded bg-slate-950 border-white/10 text-brand-purple focus:ring-brand-purple cursor-pointer h-4 w-4"
                  />
                  <label htmlFor="updateStatusChk" className="text-2xs font-bold text-slate-400 cursor-pointer select-none">
                    Automatically update candidate status in ATS to <span className="text-brand-cyan uppercase">[{statusMapping[emailType]}]</span>
                  </label>
                </div>
              )}

              {/* Status Display */}
              {emailStatusMessage && (
                <div
                  className={`text-xs px-3.5 py-2.5 rounded-xl border ${
                    emailStatusMessage.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-450'
                      : 'bg-red-500/10 border-red-500/20 text-red-400'
                  }`}
                >
                  {emailStatusMessage.text}
                </div>
              )}

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/5">
                <button
                  onClick={() => setIsEmailModalOpen(false)}
                  disabled={isEmailSending}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-white/5 text-slate-355 hover:bg-white/5 hover:text-white cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendEmail}
                  disabled={isEmailSending || !selectedEmail.trim() || !emailSubject.trim()}
                  className="btn-gradient px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isEmailSending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      Send Email
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Email Dispatcher Modal */}
      <AnimatePresence>
        {isBulkModalOpen && (
          <div className="fixed inset-0 z-[1000] bg-slate-950/65 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="glass-card w-[480px] max-w-full rounded-2xl border border-white/10 shadow-2xl p-6 flex flex-col gap-4 bg-slate-900/95 max-h-[90vh] overflow-y-auto scroll-container"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <div className="flex items-center gap-2 text-brand-cyan">
                  <Users className="h-4.5 w-4.5 shrink-0" />
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider">Send Bulk Correspondence</h4>
                </div>
                <button
                  onClick={() => setIsBulkModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
                  disabled={isBulkSending}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Correspondence Type Tab Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Bulk Action Type</label>
                <div className="flex gap-1.5 p-1 bg-slate-950 rounded-xl border border-white/5">
                  {[
                    { id: 'shortlist', label: 'Shortlist / Invite' },
                    { id: 'select', label: 'Select / Offer' },
                    { id: 'reject', label: 'Reject' },
                    { id: 'custom', label: 'Custom Bulk' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setBulkEmailType(tab.id);
                        applyBulkTemplate(tab.id, bulkJobTitle, useSchedulingLink, schedulingLink);
                      }}
                      className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all cursor-pointer ${
                        bulkEmailType === tab.id
                          ? 'bg-brand-purple text-white shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected Recipients Checklist Review */}
              <div className="flex flex-col gap-1.5 bg-slate-950/40 p-3 rounded-xl border border-white/5">
                <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider flex items-center justify-between">
                  <span>Recipients ({bulkSelectedEmails.length})</span>
                  <span className="text-2xs text-slate-500 font-normal">Check candidates to include</span>
                </label>
                <div className="flex flex-col gap-1.5 max-h-[100px] overflow-y-auto scroll-container pr-1 mt-1">
                  {candidates
                    .filter(c => bulkResumeIds.includes(c.resume_id))
                    .map(c => {
                      const isSelected = bulkSelectedEmails.includes(c.uploaded_by || '');
                      return (
                        <div
                          key={c.resume_id}
                          onClick={() => {
                            const email = c.uploaded_by || '';
                            if (isSelected) {
                              setBulkSelectedEmails(prev => prev.filter(e => e !== email));
                            } else {
                              setBulkSelectedEmails(prev => [...prev, email]);
                            }
                          }}
                          className="flex items-center gap-2 p-1.5 hover:bg-white/5 rounded-lg cursor-pointer transition-colors"
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-brand-cyan shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-slate-550 shrink-0" />
                          )}
                          <span className="text-xs text-slate-300 font-medium truncate">{c.uploaded_by}</span>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Shortlist settings with scheduling link */}
              {bulkEmailType === 'shortlist' && (
                <div className="grid grid-cols-2 gap-3 bg-slate-950/40 p-3 rounded-xl border border-white/5">
                  <div className="col-span-2 flex items-center justify-between p-2 bg-slate-900 rounded-lg border border-white/5">
                    <span className="text-[10px] font-bold text-slate-350">Use Self-Scheduling Link (Calendly)</span>
                    <button
                      type="button"
                      onClick={() => {
                        const newUseSched = !useSchedulingLink;
                        setUseSchedulingLink(newUseSched);
                        applyBulkTemplate(bulkEmailType, bulkJobTitle, newUseSched, schedulingLink);
                      }}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        useSchedulingLink ? 'bg-brand-purple' : 'bg-slate-800'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          useSchedulingLink ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {useSchedulingLink && (
                    <div className="flex flex-col col-span-2 gap-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Self-Scheduling Link</label>
                      <input
                        type="url"
                        value={schedulingLink}
                        onChange={(e) => {
                          setSchedulingLink(e.target.value);
                          applyBulkTemplate(bulkEmailType, bulkJobTitle, useSchedulingLink, e.target.value);
                        }}
                        className="bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 w-full"
                        placeholder="https://calendly.com/your-company/interview"
                      />
                    </div>
                  )}

                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase">Company Name</label>
                    <input
                      type="text"
                      defaultValue="RECRUIT.AI"
                      className="bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 w-full"
                      disabled
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase">Job Title</label>
                    <input
                      type="text"
                      value={bulkJobTitle}
                      onChange={(e) => {
                        setBulkJobTitle(e.target.value);
                        applyBulkTemplate(bulkEmailType, e.target.value, useSchedulingLink, schedulingLink);
                      }}
                      className="bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 w-full"
                    />
                  </div>
                </div>
              )}

              {/* Subject Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Subject Line</label>
                <input
                  type="text"
                  value={bulkEmailSubject}
                  onChange={(e) => setBulkEmailSubject(e.target.value)}
                  disabled={isBulkSending}
                  placeholder="Enter email subject..."
                  className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-slate-200 outline-none focus:border-brand-purple w-full"
                />
              </div>

              {/* Body Textarea with placeholder notice */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Email Template Content</label>
                  <span className="text-[9px] text-brand-cyan font-bold italic">Use {"{name}"} for candidate name</span>
                </div>
                <textarea
                  value={bulkEmailBody}
                  onChange={(e) => setBulkEmailBody(e.target.value)}
                  disabled={isBulkSending}
                  rows={8}
                  className="bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-slate-200 outline-none focus:border-brand-purple w-full resize-none scroll-container whitespace-pre-wrap leading-relaxed"
                  placeholder="Draft email content..."
                />
              </div>

              {/* Status Display */}
              {bulkStatusMessage && (
                <div
                  className={`text-xs px-3.5 py-2.5 rounded-xl border ${
                    bulkStatusMessage.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-450'
                      : 'bg-red-500/10 border-red-500/20 text-red-400'
                  }`}
                >
                  {bulkStatusMessage.text}
                </div>
              )}

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(false)}
                  disabled={isBulkSending}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-white/5 text-slate-355 hover:bg-white/5 hover:text-white cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendBulkEmails}
                  disabled={isBulkSending || bulkSelectedEmails.length === 0 || !bulkEmailSubject.trim() || !bulkEmailBody.trim()}
                  className="btn-gradient px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isBulkSending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Sending Bulk...
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      Send to {bulkSelectedEmails.length} Candidates
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
