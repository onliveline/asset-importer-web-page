// English and German interface text. The language comes from the header switch (remembered on this
// device) or, until one is picked, from the browser; theme.js sets <html lang> before the first paint.
// Catalog data (model names, tags, repository paths) is never translated.

const TEXT = {
  en: {
    'page.title': 'onXT Asset Library',
    'gate.lead': 'For members of the onliveline GitHub organization.',
    'gate.github': 'Sign in with GitHub',
    'gate.or': 'or use a personal access token',
    'gate.tokenLabel': 'GitHub personal access token',
    'gate.remember': 'Remember on this device',
    'gate.open': 'Open library with token',
    'gate.howto': 'How to create the token',
    'gate.step1': 'Open <a id="pat-link" target="_blank" rel="noopener noreferrer">GitHub → Fine-grained tokens → Generate new token</a>.',
    'gate.step2': 'Resource owner: <b id="pat-owner"></b>. Expiration: 90 days or less.',
    'gate.step3': 'Repository access: <b>All repositories</b> (models are read from the repositories they live in).',
    'gate.step4': 'Permissions → Repository → <b>Contents: Read-only</b> (Read and write to edit names and tags).',
    'gate.step5': 'Generate, copy, paste above. If the organization requires approval, wait for an admin to approve it.',
    'top.signout': 'Sign out',
    'theme.dark': 'Dark', 'theme.light': 'Light', 'theme.toDark': 'Switch to dark mode', 'theme.toLight': 'Switch to light mode',
    'lang.group': 'Language',
    'search.placeholder': 'Search name or tag', 'search.aria': 'Search assets',
    'chip.all': 'All', 'chip.animated': 'Animated', 'chips.aria': 'Filter',
    'facet.domain': 'Domain', 'facet.project': 'Client or project', 'facet.type': 'Type',
    'facet.allDomains': 'All domains', 'facet.allProjects': 'All projects', 'facet.allTypes': 'All types',
    'facet.untagged': 'Not tagged yet', 'facet.allOf': 'All {name}',
    'facet.tagPlaceholder': 'Add a tag filter…', 'facet.tagAria': 'Filter by tag',
    'filter.remove': 'Remove filter {tag}', 'filter.removeAria': 'Remove tag filter {tag}', 'filter.clear': 'Clear all filters',
    'list.aria': 'Assets', 'list.empty': 'No assets match.',
    'list.recent': 'Recently added ({n})', 'list.all': 'All models', 'list.more': 'Show more ({n} left)',
    'list.selectFor': 'Select for download', 'list.selectAria': 'Select {name}',
    'badge.animated': 'Animated', 'badge.new': 'New',
    'bulk.selectAll': 'Select all', 'bulk.clear': 'Clear',
    'bulk.download': 'Download selected', 'bulk.downloadN': 'Download selected ({n})',
    'bulk.progress': 'Downloading {i}/{n}: {name} {p}%', 'bulk.packing': 'Packing zip…',
    'bulk.done': 'Downloaded {n} assets.', 'bulk.doneOne': 'Downloaded 1 asset.', 'bulk.failed': 'Download failed: {error}',
    'stage.placeholder': 'Select an asset to view it.',
    'stage.reset': 'Reset view', 'stage.rotate': 'Auto-rotate',
    'stage.downloading': 'Downloading {name}…', 'stage.downloadingP': 'Downloading {name}… {p}%',
    'stage.preparing': 'Preparing model…', 'stage.failed': 'Could not load {name}: {error}',
    'anim.play': 'Play', 'anim.pause': 'Pause', 'anim.clip': 'Animation clip', 'anim.time': 'Animation time',
    'anim.speed': 'Playback speed', 'anim.clipN': 'Clip {n}', 'anim.unnamed': 'Unnamed', 'anim.none': 'None',
    'd.size': 'Size', 'd.meshes': 'Meshes', 'd.tris': 'Triangles', 'd.clips': 'Clips', 'd.repo': 'Source repo',
    'd.path': 'Source path', 'd.commit': 'Commit', 'd.sha': 'SHA-256', 'd.tags': 'Tags',
    'd.otherPlaces': '+{n} other places', 'd.otherPlace': '+1 other place',
    'd.tagLink': 'Show models tagged {tag}', 'd.editedBy': 'Edited by {who} {at}', 'd.someone': 'someone',
    'd.download': 'Download original',
    'edit.open': 'Edit name & tags', 'edit.name': 'Name', 'edit.tags': 'Tags',
    'edit.add': 'Add a tag and press Enter', 'edit.addAria': 'Add a tag',
    'edit.note': 'Changes the catalog only, never the model file. Saved to the library repository under your GitHub name.',
    'edit.save': 'Save', 'edit.cancel': 'Cancel', 'edit.remove': 'Remove {tag}', 'edit.removeAria': 'Remove tag {tag}',
    'edit.local': 'Sign in to edit (add &auth to the address in local preview).',
    'edit.saving': 'Saving…', 'edit.saved': 'Saved. Everyone sees it after the catalog updates (about a minute).',
    'edit.notSaved': 'Not saved: {error}',
    'err.signinStart': 'Could not start GitHub sign-in: {error}',
    'err.rejected': 'GitHub rejected this token. It may be mistyped, expired or revoked.',
    'err.noRead': 'This token cannot read {what}. It needs read access to the onliveline repositories (Contents: Read-only on all of them), or the file has been removed.',
    'err.sso': 'The organization requires SSO authorization for this token.',
    'err.rate': 'GitHub rate limit reached. Try again in a few minutes.',
    'err.notAllowed': 'This token is not allowed to read the repository. If the organization requires token approval, wait for an admin to approve it.',
    'err.api': 'GitHub API error {status}.',
    'err.noLink': 'GitHub did not return a download link for this file.',
    'err.expired': 'GitHub rejected this token. It may be expired.',
    'err.noWrite': 'Your token cannot write to {repo}. Editing needs write access: sign in with GitHub, or use a token with Contents: Read and write on that repository.',
    'err.conflict': 'Someone else saved this entry at the same time. Try again.',
    'err.local': 'Models live in their source repositories. Add &auth to the address and sign in to view them.',
    'err.download': 'Download failed ({status}).',
    'err.signinIncomplete': 'GitHub sign-in was not completed: {error}',
    'err.signinFailed': 'Sign-in failed: {error}',
    'err.noToken': 'GitHub did not return an access token. Please try signing in again.',
    'err.appNotApproved': '{org} has not approved the onVR Asset Library app yet. An organization owner can approve it under Settings → Third-party access → OAuth app policy.',
    'err.notMember': 'This GitHub account is not an active member of {org}.',
  },
  de: {
    'page.title': 'onXT Asset Library',
    'gate.lead': 'Für Mitglieder der GitHub-Organisation onliveline.',
    'gate.github': 'Mit GitHub anmelden',
    'gate.or': 'oder ein persönliches Zugriffstoken verwenden',
    'gate.tokenLabel': 'Persönliches GitHub-Zugriffstoken',
    'gate.remember': 'Auf diesem Gerät merken',
    'gate.open': 'Bibliothek mit Token öffnen',
    'gate.howto': 'Token erstellen – so geht’s',
    'gate.step1': '<a id="pat-link" target="_blank" rel="noopener noreferrer">GitHub → Fine-grained tokens → Generate new token</a> öffnen.',
    'gate.step2': 'Resource owner: <b id="pat-owner"></b>. Ablauf: höchstens 90 Tage.',
    'gate.step3': 'Repository access: <b>All repositories</b> (Modelle werden aus ihren Repositories gelesen).',
    'gate.step4': 'Permissions → Repository → <b>Contents: Read-only</b> (Read and write, um Namen und Tags zu bearbeiten).',
    'gate.step5': 'Erzeugen, kopieren und oben einfügen. Verlangt die Organisation eine Freigabe, auf die Freigabe durch einen Admin warten.',
    'top.signout': 'Abmelden',
    'theme.dark': 'Dunkel', 'theme.light': 'Hell', 'theme.toDark': 'Zum dunklen Modus wechseln', 'theme.toLight': 'Zum hellen Modus wechseln',
    'lang.group': 'Sprache',
    'search.placeholder': 'Name oder Tag suchen', 'search.aria': 'Assets durchsuchen',
    'chip.all': 'Alle', 'chip.animated': 'Animiert', 'chips.aria': 'Filter',
    'facet.domain': 'Domäne', 'facet.project': 'Kunde oder Projekt', 'facet.type': 'Typ',
    'facet.allDomains': 'Alle Domänen', 'facet.allProjects': 'Alle Projekte', 'facet.allTypes': 'Alle Typen',
    'facet.untagged': 'Noch nicht getaggt', 'facet.allOf': '{name}: alle',
    'facet.tagPlaceholder': 'Tag-Filter hinzufügen…', 'facet.tagAria': 'Nach Tag filtern',
    'filter.remove': 'Filter {tag} entfernen', 'filter.removeAria': 'Tag-Filter {tag} entfernen', 'filter.clear': 'Alle Filter zurücksetzen',
    'list.aria': 'Assets', 'list.empty': 'Keine passenden Assets.',
    'list.recent': 'Neu hinzugefügt ({n})', 'list.all': 'Alle Modelle', 'list.more': 'Mehr anzeigen (noch {n})',
    'list.selectFor': 'Zum Herunterladen auswählen', 'list.selectAria': '{name} auswählen',
    'badge.animated': 'Animiert', 'badge.new': 'Neu',
    'bulk.selectAll': 'Alle auswählen', 'bulk.clear': 'Auswahl aufheben',
    'bulk.download': 'Herunterladen', 'bulk.downloadN': 'Herunterladen ({n})',
    'bulk.progress': 'Lade {i}/{n}: {name} {p} %', 'bulk.packing': 'ZIP wird erstellt…',
    'bulk.done': '{n} Assets heruntergeladen.', 'bulk.doneOne': '1 Asset heruntergeladen.', 'bulk.failed': 'Download fehlgeschlagen: {error}',
    'stage.placeholder': 'Ein Asset auswählen, um es anzusehen.',
    'stage.reset': 'Ansicht zurücksetzen', 'stage.rotate': 'Automatisch drehen',
    'stage.downloading': 'Lade {name}…', 'stage.downloadingP': 'Lade {name}… {p} %',
    'stage.preparing': 'Modell wird vorbereitet…', 'stage.failed': '{name} konnte nicht geladen werden: {error}',
    'anim.play': 'Abspielen', 'anim.pause': 'Pause', 'anim.clip': 'Animationsclip', 'anim.time': 'Animationszeit',
    'anim.speed': 'Wiedergabegeschwindigkeit', 'anim.clipN': 'Clip {n}', 'anim.unnamed': 'Ohne Namen', 'anim.none': 'Keine',
    'd.size': 'Größe', 'd.meshes': 'Meshes', 'd.tris': 'Dreiecke', 'd.clips': 'Clips', 'd.repo': 'Quell-Repository',
    'd.path': 'Quellpfad', 'd.commit': 'Commit', 'd.sha': 'SHA-256', 'd.tags': 'Tags',
    'd.otherPlaces': '+{n} weitere Fundorte', 'd.otherPlace': '+1 weiterer Fundort',
    'd.tagLink': 'Modelle mit Tag {tag} anzeigen', 'd.editedBy': 'Bearbeitet von {who} {at}', 'd.someone': 'jemandem',
    'd.download': 'Original herunterladen',
    'edit.open': 'Name & Tags bearbeiten', 'edit.name': 'Name', 'edit.tags': 'Tags',
    'edit.add': 'Tag eingeben und Enter drücken', 'edit.addAria': 'Tag hinzufügen',
    'edit.note': 'Ändert nur den Katalog, nie die Modelldatei. Wird unter Ihrem GitHub-Namen im Bibliotheks-Repository gespeichert.',
    'edit.save': 'Speichern', 'edit.cancel': 'Abbrechen', 'edit.remove': '{tag} entfernen', 'edit.removeAria': 'Tag {tag} entfernen',
    'edit.local': 'Zum Bearbeiten anmelden (in der lokalen Vorschau &auth an die Adresse anhängen).',
    'edit.saving': 'Wird gespeichert…', 'edit.saved': 'Gespeichert. Für alle sichtbar, sobald der Katalog aktualisiert ist (etwa eine Minute).',
    'edit.notSaved': 'Nicht gespeichert: {error}',
    'err.signinStart': 'GitHub-Anmeldung konnte nicht gestartet werden: {error}',
    'err.rejected': 'GitHub hat dieses Token abgelehnt. Es ist vielleicht falsch eingegeben, abgelaufen oder widerrufen.',
    'err.noRead': 'Dieses Token kann {what} nicht lesen. Es braucht Lesezugriff auf die onliveline-Repositories (Contents: Read-only auf allen), oder die Datei wurde entfernt.',
    'err.sso': 'Die Organisation verlangt eine SSO-Freigabe für dieses Token.',
    'err.rate': 'GitHub-Ratenlimit erreicht. In ein paar Minuten erneut versuchen.',
    'err.notAllowed': 'Dieses Token darf das Repository nicht lesen. Verlangt die Organisation eine Freigabe, auf die Freigabe durch einen Admin warten.',
    'err.api': 'GitHub-API-Fehler {status}.',
    'err.noLink': 'GitHub hat keinen Download-Link für diese Datei geliefert.',
    'err.expired': 'GitHub hat dieses Token abgelehnt. Es ist vielleicht abgelaufen.',
    'err.noWrite': 'Ihr Token darf nicht in {repo} schreiben. Zum Bearbeiten braucht es Schreibzugriff: mit GitHub anmelden oder ein Token mit Contents: Read and write für dieses Repository verwenden.',
    'err.conflict': 'Jemand anderes hat diesen Eintrag gleichzeitig gespeichert. Bitte erneut versuchen.',
    'err.local': 'Modelle liegen in ihren Quell-Repositories. &auth an die Adresse anhängen und anmelden, um sie anzusehen.',
    'err.download': 'Download fehlgeschlagen ({status}).',
    'err.signinIncomplete': 'Die GitHub-Anmeldung wurde nicht abgeschlossen: {error}',
    'err.signinFailed': 'Anmeldung fehlgeschlagen: {error}',
    'err.noToken': 'GitHub hat kein Zugriffstoken geliefert. Bitte erneut anmelden.',
    'err.appNotApproved': '{org} hat die App „onVR Asset Library“ noch nicht freigegeben. Ein Organisations-Owner kann das unter Settings → Third-party access → OAuth app policy tun.',
    'err.notMember': 'Dieses GitHub-Konto ist kein aktives Mitglied von {org}.',
  },
};

// Taxonomy labels for the filter dropdowns (the tags themselves stay as stored).
const TERMS_DE = {
  abstract: 'Abstrakt', industrial: 'Industrie', medical: 'Medizin', biological: 'Biologisch', establishment: 'Einrichtung',
  character: 'Figur', anatomy: 'Anatomie', architecture: 'Architektur', furniture: 'Möbel', prop: 'Requisite', nature: 'Natur',
  vehicle: 'Fahrzeug', xr: 'XR', environment: 'Umgebung', animation: 'Animation', primitive: 'Grundkörper',
  human: 'Mensch', avatar: 'Avatar', hands: 'Hände', creature: 'Kreatur', crowd: 'Menschenmenge',
  organ: 'Organ', 'blood vessel': 'Blutgefäß', 'blood cell': 'Blutzelle', 'immune cell': 'Immunzelle', pathogen: 'Erreger',
  molecule: 'Molekül', tissue: 'Gewebe', skeleton: 'Skelett', 'body part': 'Körperteil',
  equipment: 'Ausstattung', lab: 'Labor', pharma: 'Pharma', 'hospital furniture': 'Krankenhausmöbel', diagnostic: 'Diagnostik',
  room: 'Raum', building: 'Gebäude', structure: 'Struktur', 'modular kit': 'Modulbausatz', 'door window': 'Tür / Fenster',
  stairs: 'Treppe', 'floor wall': 'Boden / Wand', seating: 'Sitzmöbel', table: 'Tisch', storage: 'Stauraum', bed: 'Bett',
  lighting: 'Beleuchtung', decor: 'Deko', household: 'Haushalt', office: 'Büro', tool: 'Werkzeug', 'food drink': 'Essen / Trinken',
  glassware: 'Glaswaren', electronics: 'Elektronik', 'sports toy': 'Sport / Spielzeug', signage: 'Beschilderung',
  container: 'Behälter', weapon: 'Waffe', 'tree plant': 'Baum / Pflanze', 'rock terrain': 'Fels / Gelände', 'water sky': 'Wasser / Himmel',
  animal: 'Tier', car: 'Auto', truck: 'Lkw', aircraft: 'Luftfahrzeug', boat: 'Boot', 'other vehicle': 'Anderes Fahrzeug',
  controller: 'Controller', 'hand model': 'Handmodell', headset: 'Headset', 'ui marker': 'UI-Marker', teleport: 'Teleport',
  gizmo: 'Gizmo', 'interior scene': 'Innenszene', 'exterior scene': 'Außenszene', city: 'Stadt', landscape: 'Landschaft',
  'sci fi': 'Sci-Fi', fantasy: 'Fantasy', 'clip only': 'Nur Clip', 'rig only': 'Nur Rig', 'basic shape': 'Grundform',
  placeholder: 'Platzhalter', collider: 'Collider', test: 'Test',
};

const KEY = 'onxt-lang';
let current = document.documentElement.lang === 'de' ? 'de' : 'en';
const listeners = [];

export const lang = () => current;

/** Translated text for a key, with {placeholders} filled from vars. */
export function t(key, vars = {}) {
  const text = TEXT[current][key] ?? TEXT.en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/** A taxonomy value for display, e.g. "blood-cell" → "Blood Cell" / "Blutzelle". */
export function term(value) {
  const words = value.toLowerCase().replace(/[-_]/g, ' ').trim();
  if (current === 'de' && TERMS_DE[words]) return TERMS_DE[words];
  return words.replace(/\b\w/g, c => c.toUpperCase());
}

/** Fills every element marked with data-i18n / data-i18n-html / data-i18n-placeholder / -aria / -title. */
export function translatePage(root = document) {
  document.documentElement.lang = current;
  document.title = t('page.title');
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-html]')) el.innerHTML = TEXT[current][el.dataset.i18nHtml] ?? TEXT.en[el.dataset.i18nHtml];
  for (const el of root.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = t(el.dataset.i18nPlaceholder);
  for (const el of root.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
  for (const el of root.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
}

export function setLang(next) {
  current = next === 'de' ? 'de' : 'en';
  try { localStorage.setItem(KEY, current); } catch { /* not remembered */ }
  translatePage();
  for (const fn of listeners) fn();
}

/** Called after the language changes, to redraw text built in code. */
export const onLangChange = fn => listeners.push(fn);
