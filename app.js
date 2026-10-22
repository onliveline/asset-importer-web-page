import { OWNER, REPO } from './config.js?v=83da3c4d';
import { tokenStore, GitHubSource, LocalSource, AuthError, saveEdit } from './source.js?v=83da3c4d';
import { githubSignInAvailable, signInWithGitHub, completeGitHubSignIn, signOut } from './auth.js?v=83da3c4d';
import { t, term, lang, setLang, translatePage, onLangChange } from './i18n.js?v=83da3c4d';

const $ = id => document.getElementById(id);
const isLocalPreview = ['localhost', '127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).has('local');

let source = null;
let login = '';      // the signed-in GitHub user, recorded on edits
let assets = [];
let recentCutoff = '';   // ISO time; assets added after it are "Recently added"
let listLimit = 200;     // rows rendered before "Show more"
let filter = 'all';      // chip: all / glb / fbx / animated / review
const LOW_CONFIDENCE = 0.5; // tagging-agent scores below this wait for a human check; any saved edit counts as checked
const facets = { domain: '', project: '', type: '', tags: [] }; // '' = any; domain '-' = not tagged yet
let selectedId = null;
let viewer = null;
let currentBytes = null;
let loadToken = 0;
const cache = new Map(); // asset id -> ArrayBuffer of models viewed or downloaded this session
const jobs = new Map();  // asset id -> { promise, listeners }: one download per asset, shared by viewer, prefetch and bulk download
const DISK_CACHE = 'onvr-asset-library-v1';
const PREFETCH_BUDGET = 500e6; // prefetch the whole library when it is this small
const checked = new Set(); // asset ids ticked for bulk download

// The 3D viewer (three.js) is loaded on demand, so the list appears without waiting for it.
let viewerReady = null;
function loadViewer() {
  viewerReady ??= import('./viewer.js?v=83da3c4d').then(({ Viewer }) => {
    viewer = new Viewer($('viewport'));
    if (isLocalPreview) window.viewer = viewer; // console access for local debugging
    viewer.onTick = updateTimeline;
    return viewer;
  });
  return viewerReady;
}

// A catalog arrived (cached first, then a newer one from GitHub): show it, keeping filters and selection.
function applyCatalog(data) {
  assets = (data.assets || []).slice().sort((a, b) => a.name.localeCompare(b.name));
  recentCutoff = new Date(Date.now() - (data.recentDays || 14) * 864e5).toISOString();
  renderFacets();
  renderList();
}

// ── Sign-in ──────────────────────────────────────────────────────────

function showGate(message) {
  $('app').hidden = true;
  $('gate').hidden = false;
  $('gate-error').hidden = !message;
  $('gate-error').textContent = message || '';
  $('token').value = '';
  $('token').focus();
}

async function start(src) {
  // Who you are and the catalog load in parallel; the catalog read also proves access.
  // Local preview always reads the catalog from this folder; models still come from GitHub when signed in.
  const onError = err => { if (err instanceof AuthError) { tokenStore.clear(); showGate(err.message); } };
  const [who, data] = await Promise.all([src.verify(), (isLocalPreview ? new LocalSource() : src).catalog(applyCatalog, onError)]);
  source = src;
  $('gate').hidden = true;
  $('app').hidden = false;
  login = who.login || '';
  $('who').textContent = login;
  applyCatalog(data);
  setTimeout(loadViewer, 0); // the 3D engine (~0.7 MB) loads after the list is on screen
  prefetch();
  const fromHash = decodeURIComponent(location.hash.slice(1)).split('@')[0];
  if (assets.some(a => a.id === fromHash)) select(fromHash);
}

// The token how-to is translated HTML; fill its link and owner after every translation.
function fillHowTo() {
  $('pat-link').href = 'https://github.com/settings/personal-access-tokens/new';
  $('pat-owner').textContent = OWNER;
}
translatePage();
fillHowTo();

$('github-signin').hidden = !githubSignInAvailable;
$('github-signin').addEventListener('click', async () => {
  $('github-signin').disabled = true;
  const { error } = await signInWithGitHub();
  if (error) { $('github-signin').disabled = false; showGate(t('err.signinStart', { error: error.message })); }
});

$('gate-form').addEventListener('submit', async e => {
  e.preventDefault();
  const token = $('token').value.trim();
  if (!token) return;
  $('gate-submit').disabled = true;
  $('gate-error').hidden = true;
  try {
    await start(new GitHubSource(token));
    tokenStore.set(token, $('remember').checked);
  } catch (err) {
    showGate(err.message);
  } finally {
    $('gate-submit').disabled = false;
  }
});

$('signout').addEventListener('click', () => {
  tokenStore.clear();
  signOut();
  source = null; assets = []; cache.clear(); checked.clear(); currentBytes = null; selectedId = null;
  clearDiskCache();
  viewer?.clear();
  location.hash = '';
  showGate();
});

// ── List ─────────────────────────────────────────────────────────────

// skip: leave one filter out, to count what choosing another value of it would show.
function passes(a, skip) {
  if (filter === 'glb' && a.format !== 'glb') return false;
  if (filter === 'fbx' && a.format !== 'fbx') return false;
  if (filter === 'animated' && !a.animated) return false;
  if (filter === 'review' && !needsReview(a)) return false;
  if (skip !== 'domain' && facets.domain && (a.domain || '-') !== facets.domain) return false;
  if (skip !== 'project' && facets.project && !(a.projects || []).includes(facets.project)) return false;
  if (skip !== 'type' && facets.type) {
    const [cat, sub] = facets.type.split('/');
    if (a.category !== cat || (sub && a.subcategory !== sub)) return false;
  }
  if (skip !== 'tags' && facets.tags.some(t => !(a.tags || []).includes(t))) return false;
  const q = $('search').value.trim().toLowerCase();
  return !q || a.name.toLowerCase().includes(q) || (a.tags || []).some(t => t.toLowerCase().includes(q));
}

const matches = a => passes(a);
const needsReview = a => typeof a.confidence === 'number' && a.confidence < LOW_CONFIDENCE && !a.edited;
const reviewBadge = a => badge(t('badge.review', { c: a.confidence.toFixed(2) }), 'review');
const filtered = () => filter !== 'all' || facets.domain || facets.project || facets.type || facets.tags.length || $('search').value.trim();

function countBy(list, key) {
  const n = new Map();
  for (const a of list) for (const v of [].concat(key(a) ?? [])) n.set(v, (n.get(v) || 0) + 1);
  return n;
}

function option(value, text, selected) {
  return Object.assign(document.createElement('option'), { value, textContent: text, selected });
}

// Rebuilds the dropdowns with counts for the current results, so you only ever pick something that exists.
function renderFacets() {
  const dom = countBy(assets.filter(a => passes(a, 'domain')), a => a.domain || '-');
  $('f-domain').replaceChildren(option('', t('facet.allDomains'), !facets.domain),
    ...[...dom].sort((x, y) => x[0].localeCompare(y[0])).map(([v, n]) => option(v, `${v === '-' ? t('facet.untagged') : v.split('/').map(term).join(' / ')} (${n})`, v === facets.domain)));

  const proj = countBy(assets.filter(a => passes(a, 'project')), a => a.projects);
  $('f-project').replaceChildren(option('', t('facet.allProjects'), !facets.project),
    ...[...proj].sort((x, y) => x[0].localeCompare(y[0])).map(([v, n]) => option(v, `${v} (${n})`, v === facets.project)));

  const typed = assets.filter(a => passes(a, 'type') && a.category);
  const cats = countBy(typed, a => a.category), subs = countBy(typed, a => `${a.category}/${a.subcategory}`);
  const groups = [...cats].sort((x, y) => y[1] - x[1]).map(([cat, n]) => {
    const g = Object.assign(document.createElement('optgroup'), { label: term(cat) });
    g.append(option(cat, `${t('facet.allOf', { name: term(cat) })} (${n})`, facets.type === cat),
      ...[...subs].filter(([k]) => k.startsWith(cat + '/')).sort((x, y) => y[1] - x[1])
        .map(([k, m]) => option(k, `${term(k.split('/')[1])} (${m})`, facets.type === k)));
    return g;
  });
  $('f-type').replaceChildren(option('', t('facet.allTypes'), !facets.type), ...groups);

  const tags = countBy(assets.filter(a => passes(a, 'tags')), a => a.tags);
  $('f-tags').replaceChildren(...[...tags].filter(([t]) => !facets.tags.includes(t)).sort((x, y) => y[1] - x[1]).slice(0, 400)
    .map(([t, n]) => Object.assign(document.createElement('option'), { value: t, label: `${n}` })));

  for (const id of ['f-domain', 'f-project', 'f-type']) $(id).classList.toggle('on', !!$(id).value);
  $('chip-review').textContent = t('chip.review', { n: assets.filter(needsReview).length });
  $('chip-review').title = t('chip.reviewTitle', { c: LOW_CONFIDENCE });
  const active = $('active');
  active.replaceChildren(...facets.tags.map(tag => {
    const chip = Object.assign(document.createElement('span'), { className: 'tag', textContent: tag });
    const x = Object.assign(document.createElement('button'), { textContent: '×', title: t('filter.remove', { tag }) });
    x.setAttribute('aria-label', t('filter.removeAria', { tag }));
    x.addEventListener('click', () => { facets.tags = facets.tags.filter(v => v !== tag); refilter(); });
    chip.append(x);
    return chip;
  }));
  if (filtered()) {
    const clear = Object.assign(document.createElement('button'), { className: 'clear', textContent: t('filter.clear') });
    clear.addEventListener('click', clearFilters);
    active.append(clear);
  }
  active.hidden = !active.children.length;
}

function refilter() {
  listLimit = 200;
  renderFacets();
  renderList();
}

function clearFilters() {
  Object.assign(facets, { domain: '', project: '', type: '', tags: [] });
  $('search').value = '';
  filter = 'all';
  for (const c of document.querySelectorAll('.chip')) c.setAttribute('aria-pressed', String(c.dataset.filter === 'all'));
  refilter();
}

function addTagFilter(t) {
  if (t && !facets.tags.includes(t)) facets.tags.push(t);
  refilter();
}

for (const [id, key] of [['f-domain', 'domain'], ['f-project', 'project'], ['f-type', 'type']])
  $(id).addEventListener('change', e => { facets[key] = e.target.value; refilter(); });
$('f-tag').addEventListener('change', e => {
  const t = e.target.value.trim();
  e.target.value = '';
  if (assets.some(a => (a.tags || []).includes(t))) addTagFilter(t);
});

const isRecent = a => !!a.addedAt && a.addedAt >= recentCutoff;
const fileName = a => a.source.path.split('/').pop();

function badge(text, kind) {
  const b = document.createElement('span');
  b.className = `badge ${kind || ''}`;
  b.textContent = text;
  return b;
}

function renderList() {
  const list = $('list');
  list.replaceChildren();
  const shown = assets.filter(matches);
  if (filter === 'review') shown.sort((x, y) => x.confidence - y.confidence); // least sure first
  // "Recently added" (newest first) heads the unfiltered list; the full list follows.
  const recent = !filtered()
    ? shown.filter(isRecent).sort((a, b) => b.addedAt.localeCompare(a.addedAt)) : [];
  if (recent.length) {
    list.append(group(t('list.recent', { n: recent.length })));
    for (const a of recent) list.append(row(a));
    list.append(group(t('list.all')));
  }
  for (const a of shown.slice(0, listLimit)) list.append(row(a));
  if (shown.length > listLimit) {
    const more = Object.assign(document.createElement('button'), { className: 'more', textContent: t('list.more', { n: shown.length - listLimit }) });
    more.addEventListener('click', () => { listLimit += 500; renderList(); });
    const li = document.createElement('li');
    li.append(more);
    list.append(li);
  }
  $('list-empty').hidden = shown.length > 0;
  updateBulk();
}

function group(text) {
  return Object.assign(document.createElement('li'), { className: 'group', textContent: text });
}

function row(a) {
  const li = document.createElement('li');
  li.className = 'row';
  const box = Object.assign(document.createElement('input'), { type: 'checkbox', checked: checked.has(a.id), title: t('list.selectFor') });
  box.setAttribute('aria-label', t('list.selectAria', { name: a.name }));
  box.addEventListener('change', () => { box.checked ? checked.add(a.id) : checked.delete(a.id); updateBulk(); });
  const btn = document.createElement('button');
  btn.className = 'item';
  btn.setAttribute('aria-current', String(a.id === selectedId));
  btn.addEventListener('click', () => select(a.id));
  const name = document.createElement('span');
  name.className = 'item-name';
  name.textContent = a.name;
  const meta = document.createElement('span');
  meta.className = 'item-meta';
  meta.append(badge(a.format.toUpperCase(), a.format));
  if (a.animated) meta.append(badge(t('badge.animated'), 'anim'));
  if (isRecent(a)) meta.append(badge(t('badge.new'), 'new'));
  if (needsReview(a)) meta.append(reviewBadge(a));
  meta.append(Object.assign(document.createElement('span'), { className: 'muted small', textContent: formatBytes(a.bytes) }));
  btn.append(name, meta);
  li.append(box, btn);
  return li;
}

// ── Bulk download ────────────────────────────────────────────────────

function updateBulk() {
  const n = checked.size;
  $('bulk-download').disabled = n === 0;
  $('bulk-download').textContent = n ? t('bulk.downloadN', { n }) : t('bulk.download');
  const visible = assets.filter(matches);
  $('select-all').textContent = visible.length && visible.every(a => checked.has(a.id)) ? t('bulk.clear') : t('bulk.selectAll');
}

$('select-all').addEventListener('click', () => {
  const visible = assets.filter(matches);
  const all = visible.every(a => checked.has(a.id));
  for (const a of visible) all ? checked.delete(a.id) : checked.add(a.id);
  renderList();
});

// ── Model bytes: memory → on-device cache → GitHub ──────────────────
// The on-device cache (Cache Storage, keyed by SHA-256) makes repeat views instant and saves
// LFS bandwidth. It holds private models, so Sign out deletes it.

const diskKey = asset => `${location.origin}/__onvr-asset-cache/${asset.sha256}`;

async function diskGet(asset) {
  try { const hit = await (await caches.open(DISK_CACHE)).match(diskKey(asset)); return hit ? hit.arrayBuffer() : null; }
  catch { return null; }
}

async function diskPut(asset, bytes) {
  try { await (await caches.open(DISK_CACHE)).put(diskKey(asset), new Response(bytes)); } catch { /* storage unavailable or full */ }
}

async function diskHas(asset) {
  try { return !!(await (await caches.open(DISK_CACHE)).match(diskKey(asset))); } catch { return false; }
}

function clearDiskCache() {
  try { caches.delete(DISK_CACHE); } catch { /* ignore */ }
}

function fetchShared(asset, onProgress) {
  let job = jobs.get(asset.id);
  if (!job) {
    job = { listeners: new Set() };
    job.promise = (async () => {
      const bytes = (await diskGet(asset)) || await source.modelBytes(asset, f => job.listeners.forEach(l => l(f)));
      await diskPut(asset, bytes);
      return bytes;
    })().finally(() => jobs.delete(asset.id));
    jobs.set(asset.id, job);
  }
  if (onProgress) job.listeners.add(onProgress);
  return job.promise;
}

async function getBytes(asset, onProgress) {
  let bytes = cache.get(asset.id);
  if (!bytes) { bytes = await fetchShared(asset, onProgress); cache.set(asset.id, bytes); }
  return bytes;
}

// Background-fill the on-device cache, three at a time, so opening any model skips the network.
async function prefetch() {
  if (typeof caches === 'undefined') return;
  // Large libraries are never prefetched: decide that before checking 1,900 cache entries.
  if (assets.reduce((n, a) => n + (a.bytes || 0), 0) > PREFETCH_BUDGET) return;
  const missing = [];
  for (const a of assets) if (!(await diskHas(a))) missing.push(a);
  if (!missing.length || missing.reduce((n, a) => n + (a.bytes || 0), 0) > PREFETCH_BUDGET) return;
  const worker = async () => {
    for (let a; (a = missing.shift()) && source;) {
      try { await fetchShared(a); } catch { /* the viewer reports errors when that model is opened */ }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
}

function saveFile(name, data) {
  const url = URL.createObjectURL(new Blob([data], { type: 'application/octet-stream' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// One file downloads as itself; several are packed into one zip (assets/<id>/<file>), uncompressed for speed.
$('bulk-download').addEventListener('click', async () => {
  const picked = assets.filter(a => checked.has(a.id));
  if (!picked.length) return;
  const status = $('bulk-status');
  $('bulk-download').disabled = true;
  status.hidden = false;
  try {
    const files = {};
    for (const [i, a] of picked.entries()) {
      const bytes = await getBytes(a, p => { status.textContent = t('bulk.progress', { i: i + 1, n: picked.length, name: a.name, p: Math.round(p * 100) }); });
      files[`${a.id}/${fileName(a)}`] = new Uint8Array(bytes);
    }
    if (picked.length === 1) {
      saveFile(fileName(picked[0]), cache.get(picked[0].id));
    } else {
      status.textContent = t('bulk.packing');
      await new Promise(r => setTimeout(r, 0));
      const { zipSync } = await import('three/addons/libs/fflate.module.js');
      saveFile(`onvr-assets-${picked.length}.zip`, zipSync(files, { level: 0 }));
    }
    status.textContent = picked.length > 1 ? t('bulk.done', { n: picked.length }) : t('bulk.doneOne');
  } catch (err) {
    if (err instanceof AuthError) { tokenStore.clear(); showGate(err.message); return; }
    status.textContent = t('bulk.failed', { error: err.message });
  } finally {
    updateBulk();
  }
});

$('search').addEventListener('input', refilter);
for (const chip of document.querySelectorAll('.chip')) {
  chip.addEventListener('click', () => {
    filter = chip.dataset.filter;
    for (const c of document.querySelectorAll('.chip')) c.setAttribute('aria-pressed', String(c === chip));
    refilter();
  });
}

// ── Viewing ──────────────────────────────────────────────────────────

async function select(id) {
  const asset = assets.find(a => a.id === id);
  if (!asset) return;
  selectedId = id;
  history.replaceState(null, '', `#${encodeURIComponent(id)}`);
  renderList();
  showDetails(asset);

  const ticket = ++loadToken;
  $('placeholder').hidden = true;
  $('anim').hidden = true;
  setLoading(0, t('stage.downloading', { name: asset.name }));
  try {
    const bytes = await getBytes(asset, p => ticket === loadToken && setLoading(p, t('stage.downloadingP', { name: asset.name, p: Math.round(p * 100) })));
    if (ticket !== loadToken) return;
    setLoading(1, t('stage.preparing'));
    // Loaders may detach or modify the buffer; give them a copy and keep the original for download.
    await loadViewer();
    if (ticket !== loadToken) return;
    const info = await viewer.show(asset.format, bytes.slice(0));
    if (ticket !== loadToken) return;
    currentBytes = bytes;
    $('d-meshes').textContent = info.meshes.toLocaleString(lang());
    $('d-tris').textContent = info.triangles.toLocaleString(lang());
    $('d-clips').textContent = info.clips.length ? info.clips.map(c => c.name || t('anim.unnamed')).join(', ') : t('anim.none');
    setupAnimation(info.clips);
    $('loading').hidden = true;
  } catch (err) {
    if (ticket !== loadToken) return;
    $('loading').hidden = true;
    if (err instanceof AuthError) { tokenStore.clear(); showGate(err.message); return; }
    $('placeholder').hidden = false;
    $('placeholder').textContent = t('stage.failed', { name: asset.name, error: err.message });
    console.error(err);
  }
}

function setLoading(fraction, text) {
  $('loading').hidden = false;
  $('loading-fill').style.width = `${Math.round(fraction * 100)}%`;
  $('loading-text').textContent = text;
}

function showDetails(a) {
  $('details').hidden = false;
  $('d-name').textContent = a.name;
  $('d-badges').replaceChildren(badge(a.format.toUpperCase(), a.format), ...(a.animated ? [badge(t('badge.animated'), 'anim')] : []), ...(isRecent(a) ? [badge(t('badge.new'), 'new')] : []), ...(needsReview(a) ? [reviewBadge(a)] : []));
  $('d-confidence').textContent = typeof a.confidence === 'number'
    ? t('d.confidenceValue', { model: a.taggedBy || '?', c: a.confidence.toFixed(2) }) + (a.edited ? `; ${t('d.checked', { who: a.edited.by || t('d.someone') })}` : '')
    : '—';
  $('d-review').hidden = !needsReview(a);
  $('d-size').textContent = formatBytes(a.bytes);
  for (const k of ['d-meshes', 'd-tris', 'd-clips']) $(k).textContent = '…';
  const others = (a.occurrences?.length || 1) - 1;
  $('d-repo').textContent = a.source?.repo ? a.source.repo + (others ? ` (${others > 1 ? t('d.otherPlaces', { n: others }) : t('d.otherPlace')})` : '') : '—';
  $('d-repo').title = (a.occurrences || []).map(o => `${o.repo}/${o.path} [${o.branches.join(', ')}]`).join('\n');
  $('d-path').textContent = a.source?.path || '—';
  $('d-commit').textContent = a.source?.commit ? a.source.commit.slice(0, 10) : '—';
  $('d-sha').textContent = a.sha256 ? `${a.sha256.slice(0, 16)}…` : '—';
  $('d-sha').title = a.sha256 || '';
  // Each tag filters the list to models that share it.
  $('d-tags').replaceChildren(...(a.tags || []).flatMap((tag, i) => {
    const b = Object.assign(document.createElement('button'), { className: 'tag-link', textContent: tag, title: t('d.tagLink', { tag }) });
    b.addEventListener('click', () => addTagFilter(tag));
    return i ? [', ', b] : [b];
  }));
  if (!(a.tags || []).length) $('d-tags').textContent = '—';
  $('d-tags').title = a.edited ? t('d.editedBy', { who: a.edited.by || t('d.someone'), at: a.edited.at || '' }) : '';
  closeEditor();
}

// ── Editing name & tags (catalog only, never the model file) ─────────

let editTags = [];
const RECENT_EDITS = 20; // suggestions come from the tags of this many most recent human edits (the edits/ commits)

// Tags from recent edits, weighted so newer edits count more; leaves out tags the model already has.
function suggestedTags() {
  const have = new Set(editTags.map(x => x.toLowerCase()));
  const score = new Map();
  assets.filter(a => a.edited && a.edited.at && a.id !== selectedId)
    .sort((x, y) => y.edited.at.localeCompare(x.edited.at)).slice(0, RECENT_EDITS)
    .forEach((a, i) => (a.tags || []).forEach(tag => {
      if (!have.has(tag.toLowerCase())) score.set(tag, (score.get(tag) || 0) + 1 / (1 + i / 5));
    }));
  return [...score].sort((x, y) => y[1] - x[1]).slice(0, 12).map(([tag]) => tag);
}

function renderEditTags() {
  $('edit-tags').replaceChildren(...editTags.map((tag, i) => {
    const chip = Object.assign(document.createElement('span'), { className: 'tag', textContent: tag });
    const x = Object.assign(document.createElement('button'), { type: 'button', textContent: '×', title: t('edit.remove', { tag }) });
    x.setAttribute('aria-label', t('edit.removeAria', { tag }));
    x.addEventListener('click', () => { editTags.splice(i, 1); renderEditTags(); });
    chip.append(x);
    return chip;
  }));
  const suggestions = suggestedTags();
  $('edit-suggest-row').hidden = !suggestions.length;
  $('edit-suggest').replaceChildren(...suggestions.map(tag => {
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'tag suggest', textContent: `+ ${tag}`, title: t('edit.suggestAdd', { tag }) });
    b.addEventListener('click', () => addTags(tag));
    return b;
  }));
}

function addTags(text) {
  for (const t of text.split(',').map(x => x.trim().slice(0, 40)).filter(Boolean))
    if (!editTags.some(e => e.toLowerCase() === t.toLowerCase())) editTags.push(t);
  renderEditTags();
}

function closeEditor() {
  $('edit').hidden = true;
  $('edit-open').hidden = false;
}

$('edit-open').addEventListener('click', () => {
  const a = assets.find(x => x.id === selectedId);
  if (!a) return;
  $('edit-status').hidden = true;
  if (source instanceof LocalSource) {
    $('edit-status').hidden = false;
    $('edit-status').textContent = t('edit.local');
    return;
  }
  $('edit-name').value = a.name;
  editTags = [...(a.tags || [])];
  renderEditTags();
  $('edit').hidden = false;
  $('edit-open').hidden = true;
  $('edit-name').focus();
});
$('edit-cancel').addEventListener('click', closeEditor);
$('edit-add').addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ',') return;
  e.preventDefault();
  addTags($('edit-add').value);
  $('edit-add').value = '';
});
$('edit').addEventListener('submit', async e => {
  e.preventDefault();
  const a = assets.find(x => x.id === selectedId);
  if (!a) return;
  addTags($('edit-add').value);
  $('edit-add').value = '';
  const edit = { name: $('edit-name').value.trim() || a.name, tags: [...editTags], by: login, at: new Date().toISOString().replace(/\.\d+Z$/, 'Z') };
  $('edit-save').disabled = true;
  $('edit-status').hidden = false;
  $('edit-status').textContent = t('edit.saving');
  try {
    await saveEdit(source.token, a, edit);
    Object.assign(a, { name: edit.name, tags: edit.tags, edited: { by: edit.by, at: edit.at } });
    assets.sort((x, y) => x.name.localeCompare(y.name));
    refilter();
    showDetails(a);
    $('edit-status').hidden = false;
    $('edit-status').textContent = t('edit.saved');
  } catch (err) {
    if (err instanceof AuthError) { tokenStore.clear(); showGate(err.message); return; }
    $('edit-status').textContent = t('edit.notSaved', { error: err.message });
  } finally {
    $('edit-save').disabled = false;
  }
});

// ── Animation bar ────────────────────────────────────────────────────

let clips = [];
let paused = false;
let scrubbing = false;

function setupAnimation(list) {
  clips = list;
  $('anim').hidden = clips.length === 0;
  if (!clips.length) return;
  $('anim-clip').replaceChildren(...clips.map((c, i) => Object.assign(document.createElement('option'), { value: i, textContent: c.name || t('anim.clipN', { n: i + 1 }) })));
  paused = false;
  $('anim-play').textContent = t('anim.pause');
  viewer.play(clips[0], Number($('anim-speed').value));
}

function updateTimeline() {
  if ($('anim').hidden || scrubbing || !viewer.duration) return;
  const t = viewer.time % viewer.duration;
  $('anim-scrub').value = String(Math.round((t / viewer.duration) * 1000));
  $('anim-time').textContent = `${t.toFixed(2)}s / ${viewer.duration.toFixed(2)}s`;
}

$('anim-clip').addEventListener('change', e => {
  viewer.play(clips[Number(e.target.value)], Number($('anim-speed').value));
  viewer.setPaused(paused);
});
$('anim-play').addEventListener('click', () => {
  paused = !paused;
  viewer.setPaused(paused);
  $('anim-play').textContent = paused ? t('anim.play') : t('anim.pause');
});
$('anim-speed').addEventListener('change', e => viewer.setSpeed(Number(e.target.value)));
$('anim-scrub').addEventListener('input', e => {
  scrubbing = true;
  viewer.seek(Number(e.target.value) / 1000);
  $('anim-time').textContent = `${viewer.time.toFixed(2)}s / ${viewer.duration.toFixed(2)}s`;
});
$('anim-scrub').addEventListener('change', () => { scrubbing = false; });

// ── Tools ────────────────────────────────────────────────────────────

$('reset-view').addEventListener('click', () => viewer?.frameModel());
$('auto-rotate').addEventListener('click', e => {
  const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
  e.currentTarget.setAttribute('aria-pressed', String(on));
  viewer?.setAutoRotate(on);
});

$('download').addEventListener('click', () => {
  const a = assets.find(x => x.id === selectedId);
  if (a && currentBytes) saveFile(fileName(a), currentBytes);
});

function formatBytes(n) {
  if (!n && n !== 0) return '—';
  return n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`;
}

// ── Theme: light / dark switch (remembered on this device) ──────────

const systemDark = matchMedia('(prefers-color-scheme: dark)');
const currentTheme = () => document.documentElement.dataset.theme || (systemDark.matches ? 'dark' : 'light');
// The same switch sits in the header and in the sign-in screen's corner.
function labelThemeButton() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  for (const b of document.querySelectorAll('.theme-btn')) {
    b.textContent = next === 'dark' ? t('theme.dark') : t('theme.light');
    b.setAttribute('aria-label', next === 'dark' ? t('theme.toDark') : t('theme.toLight'));
  }
}
for (const b of document.querySelectorAll('.theme-btn')) b.addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('onxt-theme', next); } catch { /* not remembered */ }
  labelThemeButton();
});
systemDark.addEventListener('change', labelThemeButton);
labelThemeButton();

// ── Language: DE / EN switch (remembered on this device) ────────────

// DE | EN: both shown, the active one highlighted (header and sign-in screen).
function markLanguage() {
  for (const b of document.querySelectorAll('[data-lang]')) b.setAttribute('aria-pressed', String(b.dataset.lang === lang()));
}
for (const b of document.querySelectorAll('[data-lang]')) b.addEventListener('click', () => { if (b.dataset.lang !== lang()) setLang(b.dataset.lang); });
markLanguage();
onLangChange(() => {
  markLanguage();
  fillHowTo();
  labelThemeButton();
  updateBulk();
  if (assets.length) { renderFacets(); renderList(); }
  const a = assets.find(x => x.id === selectedId);
  if (a && !$('details').hidden) {
    const keep = ['d-meshes', 'd-tris', 'd-clips'].map(k => $(k).textContent);
    showDetails(a);
    ['d-meshes', 'd-tris', 'd-clips'].forEach((k, i) => { $(k).textContent = keep[i]; });
  }
  if (!$('anim').hidden) $('anim-play').textContent = paused ? t('anim.play') : t('anim.pause');
});

// ── Boot ─────────────────────────────────────────────────────────────

(async () => {
  try {
    if (isLocalPreview && !new URLSearchParams(location.search).has('auth')) return await start(new LocalSource());
    // Returning from "Sign in with GitHub": keep the member's GitHub token for this device (it expires after 8 hours).
    const githubToken = await completeGitHubSignIn();
    if (githubToken) tokenStore.set(githubToken, true);
    const saved = tokenStore.get();
    if (!saved) return showGate();
    await start(new GitHubSource(saved));
  } catch (err) {
    if (err instanceof AuthError) tokenStore.clear();
    showGate(err.message);
  }
})();
