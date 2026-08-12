export const PATCH_CANVAS_SOURCE_ACTIONS = [
  '[data-full-voice-publish-source]',
  '[data-m09-publish-source]',
] as const;

type SourceAction = { click(): void };
type SourceActionRoot = { querySelector<T>(selector: string): T | null };

/**
 * Patch Canvas models a powered modular rack. Source modules therefore expose
 * their current output state as soon as the rack mounts. Audio playback itself
 * remains separately user-started by the browser-audio control.
 *
 * Query again before each click because each accepted source action re-renders
 * the rack and replaces its DOM nodes.
 */
export function initialisePatchCanvasSources(root: SourceActionRoot): number {
  let activated = 0;
  for (const selector of PATCH_CANVAS_SOURCE_ACTIONS) {
    const action = root.querySelector<SourceAction>(selector);
    if (!action) continue;
    action.click();
    activated += 1;
  }
  return activated;
}
