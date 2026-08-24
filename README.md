# Pawse 🐾

**Pawse** is a Workcat-inspired desktop focus assistant for Windows. It patrols your screen as a cute cream-colored cat (named **Pawse**!), keeps an eye on your active windows, and approaches to close distracting apps (like TikTok or Instagram) to help you get back to work.

If you keep drifting to distractions, Pawse will get progressively angrier — culminating in an outburst of *"yamerooooooo!!"* You can also pet Pawse by clicking on them to make them purr and show love!

> [!NOTE]
> *Credit: Inspired by [Workcat](https://github.com/workcat-app). This Windows version is a clean-room implementation built from scratch using dynamic SVG rendering.*

---

## Features

- 🐱 **Pawse the Cat:** A cream-colored virtual pet with rounded features, dot eyes, a cute `:3` mouth, and a dynamically waving tail.
- 🚶‍♂️ **Screen Patrol:** Pawse wanders around the bottom area of your screen, occasionally sitting down or purring.
- ⚡ **Win32 Enforcement:** Automatically detects foreground apps. If a distraction matches (such as a TikTok tab/app), Pawse will notice, walk to the window, swat it, and close the window/tab.
- ❤️ **Interactive Petting:** Click on Pawse to pet them and trigger floating heart emojis.
- 😠 **Escalation Engine:** Pawse's reactions escalate from cute -> disappointed -> angry (shaking head and shouting in speech bubbles) depending on distraction history.
- ⚙️ **Settings Console:** Easily toggle rule definitions and toggle auto-start with Windows.

---

## Tech Stack

- **Electron & electron-vite** — Quick scaffolding and HMR in development.
- **React + Tailwind-free CSS** — Dynamic SVG rendering and keyframe animations.
- **get-windows** — Polls active/foreground window metadata.
- **koffi FFI** — Bindings to `user32.dll` to send keystrokes (`Ctrl+W`) and system window messages (`WM_CLOSE`) without native node-gyp compiling.
- **electron-store** — Setting persistence.

---

## Project Setup

### Install Dependencies
```bash
npm install
```

### Run in Development
```bash
npm run dev
```

### Build Installer (Windows)
```bash
npm run build:win
```
The NSIS installer executable will be generated under the `dist/` or `out/` directory.

---

## Rules Configuration

Rules are defined in `rules/default-rules.json`. You can customize processes and window title expressions. Active window tracking only evaluates the currently focused window for maximum performance and minimal impact on system resources.
