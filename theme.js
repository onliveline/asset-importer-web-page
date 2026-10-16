// Applies the theme picked with the header switch before the first paint, so the page never
// flashes the wrong colours. No saved choice: the CSS follows the system setting.
try {
  const theme = localStorage.getItem('onxt-theme');
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
} catch { /* storage blocked: follow the system */ }
