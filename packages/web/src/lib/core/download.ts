export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 0);
}
