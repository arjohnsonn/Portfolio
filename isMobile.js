export function isMobile() {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;

  // Android
  if (/android/i.test(userAgent)) return true;

  // iOS
  if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) return true;

  // Other mobile devices
  if (/mobile/i.test(userAgent)) return true;

  // Small screen
  if (window.innerWidth < 800) return true;

  return false;
}
