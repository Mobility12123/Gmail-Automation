import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, format } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  return format(new Date(date), 'MMM dd, yyyy HH:mm');
}

export function formatRelativeTime(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function getStatusColor(status: string) {
  const colors: Record<string, string> = {
    ACCEPTED: 'badge-success',
    PENDING: 'badge-warning',
    PROCESSING: 'badge-info',
    FAILED: 'badge-error',
    SKIPPED: 'badge-secondary',
    DUPLICATE: 'badge-secondary',
  };
  return colors[status] || 'badge-secondary';
}

export function truncate(text: string, length: number = 100) {
  if (text.length <= length) return text;
  return text.substring(0, length) + '...';
}

export function formatNumber(num: number) {
  return new Intl.NumberFormat().format(num);
}
