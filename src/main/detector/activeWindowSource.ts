import { activeWindow } from 'get-windows';
import { exec } from 'child_process';

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

/**
 * Uses Windows UI Automation via PowerShell to locate the currently selected TabItem
 * in the active browser window and return its exact screen coordinates.
 */
export function getActiveTabCoordinates(hwnd: number): Promise<{ left: number; top: number; width: number; height: number } | null> {
  return new Promise((resolve) => {
    const script = `
      Add-Type -AssemblyName UIAutomationClient
      Add-Type -AssemblyName UIAutomationTypes
      try {
        $root = [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]${hwnd})
        $condition = New-Object System.Windows.Automation.PropertyCondition(
            [System.Windows.Automation.AutomationElement]::ControlTypeProperty, 
            [System.Windows.Automation.ControlType]::TabItem
        )
        $tabs = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition)
        foreach ($tab in $tabs) {
            try {
                $selectionPattern = $tab.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern)
                if ($selectionPattern.Current.IsSelected) {
                    $rect = $tab.GetCurrentPropertyValue([System.Windows.Automation.AutomationElement]::BoundingRectangleProperty)
                    Write-Output "{\`\"left\`\":$($rect.Left),\`\"top\`\":$($rect.Top),\`\"width\`\":$($rect.Width),\`\"height\`\":$($rect.Height)}"
                    exit
                }
            } catch {}
        }
      } catch {}
    `;

    const buffer = Buffer.from(script, 'utf16le');
    const base64 = buffer.toString('base64');
    const command = `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${base64}`;

    exec(command, (error, stdout) => {
      if (error) {
        resolve(null);
        return;
      }
      try {
        const trimmed = stdout.trim();
        if (trimmed) {
          const jsonMatch = trimmed.match(/\{"left":.*\}/);
          if (jsonMatch) {
            const coords = JSON.parse(jsonMatch[0]);
            resolve(coords);
            return;
          }
        }
        resolve(null);
      } catch (err) {
        resolve(null);
      }
    });
  });
}
