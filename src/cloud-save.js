import { supabase, isCloudEnabled } from './supabase.js';

// One row per browser voyage. No auth yet - anonymous voyage_id stored locally.
// Table: voyages (see supabase/schema.sql)
function getVoyageId() {
  let id = null;
  try { id = localStorage.getItem('uncharted-voyage-id'); } catch { /* ignore */ }
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + '-' + Math.random().toString(16).slice(2));
    try { localStorage.setItem('uncharted-voyage-id', id); } catch { /* ignore */ }
  }
  return id;
}

let pendingTimer = 0;
let lastError = '';

export function cloudError() {
  return lastError;
}

export async function loadCloudVoyage() {
  if (!isCloudEnabled) return null;
  try {
    const { data, error } = await supabase
      .from('voyages')
      .select('save')
      .eq('id', getVoyageId())
      .maybeSingle();
    if (error) { lastError = error.message; return null; }
    return data?.save ?? null;
  } catch (e) {
    lastError = String(e?.message || e);
    return null;
  }
}

export function queueCloudSave(state) {
  if (!isCloudEnabled) return;
  clearTimeout(pendingTimer);
  // Debounce: local save stays instant, cloud sync follows 2s later.
  pendingTimer = setTimeout(async () => {
    try {
      const payload = {
        id: getVoyageId(),
        save: { ...state, version: 3 },
        distance: Number(state.distance) || 0,
        treasures: (state.found || []).length,
        lands: (state.discovered || []).length,
        won: Boolean(state.won),
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('voyages').upsert(payload, { onConflict: 'id' });
      if (error) lastError = error.message;
      else lastError = '';
    } catch (e) {
      lastError = String(e?.message || e);
    }
  }, 2000);
}

export async function fetchLeaderboard(limit = 10) {
  if (!isCloudEnabled) return [];
  const { data, error } = await supabase
    .from('voyages')
    .select('id,distance,treasures,lands,won,updated_at')
    .order('distance', { ascending: false })
    .limit(limit);
  if (error) { lastError = error.message; return []; }
  return data || [];
}
