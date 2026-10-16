// Applies the theme and language picked with the header switches before the first paint, so the
// page never flashes the wrong colours or language. No saved theme: the CSS follows the system.
// No saved language: German for German browsers, English otherwise.
try {
  const theme = localStorage.getItem('onxt-theme');
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
} catch { /* storage blocked: follow the system */ }
try {
  const saved = localStorage.getItem('onxt-lang');
  document.documentElement.lang = saved === 'de' || saved === 'en' ? saved
    : (navigator.languages || [navigator.language || 'en']).some(l => /^de\b/i.test(l)) ? 'de' : 'en';
} catch {
  document.documentElement.lang = /^de\b/i.test(navigator.language || '') ? 'de' : 'en';
}
