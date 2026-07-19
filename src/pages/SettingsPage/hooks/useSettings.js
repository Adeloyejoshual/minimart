/**
 * src/pages/SettingsPage/hooks/useSettings.js
 *
 * Central hook for all settings state and actions.
 * Keeps logic out of the UI components.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

/* ─── Constants ─── */
const THEME_KEY  = "loemart_theme";
const LANG_KEY   = "loemart_lang";
const PREFS_KEY  = "loemart_notification_prefs";

const THEMES     = ["light", "dark", "system"];
const LANGUAGES  = [
  { code: "en", label: "English"  },
  { code: "yo", label: "Yorùbá"   },
  { code: "ha", label: "Hausa"    },
  { code: "ig", label: "Igbo"     },
  { code: "pcm", label: "Pidgin"  },
];

/* ─── Theme helpers ─── */
const getSystemTheme = () =>
  window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

const applyTheme = (theme) => {
  const resolved = theme === "system" ? getSystemTheme() : theme;
  document.documentElement.setAttribute("data-theme", resolved);
};

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

/* ═══════════════════════════════════════════════════════════════
   HOOK
═══════════════════════════════════════════════════════════════ */
export function useSettings({ user, onLogout } = {}) {
  const navigate = useNavigate();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  /* ── Theme ── */
  const [theme, setThemeState] = useState(
    () => readPref(THEME_KEY, "system")
  );

  const setTheme = useCallback((next) => {
    if (!THEMES.includes(next)) return;
    setThemeState(next);
    writePref(THEME_KEY, next);
    applyTheme(next);
  }, []);

  /* Apply theme on mount and when system preference changes */
  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  /* ── Language ── */
  const [language, setLanguageState] = useState(
    () => readPref(LANG_KEY, "en")
  );

  const setLanguage = useCallback((code) => {
    if (!LANGUAGES.find((l) => l.code === code)) return;
    setLanguageState(code);
    writePref(LANG_KEY, code);
    document.documentElement.setAttribute("lang", code);
  }, []);

  /* ── Notifications ── */
  const [notifPrefs, setNotifPrefs] = useState(() =>
    readPref(PREFS_KEY, {
      push  : true,
      email : true,
    })
  );

  const toggleNotif = useCallback((key) => {
    setNotifPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      writePref(PREFS_KEY, next);
      return next;
    });
  }, []);

  /* ── Feedback ── */
  const [toast, setToast] = useState(null); // { type: "success"|"error", msg }
  const toastTimer = useRef(null);

  const showToast = useCallback((type, msg) => {
    if (!mountedRef.current) return;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, msg });
    toastTimer.current = setTimeout(() => {
      if (mountedRef.current) setToast(null);
    }, 3_500);
  }, []);

  /* ── Delete account confirmation ── */
  const [deleteStep, setDeleteStep] = useState(0); // 0 idle 1 confirm 2 loading
  const [deleteInput, setDeleteInput] = useState("");

  const requestDeleteAccount = useCallback(() => {
    setDeleteStep(1);
    setDeleteInput("");
  }, []);

  const cancelDeleteAccount = useCallback(() => {
    setDeleteStep(0);
    setDeleteInput("");
  }, []);

  const confirmDeleteAccount = useCallback(async () => {
    if (deleteInput.trim().toLowerCase() !== "delete") {
      showToast("error", "Type DELETE to confirm.");
      return;
    }
    setDeleteStep(2);
    try {
      const token =
        localStorage.getItem("marketplace_token") ||
        localStorage.getItem("token");

      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/auth/delete-account`,
        {
          method  : "DELETE",
          headers : {
            Authorization  : `Bearer ${token}`,
            "Content-Type" : "application/json",
          },
        }
      );

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message ?? "Delete failed.");
      }

      /* Clear local data */
      localStorage.clear();
      sessionStorage.clear();
      onLogout?.();
      navigate("/", { replace: true });

    } catch (err) {
      if (mountedRef.current) {
        setDeleteStep(1);
        showToast("error", err.message ?? "Account deletion failed.");
      }
    }
  }, [deleteInput, navigate, onLogout, showToast]);

  /* ── Logout ── */
  const handleLogout = useCallback(() => {
    localStorage.clear();
    sessionStorage.clear();
    onLogout?.();
    navigate("/login", { replace: true });
  }, [navigate, onLogout]);

  return {
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
    /* delete */
    deleteStep,
    deleteInput,
    setDeleteInput,
    requestDeleteAccount,
    cancelDeleteAccount,
    confirmDeleteAccount,
    /* logout */
    handleLogout,
    /* user passthrough */
    user,
  };
}