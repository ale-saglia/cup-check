// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ProgressBar from '../src/components/ProgressBar.svelte';

describe('ProgressBar', () => {
  afterEach(() => cleanup());

  it('arrotonda la percentuale mostrata', () => {
    const { container } = render(ProgressBar, { props: { label: 'Validazione', percent: 42.4 } });

    expect(container.querySelector('strong')?.textContent).toBe('42%');
    expect(container.querySelector('progress')?.getAttribute('value')).toBe('42');
  });
});
