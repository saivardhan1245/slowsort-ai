export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return isoString;
  }
}

export function formatRelativeTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const now = Date.now();
    const diffSec = Math.floor((now - d.getTime()) / 1000);

    if (diffSec < 15) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(isoString);
  } catch {
    return isoString;
  }
}

export type FileCategoryKey =
  | 'Documents'
  | 'Finance'
  | 'Legal'
  | 'Career'
  | 'Images'
  | 'Spreadsheets'
  | 'Presentations'
  | 'Audio'
  | 'Video'
  | 'Archives'
  | 'Code'
  | 'Other';

export function getFileCategoryTheme(category: string): {
  color: string;
  bg: string;
  border: string;
} {
  const cat = category.toLowerCase();
  if (cat.includes('finance') || cat.includes('receipt') || cat.includes('invoice')) {
    return { color: '#a3e635', bg: 'rgba(163, 230, 53, 0.08)', border: 'rgba(163, 230, 53, 0.25)' };
  }
  if (cat.includes('legal') || cat.includes('contract')) {
    return { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.08)', border: 'rgba(251, 191, 36, 0.25)' };
  }
  if (cat.includes('career') || cat.includes('resume')) {
    return { color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.08)', border: 'rgba(56, 189, 248, 0.25)' };
  }
  if (cat.includes('image') || cat.includes('photo') || cat.includes('screenshot')) {
    return { color: '#c084fc', bg: 'rgba(192, 132, 252, 0.08)', border: 'rgba(192, 132, 252, 0.25)' };
  }
  if (cat.includes('spreadsheet') || cat.includes('data')) {
    return { color: '#34d399', bg: 'rgba(52, 211, 153, 0.08)', border: 'rgba(52, 211, 153, 0.25)' };
  }
  if (cat.includes('code') || cat.includes('dev')) {
    return { color: '#f472b6', bg: 'rgba(244, 114, 182, 0.08)', border: 'rgba(244, 114, 182, 0.25)' };
  }
  if (cat.includes('archive') || cat.includes('zip')) {
    return { color: '#fb923c', bg: 'rgba(251, 146, 60, 0.08)', border: 'rgba(251, 146, 60, 0.25)' };
  }
  if (cat.includes('audio') || cat.includes('video')) {
    return { color: '#e879f9', bg: 'rgba(232, 121, 249, 0.08)', border: 'rgba(232, 121, 249, 0.25)' };
  }
  return { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.08)', border: 'rgba(148, 163, 184, 0.2)' };
}
