export type TouchAction = "gas" | "reverse" | "left" | "right";

// Each touch control drives the same synthetic key as its keyboard counterpart
// so the shared `readVehicleInput` set works for both input methods. "reverse"
// maps to the S key (reverse throttle), matching the keyboard mapping.
export const TOUCH_ACTION_KEY: Record<TouchAction, string> = {
  gas: "w",
  reverse: "s",
  left: "a",
  right: "d",
};

export function applyTouchAction(keys: Set<string>, action: TouchAction, pressed: boolean): void {
  const key = TOUCH_ACTION_KEY[action];
  if (pressed) keys.add(key);
  else keys.delete(key);
}

export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return "ontouchstart" in window || navigator.maxTouchPoints > 0 || window.matchMedia?.("(pointer: coarse)").matches === true;
}

export function createTouchControls(root: HTMLElement, onInput: (key: string, pressed: boolean) => void): { dispose(): void } {
  const overlay = document.createElement("div");
  overlay.id = "touch-controls";
  overlay.setAttribute("aria-label", "Controlli touch");
  // The container ignores pointer events so only the buttons are interactive;
  // it sits above the status/hint bars and clears the safe-area inset.
  overlay.style.cssText = "position:fixed;left:0;right:0;bottom:92px;display:flex;justify-content:space-between;align-items:flex-end;padding:0 18px;z-index:2;pointer-events:none;";
  const button = (action: TouchAction, label: string, glyph: string, color: string) => {
    const el = document.createElement("button");
    el.type = "button";
    el.textContent = glyph;
    el.setAttribute("aria-label", label);
    el.dataset.touchAction = action;
    el.style.cssText = "pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;width:84px;height:84px;border-radius:50%;border:2px solid #ffffff99;background:" + color + ";color:#fff;font-size:30px;line-height:1;display:flex;align-items:center;justify-content:center;opacity:0.85;transition:opacity 80ms,transform 80ms";
    let pressed = false;
    const set = (value: boolean) => {
      if (pressed === value) return;
      pressed = value;
      applyTouchActionToCallback(onInput, action, value);
      el.style.opacity = value ? "1" : "0.85";
      el.style.transform = value ? "scale(0.94)" : "scale(1)";
    };
    el.addEventListener("pointerdown", (event) => { event.preventDefault(); set(true); });
    el.addEventListener("pointerup", () => set(false));
    el.addEventListener("pointercancel", () => set(false));
    return el;
  };
  const leftCluster = document.createElement("div");
  leftCluster.style.cssText = "display:flex;flex-direction:column;gap:12px;align-items:center;pointer-events:none;";
  leftCluster.append(button("gas", "Accelerazione", "\u25B2", "#1f9d55"), button("reverse", "Indietro", "\u25BC", "#b3323a"));
  const rightCluster = document.createElement("div");
  rightCluster.style.cssText = "display:flex;flex-direction:row;gap:12px;align-items:flex-end;pointer-events:none;";
  rightCluster.append(button("left", "Sterza sinistra", "\u25C0", "#1f6f8b"), button("right", "Sterza destra", "\u25B6", "#1f6f8b"));
  overlay.append(leftCluster, rightCluster);
  root.append(overlay);
  return {
    dispose() { overlay.remove(); },
  };
}

function applyTouchActionToCallback(onInput: (key: string, pressed: boolean) => void, action: TouchAction, pressed: boolean): void {
  onInput(TOUCH_ACTION_KEY[action], pressed);
}
