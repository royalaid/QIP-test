/**
 * Debug configuration
 * Controls visibility of development tools in the UI
 */

// Check if we're in development mode
export const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

// Check if debug mode is explicitly enabled via localStorage
export const isDebugEnabled = () => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('DEBUG_CACHE') === 'true' ||
         localStorage.getItem('DEBUG_MODE') === 'true';
};

// Should show development tools (refresh button, timestamps, etc)
export const showDevTools = isDevelopment || isDebugEnabled();

// Should show cache debug indicator
export const showCacheDebug = isDevelopment || isDebugEnabled();

// Export for components to use
export const debugConfig = {
  isDevelopment,
  isDebugEnabled,
  showDevTools,
  showCacheDebug,
};