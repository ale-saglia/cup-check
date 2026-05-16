// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initDialogs, showDetailDialog } from '../src/dialogs.js';

function dialogDom() {
  return {
    openLimitsDescButton: document.createElement('button'),
    limitsDialog: document.createElement('dialog'),
    detailDialog: document.createElement('dialog'),
    detailDialogText: document.createElement('p'),
  };
}

describe('dialogs', () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn();
  });

  it('opens and closes the limits dialog', () => {
    const dom = dialogDom();
    initDialogs(dom);

    dom.openLimitsDescButton.click();
    dom.limitsDialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(dom.limitsDialog.showModal).toHaveBeenCalledTimes(1);
    expect(dom.limitsDialog.close).toHaveBeenCalledTimes(1);
  });

  it('does not close the limits dialog when clicking inside it', () => {
    const dom = dialogDom();
    const child = document.createElement('span');
    dom.limitsDialog.append(child);
    initDialogs(dom);

    child.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(dom.limitsDialog.close).not.toHaveBeenCalled();
  });

  it('closes the detail dialog only when clicking the backdrop', () => {
    const dom = dialogDom();
    const child = document.createElement('span');
    dom.detailDialog.append(child);
    initDialogs(dom);

    child.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    dom.detailDialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(dom.detailDialog.close).toHaveBeenCalledTimes(1);
  });

  it('shows a detail message', () => {
    const dom = dialogDom();

    showDetailDialog(dom, 'Righe originali: 1, 2');

    expect(dom.detailDialogText.textContent).toBe('Righe originali: 1, 2');
    expect(dom.detailDialog.showModal).toHaveBeenCalledTimes(1);
  });
});
