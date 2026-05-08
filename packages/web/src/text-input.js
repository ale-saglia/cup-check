export function textInputLines(value) {
  const lines = value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines[0] === 'CUP') {
    return lines.slice(1);
  }

  return lines;
}
