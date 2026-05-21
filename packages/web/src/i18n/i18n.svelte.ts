import itMessages from './it.json';
import { isLocalizedError } from '../lib/core/errors.js';

export type Locale = 'it' | 'en';
export type MessageKey = keyof typeof itMessages & string;

type Messages = Record<MessageKey, string>;
type MessageLoader = (locale: Locale) => Promise<Messages>;

const STORAGE_KEY = 'cup-check:language';
const FALLBACK_LOCALE: Locale = 'it';
const fallbackMessages: Messages = itMessages;

const initial = initialLocale();
let locale = $state<Locale>(FALLBACK_LOCALE);
let messages = $state<Messages>(fallbackMessages);
let loadingLocale = $state<Locale | null>(null);
let messageLoader: MessageLoader = loadMessages;

void setLocale(initial);

export const languageOptions: Array<{ code: Locale; labelKey: MessageKey }> = [
  { code: 'it', labelKey: 'language.it' },
  { code: 'en', labelKey: 'language.en' },
];

export const i18n = {
  get locale() {
    return locale;
  },
  get messages() {
    return messages;
  },
  get loadingLocale() {
    return loadingLocale;
  },
  t,
  errorMessage,
  setLocale,
};

export function t(key: MessageKey, values: Record<string, string | number> = {}): string {
  const template = messages[key] ?? fallbackMessages[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => String(values[name] ?? ''));
}

export function errorMessage(error: unknown): string {
  if (isLocalizedError(error)) return t(error.key, error.values);
  if (error instanceof Error) return error.message;
  return t('error.unknown');
}

export async function setLocale(nextLocale: Locale): Promise<void> {
  if (!isLocale(nextLocale)) return;
  loadingLocale = nextLocale;
  try {
    const nextMessages = await messageLoader(nextLocale);
    if (loadingLocale === nextLocale) {
      messages = nextMessages;
      locale = nextLocale;
      persistLocale(nextLocale);
      if (typeof document !== 'undefined') {
        document.documentElement.lang = nextLocale;
        window.dispatchEvent(new CustomEvent('cup-check:languagechange', { detail: { locale: nextLocale } }));
      }
    }
  } finally {
    if (loadingLocale === nextLocale) loadingLocale = null;
  }
}

function initialLocale(): Locale {
  if (typeof localStorage === 'undefined') return FALLBACK_LOCALE;
  let stored: string | null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    return FALLBACK_LOCALE;
  }
  return isLocale(stored) ? stored : FALLBACK_LOCALE;
}

function persistLocale(nextLocale: Locale): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, nextLocale);
  } catch {
    // La persistenza lingua è best-effort: Safari private mode può bloccare localStorage.
  }
}

function isLocale(value: unknown): value is Locale {
  return value === 'it' || value === 'en';
}

export function isMessageKey(value: unknown): value is MessageKey {
  return typeof value === 'string' && value in fallbackMessages;
}

async function loadMessages(nextLocale: Locale): Promise<Messages> {
  if (nextLocale === 'it') return fallbackMessages;
  const module = await import('./en.json');
  return module.default as Messages;
}

export function setMessageLoaderForTest(loader: MessageLoader): () => void {
  messageLoader = loader;
  return () => {
    messageLoader = loadMessages;
  };
}
