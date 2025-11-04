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

export const getTimeUntilExpiry = (expiryDate: string | Date): string => {
  const now = new Date();
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
