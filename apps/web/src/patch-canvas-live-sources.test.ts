import { describe, expect, it } from 'vitest';
import { initialisePatchCanvasSources, PATCH_CANVAS_SOURCE_ACTIONS } from './patch-canvas-live-sources';

describe('Patch Canvas live source initialisation', () => {
  it('activates M03 then re-queries and activates M09', () => {
    const queries: string[] = [];
    const clicks: string[] = [];
    const root = {
      querySelector<T>(selector: string): T | null {
        queries.push(selector);
        return { click: () => clicks.push(selector) } as T;
      },
    };

    expect(initialisePatchCanvasSources(root)).toBe(2);
    expect(queries).toEqual([...PATCH_CANVAS_SOURCE_ACTIONS]);
    expect(clicks).toEqual([...PATCH_CANVAS_SOURCE_ACTIONS]);
  });

  it('does not fail when a source action is absent', () => {
    const root = {
      querySelector<T>(selector: string): T | null {
        if (selector === PATCH_CANVAS_SOURCE_ACTIONS[0]) return { click: () => undefined } as T;
        return null;
      },
    };

    expect(initialisePatchCanvasSources(root)).toBe(1);
  });
});
