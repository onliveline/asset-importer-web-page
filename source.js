import { OWNER, REPO, BRANCH, CATALOG_PATH } from './config.js';

const API = 'https://api.github.com';
const KEY = 'onvr-asset-library-token';

// ── Token storage: session by default, local only when the user opts in ──
export const tokenStore = {
  get() {
    try { return sessionStorage.getItem(KEY) || localStorage.getItem(KEY) || ''; } catch { return ''; }
  },
  set(token, remember) {
    this.clear();
    try { (remember ? localStorage : sessionStorage).setItem(KEY, token); } catch { /* storage blocked: token lives in memory only */ }
  },
  clear() {
    try { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); } catch { /* ignore */ }
  },
};

export class AuthError extends Error {}

/** Reads the private repository through the GitHub REST API with the visitor's token. */
export class GitHubSource {
  constructor(token) { this.token = token; }

  async api(path, accept = 'application/vnd.github+json', what = `${OWNER}/${REPO}`, etag = '') {
    const headers = { Authorization: `Bearer ${this.token}`, Accept: accept, 'X-GitHub-Api-Version': '2022-11-28' };
    if (etag) headers['If-None-Match'] = etag;
    const res = await fetch(`${API}${path}`, { headers, cache: 'no-store' });
    if (res.status === 304) return res; // unchanged since the cached copy (free: does not count against the rate limit)
    if (res.status === 401) throw new AuthError('GitHub rejected this token. It may be mistyped, expired or revoked.');
    if (res.status === 404) throw new AuthError(`This token cannot read ${what}. It needs read access to the onliveline repositories (Contents: Read-only on all of them), or the file has been removed.`);
    if (res.status === 403) {
      const body = await res.text();
      if (/SAML|SSO/i.test(body)) throw new AuthError('The organization requires SSO authorization for this token.');
      if (/rate limit/i.test(body)) throw new Error('GitHub rate limit reached. Try again in a few minutes.');
      throw new AuthError('This token is not allowed to read the repository. If the organization requires token approval, wait for an admin to approve it.');
    }
    if (!res.ok) throw new Error(`GitHub API error ${res.status}.`);
    return res;
  }

  // Who is signed in. Access itself is proven by reading the catalog, which runs at the same time.
  async verify() {
    // Fine-grained tokens can read their own user; failure here is not fatal.
    try { const u = await (await this.api('/user')).json(); return { login: u.login, avatar: u.avatar_url }; }
    catch { return { login: null, avatar: null }; }
  }

  /**
   * The catalog, fast: a copy cached on this device is returned at once and GitHub is asked only
   * whether it changed (ETag). A newer catalog arrives through onUpdate; a failure (e.g. a revoked
   * token) through onError. Without a cached copy this waits for GitHub.
   */
  async catalog(onUpdate, onError) {
    const cached = await catalogCache.read();
    const fresh = (async () => {
      const res = await this.api(`/repos/${OWNER}/${REPO}/contents/${CATALOG_PATH}?ref=${BRANCH}`, 'application/vnd.github.raw+json', undefined, cached?.etag);
      if (res.status === 304) return null;
      const text = await res.text();
      await catalogCache.write(text, res.headers.get('ETag'));
      return JSON.parse(text);
    })();
    if (!cached) return fresh;
    fresh.then(data => data && onUpdate?.(data), err => onError?.(err));
    return JSON.parse(cached.text);
  }

  // Models are read from the repository they live in, at the commit the catalog recorded.
  // LFS files: the contents API returns a short-lived download URL on media.githubusercontent.com.
  // It is a bearer link, so it is used once and never stored or shown. Plain git files come raw from the API.
  async modelBytes(asset, onProgress) {
    const { repo, commit, path } = asset.source;
    const url = `/repos/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${commit}`;
    if (!asset.lfs) return readWithProgress(await this.api(url, 'application/vnd.github.raw+json', repo), asset.bytes, onProgress);
    const meta = await (await this.api(url, undefined, repo)).json();
    if (!meta.download_url) throw new Error('GitHub did not return a download link for this file.');
    return readWithProgress(await fetch(meta.download_url, { cache: 'no-store', referrerPolicy: 'no-referrer' }), asset.bytes, onProgress);
  }
}

/**
 * Saves a human edit of an asset's catalog entry (name, tags) as edits/<sha256>.json in the
 * library repository, committed with the visitor's own token. The catalog workflow merges it
 * within about a minute; the model file is never touched.
 */
export async function saveEdit(token, asset, edit) {
  const url = `${API}/repos/${OWNER}/${REPO}/contents/edits/${asset.sha256}.json`;
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  const bytes = new TextEncoder().encode(JSON.stringify(edit, null, 1) + '\n');
  const content = btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''));
  for (let attempt = 0; attempt < 2; attempt++) {
    const current = await fetch(`${url}?ref=${BRANCH}`, { headers, cache: 'no-store' });
    const sha = current.ok ? (await current.json()).sha : undefined;
    const res = await fetch(url, {
      method: 'PUT', headers,
      body: JSON.stringify({ message: `Edit ${asset.id}: name and tags (${edit.by || 'web'})`, content, branch: BRANCH, sha }),
    });
    if (res.ok) return;
    if (res.status === 409) continue; // saved by someone else a moment ago: retry on top of it
    if (res.status === 401) throw new AuthError('GitHub rejected this token. It may be expired.');
    if (res.status === 403 || res.status === 404) throw new Error(`Your token cannot write to ${OWNER}/${REPO}. Editing needs write access: sign in with GitHub, or use a token with Contents: Read and write on that repository.`);
    throw new Error(`GitHub API error ${res.status}.`);
  }
  throw new Error('Someone else saved this entry at the same time. Try again.');
}

// The private catalog lives in the same Cache Storage as the models, so Sign out deletes both.
const catalogCache = {
  key: `${location.origin}/__onvr-catalog/${CATALOG_PATH}`,
  async read() {
    try {
      const hit = await (await caches.open('onvr-asset-library-v1')).match(this.key);
      return hit ? { text: await hit.text(), etag: hit.headers.get('X-ETag') || '' } : null;
    } catch { return null; }
  },
  async write(text, etag) {
    try { await (await caches.open('onvr-asset-library-v1')).put(this.key, new Response(text, { headers: { 'X-ETag': etag || '' } })); } catch { /* not cached */ }
  },
};

/** Developer mode on localhost: serves the repository folder itself, no token involved. */
export class LocalSource {
  async verify() { return { login: 'local preview', avatar: null }; }
  async catalog() { return (await fetch(`../${CATALOG_PATH}`, { cache: 'no-store' })).json(); }
  async modelBytes() {
    throw new Error('Models live in their source repositories. Add &auth to the address and sign in to view them.');
  }
}

async function readWithProgress(res, expected, onProgress) {
  if (!res.ok) throw new Error(`Download failed (${res.status}).`);
  const total = Number(res.headers.get('Content-Length')) || expected || 0;
  if (!res.body || !total) return res.arrayBuffer();
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onProgress?.(Math.min(got / total, 1));
  }
  const bytes = new Uint8Array(got);
  let offset = 0;
  for (const c of chunks) { bytes.set(c, offset); offset += c.length; }
  return bytes.buffer;
}
