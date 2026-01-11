import { Request, Response } from 'express';
import { slackApp, expressApp } from '../src/lib/slack-client';
import { supabase } from '../src/lib/supabase';
import { validateAnswer } from '../src/services/answer-validator';
import {
  formatFeedbackMessage,
  formatTextQuestion,
  formatMultipleChoiceQuestion,
  formatCompletionMessage,
} from '../src/services/slack-message-service';
import { Question } from '../src/types';

/**
 * Handle button clicks for multiple choice questions
 */
slackApp.action(/^answer_\d+$/, async ({ ack, action, say, body, client }) => {
  await ack();

  try {
    if (action.type !== 'button' || !('value' in action)) {
      return;
    }

    const slackUserId = body.user.id;
    const { testSessionId, questionId, answer } = JSON.parse(action.value as string);

    // Get user
    const { data: user } = await supabase
      .from('slack_users')
      .select('*')
      .eq('slack_user_id', slackUserId)
      .single();

    if (!user) {
      if (say) await say('ユーザー情報が見つかりませんでした。');
      return;
    }

    const userId = user.id;

    // Get current test attempt
    const { data: attempt } = await supabase
      .from('user_test_attempts')
      .select('*')
      .eq('user_id', userId)
      .eq('test_session_id', testSessionId)
      .single();

    if (!attempt) {
      if (say) await say('テストセッションが見つかりませんでした。');
      return;
    }

    // Get test session
    const { data: testSession } = await supabase
      .from('test_sessions')
      .select('*')
      .eq('id', testSessionId)
      .single();

    if (!testSession) {
      if (say) await say('テストセッションが見つかりませんでした。');
      return;
    }

    const questions: Question[] = testSession.questions as Question[];
    const currentQuestion = questions[attempt.current_question_index];

    // Verify question ID matches
    if (currentQuestion.id !== questionId) {
      if (say) await say('この質問はすでに回答済みです。');
      return;
    }

    // Validate answer (strict for multiple choice)
    const isCorrect = validateAnswer(answer, currentQuestion.correctAnswer, 'multiple_choice');

    // Save answer
    await supabase.from('user_answers').insert({
      user_id: userId,
      test_session_id: testSession.id,
      vocabulary_id: currentQuestion.vocabularyId,
      question_type: currentQuestion.type,
      user_answer: answer,
      correct_answer: currentQuestion.correctAnswer,
      is_correct: isCorrect,
      options: currentQuestion.options,
    });

    // Update score
    const newScore = isCorrect ? attempt.score + 1 : attempt.score;

    // Send feedback
    if (say) {
      await say(
        formatFeedbackMessage(
          isCorrect,
          currentQuestion.correctAnswer,
          answer,
          newScore,
          questions.length
        )
      );
    }

    // Move to next question or complete test
    const nextQuestionIndex = attempt.current_question_index + 1;

    if (nextQuestionIndex >= questions.length) {
      // Test completed
      await supabase
        .from('user_test_attempts')
        .update({
          score: newScore,
          completed_at: new Date().toISOString(),
        })
        .eq('id', attempt.id);

      await supabase
        .from('test_sessions')
        .update({ status: 'completed' })
        .eq('id', testSession.id);

      if (say) await say(formatCompletionMessage(newScore, questions.length));
    } else {
      // Send next question
      await supabase
        .from('user_test_attempts')
        .update({
          current_question_index: nextQuestionIndex,
          score: newScore,
        })
        .eq('id', attempt.id);

      const nextQuestion = questions[nextQuestionIndex];

      const messagePayload =
        nextQuestion.type === 'multiple_choice'
          ? formatMultipleChoiceQuestion(nextQuestion, nextQuestionIndex + 1, questions.length, testSession.id)
          : formatTextQuestion(nextQuestion, nextQuestionIndex + 1, questions.length);

      if (say) await say(messagePayload);
    }
  } catch (error) {
    console.error('Error handling interaction:', error);
    if (say) await say('エラーが発生しました。もう一度お試しください。');
  }
});

/**
 * Cloud Function: Handle Slack Interactions
 * HTTP Trigger
 */
export async function slackInteractions(req: Request, res: Response) {
  return expressApp(req, res);
}
