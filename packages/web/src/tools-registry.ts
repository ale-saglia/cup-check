export interface Tool {
  id: string;
  labelKey?: string;
  label?: string;
  path: string | null;
  enabled: boolean;
  descriptionKey: string;
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
    id: 'placeholder',
    labelKey: 'tool.placeholder.label',
    path: null,
    enabled: false,
    descriptionKey: '',
  },
];
