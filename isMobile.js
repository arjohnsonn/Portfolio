export function isMobile() {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;

  // Check for Android
  if (/android/i.test(userAgent)) {
    return true;
  }

  // Check for iOS
  if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
    return true;
  }

  // Check for other mobile devices
  if (/mobile/i.test(userAgent)) {
    return true;
  }

  return false;
}
