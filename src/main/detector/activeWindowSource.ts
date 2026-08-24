import { activeWindow } from 'get-windows';

export interface ActiveWindowInfo {
  title: string;
  id: number;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  owner: {
    name: string;
    processId: number;
    path: string;
  };
}

/**
 * Fetches current active window details. Returns null if unable to fetch.
 */
export async function getActiveWindow(): Promise<ActiveWindowInfo | null> {
  try {
    const win = await activeWindow();
    if (!win) return null;
    return win as unknown as ActiveWindowInfo;
  } catch (err) {
    // Occasional Win32 errors when shifting focus during window enumeration
    return null;
  }
}
