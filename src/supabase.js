import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isCloudEnabled = Boolean(url && publishableKey);

export const supabase = isCloudEnabled
  ? createClient(url, publishableKey)
  : null;

export function cloudStatus() {
  if (url && !publishableKey) return 'missing-key';
  if (!url && publishableKey) return 'missing-url';
  if (!url && !publishableKey) return 'disabled';
  return 'ready';
}
