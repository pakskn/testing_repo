/**
 * Related niches mapping — used by "Similar Channels" feature
 * When user clicks "Related Niches", shows channels from all related niches
 */
export const RELATED_NICHES: Record<string, string[]> = {
  // ── Horror / Mystery cluster ──────────────────────────────
  'Horror':        ['Horror', 'Paranormal', 'True Crime', 'Crime', 'Crime Stories', 'Conspiracy'],
  'Paranormal':    ['Paranormal', 'Horror', 'Conspiracy', 'True Crime'],
  'True Crime':    ['True Crime', 'Crime', 'Crime Stories', 'Horror', 'Paranormal', 'Conspiracy'],
  'Crime':         ['Crime', 'True Crime', 'Crime Stories', 'Horror', 'Conspiracy'],
  'Crime Stories': ['Crime Stories', 'True Crime', 'Crime', 'Horror', 'Paranormal'],
  'Conspiracy':    ['Conspiracy', 'Horror', 'Paranormal', 'History', 'True Crime', 'Exploration'],

  // ── History / Knowledge cluster ───────────────────────────
  'History':       ['History', 'Education', 'Conspiracy', 'AI Restoration'],
  'Science':       ['Science', 'Space', 'Education', 'Technology', 'Health'],
  'Space':         ['Space', 'Science', 'Education', 'Conspiracy', 'AI'],
  'Education':     ['Education', 'Science', 'History', 'Technology', 'Psychology'],

  // ── Technology / AI cluster ───────────────────────────────
  'Technology':    ['Technology', 'AI', 'Science', 'Education'],
  'AI':            ['AI', 'AI Restoration', 'AI Survival', 'Technology', 'Science'],
  'AI Restoration':['AI Restoration', 'AI', 'History', 'Technology'],
  'AI Survival':   ['AI Survival', 'AI', 'Survival', 'Conspiracy', 'Technology'],

  // ── Mindset / Growth cluster ──────────────────────────────
  'Psychology':    ['Psychology', 'Motivation', 'Self Improvement', 'Health'],
  'Motivation':    ['Motivation', 'Psychology', 'Self Improvement', 'Finance', 'Business'],
  'Self Improvement': ['Self Improvement', 'Motivation', 'Psychology', 'Productivity'],
  'Productivity':  ['Productivity', 'Self Improvement', 'Motivation', 'Business'],

  // ── Finance / Business cluster ────────────────────────────
  'Finance':       ['Finance', 'Business', 'Motivation', 'Self Improvement'],
  'Business':      ['Business', 'Finance', 'Motivation', 'Self Improvement'],

  // ── Stories cluster ───────────────────────────────────────
  'Reddit Stories':  ['Reddit Stories', 'HFy Stories', 'Revenge Stories', 'Horror'],
  'HFy Stories':     ['HFy Stories', 'Reddit Stories', 'Horror', 'Conspiracy'],
  'Revenge Stories': ['Revenge Stories', 'Reddit Stories', 'Motivation'],

  // ── Nature / Adventure cluster ────────────────────────────
  'Wildlife':      ['Wildlife', 'Nature', 'Science', 'Exploration'],
  'Nature':        ['Nature', 'Wildlife', 'Science', 'Exploration', 'Survival'],
  'Survival':      ['Survival', 'Nature', 'AI Survival', 'Exploration'],
  'Exploration':   ['Exploration', 'Nature', 'Conspiracy', 'History'],

  // ── Health / Wellness cluster ─────────────────────────────
  'Health':        ['Health', 'Fitness', 'Psychology', 'Science'],
  'Fitness':       ['Fitness', 'Health', 'Motivation', 'Self Improvement'],
  'Cooking':       ['Cooking', 'Health', 'Fitness'],
  'DIY':           ['DIY', 'Exploration', 'Survival'],
}

/** Get related niches for a given niche (falls back to just that niche) */
export function getRelatedNiches(niche: string): string[] {
  return RELATED_NICHES[niche] ?? [niche]
}

/** Describe the relation in plain text */
export function describeRelated(niche: string): string {
  const related = getRelatedNiches(niche)
  if (related.length <= 1) return niche
  const others = related.filter(n => n !== niche).slice(0, 3)
  return `${niche} + ${others.join(', ')}${related.length > 4 ? '...' : ''}`
}
