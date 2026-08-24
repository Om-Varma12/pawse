const WINDOW_MS = 15 * 60 * 1000; // 15 mins rolling window
const HAPPY_WINDOW_MS = 20 * 60 * 1000; // 20 mins for happy purring reinforcement

export interface EmotionTier {
  state: 'cute' | 'disappointed' | 'angry';
  phrases: string[];
}

const TIERS: EmotionTier[] = [
  { state: 'cute', phrases: ['nya~', 'gotcha!', 'whatcha doing?'] },
  { state: 'disappointed', phrases: ['...mou.', 'again?', 'focus please!'] },
  { state: 'angry', phrases: ['yamerooooooo!!', 'yamete yo~!!', 'stop it!'] }
];

// Keep track of offense timestamps
const offenseHistory: Record<string, number[]> = {};
let lastOffenseTime = 0;
let happyTriggered = false;

/**
 * Records an offense for a given rule. Returns the corresponding emotional tier and reaction phrase.
 */
export function recordOffense(ruleId: string): { state: 'cute' | 'disappointed' | 'angry'; phrase: string } {
  const now = Date.now();
  lastOffenseTime = now;
  happyTriggered = false; // Reset happy state upon a new offense

  if (!offenseHistory[ruleId]) {
    offenseHistory[ruleId] = [];
  }

  // Push new offense timestamp and decay old ones outside the rolling window
  offenseHistory[ruleId].push(now);
  offenseHistory[ruleId] = offenseHistory[ruleId].filter(t => now - t < WINDOW_MS);

  const offenseCount = offenseHistory[ruleId].length;

  let tier = TIERS[0]; // Tier 1: cute
  if (offenseCount >= 4) {
    tier = TIERS[2]; // Tier 3: angry ("yamerooooooo" tier)
  } else if (offenseCount >= 2) {
    tier = TIERS[1]; // Tier 2: disappointed
  }

  const phrase = tier.phrases[Math.floor(Math.random() * tier.phrases.length)];
  return { state: tier.state, phrase };
}

/**
 * Checks if the user is eligible for positive happy reinforcement (purring).
 * Triggers if there are zero offenses in the last 20 minutes.
 */
export function checkHappyReinforcement(): { state: 'happy'; phrase: string } | null {
  const now = Date.now();
  // Treat starting up (lastOffenseTime === 0) as eligible only after app has been open for HAPPY_WINDOW_MS
  if (lastOffenseTime > 0 && now - lastOffenseTime > HAPPY_WINDOW_MS && !happyTriggered) {
    happyTriggered = true;
    const phrases = ['purrrr~', 'good job!', 'so focused!', 'u did great!'];
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];
    return { state: 'happy', phrase };
  }
  return null;
}
