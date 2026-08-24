import { BrowserWindow, screen, ipcMain, shell } from 'electron';
import { join } from 'path';
import { is } from '@electron-toolkit/utils';
import { closeNativeWindow, closeActiveTab } from './actions/win32';

let catWindow: BrowserWindow | null = null;
let patrolInterval: NodeJS.Timeout | null = null;
let isAnimating = false;
let currentCatState: string = 'idle';

export function getCatWindow(): BrowserWindow | null {
  return catWindow;
}

/**
 * Creates the transparent always-on-top cat window.
 */
export function createCatWindow(): BrowserWindow {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workArea;

  catWindow = new BrowserWindow({
    width: 220,
    height: 220,
    x: width - 240,
    y: height - 240,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    show: false,
    skipTaskbar: true, // Hide from taskbar
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  });

  // Always keep on top
  catWindow.setAlwaysOnTop(true, 'screen-saver');

  catWindow.on('ready-to-show', () => {
    catWindow?.show();
    sendCatState('idle');
    startPatrol();
  });

  catWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    catWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    catWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  setupIpcHandlers();

  return catWindow;
}

/**
 * Sends a state update to the React renderer.
 */
export function sendCatState(state: string, data?: any): void {
  currentCatState = state;
  if (catWindow && !catWindow.isDestroyed()) {
    catWindow.webContents.send('cat:state', { state, data });
  }
}

/**
 * Smoothly tweens the window to target coordinates.
 */
export function tweenWindowTo(targetX: number, targetY: number, durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    if (!catWindow || catWindow.isDestroyed()) return resolve();
    
    const startBounds = catWindow.getBounds();
    const startTime = Date.now();

    function step() {
      if (!catWindow || catWindow.isDestroyed()) return resolve();
      
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      
      // Easing: easeInOutQuad
      const ease = progress < 0.5 
        ? 2 * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const currentX = Math.round(startBounds.x + (targetX - startBounds.x) * ease);
      const currentY = Math.round(startBounds.y + (targetY - startBounds.y) * ease);

      catWindow.setBounds({
        x: currentX,
        y: currentY,
        width: startBounds.width,
        height: startBounds.height
      });

      if (progress < 1) {
        setTimeout(step, 16);
      } else {
        resolve();
      }
    }

    step();
  });
}

/**
 * Triggers random walking patrol around the screen.
 */
export function startPatrol(): void {
  if (patrolInterval) clearInterval(patrolInterval);

  patrolInterval = setInterval(async () => {
    if (isAnimating || currentCatState !== 'idle' && currentCatState !== 'sit') return;

    // 60% chance to walk, 40% chance to sit and wave tail
    const action = Math.random() < 0.6 ? 'walk' : 'sit';

    if (action === 'walk') {
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.workArea;

      // Pick a random spot, biasing towards bottom edges
      const targetX = Math.floor(Math.random() * (width - 220));
      const targetY = Math.random() < 0.7 
        ? height - 220 // Stay on taskbar/bottom
        : Math.floor(Math.random() * (height - 220));

      sendCatState('walk');
      isAnimating = true;
      await tweenWindowTo(targetX, targetY, 2000 + Math.random() * 1500);
      isAnimating = false;
      
      sendCatState(Math.random() < 0.5 ? 'idle' : 'sit');
    } else {
      sendCatState('sit');
    }
  }, 12000 + Math.random() * 8000);
}

export function stopPatrol(): void {
  if (patrolInterval) {
    clearInterval(patrolInterval);
    patrolInterval = null;
  }
}

/**
 * Initiates the distraction approach sequence:
 * 1. Notice the window
 * 2. Walk over to its bottom center location
 * 3. Swat it (closing the window/tab synchronized with animation)
 * 4. React emotionally based on history
 */
export async function triggerDistractionApproach(
  rule: any, 
  winBounds: { x: number; y: number; width: number; height: number },
  emotion: { state: 'cute' | 'disappointed' | 'angry'; phrase: string }
): Promise<void> {
  if (isAnimating) return;
  isAnimating = true;
  stopPatrol();

  try {
    // 1. Notice
    sendCatState('notice');
    await new Promise((resolve) => setTimeout(resolve, 800));

    // 2. Approach: Move to bottom-center of the target window
    const targetX = Math.round(winBounds.x + winBounds.width / 2 - 110);
    const targetY = Math.round(winBounds.y + winBounds.height - 180);
    
    // Ensure boundaries are on-screen
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workArea;
    const boundedX = Math.max(0, Math.min(width - 220, targetX));
    const boundedY = Math.max(0, Math.min(height - 220, targetY));

    sendCatState('approach');
    await tweenWindowTo(boundedX, boundedY, 1500);

    // 3. Swat
    sendCatState('swat');
    // Wait for the impact frame (approx 300ms into the swat motion)
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Execute Win32 action to close
    if (rule.closeAction === 'wm-close') {
      closeNativeWindow(rule.hwnd);
    } else {
      closeActiveTab(rule.hwnd);
    }

    // Wait for swat animation to finish
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 4. Emotional reaction
    sendCatState(emotion.state, { phrase: emotion.phrase });
    await new Promise((resolve) => setTimeout(resolve, 2500));

  } catch (err) {
    console.error('Error during distraction approach:', err);
  } finally {
    isAnimating = false;
    sendCatState('idle');
    startPatrol();
  }
}

/**
 * Handles IPC messages from the renderer.
 */
function setupIpcHandlers(): void {
  ipcMain.on('drag-window', (event, { dx, dy }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      const bounds = win.getBounds();
      win.setBounds({
        x: bounds.x + dx,
        y: bounds.y + dy,
        width: bounds.width,
        height: bounds.height
      });
    }
  });

  ipcMain.on('cat:pet', () => {
    // If we're not busy approaching a distraction, trigger love popup
    if (!isAnimating && (currentCatState === 'idle' || currentCatState === 'sit')) {
      sendCatState('pet');
      setTimeout(() => {
        if (currentCatState === 'pet') {
          sendCatState('idle');
        }
      }, 2000);
    }
  });

  ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.setIgnoreMouseEvents(ignore, options);
  });
}
