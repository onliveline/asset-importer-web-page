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

// If the app fails while starting (e.g. a browser still holding files from an older release),
// say so instead of leaving a blank page. Once the sign-in card or the library shows, this stays quiet.
function showStartupProblem() {
  const gate = document.getElementById('gate'), app = document.getElementById('app'), box = document.getElementById('fatal');
  if (!box || (gate && !gate.hidden) || (app && !app.hidden)) return;
  box.textContent = document.documentElement.lang === 'de'
    ? 'Die Seite konnte nicht gestartet werden. Bitte mit Strg+F5 (Mac: Cmd+Shift+R) neu laden.'
    : 'The page could not start. Please reload with Ctrl+F5 (Mac: Cmd+Shift+R).';
  box.hidden = false;
}
addEventListener('error', showStartupProblem);
addEventListener('unhandledrejection', showStartupProblem);
