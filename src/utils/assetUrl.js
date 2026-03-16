const BASE = import.meta.env.BASE_URL || '/';

export function assetUrl(path) {
  if (!path) return '';
  // Already absolute URL (http/https)
  if (path.startsWith('http')) return path;
  // Strip leading slash if present
  const clean = path.startsWith('/') ? path.slice(1) : path;
  return `${BASE}${clean}`;
}
