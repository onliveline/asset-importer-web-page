import { OWNER, SUPABASE_URL, SUPABASE_KEY } from './config.js?v=f2cc7786';
import { AuthError } from './source.js?v=f2cc7786';
import { t } from './i18n.js?v=f2cc7786';

// Sign in with GitHub through Supabase (it holds the OAuth client secret).
// The GitHub token returned to the browser is what reads the private repository,
// exactly like a pasted token; Supabase never sees the assets.

// Read before the client strips them: a returning sign-in carries ?code=, a refusal ?error=.
const params = new URLSearchParams(location.search);
const returning = params.has('code');
const returnError = params.get('error_description') || params.get('error');

const supabase = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true },
});

export const githubSignInAvailable = !!supabase;

export function signInWithGitHub() {
  return supabase.auth.signInWithOAuth({
    provider: 'github',
    options: { scopes: 'repo read:org', redirectTo: location.origin + location.pathname },
  });
}

/** After the GitHub redirect: the member's GitHub token, or null when this load is not a sign-in return. */
export async function completeGitHubSignIn() {
  if (returnError) { cleanUrl(); throw new AuthError(t('err.signinIncomplete', { error: returnError })); }
  if (!returning || !supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  cleanUrl();
  if (error) throw new AuthError(t('err.signinFailed', { error: error.message }));
  const token = data.session?.provider_token;
  if (!token) throw new AuthError(t('err.noToken'));
  await requireMembership(token);
  return token;
}

// Only active members of the organization get in. (GitHub itself also hides the
// private repository from everyone else, so this is a clear message, not the only gate.)
async function requireMembership(token) {
  const res = await fetch(`https://api.github.com/user/memberships/orgs/${OWNER}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    cache: 'no-store',
  });
  if (res.ok && (await res.json()).state === 'active') return;
  await signOut();
  if (res.status === 403) {
    throw new AuthError(t('err.appNotApproved', { org: OWNER }));
  }
  throw new AuthError(t('err.notMember', { org: OWNER }));
}

export async function signOut() {
  try { await supabase?.auth.signOut(); } catch { /* already signed out */ }
}

function cleanUrl() {
  history.replaceState(null, '', location.pathname + location.hash);
}
