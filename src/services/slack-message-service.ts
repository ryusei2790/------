import { Question } from '../types';

/**
 * Format a text input question for Slack
 */
export function formatTextQuestion(question: Question, questionNumber: number, totalQuestions: number) {
  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `📝 問題 ${questionNumber}/${totalQuestions}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: question.question,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '💬 回答を入力してください',
          },
        ],
      },
    ],
  };
}

/**
 * Format a multiple choice question for Slack with buttons
 */
export function formatMultipleChoiceQuestion(
  question: Question,
  questionNumber: number,
  totalQuestions: number,
  testSessionId: string
) {
  if (!question.options) {
    throw new Error('Multiple choice question must have options');
  }

  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `📝 問題 ${questionNumber}/${totalQuestions}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: question.question,
        },
      },
      {
        type: 'actions',
        elements: question.options.map((option, index) => ({
          type: 'button',
          text: {
            type: 'plain_text',
            text: option,
            emoji: true,
          },
          value: JSON.stringify({
            testSessionId,
            questionId: question.id,
            answer: option,
          }),
          action_id: `answer_${index}`,
        })),
      },
    ],
  };
}

/**
 * Format feedback message
 */
export function formatFeedbackMessage(
  isCorrect: boolean,
  correctAnswer: string,
  userAnswer: string,
  score: number,
  totalQuestions: number
) {
  const emoji = isCorrect ? '✅' : '❌';
  const result = isCorrect ? '正解！' : '不正解';

  const blocks: any[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${emoji} *${result}*`,
      },
    },
  ];

  if (!isCorrect) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `正しい答え: *${correctAnswer}*\nあなたの答え: ${userAnswer}`,
      },
    });
  }

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `現在のスコア: ${score}/${totalQuestions}`,
      },
    ],
  });

  return { blocks };
}

/**
 * Format test completion message
 */
export function formatCompletionMessage(score: number, totalQuestions: number) {
  const percentage = Math.round((score / totalQuestions) * 100);
  let emoji = '🎉';
  let message = 'よく頑張りました！';

  if (percentage === 100) {
    emoji = '🏆';
    message = 'パーフェクト！素晴らしい！';
  } else if (percentage >= 80) {
    emoji = '🎉';
    message = 'よくできました！';
  } else if (percentage >= 60) {
    emoji = '👍';
    message = '良い調子です！';
  } else {
    emoji = '💪';
    message = '次回も頑張りましょう！';
  }

  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} テスト完了！`,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*最終スコア: ${score}/${totalQuestions} (${percentage}%)*\n\n${message}`,
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '次のテストは1時間後に配信されます 📚',
          },
        ],
      },
    ],
  };
}

/**
 * Format welcome message
 */
export function formatWelcomeMessage() {
  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📚 英単語学習Bot',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'ようこそ！このBotは毎時間、英単語のテストを送信します。',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*テストの種類:*\n• 英単語 → 日本語（テキスト入力）\n• 日本語 → 英単語（テキスト入力）\n• 4択問題（ボタン選択）',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*仕組み:*\n正解率が低い単語ほど、出題される確率が高くなります。\n効率的に苦手な単語を克服できます！',
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '次のテストまでお待ちください 🕐',
          },
        ],
      },
    ],
  };
}
