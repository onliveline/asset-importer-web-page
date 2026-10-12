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

  async api(path, accept = 'application/vnd.github+json') {
    const res = await fetch(`${API}${path}`, {
      headers: { Authorization: `Bearer ${this.token}`, Accept: accept, 'X-GitHub-Api-Version': '2022-11-28' },
      cache: 'no-store',
    });
    if (res.status === 401) throw new AuthError('GitHub rejected this token. It may be mistyped, expired or revoked.');
    if (res.status === 404) throw new AuthError(`This token cannot read ${OWNER}/${REPO}. Check it is scoped to that repository with Contents: Read-only, and that you have access.`);
    if (res.status === 403) {
      const body = await res.text();
      if (/SAML|SSO/i.test(body)) throw new AuthError('The organization requires SSO authorization for this token.');
      if (/rate limit/i.test(body)) throw new Error('GitHub rate limit reached. Try again in a few minutes.');
      throw new AuthError('This token is not allowed to read the repository. If the organization requires token approval, wait for an admin to approve it.');
    }
    if (!res.ok) throw new Error(`GitHub API error ${res.status}.`);
    return res;
  }

  async verify() {
    await this.api(`/repos/${OWNER}/${REPO}`);
    // Fine-grained tokens can read their own user; failure here is not fatal.
    try { const u = await (await this.api('/user')).json(); return { login: u.login, avatar: u.avatar_url }; }
    catch { return { login: null, avatar: null }; }
  }

  async catalog() {
    const res = await this.api(`/repos/${OWNER}/${REPO}/contents/${CATALOG_PATH}?ref=${BRANCH}`, 'application/vnd.github.raw+json');
    return res.json();
  }

  // The contents API returns a short-lived download URL on media.githubusercontent.com
  // for LFS files. It is a bearer link, so it is used once and never stored or shown.
  async modelBytes(asset, onProgress) {
    const path = asset.path.split('/').map(encodeURIComponent).join('/');
    const meta = await (await this.api(`/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`)).json();
    if (!meta.download_url) throw new Error('GitHub did not return a download link for this file.');
    return readWithProgress(await fetch(meta.download_url, { cache: 'no-store', referrerPolicy: 'no-referrer' }), asset.bytes, onProgress);
  }
}

/** Developer mode on localhost: serves the repository folder itself, no token involved. */
export class LocalSource {
  async verify() { return { login: 'local preview', avatar: null }; }
  async catalog() { return (await fetch(`../${CATALOG_PATH}`, { cache: 'no-store' })).json(); }
  async modelBytes(asset, onProgress) {
    return readWithProgress(await fetch(`../${asset.path}`, { cache: 'no-store' }), asset.bytes, onProgress);
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
