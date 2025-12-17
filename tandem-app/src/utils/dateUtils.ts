import { format, addHours, endOfDay, isPast } from 'date-fns';

export const getExpiryPresets = () => {
  const now = new Date();
  return {
    '1h': addHours(now, 1),
    '2h': addHours(now, 2),
    '4h': addHours(now, 4),
    'eod': endOfDay(now),
  };
};

// Format a Date for use in <input type="datetime-local"> (always local time)
export const toLocalDateTimeInputValue = (date: Date): string => {
  return format(date, "yyyy-MM-dd'T'HH:mm");
};

export const formatDateTime = (date: string | Date): string => {
  return format(new Date(date), 'MMM dd, yyyy h:mm a');
};

export const formatTime = (date: string | Date): string => {
  return format(new Date(date), 'h:mm a');
};

export const formatDate = (date: string | Date): string => {
  return format(new Date(date), 'MMM dd, yyyy');
};

export const isExpired = (date: string | Date): boolean => {
  return isPast(new Date(date));
};

export const getTimeUntilExpiry = (
  expiryDate: string | Date,
  from: Date = new Date()
): string => {
  const now = from;
  const expiry = new Date(expiryDate);
  const diff = expiry.getTime() - now.getTime();

  if (diff <= 0) return 'Expired';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

export const formatRelativeTime = (date: string | Date): string => {
  const now = new Date();
  const target = new Date(date);
  const diff = now.getTime() - target.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  }
  return 'just now';
};
