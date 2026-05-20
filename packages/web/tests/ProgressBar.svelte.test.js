// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ProgressBar from '../src/components/ProgressBar.svelte';

describe('ProgressBar', () => {
  afterEach(() => cleanup());

  it('arrotonda la percentuale mostrata', () => {
    const { container, rerender } = render(ProgressBar, {
      props: { label: 'Validazione', percent: 42.4 },
    });

    expect(container.querySelector('strong')?.textContent).toBe('42%');
    expect(container.querySelector('progress')?.getAttribute('value')).toBe('42');

    rerender({ label: 'Lookup', percent: 99.6 });
    expect(container.querySelector('.progress-block')?.getAttribute('aria-label')).toBe('Lookup');
    expect(container.querySelector('strong')?.textContent).toBe('100%');
    expect(container.querySelector('progress')?.textContent).toBe('100%');

    rerender({ label: '', percent: 0 });
    expect(container.querySelector('.progress-block')?.getAttribute('aria-label')).toBe('');
    expect(container.querySelector('strong')?.textContent).toBe('0%');
  });
});
