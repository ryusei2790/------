import { Request, Response } from 'express';
import { slackApp, expressApp } from '../src/lib/slack-client';
import { supabase } from '../src/lib/supabase';
import { validateAnswer } from '../src/services/answer-validator';
import {
  formatFeedbackMessage,
  formatTextQuestion,
  formatMultipleChoiceQuestion,
  formatCompletionMessage,
  formatWelcomeMessage,
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
 * Handle incoming messages
 */
slackApp.message(async ({ message, say }) => {
  try {
    // Ignore bot messages and non-text messages
    if (message.subtype || !('text' in message) || !('user' in message)) {
      return;
    }

    const slackUserId = message.user;
    const userAnswer = message.text?.trim() || '';

    // Get or create user
    const { data: existingUser } = await supabase
      .from('slack_users')
      .select('*')
      .eq('slack_user_id', slackUserId)
      .single();

    let userId: string;

    if (!existingUser) {
      // Create new user
      const { data: newUser, error: createError } = await supabase
        .from('slack_users')
        .insert({
          slack_user_id: slackUserId,
          team_id: 'team' in message ? message.team || '' : '',
          is_active: true,
        })
        .select()
        .single();

      if (createError || !newUser) {
        console.error('Error creating user:', createError);
        await say('エラーが発生しました。もう一度お試しください。');
        return;
      }

      userId = newUser.id;

      // Send welcome message
      await say(formatWelcomeMessage());
      return;
    }

    userId = existingUser.id;

    // Get current test attempt
    const { data: attempt } = await supabase
      .from('user_test_attempts')
      .select('*')
      .eq('user_id', userId)
      .is('completed_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (!attempt) {
      await say('現在進行中のテストがありません。次のテストをお待ちください。');
      return;
    }

    // Get test session
    const { data: testSession } = await supabase
      .from('test_sessions')
      .select('*')
      .eq('id', attempt.test_session_id)
      .single();

    if (!testSession) {
      await say('テストセッションが見つかりませんでした。');
      return;
    }

    const questions: Question[] = testSession.questions as Question[];
    const currentQuestion = questions[attempt.current_question_index];

    // Skip if current question is multiple choice (button only)
    if (currentQuestion.type === 'multiple_choice') {
      await say('この問題はボタンで回答してください。');
      return;
    }

    // Validate answer
    const isCorrect = validateAnswer(userAnswer, currentQuestion.correctAnswer, currentQuestion.type);

    // Save answer
    await supabase.from('user_answers').insert({
      user_id: userId,
      test_session_id: testSession.id,
      vocabulary_id: currentQuestion.vocabularyId,
      question_type: currentQuestion.type,
      user_answer: userAnswer,
      correct_answer: currentQuestion.correctAnswer,
      is_correct: isCorrect,
    });

    // Update score
    const newScore = isCorrect ? attempt.score + 1 : attempt.score;

    // Send feedback
    await say(
      formatFeedbackMessage(
        isCorrect,
        currentQuestion.correctAnswer,
        userAnswer,
        newScore,
        questions.length
      )
    );

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

      await say(formatCompletionMessage(newScore, questions.length));
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

      await say(messagePayload);
    }
  } catch (error) {
    console.error('Error handling message:', error);
    await say('エラーが発生しました。もう一度お試しください。');
  }
});

/**
 * Cloud Function: Handle Slack Events
 * HTTP Trigger
 */
export async function slackEvents(req: Request, res: Response) {
  return expressApp(req, res);
}
