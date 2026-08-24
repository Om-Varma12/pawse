import koffi from 'koffi';

const user32 = koffi.load('user32.dll');

// Define Win32 structural mappings for keyboard simulation
const KEYBDINPUT = koffi.struct('KEYBDINPUT', {
  wVk: 'uint16',
  wScan: 'uint16',
  dwFlags: 'uint32',
  time: 'uint32',
  dwExtraInfo: 'uintptr_t'
});

const MOUSEINPUT = koffi.struct('MOUSEINPUT', {
  dx: 'int32',
  dy: 'int32',
  mouseData: 'uint32',
  dwFlags: 'uint32',
  time: 'uint32',
  dwExtraInfo: 'uintptr_t'
});

const HARDWAREINPUT = koffi.struct('HARDWAREINPUT', {
  uMsg: 'uint32',
  wParamL: 'uint16',
  wParamH: 'uint16'
});

const INPUT_UNION = koffi.union('INPUT_UNION', {
  mi: MOUSEINPUT,
  ki: KEYBDINPUT,
  hi: HARDWAREINPUT
});

const INPUT = koffi.struct('INPUT', {
  type: 'uint32',
  u: INPUT_UNION
});

// Bind Win32 API functions from user32.dll
const PostMessageW = user32.func('bool PostMessageW(uintptr_t hwnd, uint32 msg, uintptr_t wparam, uintptr_t lparam)');
const SetForegroundWindow = user32.func('bool SetForegroundWindow(uintptr_t hwnd)');
const SendInput = user32.func('uint32 SendInput(uint32 cInputs, INPUT* pInputs, int32 cbSize)');

const WM_CLOSE = 0x0010;
const INPUT_KEYBOARD = 1;
const VK_CONTROL = 0x11;
const VK_W = 0x57;
const KEYEVENTF_KEYUP = 0x0002;

/**
 * Sends a WM_CLOSE message to gracefully close a native desktop window.
 */
export function closeNativeWindow(hwnd: number): boolean {
  try {
    return !!PostMessageW(hwnd, WM_CLOSE, 0, 0);
  } catch (err) {
    console.error('Error closing native window:', err);
    return false;
  }
}

/**
 * Focuses the browser window and sends a simulated Ctrl+W keyboard shortcut to close the active tab.
 */
export function closeActiveTab(hwnd: number): boolean {
  try {
    // Focus the target window
    SetForegroundWindow(hwnd);
    
    // Simulate Ctrl down, W down, W up, Ctrl up
    const inputs = [
      {
        type: INPUT_KEYBOARD,
        u: {
          ki: {
            wVk: VK_CONTROL,
            wScan: 0,
            dwFlags: 0,
            time: 0,
            dwExtraInfo: 0
          }
        }
      },
      {
        type: INPUT_KEYBOARD,
        u: {
          ki: {
            wVk: VK_W,
            wScan: 0,
            dwFlags: 0,
            time: 0,
            dwExtraInfo: 0
          }
        }
      },
      {
        type: INPUT_KEYBOARD,
        u: {
          ki: {
            wVk: VK_W,
            wScan: 0,
            dwFlags: KEYEVENTF_KEYUP,
            time: 0,
            dwExtraInfo: 0
          }
        }
      },
      {
        type: INPUT_KEYBOARD,
        u: {
          ki: {
            wVk: VK_CONTROL,
            wScan: 0,
            dwFlags: KEYEVENTF_KEYUP,
            time: 0,
            dwExtraInfo: 0
          }
        }
      }
    ];

    const result = SendInput(inputs.length, inputs, koffi.sizeof(INPUT));
    return result === inputs.length;
  } catch (err) {
    console.error('Error sending Ctrl+W:', err);
    return false;
  }
}
