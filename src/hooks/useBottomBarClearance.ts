import { useEffect, type RefObject } from "react";

// Publishes the height of a page's sticky bottom action bar as a CSS variable, so fixed-position
// chrome (the Manufacturing Coach orb) can sit above it instead of on top of it.
//
// Measured rather than hard-coded because FormEntry's bar wraps: on a tablet in portrait, Back,
// Save Draft, Submit and Download PDF do not fit on one line and the bar doubles in height. A fixed
// offset that cleared one row covered Submit on two.
export const BOTTOM_BAR_VAR = "--tp-bottom-bar-h";

export function useBottomBarClearance(ref: RefObject<HTMLElement>, active: boolean): void {
  useEffect(() => {
    const el = ref.current;
    const root = document.documentElement;
    if (!active || !el || typeof ResizeObserver === "undefined") return;
    const publish = () => root.style.setProperty(BOTTOM_BAR_VAR, `${Math.ceil(el.getBoundingClientRect().height)}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty(BOTTOM_BAR_VAR);
    };
  }, [ref, active]);
}
