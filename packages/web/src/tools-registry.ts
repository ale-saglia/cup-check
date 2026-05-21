import type { MessageKey } from './i18n/i18n.svelte.js';

export interface Tool {
  id: string;
  labelKey?: MessageKey;
  label?: string;
  path: string | null;
  enabled: boolean;
  descriptionKey?: MessageKey;
}

export const tools: Tool[] = [
  {
    id: 'pdf-extract',
    labelKey: 'tool.pdfExtract.label',
    path: '#/pdf-extract',
    enabled: true,
    descriptionKey: 'tool.pdfExtract.description',
  },
  {
    id: 'xml-extract',
    labelKey: 'tool.xmlExtract.label',
    path: '#/xml-extract',
    enabled: true,
    descriptionKey: 'tool.xmlExtract.description',
  },
  {
    id: 'placeholder',
    labelKey: 'tool.placeholder.label',
    path: null,
    enabled: false,
  },
];
