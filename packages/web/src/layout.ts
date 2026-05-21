import { tools } from './tools-registry.js';
import { PRODUCT_VERSION } from './version.js';
import { i18n, isMessageKey } from './i18n/i18n.svelte.js';

function esc(str: unknown): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function translateDynamicKey(key: string): string {
  return isMessageKey(key) ? i18n.t(key) : key;
}

function buildMenuItems(): string {
  return tools
    .filter((tool) => tool.enabled)
    .map(
      (tool) =>
        `<li role="none"><a class="nav-menu-item" role="menuitem" href="${esc(tool.path)}">${esc(tool.labelKey ? i18n.t(tool.labelKey) : (tool.label ?? ''))}</a></li>`,
    )
    .join('');
}

export function refreshLayoutTranslations(root: Element): void {
  const siteNav = root.querySelector('.site-nav');
  if (siteNav) siteNav.setAttribute('aria-label', i18n.t('app.mainNav'));
  root.querySelectorAll('[data-i18n]').forEach((element) => {
    const key = (element as HTMLElement).dataset['i18n'];
    if (key) (element as HTMLElement).textContent = translateDynamicKey(key);
  });
  root.querySelectorAll('[data-i18n-aria-label]').forEach((element) => {
    const key = (element as HTMLElement).dataset['i18nAriaLabel'];
    if (key) element.setAttribute('aria-label', translateDynamicKey(key));
  });
  const menuList = root.querySelector<HTMLElement>('.nav-menu-list');
  if (menuList) menuList.innerHTML = buildMenuItems();
}

export function mountLayout(root: Element = document.querySelector('#app')!): Element | null {
  root.innerHTML = `
    <div class="app-shell">
      <a class="skip-link" href="#main-content">${i18n.t('app.skipToContent')}</a>
      <nav class="site-nav" aria-label="${i18n.t('app.mainNav')}">
        <div class="nav-inner">
          <div class="nav-left">
            <a class="brand" data-i18n="app.brand" href="#/">${i18n.t('app.brand')}</a>
            <details class="nav-menu">
              <summary class="nav-menu-toggle" data-i18n="app.tools" aria-haspopup="menu">${i18n.t('app.tools')}</summary>
              <ul class="nav-menu-list" role="menu">
                ${buildMenuItems()}
              </ul>
            </details>
          </div>
          <div class="nav-links">
            <a class="project-link" href="https://github.com/ale-saglia/cup-check/releases/tag/v${PRODUCT_VERSION}" target="_blank" rel="noopener noreferrer">cup-check ${PRODUCT_VERSION}</a>
            <span id="dataset-status-bar" class="dataset-status-bar" role="status" aria-live="polite"></span>
          </div>
        </div>
      </nav>
      <main id="main-content" class="view-slot shell" data-i18n-aria-label="app.mainArea" aria-label="${i18n.t('app.mainArea')}" tabindex="-1"></main>
      <footer class="site-footer">
        <span><span data-i18n="app.footerAuthorPrefix">${i18n.t('app.footerAuthorPrefix')}</span> <a href="https://ale-saglia.com" rel="noreferrer">Alessandro Saglia</a></span>
        <span><span id="language-switcher-slot"></span> · <a href="https://opencup.gov.it" target="_blank" rel="noopener noreferrer">OpenCUP</a> · <a href="https://github.com/ale-saglia/cup-check" target="_blank" rel="noopener noreferrer" data-i18n="app.sourceAndLicense">${i18n.t('app.sourceAndLicense')}</a></span>
      </footer>
    </div>
  `;

  const menu = root.querySelector('.nav-menu') as HTMLDetailsElement;
  const menuList = root.querySelector('.nav-menu-list') as HTMLElement;
  const menuToggle = root.querySelector('.nav-menu-toggle') as HTMLElement;

  document.addEventListener('click', (e) => {
    if (menu.open && !menu.contains(e.target as Node)) {
      menu.open = false;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.open) {
      menu.open = false;
      menuToggle.focus();
    }
  });

  window.addEventListener('cup-check:languagechange', () => refreshLayoutTranslations(root));

  menuList.addEventListener('click', () => {
    menu.open = false;
  });

  menuList.addEventListener('keydown', (e) => {
    const items = [
      ...menuList.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])'),
    ];
    const idx = items.indexOf(document.activeElement as HTMLElement);
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
