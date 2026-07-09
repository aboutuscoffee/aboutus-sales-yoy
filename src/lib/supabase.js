import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Supabase 環境変数が設定されていません。.env を確認してください。');
}

export const supabase = createClient(url, key);
