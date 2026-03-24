const IRREGULAR: Record<string, string> = {
  add: 'adding',
  put: 'putting',
  set: 'setting',
  get: 'getting',
  cut: 'cutting',
  run: 'running',
  sit: 'sitting',
  stop: 'stopping',
  drop: 'dropping',
  trim: 'trimming',
  crop: 'cropping',
  flip: 'flipping',
  swap: 'swapping',
  blur: 'blurring',
  begin: 'beginning',
  make: 'making',
  give: 'giving',
  take: 'taking',
  have: 'having',
  come: 'coming',
  move: 'moving',
  change: 'changing',
  replace: 'replacing',
  remove: 'removing',
  create: 'creating',
  enhance: 'enhancing',
  reduce: 'reducing',
  increase: 'increasing',
  erase: 'erasing',
  rotate: 'rotating',
  generate: 'generating',
  improve: 'improving',
  resize: 'resizing',
  restore: 'restoring',
  place: 'placing',
  fade: 'fading',
  use: 'using',
  raise: 'raising',
  write: 'writing',
  combine: 'combining',
  sharpen: 'sharpening',
  brighten: 'brightening',
  darken: 'darkening',
  die: 'dying',
  lie: 'lying',
  tie: 'tying',
  apply: 'applying',
  try: 'trying',
  copy: 'copying',
  modify: 'modifying',
  amplify: 'amplifying',
  intensify: 'intensifying',
  simplify: 'simplifying',
  magnify: 'magnifying',
  satisfy: 'satisfying',
};

const VOWELS = new Set('aeiou');

function isConsonant(ch: string): boolean {
  return /[a-z]/.test(ch) && !VOWELS.has(ch);
}

function toGerund(verb: string): string {
  const lower = verb.toLowerCase();

  if (IRREGULAR[lower]) return IRREGULAR[lower];

  if (lower.endsWith('ie')) return lower.slice(0, -2) + 'ying';
  if (lower.endsWith('ee') || lower.endsWith('ye') || lower.endsWith('oe')) return lower + 'ing';
  if (lower.endsWith('e')) return lower.slice(0, -1) + 'ing';

  if (
    lower.length >= 3 &&
    isConsonant(lower[lower.length - 1]) &&
    VOWELS.has(lower[lower.length - 2]) &&
    isConsonant(lower[lower.length - 3]) &&
    !lower.endsWith('w') && !lower.endsWith('x') && !lower.endsWith('y')
  ) {
    return lower + lower[lower.length - 1] + 'ing';
  }

  return lower + 'ing';
}

export function promptToGerund(prompt: string): string {
  const trimmed = prompt.trim();
  if (!trimmed) return '';

  const spaceIdx = trimmed.indexOf(' ');
  const firstWord = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
  const rest = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx);

  if (!/^[a-zA-Z]+$/.test(firstWord)) {
    return trimmed + '...';
  }

  return toGerund(firstWord) + rest + '...';
}
