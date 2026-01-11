/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,     // deletion
          dp[i][j - 1] + 1,     // insertion
          dp[i - 1][j - 1] + 1  // substitution
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Normalize string for comparison
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Validate user's answer with fuzzy matching
 */
export function validateAnswer(
  userAnswer: string,
  correctAnswer: string,
  questionType: 'en_to_jp' | 'jp_to_en' | 'multiple_choice'
): boolean {
  const normalizedUser = normalizeString(userAnswer);
  const normalizedCorrect = normalizeString(correctAnswer);

  // Exact match
  if (normalizedUser === normalizedCorrect) {
    return true;
  }

  // Multiple choice: strict exact match only
  if (questionType === 'multiple_choice') {
    return false;
  }

  // Fuzzy matching for text input questions
  const maxDistance = normalizedCorrect.length >= 4 ? 1 : 0;
  const distance = levenshteinDistance(normalizedUser, normalizedCorrect);

  if (distance <= maxDistance) {
    return true;
  }

  // Japanese: try without particles (は、が、を、に、で、と、から、まで、より)
  if (questionType === 'en_to_jp') {
    const particles = ['は', 'が', 'を', 'に', 'で', 'と', 'から', 'まで', 'より', 'だ', 'です'];

    for (const particle of particles) {
      const withoutParticle = normalizedCorrect.replace(new RegExp(particle + '$'), '');
      if (normalizedUser === withoutParticle) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Get feedback message for answer
 */
export function getFeedbackMessage(
  isCorrect: boolean,
  correctAnswer: string,
  userAnswer: string
): string {
  if (isCorrect) {
    return `✅ 正解！`;
  } else {
    return `❌ 不正解\n正しい答え: *${correctAnswer}*\nあなたの答え: ${userAnswer}`;
  }
}
