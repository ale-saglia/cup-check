// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { mountApp } from '../src/dom.js';
import { OUTCOMES } from '../src/lib/core/validator.js';
import { PRODUCT_VERSION } from '../src/version.js';

describe('mountApp', () => {
  it('mounts the browser app and returns the interactive elements', () => {
    const root = document.createElement('div');
    const dom = mountApp(root);

    expect(root.querySelector('.brand')?.textContent).toBe('Verifica CUP');
    expect(root.querySelector('.project-link')?.textContent).toBe(`cup-check ${PRODUCT_VERSION}`);
    expect(dom.datasetStatusBar.id).toBe('dataset-status-bar');
    expect(dom.fileInput.id).toBe('file-input');
    expect(dom.cupTextarea.id).toBe('cup-textarea');
    expect(dom.resultsTable.id).toBe('results-table');
    expect(dom.limitsDialog.id).toBe('limits-dialog');
    expect([...dom.filterSelect.options].map((option) => option.value)).toEqual([
      'ALL',
      OUTCOMES.FOUND_OPENCUP,
      OUTCOMES.NOT_FOUND_OPENCUP,
      OUTCOMES.CHECK,
      OUTCOMES.INVALID,
    ]);
  });

  it('uses #app as the default root', () => {
    document.body.innerHTML = '<main id="app"></main>';

    const dom = mountApp();

    expect(dom.filePanel.id).toBe('file');
    expect(document.querySelector('#app .app-shell')).not.toBeNull();
  });
});
