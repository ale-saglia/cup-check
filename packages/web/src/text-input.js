export function textInputLines(value) {
  const lines = value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines[0]?.toLowerCase() === 'cup') {
    return lines.slice(1);
  }

  return lines;
}
