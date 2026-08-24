# Desktop Cat Focus App — Windows Build Plan

A Workcat-inspired (github credit them in your README, don't reuse their name/art) desktop cat for Windows: it patrols your screen, notices drift content (TikTok, Instagram, YouTube Shorts), walks over, closes it, and reacts emotionally based on how often you keep doing it — culminating in an angry "yamerooooooo" outburst.

Budget: 4-5 hours, vibe-coded, open source, cat models swappable by the community.

---

## 1. Tech stack

| Piece | Choice | Why |
|---|---|---|
| Shell | Electron (via `electron-vite` scaffold) | Fast HMR, zero webpack config, ships in minutes |
| Renderer | React + plain CSS (Tailwind optional) | State-driven animation swapping is trivial with React |
| Language | JS is fine; light TS in `main/` recommended | TS in main catches IPC/typo bugs an agent tends to make; skip it in renderer if you want raw speed |
| Window/app detection | [`get-windows`](https://www.npmjs.com/package/get-windows) (ESM) | Cross-platform active-window title/process/bounds. **No URL on Windows** — see §3 |
| OS-level actions (close window, send Ctrl+W, focus window) | [`koffi`](https://koffi.dev/) FFI bindings to `user32.dll` | Ships prebuilt binaries — **no node-gyp / native compile step**, critical for fast vibe-coding on Windows |
| Settings persistence | `electron-store` | Zero-config JSON persistence |
| Packaging | `electron-builder` (NSIS target) | Standard Windows installer output |

No Accessibility-style permission prompt is needed on Windows for reading foreground window titles or sending `WM_CLOSE`/`Ctrl+W` to windows at the same privilege level — unlike macOS. Only exception: you can't close a window running elevated (as admin) from a non-elevated app; that's an acceptable limitation to note in the README, not something to solve.

---

## 2. Architecture at a glance

```
┌────────────────────────────────────────────────────────┐
│ Electron Main Process                                   │
│                                                          │
│  Detector (poll loop, ~1000ms)                          │
│    → get-windows: activeWindow()                        │
│    → RuleEngine.match(title, process)                   │
│    → on match: EmotionEngine.recordOffense(ruleId)       │
│                     → tier (cute/disappointed/angry)     │
│                                                          │
│  ActionRunner (koffi → user32.dll)                       │
│    → WM_CLOSE for native apps                            │
│    → SetForegroundWindow + Ctrl-W for browser tabs        │
│                                                          │
│  CatWindowController                                     │
│    → owns a SMALL (≈220×220) frameless, transparent,     │
│      always-on-top BrowserWindow that IS the cat          │
│    → repositions it via setBounds() to patrol/approach     │
│    → sends IPC state changes to the renderer inside it     │
└───────────────────────┬──────────────────────────────────┘
                         │ IPC (contextBridge)
┌───────────────────────▼──────────────────────────────────┐
│ Renderer (inside the small cat window)                    │
│   - AnimationEngine: steps sprite-sheet frames per state   │
│   - SpeechBubble: shows phrase for current emotion tier    │
│   - Drag handling (mousedown/mousemove → IPC → main moves  │
│     the actual OS window)                                  │
└────────────────────────────────────────────────────────────┘
```

**Key implementation trick:** don't build a full-screen transparent click-through overlay (that requires hit-testing gymnastics in Electron). Instead make the cat's own window small and exactly cat-sized, and *move that window* to make the cat "walk." This sidesteps click-through entirely — the window is only ever where the cat visually is.

---

## 3. Important limitation to design around (read this before building rules)

`get-windows` only returns `url` on **macOS**. On Windows you get `title`, `owner.name` (process), `owner.processId`, and `bounds` — no tab URL. That means:

- **TikTok (web or app):** reliable. The word "TikTok" is in the title/tab almost universally.
- **Instagram (web):** only coarse detection is possible — you can detect "on Instagram" but not "on Reels specifically" from the title alone. Ship this as an opt-in rule, labeled honestly as coarse.
- **YouTube Shorts:** **not reliably detectable from window title on Windows.** A Shorts tab's title is just `"<video title> - YouTube"` — identical in shape to a regular video. There is no substring that reliably marks it as a Short. Don't fake a heuristic here; ship this rule **disabled by default** with a note, and treat it as the flagship reason to build the browser-extension stretch goal (§9).

This isn't a blocker for v1 — TikTok alone (app + web) plus coarse Instagram gets you a working, honest product today.

---

## 4. Repo structure

```
workcat-win/
├── README.md
├── LICENSE                      # MIT recommended
├── CONTRIBUTING.md
├── package.json
├── electron.vite.config.ts
├── electron-builder.yml
├── src/
│   ├── main/
│   │   ├── index.ts             # app entry, tray icon, lifecycle
│   │   ├── catWindow.ts         # creates + moves the small cat window
│   │   ├── detector/
│   │   │   ├── index.ts         # poll loop, orchestrates match → react → act
│   │   │   ├── activeWindowSource.ts   # wraps get-windows
│   │   │   └── ruleEngine.ts    # loads rules/*.json, does regex matching
│   │   ├── actions/
│   │   │   └── win32.ts         # koffi bindings: PostMessage, SendInput, SetForegroundWindow
│   │   ├── emotion/
│   │   │   └── emotionEngine.ts # offense history, tier calc, decay
│   │   ├── catModels/
│   │   │   └── loader.ts        # scans /cats, validates manifest.json
│   │   ├── settingsStore.ts
│   │   └── ipc.ts               # channel name constants + handlers
│   ├── preload/
│   │   └── index.ts             # contextBridge, exposes safe IPC surface
│   └── renderer/
│       ├── index.html
│       ├── main.tsx
│       ├── Cat.tsx
│       ├── SpeechBubble.tsx
│       ├── SettingsPanel.tsx
│       └── animationEngine.ts
├── rules/
│   └── default-rules.json       # ships with app; user can override in settings
├── cats/
│   └── classic-cat/
│       ├── manifest.json
│       ├── idle.png             # horizontal sprite strip
│       ├── walk.png
│       ├── notice.png
│       ├── approach.png
│       ├── swat.png
│       ├── cute.png
│       ├── disappointed.png
│       ├── angry.png
│       └── happy.png
├── extension/                   # stretch goal, see §9
└── docs/
    ├── CAT_MODEL_SPEC.md         # spec for community-contributed cats
    └── RULES_SPEC.md             # spec for community-contributed detection rules
```

---

## 5. Rule engine

`rules/default-rules.json`:

```json
[
  {
    "id": "tiktok-app",
    "label": "TikTok (desktop app)",
    "matchType": "nativeApp",
    "process": ["TikTok.exe"],
    "titleRegex": null,
    "closeAction": "wm-close",
    "enabled": true,
    "confidence": "high"
  },
  {
    "id": "tiktok-web",
    "label": "TikTok (browser)",
    "matchType": "browserTab",
    "process": ["chrome.exe", "msedge.exe", "firefox.exe", "brave.exe"],
    "titleRegex": "TikTok",
    "closeAction": "ctrl-w",
    "enabled": true,
    "confidence": "high"
  },
  {
    "id": "instagram-web",
    "label": "Instagram (browser) — coarse, catches all of Instagram, not just Reels",
    "matchType": "browserTab",
    "process": ["chrome.exe", "msedge.exe", "firefox.exe", "brave.exe"],
    "titleRegex": "Instagram",
    "closeAction": "ctrl-w",
    "enabled": false,
    "confidence": "low"
  },
  {
    "id": "youtube-shorts",
    "label": "YouTube Shorts — cannot be distinguished from regular videos by title on Windows; needs the browser extension (see docs) for accuracy",
    "matchType": "browserTab",
    "process": ["chrome.exe", "msedge.exe", "firefox.exe", "brave.exe"],
    "titleRegex": null,
    "closeAction": "ctrl-w",
    "enabled": false,
    "confidence": "unsupported"
  }
]
```

Matcher logic: only ever evaluate the **foreground/active window** (not a full window enumeration). This is deliberate — it sidesteps "which tab is this" ambiguity entirely, because if a `browserTab` rule matches, the matched tab is by definition the one currently in focus, so `Ctrl+W` closes exactly that tab and nothing else.

```ts
async function tick() {
  const win = await activeWindow(); // get-windows
  if (!win) return;
  const rule = rules.find(r =>
    r.enabled &&
    r.process.some(p => p.toLowerCase() === win.owner.name.toLowerCase()) &&
    (r.titleRegex === null || new RegExp(r.titleRegex, 'i').test(win.title))
  );
  if (rule) handleMatch(rule, win);
}
```

---

## 6. Close actions (koffi → user32.dll)

```ts
import koffi from 'koffi';
const user32 = koffi.load('user32.dll');
const PostMessageW = user32.func('bool PostMessageW(void* hwnd, uint32 msg, void* wparam, void* lparam)');
const SetForegroundWindow = user32.func('bool SetForegroundWindow(void* hwnd)');
const SendInput = user32.func('uint32 __stdcall SendInput(uint32 cInputs, void* pInputs, int32 cbSize)');

const WM_CLOSE = 0x0010;

function closeNativeWindow(hwnd: number) {
  PostMessageW(hwnd, WM_CLOSE, 0, 0); // graceful close, respects app's own handler
}

function closeActiveTab(hwnd: number) {
  SetForegroundWindow(hwnd);
  sendCtrlW(); // build an INPUT[] struct for Ctrl down, W down, W up, Ctrl up via SendInput
}
```

`get-windows`'s `id` field on Windows is the raw HWND memory address — usable directly as the `hwnd` argument above. Building the `SendInput` `INPUT` struct is the fiddliest part; have the agent look up the exact `INPUT`/`KEYBDINPUT` struct layout for `koffi.struct(...)` — it's a well-documented, copy-pasteable Win32 struct.

---

## 7. Emotion / escalation engine

This is the "gets angrier" mechanic. Track offenses **per rule id**, in a rolling time window, with decay.

```ts
const WINDOW_MS = 15 * 60 * 1000;      // only count recent repeats
const DECAY_STEP_MS = 5 * 60 * 1000;   // anger cools off if you behave

const TIERS = [
  { min: 1, state: 'cute',         phrases: 'cute' },
  { min: 2, state: 'disappointed', phrases: 'disappointed' },
  { min: 4, state: 'angry',        phrases: 'angry' }, // "yamerooooooo" tier
];

function recordOffense(ruleId: string): Tier {
  const now = Date.now();
  const rec = history[ruleId] ??= [];
  rec.push(now);
  history[ruleId] = rec.filter(t => now - t < WINDOW_MS);
  const count = history[ruleId].length;
  return [...TIERS].reverse().find(t => count >= t.min) ?? TIERS[0];
}
```

Bonus positive-reinforcement state: if the user goes a full window (e.g. 20+ min) with **zero** offenses across all rules, fire a one-off `happy`/purr state next time the cat is idle — costs almost nothing to add and makes the app feel alive rather than punitive.

Phrase tables (put these in the cat model, not hardcoded — see §8, so community cats can localize/reflavor them):

```json
{
  "cute":         ["nya~", "gotcha!"],
  "disappointed": ["...mou.", "again?"],
  "angry":        ["yamerooooooo!!", "yamete yo~!!"],
  "happy":        ["purrrr~"]
}
```

---

## 8. Cat model system (the extensibility layer)

`cats/<id>/manifest.json`:

```json
{
  "id": "classic-cat",
  "name": "Classic Cat",
  "author": "your-name",
  "version": "1.0.0",
  "license": "CC-BY-4.0",
  "frameSize": { "width": 128, "height": 128 },
  "states": {
    "idle":         { "frames": 6, "fps": 4,  "loop": true  },
    "walk":         { "frames": 8, "fps": 10, "loop": true  },
    "notice":       { "frames": 4, "fps": 8,  "loop": false },
    "approach":     { "frames": 8, "fps": 12, "loop": true  },
    "swat":         { "frames": 6, "fps": 14, "loop": false, "impactFrame": 3 },
    "cute":         { "frames": 6, "fps": 6,  "loop": false },
    "disappointed": { "frames": 5, "fps": 5,  "loop": false },
    "angry":        { "frames": 6, "fps": 10, "loop": true  },
    "happy":        { "frames": 6, "fps": 8,  "loop": false }
  },
  "phrases": {
    "cute": ["nya~", "gotcha!"],
    "disappointed": ["...mou.", "again?"],
    "angry": ["yamerooooooo!!", "yamete yo~!!"],
    "happy": ["purrrr~"]
  }
}
```

Each state is one horizontal sprite-strip PNG (`swat.png` = 6 frames side by side). `impactFrame` on `swat` is what the main process uses to time the actual window close so it lands on the paw hitting the "screen" — a small detail that sells the whole bit.

Loader just does `fs.readdir('cats')`, reads each `manifest.json`, validates required fields exist, and exposes the list to the settings UI as a picker. Anyone contributing a new cat (or a different animal entirely) just drops a folder in `cats/` with this shape — no code changes needed. Document this contract in `docs/CAT_MODEL_SPEC.md` verbatim so external contributors don't have to read your source.

---

## 9. End-to-end sequence (what actually happens on a match)

```
tick() finds a rule match
  → EmotionEngine.recordOffense(ruleId) → tier
  → CatWindowController: begin walking toward matched window's bounds
       (get-windows gives win.bounds — aim for bottom-center of it;
        if bounds missing, just aim for screen center-bottom)
  → IPC cat:setState('notice')            (~400ms, ears perk)
  → IPC cat:setState('approach') + moveTo(targetX, targetY)
       main tweens the OS window position over ~600-900ms
  → IPC cat:setState('swat')
  → setTimeout(closeAction, impactFrame / fps * 1000)   // sync close to paw-hit frame
  → IPC cat:setState(tier.state, { phrase: pick(tier.phrases) })
  → after ~1800ms bubble duration → IPC cat:setState('idle')
  → resume patrol loop after a short random delay
```

---

## 10. Build order (fits ~4.5-5h)

| Phase | Time | Deliverable |
|---|---|---|
| 0 | 15 min | `electron-vite` scaffold running, blank window visible |
| 1 | 45 min | Small transparent always-on-top cat window; basic patrol (random walk via `setBounds` on a timer); placeholder square sprite is fine |
| 2 | 45 min | Detector polling loop + `default-rules.json` + matcher; **log matches to console only** — verify against real TikTok/Instagram tabs before wiring any close action |
| 3 | 45 min | Wire koffi close actions (`WM_CLOSE`, `Ctrl+W`); confirm both actually close things without side effects |
| 4 | 60 min | Animation engine (sprite-strip stepper) + notice→approach→swat sequence with real or placeholder frames; `moveTo` tween |
| 5 | 45 min | Emotion engine (tiers, decay) + `SpeechBubble` + phrase wiring, including the angry/yamerooooooo tier |
| 6 | 30 min | Cat model loader + minimal settings panel (rule toggles, cat picker, tray menu, "start with Windows" toggle) |
| buffer | remaining | `electron-builder` NSIS packaging, README, `docs/CAT_MODEL_SPEC.md`, `docs/RULES_SPEC.md`, smoke test |

---

## 11. Stretch goal: browser extension for precise Shorts/Reels detection

Since Windows gives no tab URL, the only way to detect Shorts/Reels *precisely* (not just "on YouTube" or "on Instagram") is a small companion browser extension:

- `chrome.tabs.onUpdated` watches the active tab's URL.
- On a URL matching `/\/shorts\//` (YouTube) or `/reels?\//` (Instagram), it messages the Electron app over a local WebSocket (e.g. `ws://127.0.0.1:<port>`) or Native Messaging host.
- The extension can even close the tab directly via `chrome.tabs.remove(tabId)` — more precise than simulated `Ctrl+W`, since it doesn't depend on window focus at all.
- Detector treats extension events as just another `DriftEvent` source alongside the title-matcher, feeding the same `RuleEngine` → `EmotionEngine` → cat-reaction pipeline. No architecture rework needed later — this is why the pipeline is source-agnostic from the start.

Not required for v1; note it in the README as the answer to "why doesn't this catch Shorts."

---

## 12. Open-source scaffolding checklist

- MIT (or similar permissive) `LICENSE`.
- README: what it does, install/run instructions, screenshot/gif, credit to Workcat as the inspiration, and the honest limitation from §3.
- `docs/CAT_MODEL_SPEC.md` — the manifest schema from §8, so contributors can add cats without reading code.
- `docs/RULES_SPEC.md` — the rule schema from §5, so contributors can add detection rules for other drift apps.
- `CONTRIBUTING.md` — how to test a new cat model locally (drop folder in `cats/`, restart app, pick it in settings).