import { tools } from './tools-registry.js';
import { PRODUCT_VERSION } from './version.js';

function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildMenuItems() {
  return tools
    .filter((tool) => tool.enabled)
    .map((tool) => `<li role="none"><a class="nav-menu-item" role="menuitem" href="${esc(tool.path)}">${esc(tool.label)}</a></li>`)
    .join('');
}

export function mountLayout(root = document.querySelector('#app')) {
  root.innerHTML = `
    <div class="app-shell">
      <nav class="site-nav" aria-label="Navigazione principale">
        <div class="nav-inner">
          <div class="nav-left">
            <a class="brand" href="#/">Verifica CUP</a>
            <details class="nav-menu">
              <summary class="nav-menu-toggle" aria-haspopup="menu">Strumenti</summary>
              <ul class="nav-menu-list" role="menu">
                ${buildMenuItems()}
              </ul>
            </details>
          </div>
          <div class="nav-links">
            <a class="project-link" href="https://github.com/ale-saglia/cup-check" target="_blank" rel="noreferrer">cup-check ${PRODUCT_VERSION}</a>
            <span id="dataset-status-bar" class="dataset-status-bar" role="status" aria-live="polite"></span>
          </div>
        </div>
      </nav>
      <main class="view-slot shell" aria-label="Area principale"></main>
      <footer class="site-footer">
        <span>Sviluppato da <a href="https://ale-saglia.com" rel="noreferrer">Alessandro Saglia</a></span>
        <span><a href="https://opencup.gov.it" target="_blank" rel="noreferrer">OpenCUP</a> · <a href="https://github.com/ale-saglia/cup-check" target="_blank" rel="noreferrer">Codice sorgente e licenza</a></span>
      </footer>
    </div>
  `;

  const menu = root.querySelector('.nav-menu');
  const menuList = root.querySelector('.nav-menu-list');
  const menuToggle = root.querySelector('.nav-menu-toggle');

  document.addEventListener('click', (e) => {
    if (menu.open && !menu.contains(e.target)) {
      menu.open = false;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.open) {
      menu.open = false;
      menuToggle.focus();
    }
  });

  menuList.addEventListener('click', () => {
    menu.open = false;
  });

  menuList.addEventListener('keydown', (e) => {
    const items = [...menuList.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])')];
    const idx = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(idx + 1) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length]?.focus();
    }
  });

  return root.querySelector('.view-slot');
}
