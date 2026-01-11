import { Client } from '@notionhq/client';
import { NotionVocabularyPage } from '../types';

if (!process.env.NOTION_API_KEY) {
  throw new Error('NOTION_API_KEY is not set');
}

if (!process.env.NOTION_DATABASE_ID) {
  throw new Error('NOTION_DATABASE_ID is not set');
}

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

const DATABASE_ID = process.env.NOTION_DATABASE_ID;

/**
 * Fetch all vocabulary entries from Notion database
 */
export async function fetchVocabularyFromNotion() {
  const vocabularyList: Array<{
    notion_page_id: string;
    english: string;
    japanese: string;
  }> = [];

  let hasMore = true;
  let startCursor: string | undefined = undefined;

  while (hasMore) {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
      start_cursor: startCursor,
      page_size: 100,
    });

    for (const page of response.results) {
      if (!('properties' in page)) continue;

      const notionPage = page as unknown as NotionVocabularyPage;

      const englishTexts = notionPage.properties.English?.title || [];
      const japaneseTexts = notionPage.properties['日本語']?.rich_text || [];

      const english = englishTexts.map(t => t.plain_text).join('').trim();
      const japanese = japaneseTexts.map(t => t.plain_text).join('').trim();

      if (english && japanese) {
        vocabularyList.push({
          notion_page_id: page.id,
          english,
          japanese,
        });
      }
    }

    hasMore = response.has_more;
    startCursor = response.next_cursor || undefined;
  }

  return vocabularyList;
}

export { notion };
