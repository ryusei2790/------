import { Request, Response } from 'express';
import { fetchVocabularyFromNotion } from '../src/lib/notion-client';
import { supabase } from '../src/lib/supabase';

/**
 * Cloud Function: Sync vocabulary from Notion to Supabase
 * HTTP Trigger
 */
export async function syncVocabulary(req: Request, res: Response) {
  try {
    console.log('Starting vocabulary synchronization...');

    // Fetch vocabulary from Notion
    const notionVocabulary = await fetchVocabularyFromNotion();
    console.log(`Fetched ${notionVocabulary.length} vocabulary entries from Notion`);

    if (notionVocabulary.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No vocabulary entries found in Notion',
        synced: 0,
      });
    }

    // Upsert vocabulary entries to Supabase
    const { data, error } = await supabase
      .from('vocabulary')
      .upsert(
        notionVocabulary.map(v => ({
          notion_page_id: v.notion_page_id,
          english: v.english,
          japanese: v.japanese,
          last_synced_at: new Date().toISOString(),
        })),
        {
          onConflict: 'notion_page_id',
          ignoreDuplicates: false,
        }
      )
      .select();

    if (error) {
      console.error('Error upserting vocabulary to Supabase:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    console.log(`Successfully synced ${data?.length || 0} vocabulary entries`);

    return res.status(200).json({
      success: true,
      message: 'Vocabulary synchronized successfully',
      synced: data?.length || 0,
      total: notionVocabulary.length,
    });
  } catch (error) {
    console.error('Error in syncVocabulary:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
