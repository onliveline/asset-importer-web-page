import { OWNER, REPO } from './config.js';
import { tokenStore, GitHubSource, LocalSource, AuthError } from './source.js';
import { githubSignInAvailable, signInWithGitHub, completeGitHubSignIn, signOut } from './auth.js';
import { Viewer } from './viewer.js';
import { zipSync } from 'three/addons/libs/fflate.module.js';

const $ = id => document.getElementById(id);
const isLocalPreview = ['localhost', '127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).has('local');

let source = null;
let assets = [];
let recentCutoff = '';   // ISO time; assets added after it are "Recently added"
let listLimit = 200;     // rows rendered before "Show more"
let filter = 'all';
let selectedId = null;
let viewer = null;
let currentBytes = null;
let loadToken = 0;
const cache = new Map(); // asset id -> ArrayBuffer of models viewed or downloaded this session
const jobs = new Map();  // asset id -> { promise, listeners }: one download per asset, shared by viewer, prefetch and bulk download
const DISK_CACHE = 'onvr-asset-library-v1';
const PREFETCH_BUDGET = 500e6; // prefetch the whole library when it is this small
const checked = new Set(); // asset ids ticked for bulk download

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
  const who = await src.verify();
  source = src;
  // Local preview always reads the catalog from this folder; models still come from GitHub when signed in.
  const data = await (isLocalPreview ? new LocalSource() : src).catalog();
  assets = (data.assets || []).slice().sort((a, b) => a.name.localeCompare(b.name));
  recentCutoff = new Date(Date.now() - (data.recentDays || 14) * 864e5).toISOString();
  $('gate').hidden = true;
  $('app').hidden = false;
  $('who').textContent = who.login ? who.login : '';
  viewer ??= new Viewer($('viewport'));
  if (isLocalPreview) window.viewer = viewer; // console access for local debugging
  viewer.onTick = updateTimeline;
  renderList();
  prefetch();
  const fromHash = decodeURIComponent(location.hash.slice(1)).split('@')[0];
  if (assets.some(a => a.id === fromHash)) select(fromHash);
}

$('pat-link').href = 'https://github.com/settings/personal-access-tokens/new';
$('pat-owner').textContent = OWNER;
$('pat-repo').textContent = `${OWNER}/${REPO}`;

$('github-signin').hidden = !githubSignInAvailable;
$('github-signin').addEventListener('click', async () => {
  $('github-signin').disabled = true;
  const { error } = await signInWithGitHub();
  if (error) { $('github-signin').disabled = false; showGate(`Could not start GitHub sign-in: ${error.message}`); }
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

function matches(a) {
  const q = $('search').value.trim().toLowerCase();
  if (filter === 'glb' && a.format !== 'glb') return false;
  if (filter === 'fbx' && a.format !== 'fbx') return false;
  if (filter === 'animated' && !a.animated) return false;
  return !q || a.name.toLowerCase().includes(q) || (a.tags || []).some(t => t.toLowerCase().includes(q));
}

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
  // "Recently added" (newest first) heads the unfiltered list; the full list follows.
  const recent = filter === 'all' && !$('search').value.trim()
    ? shown.filter(isRecent).sort((a, b) => b.addedAt.localeCompare(a.addedAt)) : [];
  if (recent.length) {
    list.append(group(`Recently added (${recent.length})`));
    for (const a of recent) list.append(row(a));
    list.append(group('All models'));
  }
  for (const a of shown.slice(0, listLimit)) list.append(row(a));
  if (shown.length > listLimit) {
    const more = Object.assign(document.createElement('button'), { className: 'more', textContent: `Show more (${shown.length - listLimit} left)` });
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
  const box = Object.assign(document.createElement('input'), { type: 'checkbox', checked: checked.has(a.id), title: 'Select for download' });
  box.setAttribute('aria-label', `Select ${a.name}`);
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
  if (a.animated) meta.append(badge('Animated', 'anim'));
  if (isRecent(a)) meta.append(badge('New', 'new'));
  meta.append(Object.assign(document.createElement('span'), { className: 'muted small', textContent: formatBytes(a.bytes) }));
  btn.append(name, meta);
  li.append(box, btn);
  return li;
}

// ── Bulk download ────────────────────────────────────────────────────

function updateBulk() {
  const n = checked.size;
  $('bulk-download').disabled = n === 0;
  $('bulk-download').textContent = n ? `Download selected (${n})` : 'Download selected';
  const visible = assets.filter(matches);
  $('select-all').textContent = visible.length && visible.every(a => checked.has(a.id)) ? 'Clear' : 'Select all';
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
      const bytes = await getBytes(a, p => { status.textContent = `Downloading ${i + 1}/${picked.length}: ${a.name} ${Math.round(p * 100)}%`; });
      files[`${a.id}/${fileName(a)}`] = new Uint8Array(bytes);
    }
    if (picked.length === 1) {
      saveFile(fileName(picked[0]), cache.get(picked[0].id));
    } else {
      status.textContent = 'Packing zip…';
      await new Promise(r => setTimeout(r, 0));
      saveFile(`onvr-assets-${picked.length}.zip`, zipSync(files, { level: 0 }));
    }
    status.textContent = `Downloaded ${picked.length} asset${picked.length > 1 ? 's' : ''}.`;
  } catch (err) {
    if (err instanceof AuthError) { tokenStore.clear(); showGate(err.message); return; }
    status.textContent = `Download failed: ${err.message}`;
  } finally {
    updateBulk();
  }
});

$('search').addEventListener('input', () => { listLimit = 200; renderList(); });
for (const chip of document.querySelectorAll('.chip')) {
  chip.addEventListener('click', () => {
    filter = chip.dataset.filter;
    listLimit = 200;
    for (const c of document.querySelectorAll('.chip')) c.setAttribute('aria-pressed', String(c === chip));
    renderList();
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
  setLoading(0, `Downloading ${asset.name}…`);
  try {
    const bytes = await getBytes(asset, p => ticket === loadToken && setLoading(p, `Downloading ${asset.name}… ${Math.round(p * 100)}%`));
    if (ticket !== loadToken) return;
    setLoading(1, 'Preparing model…');
    // Loaders may detach or modify the buffer; give them a copy and keep the original for download.
    const info = await viewer.show(asset.format, bytes.slice(0));
    if (ticket !== loadToken) return;
    currentBytes = bytes;
    $('d-meshes').textContent = info.meshes.toLocaleString();
    $('d-tris').textContent = info.triangles.toLocaleString();
    $('d-clips').textContent = info.clips.length ? info.clips.map(c => c.name || 'Unnamed').join(', ') : 'None';
    setupAnimation(info.clips);
    $('loading').hidden = true;
  } catch (err) {
    if (ticket !== loadToken) return;
    $('loading').hidden = true;
    if (err instanceof AuthError) { tokenStore.clear(); showGate(err.message); return; }
    $('placeholder').hidden = false;
    $('placeholder').textContent = `Could not load ${asset.name}: ${err.message}`;
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
  $('d-badges').replaceChildren(badge(a.format.toUpperCase(), a.format), ...(a.animated ? [badge('Animated', 'anim')] : []), ...(isRecent(a) ? [badge('New', 'new')] : []));
  $('d-size').textContent = formatBytes(a.bytes);
  for (const k of ['d-meshes', 'd-tris', 'd-clips']) $(k).textContent = '…';
  const others = (a.occurrences?.length || 1) - 1;
  $('d-repo').textContent = a.source?.repo ? a.source.repo + (others ? ` (+${others} other place${others > 1 ? 's' : ''})` : '') : '—';
  $('d-repo').title = (a.occurrences || []).map(o => `${o.repo}/${o.path} [${o.branches.join(', ')}]`).join('\n');
  $('d-path').textContent = a.source?.path || '—';
  $('d-commit').textContent = a.source?.commit ? a.source.commit.slice(0, 10) : '—';
  $('d-sha').textContent = a.sha256 ? `${a.sha256.slice(0, 16)}…` : '—';
  $('d-sha').title = a.sha256 || '';
  $('d-tags').textContent = (a.tags || []).join(', ') || '—';
}

// ── Animation bar ────────────────────────────────────────────────────

let clips = [];
let paused = false;
let scrubbing = false;

function setupAnimation(list) {
  clips = list;
  $('anim').hidden = clips.length === 0;
  if (!clips.length) return;
  $('anim-clip').replaceChildren(...clips.map((c, i) => Object.assign(document.createElement('option'), { value: i, textContent: c.name || `Clip ${i + 1}` })));
  paused = false;
  $('anim-play').textContent = 'Pause';
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
  $('anim-play').textContent = paused ? 'Play' : 'Pause';
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
