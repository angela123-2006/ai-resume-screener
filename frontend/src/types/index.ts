export type UserRole = 'recruiter' | 'candidate';

export interface UserProfile {
  email: string;
  role: UserRole;
  company_id?: number;
}

export interface ExtractedSkills {
  technical_skills: string[];
  soft_skills: string[];
  tools_and_technologies: string[];
  certifications: string[];
  error?: string;
}

export interface ResumeItem {
  resume_id: number;
  filename: string;
  uploaded_by?: string;
  uploaded_at: string;
  status?: string;
  parsing_status?: 'pending' | 'processing' | 'completed' | 'failed';
  job_id?: number | null;
  job_title?: string | null;
}

export interface ResumeUploadResponse {
  message: string;
  resume_id: number;
  uploaded_by: string;
  filename: string;
  extracted_text: string;
  extracted_skills: ExtractedSkills;
  parsing_status?: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface JobItem {
  id: number;
  title: string;
  description: string;
  location_type: string;
  location?: string;
  created_at: string;
  company?: {
    id: number;
    name: string;
  };
}

export interface ScoreExplanation {
  match_score: number;
  experience_match: 'good' | 'partial' | 'poor' | 'unknown' | string;
  confirmed_strengths: string[];
  unconfirmed_strengths: string[];
  missing_skills: string[];
  resume_skill_count: number;
  reasoning: string;
}

// Raw DB Score response with stringified strengths/missing_skills
export interface RawScoreResponse {
  id: number;
  resume_id: number;
  job_id: number;
  match_score: number;
  strengths: string; // JSON string
  missing_skills: string; // JSON string
  summary: string;
  explanation: ScoreExplanation | null;
  created_at: string;
}

// Unified frontend score item model
export interface UnifiedScoreItem {
  id: number;
  resume_id: number;
  job_id: number;
  match_score: number;
  strengths: string[];
  missing_skills: string[];
  summary: string;
  explanation: ScoreExplanation | null;
  status: string;
  confidence: string;
  recruiter_flagged: boolean;
  recruiter_override_note: string | null;
  created_at: string;
}

export interface JobRankingItem {
  rank: number;
  resume_id: number;
  score: number;
  summary: string;
  status: string;
  confidence: string;
  recruiter_flagged: boolean;
  recruiter_override_note: string | null;
}

export interface DashboardOverview {
  total_jobs: number;
  total_resumes: number;
  total_scores: number;
  average_score: number;
  top_score: number;
}

export interface DashboardStatsResponse {
  status: string;
  data: {
    overview: DashboardOverview;
    score_distribution: {
      '0-30': number;
      '30-60': number;
      '60-80': number;
      '80-100': number;
    };
    top_candidates: {
      resume: string;
      job: string;
      score: number;
    }[];
  };
}

export interface SkillGapInsightItem {
  skill: string;
  count: number;
}

export interface DashboardInsightsResponse {
  status: string;
  data: {
    top_missing_skills: SkillGapInsightItem[];
    total_evaluations: number;
  };
}

export interface JobAnalyticsResponse {
  status: string;
  data: {
    job_id: number;
    job_title: string;
    overview: {
      total_candidates: number;
      average_score: number;
      top_score: number;
    };
    score_distribution: {
      '0-30': number;
      '30-60': number;
      '60-80': number;
      '80-100': number;
    };
    top_candidates: {
      resume: string;
      score: number;
    }[];
  };
}
