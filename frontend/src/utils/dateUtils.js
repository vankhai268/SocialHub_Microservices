/**
 * Utility function to format raw timestamp into human-readable relative time (Vietnamese)
 * Example outputs:
 * - "Vừa xong"
 * - "2 phút trước"
 * - "3 giờ trước"
 * - "Hôm qua lúc 14:22"
 * - "23 Thg 7 lúc 14:22"
 * - "23/07/2025 lúc 14:22"
 */
export const formatRelativeTime = (dateInput) => {
  if (!dateInput) return "";

  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return String(dateInput);

  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  // Future dates or less than 10s
  if (diffInSeconds < 10) {
    return "Vừa xong";
  }

  // Under 60 seconds
  if (diffInSeconds < 60) {
    return `${diffInSeconds} giây trước`;
  }

  // Under 60 minutes
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} phút trước`;
  }

  // Under 24 hours
  const diffInHours = Math.floor(diffInMinutes / 60);
  
  // Helper for 2-digit pad
  const pad = (num) => String(num).padStart(2, "0");
  const timeStr = `${pad(date.getHours())}:${pad(date.getMinutes())}`;

  // Same day
  const isSameDay = 
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isSameDay) {
    return `${diffInHours} giờ trước`;
  }

  // Yesterday
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = 
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return `Hôm qua lúc ${timeStr}`;
  }

  // Same year
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getDate()} Thg ${date.getMonth() + 1} lúc ${timeStr}`;
  }

  // Different year
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} lúc ${timeStr}`;
};
