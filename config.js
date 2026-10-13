// Public by design: the site shell ships no secrets. Everything private is read
// from this repository at runtime with the visitor's own GitHub token.
export const OWNER = 'onliveline';
export const REPO = 'OnVR-Asset-Library';
export const BRANCH = 'main';
export const CATALOG_PATH = 'catalog.json';

// Supabase project used only for "Sign in with GitHub". The publishable key is meant for browsers.
export const SUPABASE_URL = 'https://hqejsjjnstuifxtejosx.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_GWrveANLhK5myPwffoHM3w_GVz2TJgo';
