// Database types
export interface SlackUser {
  id: string;
  line_user_id: string;
  slack_user_id: string;
  team_id: string;
  display_name?: string;
  created_at: string;
  is_active: boolean;
  last_active_at?: string;
}

export interface Vocabulary {
  id: string;
  notion_page_id: string;
  english: string;
  japanese: string;
  created_at: string;
  updated_at: string;
  last_synced_at: string;
}

export interface TestSession {
  id: string;
  created_at: string;
  sent_at?: string;
  questions: Question[];
  status: 'created' | 'sent' | 'completed';
}

export interface UserTestAttempt {
  id: string;
  user_id: string;
  test_session_id: string;
  started_at: string;
  completed_at?: string;
  current_question_index: number;
  score: number;
}

export interface UserAnswer {
  id: string;
  user_id: string;
  test_session_id: string;
  vocabulary_id: string;
  question_type: QuestionType;
  user_answer: string;
  correct_answer: string;
  is_correct: boolean;
  answered_at: string;
  options?: string[];
}

export interface VocabularyStats {
  id: string;
  vocabulary_id: string;
  user_id: string;
  total_attempts: number;
  correct_attempts: number;
  accuracy_rate: number;
  last_tested_at?: string;
  weight: number;
}

// Question types
export type QuestionType = 'en_to_jp' | 'jp_to_en' | 'multiple_choice';

export interface Question {
  id: string;
  vocabularyId: string;
  type: QuestionType;
  question: string;
  correctAnswer: string;
  options?: string[]; // For multiple choice
  english: string;
  japanese: string;
}

// Weighted item for random selection
export interface WeightedItem<T = any> {
  id: string;
  weight: number;
  data: T;
}

// Notion types
export interface NotionVocabularyPage {
  id: string;
  properties: {
    English: {
      title: Array<{
        plain_text: string;
      }>;
    };
    日本語: {
      rich_text: Array<{
        plain_text: string;
      }>;
    };
  };
}

// Environment variables
export interface EnvVars {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SLACK_BOT_TOKEN: string;
  SLACK_SIGNING_SECRET: string;
  NOTION_API_KEY: string;
  NOTION_DATABASE_ID: string;
  GCP_PROJECT_ID?: string;
  GCP_REGION?: string;
}
