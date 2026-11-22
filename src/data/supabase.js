// Minimal Supabase client: talks to Supabase over plain fetch, so the project
// needs no extra npm package.
//
//  * Customers call database functions with the public (anon/publishable) key.
//  * Staff sign in with email + password; their session token is then sent only
//    on staff calls. The database checks the token itself (see src/supabase/schema.sql).
//  * The service_role key must NEVER be used here. Only these two variables exist:
//      VITE_SUPABASE_URL        e.g. https://abcdxyz.supabase.co
//      VITE_SUPABASE_ANON_KEY   the anon / publishable key
const SESSION_KEY = "doncafe:staff-session";
const REFRESH_MARGIN_MS = 60 * 1000;

const env = (typeof import.meta !== "undefined" && import.meta.env) || {};
export const CONFIG = {
  url: String(env.VITE_SUPABASE_URL || "").trim().replace(/\/+$/, ""),
  key: String(env.VITE_SUPABASE_ANON_KEY || "").trim(),
};

export const isConfigured = (config = CONFIG) => /^https?:\/\/.+/i.test(config.url) && config.key.length > 20;

function defaultStorage() {
  try {
    const s = globalThis.localStorage;
    s.setItem("__t", "1");
    s.removeItem("__t");
    return s;
  } catch {
    const mem = new Map();
    return {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k),
    };
  }
}

const NOT_CONFIGURED = {
  ok: false,
  code: "not_configured",
  message: "The database is not connected yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see README).",
};

// Turns any failure into { ok:false, code, message } that screens can show.
function describeError(status, body) {
  const pgCode = body?.code;
  if (status === 401 || status === 403 || pgCode === "42501") {
    return { ok: false, code: "forbidden", message: "Staff sign-in required." };
  }
  if (pgCode === "PGRST202" || pgCode === "42883" || status === 404) {
    return {
      ok: false,
      code: "not_set_up",
      message: "The database is reachable but not set up. Run src/supabase/schema.sql in the Supabase SQL Editor.",
    };
  }
  return { ok: false, code: "error", message: "Something went wrong on the server. Please try again." };
}

export function createClient({ url, key, fetchImpl, storage, now = Date.now } = CONFIG) {
  const doFetch = fetchImpl || ((...a) => globalThis.fetch(...a));
  const store = storage || defaultStorage();
  const configured = isConfigured({ url, key });

  const readSession = () => {
    try {
      const raw = store.getItem(SESSION_KEY);
      const s = raw ? JSON.parse(raw) : null;
      return s && s.access_token && s.refresh_token ? s : null;
    } catch {
      return null;
    }
  };
  const writeSession = (s) => {
    try {
      s ? store.setItem(SESSION_KEY, JSON.stringify(s)) : store.removeItem(SESSION_KEY);
    } catch {
      /* storage blocked: staff stays signed in until reload */
    }
  };

  const toSession = (b) => ({
    access_token: b.access_token,
    refresh_token: b.refresh_token,
    expires_at: now() + Number(b.expires_in || 3600) * 1000,
    email: b.user?.email || "",
  });

  async function authCall(path, body) {
    try {
      const res = await doFetch(`${url}/auth/v1/${path}`, {
        method: "POST",
        headers: { apikey: key, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      return { res, json };
    } catch {
      return { res: null, json: null };
    }
  }

  // Returns a token that is valid right now, or null (and clears the session).
  async function freshToken() {
    const s = readSession();
    if (!s) return null;
    if (s.expires_at - now() > REFRESH_MARGIN_MS) return s.access_token;
    const { res, json } = await authCall("token?grant_type=refresh_token", { refresh_token: s.refresh_token });
    if (res?.ok && json?.access_token) {
      const next = toSession({ ...json, user: json.user || { email: s.email } });
      writeSession(next);
      return next.access_token;
    }
    if (res) writeSession(null); // refresh rejected: sign out. (Network trouble keeps the session.)
    return null;
  }

  async function rpc(name, args = {}, { asStaff = false } = {}) {
    if (!configured) return NOT_CONFIGURED;
    let bearer = key;
    if (asStaff) {
      const token = await freshToken();
      if (!token) return { ok: false, code: "forbidden", message: "Staff sign-in required." };
      bearer = token;
    }
    let res;
    try {
      res = await doFetch(`${url}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
    } catch {
      return { ok: false, code: "network", message: "Can't reach the database. Check the internet connection." };
    }
    const body = await res.json().catch(() => null);
    if (!res.ok) return describeError(res.status, body);
    return body && typeof body === "object" ? body : { ok: true, data: body };
  }

  return {
    configured,
    rpc,
    getSession: () => {
      const s = readSession();
      return s ? { email: s.email } : null;
    },
    async signIn(email, password) {
      if (!configured) return NOT_CONFIGURED;
      const { res, json } = await authCall("token?grant_type=password", { email, password });
      if (!res) return { ok: false, code: "network", message: "Can't reach the database. Check the internet connection." };
      if (!res.ok || !json?.access_token) {
        return { ok: false, code: "bad_login", message: "Wrong email or password." };
      }
      writeSession(toSession(json));
      return { ok: true, email: json.user?.email || email };
    },
    async signOut() {
      const s = readSession();
      writeSession(null);
      if (configured && s) {
        try {
          await doFetch(`${url}/auth/v1/logout`, {
            method: "POST",
            headers: { apikey: key, Authorization: `Bearer ${s.access_token}` },
          });
        } catch {
          /* already signed out locally */
        }
      }
      return { ok: true };
    },
  };
}

// One shared client for the app.
export const client = createClient();
