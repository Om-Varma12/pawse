import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { store } from '../settingsStore';

export interface Rule {
  id: string;
  label: string;
  matchType: 'nativeApp' | 'browserTab';
  process: string[];
  titleRegex: string | null;
  closeAction: 'wm-close' | 'ctrl-w';
  enabled: boolean;
  confidence: 'high' | 'low' | 'unsupported';
}

/** The canonical default rules — used as source of truth for definitions. */
const BUILT_IN_DEFAULTS: Rule[] = [
  {
    id: 'tiktok-app',
    label: 'TikTok (desktop app)',
    matchType: 'nativeApp',
    // get-windows returns display name on Windows, not .exe filename
    process: ['TikTok', 'tiktok'],
    titleRegex: null,
    closeAction: 'wm-close',
    enabled: true,
    confidence: 'high'
  },
  {
    id: 'tiktok-web',
    label: 'TikTok (browser)',
    matchType: 'browserTab',
    process: ['chrome', 'edge', 'firefox', 'brave', 'opera'],
    titleRegex: 'TikTok',
    closeAction: 'ctrl-w',
    enabled: true,
    confidence: 'high'
  },
  {
    id: 'instagram-web',
    label: 'Instagram (browser) — coarse, catches all of Instagram, not just Reels',
    matchType: 'browserTab',
    process: ['chrome', 'edge', 'firefox', 'brave', 'opera'],
    titleRegex: 'Instagram',
    closeAction: 'ctrl-w',
    enabled: true,
    confidence: 'low'
  },
  {
    id: 'youtube-shorts',
    label: 'YouTube Shorts (browser) — coarse, matches all of YouTube',
    matchType: 'browserTab',
    process: ['chrome', 'edge', 'firefox', 'brave', 'opera'],
    titleRegex: 'YouTube',
    closeAction: 'ctrl-w',
    enabled: false,
    confidence: 'unsupported'
  }
];

/**
 * Loads canonical rule definitions from default-rules.json, falling back to built-in defaults.
 * The `enabled` state is then overlaid with per-rule user overrides from electron-store.
 *
 * This approach ensures new rule definitions always ship correctly even across app updates,
 * while preserving only what the user explicitly toggled.
 */
export function getRules(): Rule[] {
  // 1. Load canonical rule definitions (schema + defaults)
  let baseRules: Rule[] = BUILT_IN_DEFAULTS;
  try {
    const rootPath = app.getAppPath();
    let defaultRulesPath = path.join(rootPath, 'rules', 'default-rules.json');
    if (!fs.existsSync(defaultRulesPath)) {
      defaultRulesPath = path.join(rootPath, '..', 'rules', 'default-rules.json');
    }
    if (fs.existsSync(defaultRulesPath)) {
      const parsed = JSON.parse(fs.readFileSync(defaultRulesPath, 'utf8')) as Rule[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        baseRules = parsed;
      }
    }
  } catch (err) {
    console.error('[ruleEngine] Failed to read default-rules.json, using built-in defaults:', err);
  }

  // 2. Load per-rule user toggle overrides: { ruleId -> enabled }
  const userToggles = (store.get('ruleToggles') || {}) as Record<string, boolean>;

  // 3. Merge: apply user overrides on top of the canonical base rules
  const mergedRules = baseRules.map((rule) => {
    if (rule.id in userToggles) {
      return { ...rule, enabled: userToggles[rule.id] };
    }
    return rule;
  });

  return mergedRules;
}

/**
 * Saves user-toggled rule enabled states.
 * Only stores the per-rule enabled overrides, not the full rule definition.
 * This way, rule definitions always come from default-rules.json.
 */
export function saveRules(rules: Rule[]): void {
  const toggles: Record<string, boolean> = {};
  rules.forEach((r) => { toggles[r.id] = r.enabled; });
  store.set('ruleToggles', toggles);
}

/**
 * Checks active window details against the enabled rule set.
 * Returns the matched Rule, or null if no rule matches.
 * Logs active window details for debugging.
 */
export function matchActiveWindow(win: { title: string; owner: { name: string } }): Rule | null {
  const rules = getRules();
  const processName = win.owner.name.toLowerCase();

  // Debug: log active window so you can see what Pawse is detecting
  console.log(`[detector] Active window — process: "${win.owner.name}" | title: "${win.title}"`);

  for (const rule of rules) {
    if (!rule.enabled) continue;

    // get-windows on Windows returns display name (e.g. "Google Chrome"), not exe filename.
    // Use substring matching so "chrome" matches "Google Chrome", "edge" matches "Microsoft Edge" etc.
    const processMatch = rule.process.some((p) =>
      processName.includes(p.toLowerCase())
    );
    if (!processMatch) continue;

    if (rule.titleRegex) {
      try {
        const regex = new RegExp(rule.titleRegex, 'i');
        if (regex.test(win.title)) {
          console.log(`[detector] ✅ MATCH — rule: "${rule.id}" for title: "${win.title}"`);
          return rule;
        }
      } catch (err) {
        console.error(`[detector] Invalid regex for rule ${rule.id}:`, err);
      }
    } else {
      // No title regex → process name match alone is sufficient (native apps)
      console.log(`[detector] ✅ MATCH — rule: "${rule.id}" via process name`);
      return rule;
    }
  }

  return null;
}
