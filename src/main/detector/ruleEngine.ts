import Store from 'electron-store';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

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

const store = new Store<{ rules: Rule[] }>();

/**
 * Loads rules from electron-store or falls back to default-rules.json in the project root.
 */
export function getRules(): Rule[] {
  let rules = store.get('rules') as Rule[];
  if (!rules) {
    try {
      const rootPath = app.getAppPath();
      // Look for default-rules.json in rules/ relative to app path
      let defaultRulesPath = path.join(rootPath, 'rules', 'default-rules.json');
      
      // Fallback path in case of different dev layout
      if (!fs.existsSync(defaultRulesPath)) {
        defaultRulesPath = path.join(rootPath, '..', 'rules', 'default-rules.json');
      }

      if (fs.existsSync(defaultRulesPath)) {
        const fileContent = fs.readFileSync(defaultRulesPath, 'utf8');
        rules = JSON.parse(fileContent);
      } else {
        // Hardcoded default rules fallback
        rules = [
          {
            id: "tiktok-app",
            label: "TikTok (desktop app)",
            matchType: "nativeApp",
            process: ["TikTok.exe"],
            titleRegex: null,
            closeAction: "wm-close",
            enabled: true,
            confidence: "high"
          },
          {
            id: "tiktok-web",
            label: "TikTok (browser)",
            matchType: "browserTab",
            process: ["chrome.exe", "msedge.exe", "firefox.exe", "brave.exe", "opera.exe"],
            titleRegex: "TikTok",
            closeAction: "ctrl-w",
            enabled: true,
            confidence: "high"
          },
          {
            id: "instagram-web",
            label: "Instagram (browser) — coarse, catches all of Instagram, not just Reels",
            matchType: "browserTab",
            process: ["chrome.exe", "msedge.exe", "firefox.exe", "brave.exe", "opera.exe"],
            titleRegex: "Instagram",
            closeAction: "ctrl-w",
            enabled: false,
            confidence: "low"
          },
          {
            id: "youtube-shorts",
            label: "YouTube Shorts (browser) — coarse, matches all of YouTube",
            matchType: "browserTab",
            process: ["chrome.exe", "msedge.exe", "firefox.exe", "brave.exe", "opera.exe"],
            titleRegex: "YouTube",
            closeAction: "ctrl-w",
            enabled: false,
            confidence: "unsupported"
          }
        ];
      }
      store.set('rules', rules);
    } catch (err) {
      console.error('Failed to load default rules:', err);
      rules = [];
    }
  }
  return rules;
}

/**
 * Saves modified rules back to the electron-store.
 */
export function saveRules(rules: Rule[]): void {
  store.set('rules', rules);
}

/**
 * Checks an active window details against the rule set.
 * Returns the matched Rule, or null if no rule matches.
 */
export function matchActiveWindow(win: { title: string; owner: { name: string } }): Rule | null {
  const rules = getRules();
  const processName = win.owner.name.toLowerCase();
  
  for (const rule of rules) {
    if (!rule.enabled) continue;
    
    // Check if the process matches
    const processMatch = rule.process.some(p => p.toLowerCase() === processName);
    if (!processMatch) continue;
    
    // Check if the title matches (if regex is provided)
    if (rule.titleRegex) {
      try {
        const regex = new RegExp(rule.titleRegex, 'i');
        if (regex.test(win.title)) {
          return rule;
        }
      } catch (err) {
        console.error(`Invalid regex for rule ${rule.id}:`, err);
      }
    } else {
      // If no title regex, process name match is sufficient (for native apps)
      return rule;
    }
  }
  
  return null;
}
