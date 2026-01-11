import { Request, Response } from 'express';
import { WebClient } from '@slack/web-api';
import { supabase } from '../src/lib/supabase';
import { generateTestForUser, createTestSession } from '../src/lib/test-generator';
import {
  formatTextQuestion,
  formatMultipleChoiceQuestion,
} from '../src/services/slack-message-service';

if (!process.env.SLACK_BOT_TOKEN) {
  throw new Error('SLACK_BOT_TOKEN is not set');
}

const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);

/**
 * Cloud Function: Create and send hourly tests to all active users
 * HTTP Trigger (called by Cloud Scheduler)
 */
export async function createTest(req: Request, res: Response) {
  try {
    console.log('Starting hourly test creation...');

    // Fetch all active users
    const { data: users, error: usersError } = await supabase
      .from('slack_users')
      .select('*')
      .eq('is_active', true);

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    if (!users || users.length === 0) {
      console.log('No active users found');
      return res.status(200).json({
        success: true,
        message: 'No active users to send tests to',
        sentCount: 0,
      });
    }

    console.log(`Found ${users.length} active users`);

    const results = await Promise.allSettled(
      users.map(async user => {
        try {
          // Generate test for user
          const questions = await generateTestForUser(user.id);

          // Create test session in database
          const testSession = await createTestSession(questions);

          // Create user test attempt
          const { error: attemptError } = await supabase
            .from('user_test_attempts')
            .insert({
              user_id: user.id,
              test_session_id: testSession.id,
              current_question_index: 0,
              score: 0,
            });

          if (attemptError) {
            throw new Error(`Failed to create user test attempt: ${attemptError.message}`);
          }

          // Send first question to user via DM
          const firstQuestion = questions[0];

          // Open DM channel with user
          const dmResult = await slackClient.conversations.open({
            users: user.slack_user_id,
          });

          if (!dmResult.ok || !dmResult.channel || !dmResult.channel.id) {
            throw new Error('Failed to open DM channel');
          }

          const channelId: string = dmResult.channel.id;

          // Format and send question
          const messagePayload =
            firstQuestion.type === 'multiple_choice'
              ? formatMultipleChoiceQuestion(firstQuestion, 1, questions.length, testSession.id)
              : formatTextQuestion(firstQuestion, 1, questions.length);

          await slackClient.chat.postMessage({
            channel: channelId,
            ...messagePayload,
          });

          // Update test session status
          await supabase
            .from('test_sessions')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', testSession.id);

          console.log(`Test sent to user ${user.slack_user_id}`);
          return { userId: user.id, success: true };
        } catch (error) {
          console.error(`Error sending test to user ${user.slack_user_id}:`, error);
          return { userId: user.id, success: false, error };
        }
      })
    );

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failedCount = results.length - successCount;

    console.log(`Tests sent: ${successCount} succeeded, ${failedCount} failed`);

    return res.status(200).json({
      success: true,
      message: 'Tests created and sent',
      total: users.length,
      succeeded: successCount,
      failed: failedCount,
    });
  } catch (error) {
    console.error('Error in createTest:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
