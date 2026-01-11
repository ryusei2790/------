import { supabase } from './supabase';
import { selectWeightedRandom, shuffleArray } from '../utils/weighted-random';
import { Question, QuestionType, Vocabulary, VocabularyStats, WeightedItem } from '../types';
import { v4 as uuidv4 } from 'uuid';

const QUESTIONS_PER_TEST = 5;
const QUESTION_TYPES: QuestionType[] = ['en_to_jp', 'jp_to_en', 'multiple_choice'];

/**
 * Generate a test session for a user
 */
export async function generateTestForUser(userId: string): Promise<Question[]> {
  // Fetch vocabulary with user stats
  const { data: vocabulary, error: vocabError } = await supabase
    .from('vocabulary')
    .select('*');

  if (vocabError) {
    throw new Error(`Failed to fetch vocabulary: ${vocabError.message}`);
  }

  if (!vocabulary || vocabulary.length === 0) {
    throw new Error('No vocabulary available');
  }

  // Fetch user's vocabulary stats
  const { data: stats, error: statsError } = await supabase
    .from('vocabulary_stats')
    .select('*')
    .eq('user_id', userId);

  if (statsError) {
    console.error('Failed to fetch user stats:', statsError);
  }

  // Create weighted items
  const statsMap = new Map<string, VocabularyStats>();
  if (stats) {
    stats.forEach(stat => statsMap.set(stat.vocabulary_id, stat));
  }

  const weightedVocabulary: WeightedItem<Vocabulary>[] = vocabulary.map(vocab => ({
    id: vocab.id,
    weight: statsMap.get(vocab.id)?.weight || 1.0,
    data: vocab,
  }));

  // Select vocabulary items for test
  const selectedItems = selectWeightedRandom(weightedVocabulary, QUESTIONS_PER_TEST);

  // Generate questions
  const questions: Question[] = [];

  for (const item of selectedItems) {
    const questionType = QUESTION_TYPES[Math.floor(Math.random() * QUESTION_TYPES.length)];
    const question = await generateQuestion(item.data, questionType, vocabulary);
    questions.push(question);
  }

  return questions;
}

/**
 * Generate a single question
 */
async function generateQuestion(
  vocab: Vocabulary,
  type: QuestionType,
  allVocabulary: Vocabulary[]
): Promise<Question> {
  const questionId = uuidv4();

  switch (type) {
    case 'en_to_jp':
      return {
        id: questionId,
        vocabularyId: vocab.id,
        type: 'en_to_jp',
        question: `次の英単語の意味を日本語で答えてください:\n\n*${vocab.english}*`,
        correctAnswer: vocab.japanese,
        english: vocab.english,
        japanese: vocab.japanese,
      };

    case 'jp_to_en':
      return {
        id: questionId,
        vocabularyId: vocab.id,
        type: 'jp_to_en',
        question: `次の日本語に対応する英単語を答えてください:\n\n*${vocab.japanese}*`,
        correctAnswer: vocab.english,
        english: vocab.english,
        japanese: vocab.japanese,
      };

    case 'multiple_choice':
      // Generate 3 wrong options
      const wrongOptions = allVocabulary
        .filter(v => v.id !== vocab.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(v => v.japanese);

      const options = shuffleArray([vocab.japanese, ...wrongOptions]);

      return {
        id: questionId,
        vocabularyId: vocab.id,
        type: 'multiple_choice',
        question: `次の英単語の意味を選んでください:\n\n*${vocab.english}*`,
        correctAnswer: vocab.japanese,
        options,
        english: vocab.english,
        japanese: vocab.japanese,
      };

    default:
      throw new Error(`Unknown question type: ${type}`);
  }
}

/**
 * Create a test session in database
 */
export async function createTestSession(questions: Question[]) {
  const { data, error } = await supabase
    .from('test_sessions')
    .insert({
      questions,
      status: 'created',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create test session: ${error.message}`);
  }

  return data;
}
