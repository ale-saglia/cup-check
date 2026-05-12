export function initDialogs(dom) {
  dom.openLimitsDescButton.addEventListener('click', () => {
    dom.limitsDialog.showModal();
  });

  dom.limitsDialog.addEventListener('click', (event) => {
    if (event.target === dom.limitsDialog) {
      dom.limitsDialog.close();
    }
  });

  dom.detailDialog.addEventListener('click', (event) => {
    if (event.target === dom.detailDialog) {
      dom.detailDialog.close();
    }
  });
}

export function showDetailDialog(dom, text) {
  dom.detailDialogText.textContent = text;
  dom.detailDialog.showModal();
}
