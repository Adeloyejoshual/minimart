// ════════════════════════════════════════════════════════════
// FILE: src/pages/SettingsPage/hooks/useSettings.js
//
// Central hook for all settings state and actions.
// Keeps logic out of the UI components.
// ════════════════════════════════════════════════════════════

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const THEME_KEY = "loemart_theme";
const LANG_KEY  = "loemart_lang";
const PREFS_KEY = "loemart_notification_prefs";

const THEMES = ["light", "dark", "system"];

const LANGUAGES = [
  { code: "en",  label: "English" },
  { code: "yo",  label: "Yorùbá"  },
  { code: "ha",  label: "Hausa"   },
  { code: "ig",  label: "Igbo"    },
  { code: "pcm", label: "Pidgin"  },
];

const API_BASE = import.meta.env.VITE_API_BASE_URL;

/* ═══════════════════════════════════════════════════════════════
   THEME HELPERS
═══════════════════════════════════════════════════════════════ */
const getSystemTheme = () =>
  window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

const applyTheme = (theme) => {
  const resolved = theme === "system" ? getSystemTheme() : theme;
  document.documentElement.setAttribute("data-theme", resolved);
};

/* ═══════════════════════════════════════════════════════════════
   STORAGE HELPERS
═══════════════════════════════════════════════════════════════ */
const readPref = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};

const writePref = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* storage full — non-critical */ }
};

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token")             ||
  null;

/*
  clearAllAuthStorage
  ───────────────────
  Only clears authentication keys — NOT preferences like
  theme and language. Those should survive a logout so the
  user's UI settings are still applied when they log back in.
*/
const clearAllAuthStorage = () => {
  localStorage.removeItem("marketplace_token");
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("auth_user");
  sessionStorage.removeItem("marketplace_token");
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("user");
};

/* ═══════════════════════════════════════════════════════════════
   HOOK
═══════════════════════════════════════════════════════════════ */
export function useSettings({ user, onLogout } = {}) {
  /*
    onLogout  — App.jsx's handleLogout(navigateFn)
    We do NOT call useNavigate() here.  Navigation is the
    responsibility of App.jsx's handleLogout.  DangerZone
    passes its own navigate when it calls onLogout(navigate).
    This avoids duplicate navigation and keeps the destination
    defined in one place.
  */

  const mountedRef  = useRef(true);
  const toastTimer  = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  /* ══════════════════════════════════════════════════════════
     THEME
  ══════════════════════════════════════════════════════════ */
  const [theme, setThemeState] = useState(
    () => readPref(THEME_KEY, "system")
  );

  const setTheme = useCallback((next) => {
    if (!THEMES.includes(next)) return;
    setThemeState(next);
    writePref(THEME_KEY, next);
    applyTheme(next);
  }, []);

  /* Apply on mount + watch system preference when theme = "system" */
  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;

    const mq      = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  /* ══════════════════════════════════════════════════════════
     LANGUAGE
  ══════════════════════════════════════════════════════════ */
  const [language, setLanguageState] = useState(
    () => readPref(LANG_KEY, "en")
  );

  const setLanguage = useCallback((code) => {
    if (!LANGUAGES.find((l) => l.code === code)) return;
    setLanguageState(code);
    writePref(LANG_KEY, code);
    document.documentElement.setAttribute("lang", code);
  }, []);

  /* ══════════════════════════════════════════════════════════
     NOTIFICATIONS
  ══════════════════════════════════════════════════════════ */
  const [notifPrefs, setNotifPrefs] = useState(() =>
    readPref(PREFS_KEY, { push: true, email: true })
  );

  const toggleNotif = useCallback((key) => {
    setNotifPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      writePref(PREFS_KEY, next);
      return next;
    });
  }, []);

  /* ══════════════════════════════════════════════════════════
     TOAST
  ══════════════════════════════════════════════════════════ */
  const [toast, setToast] = useState(null); // { type, msg } | null

  const showToast = useCallback((type, msg) => {
    if (!mountedRef.current) return;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, msg });
    toastTimer.current = setTimeout(() => {
      if (mountedRef.current) setToast(null);
    }, 3_500);
  }, []);

  /* ══════════════════════════════════════════════════════════
     LOGOUT
     ──────────────────────────────────────────────────────
     useSettings does NOT navigate directly.
     It exposes handleLogout(navigate) so DangerZone can
     pass its local navigate and App.jsx controls destination.

     Called from DangerZone:
       settings.handleLogout(navigate)
         → onLogout(navigate)        [App.jsx]
           → DELETE /api/users/me    [sets is_online = false]
           → clearAllAuthStorage()
           → setUser(null)
           → navigate("/auth")
  ══════════════════════════════════════════════════════════ */
  const handleLogout = useCallback(
    (navigateFn) => {
      if (typeof onLogout === "function") {
        onLogout(navigateFn);
      }
    },
    [onLogout]
  );

  /* ══════════════════════════════════════════════════════════
     DELETE ACCOUNT
     ──────────────────────────────────────────────────────
     The modal in DangerZone handles the full delete flow
     including the password input and confirm word.

     This hook only exposes a lightweight helper that cleans
     up and hands off to onLogout after a successful delete.

     The actual DELETE /api/settings/delete-account call is
     made inside DangerZone's DeleteAccountModal so it can
     manage its own loading / error / success states cleanly.

     handleDeleteSuccess(navigate) is called by DangerZone
     after the server confirms deletion:
       1. Clear auth storage locally
       2. Call onLogout(navigate) → navigate("/auth")
  ══════════════════════════════════════════════════════════ */
  const handleDeleteSuccess = useCallback(
    (navigateFn) => {
      clearAllAuthStorage();
      if (typeof onLogout === "function") {
        onLogout(navigateFn);
      }
    },
    [onLogout]
  );

  /* ══════════════════════════════════════════════════════════
     RETURN
  ══════════════════════════════════════════════════════════ */
  return {
    /* meta */
    user,
    onLogout,         // raw — DangerZone can call it directly if needed

    /* theme */
    theme,
    setTheme,
    THEMES,

    /* language */
    language,
    setLanguage,
    LANGUAGES,

    /* notifications */
    notifPrefs,
    toggleNotif,

    /* feedback */
    toast,
    showToast,

    /* logout — DangerZone calls handleLogout(navigate) */
    handleLogout,

    /* delete — DangerZone calls handleDeleteSuccess(navigate) */
    handleDeleteSuccess,
  };
}