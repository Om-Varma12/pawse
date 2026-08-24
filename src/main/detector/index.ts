import { getActiveWindow } from './activeWindowSource';
import { matchActiveWindow } from './ruleEngine';
import { recordOffense, checkHappyReinforcement } from '../emotion/emotionEngine';
import { triggerDistractionApproach, sendCatState } from '../catWindow';

let detectorInterval: NodeJS.Timeout | null = null;
let isProcessingMatch = false;

/**
 * Starts the foreground window polling detector loop.
 */
export function startDetectorLoop(): void {
  if (detectorInterval) clearInterval(detectorInterval);

  detectorInterval = setInterval(async () => {
    // If the cat is already in the middle of closing a window or animating, skip tick
    if (isProcessingMatch) return;

    const activeWin = await getActiveWindow();
    if (!activeWin) return;

    const matchedRule = matchActiveWindow(activeWin);
    if (matchedRule) {
      isProcessingMatch = true;
      try {
        // Record offense and escalate anger level
        const emotion = recordOffense(matchedRule.id);

        // Inject HWND id for closure action
        const ruleWithHwnd = {
          ...matchedRule,
          hwnd: activeWin.id
        };

        // Run the distraction sequence (notice, walk, swat, close, react)
        await triggerDistractionApproach(ruleWithHwnd, activeWin.bounds, emotion);
      } catch (err) {
        console.error('Error during detector match handling:', err);
      } finally {
        isProcessingMatch = false;
      }
    } else {
      // Periodically check if we qualify for happy reinforcement
      const happyReaction = checkHappyReinforcement();
      if (happyReaction) {
        isProcessingMatch = true;
        sendCatState('happy', { phrase: happyReaction.phrase });
        setTimeout(() => {
          sendCatState('idle');
          isProcessingMatch = false;
        }, 3000);
      }
    }
  }, 1000);
}

/**
 * Stops the detector loop.
 */
export function stopDetectorLoop(): void {
  if (detectorInterval) {
    clearInterval(detectorInterval);
    detectorInterval = null;
  }
}
