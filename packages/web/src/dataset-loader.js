const WORKER_URL = import.meta.env.VITE_LOOKUP_WORKER_URL;

export const hasDataset = Boolean(WORKER_URL);

export async function lookupMany(cups) {
  const response = await fetch(`${WORKER_URL}/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cups }),
  });
  if (!response.ok) throw new Error(`lookup: HTTP ${response.status}`);
  return response.json();
}
