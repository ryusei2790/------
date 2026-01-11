import { App, ExpressReceiver } from '@slack/bolt';

if (!process.env.SLACK_BOT_TOKEN) {
  throw new Error('SLACK_BOT_TOKEN is not set');
}

if (!process.env.SLACK_SIGNING_SECRET) {
  throw new Error('SLACK_SIGNING_SECRET is not set');
}

// Create Express receiver for Cloud Functions
const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  processBeforeResponse: true,
});

// Create Slack Bolt App
export const slackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver,
});

// Export the Express app for Cloud Functions
export const expressApp = receiver.app;
