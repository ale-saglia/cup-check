export function csvCell(value: string, delimiter = ';'): string {
  const text = protectCsvFormula(value);
  const wasProtected = text !== value;

  if (wasProtected || text.includes(delimiter) || /["\n\r]/.test(text)) {
    return '"' + text.replaceAll('"', '""') + '"';
  }

  return text;
}

export function protectCsvFormula(text: string): string {
  if (/^[-=+@]/.test(text)) {
    // A leading apostrophe prevents formula execution in Excel/Sheets and is ignored as a text prefix;
    // quoting protected cells keeps CSV parsers from treating the apostrophe inconsistently.
    return "'" + text;
  }

  return text;
}
