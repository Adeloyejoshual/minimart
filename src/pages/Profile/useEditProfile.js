// src/pages/Profile/useEditProfile.js

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import imageCompression from "browser-image-compression";

// ═══════════════════════════════════════════════════════════════
// AXIOS INSTANCE
// ═══════════════════════════════════════════════════════════════
const BASE = import.meta.env.VITE_API_BASE_URL || window.location.origin;

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") || null;

export const api = axios.create({ baseURL: `${BASE}/api/edit-profile` });
api.interceptors.request.use((cfg) => {
  const t = getToken();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
export const MAX_BIO        = 200;
export const MAX_STORE_DESC = 300;
export const MAX_FILE       = 5 * 1024 * 1024;
export const MIN_IMG        = 100;

const DRAFT_KEY      = "ep_draft";
const DRAFT_DEBOUNCE = 500;

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
export function classifyError(err) {
  if (!err.response) {
    if (err.code === "ECONNABORTED" || err.message?.includes("timeout"))
      return "Request timed out. Check your connection.";
    return "Network error. Check your internet connection.";
  }
  const s = err.response.status, m = err.response.data?.message;
  if (s === 413) return "File is too large. Try a smaller image.";
  if (s === 415) return "File type not supported. Use JPG, PNG or WebP.";
  if (s === 401) return "Session expired. Please log in again.";
  if (s === 409) return m || "That value is already taken.";
  if (s === 422) return m || "Validation error. Check your inputs.";
  if (s === 429) return m || "Please wait before trying again.";
  if (s >= 500)  return "Server error. Please try again shortly.";
  return m || `Unexpected error (${s}).`;
}

export function fmtPhone(raw = "") {
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+234")) d = "0" + d.slice(4);
  if (d.startsWith("0") && d.length <= 11) {
    const r = d.slice(1);
    if (r.length <= 3) return `0${r}`;
    if (r.length <= 6) return `0${r.slice(0,3)} ${r.slice(3)}`;
    return `0${r.slice(0,3)} ${r.slice(3,6)} ${r.slice(6,10)}`;
  }
  if (d.startsWith("+")) {
    const cc = d.slice(0,4), r = d.slice(4);
    if (r.length <= 3) return `${cc} ${r}`;
    if (r.length <= 6) return `${cc} ${r.slice(0,3)} ${r.slice(3)}`;
    return `${cc} ${r.slice(0,3)} ${r.slice(3,6)} ${r.slice(6,10)}`;
  }
  return d;
}
export const stripPhone = (v = "") => v.replace(/\s/g, "");

export function checkDimensions(file) {
  return new Promise((res, rej) => {
    const u = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(u);
      img.width < MIN_IMG || img.height < MIN_IMG
        ? rej(new Error(`Image must be at least ${MIN_IMG}×${MIN_IMG} px (yours is ${img.width}×${img.height}).`))
        : res();
    };
    img.onerror = () => { URL.revokeObjectURL(u); rej(new Error("Could not read image file.")); };
    img.src = u;
  });
}
export async function compress(file) {
  try {
    return await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1200,
      useWebWorker: true,
      fileType: "image/jpeg",
    });
  } catch { return file; }
}

let _dt = null;
function saveDraft(data) {
  clearTimeout(_dt);
  _dt = setTimeout(() => {
    try {
      const ex = (() => {
        try { const r = localStorage.getItem(DRAFT_KEY); return r ? JSON.parse(r).data || {} : {}; }
        catch { return {}; }
      })();
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ data: { ...ex, ...data }, ts: Date.now() }));
    } catch {}
  }, DRAFT_DEBOUNCE);
}
function loadDraft() {
  try {
    const r = localStorage.getItem(DRAFT_KEY);
    if (!r) return null;
    const { data, ts } = JSON.parse(r);
    if (Date.now() - ts > 86400000) { localStorage.removeItem(DRAFT_KEY); return null; }
    return data;
  } catch { return null; }
}
function clearDraft() { clearTimeout(_dt); localStorage.removeItem(DRAFT_KEY); }

/* Shared username availability cache */
export const unCache = new Map();

// ═══════════════════════════════════════════════════════════════
// MAIN HOOK — all state, effects, and handlers
// ═══════════════════════════════════════════════════════════════
export function useEditProfile({ onProfileUpdate, push, flashSaved }) {
  const nav = useNavigate();
  const savingRef = useRef(false);

  // Form
  const [orig, setOrig] = useState(null);
  const [form, setForm] = useState({
    name:"", username:"", email:"", email_verified:false, phone:"", bio:"",
    profile_image:"", store_logo:"", location_state:"", location_city:"",
    store_name:"", store_description:"", store_category:"", business_hours:{},
  });
  const [errors, setErrors] = useState({});
  const [dirty,  setDirty]  = useState(false);

  // Username
  const [cooldown, setCooldown] = useState(null);
  const [usernameStatus, setUsernameStatus] = useState("idle");

  // Images
  const [ppv, setPpv] = useState("");
  const [spv, setSpv] = useState("");
  const [upl, setUpl] = useState("");
  const [uplPct, setUplPct] = useState(0);
  const [uplPh, setUplPh] = useState("uploading");

  // Retry
  const [failUp, setFailUp] = useState(null);
  const [showRetry, setShowRetry] = useState(false);

  // Crop
  const [cropSrc, setCropSrc] = useState(null);
  const [cropTgt, setCropTgt] = useState("");

  // UI
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);
  const [pendingDiscard, setPendingDiscard] = useState(null);

  // Object URLs
  const urlsRef = useRef([]);
  const mkUrl = useCallback(b => { const u = URL.createObjectURL(b); urlsRef.current.push(u); return u; }, []);
  const rmUrl = useCallback(u => {
    if (!u?.startsWith("blob:")) return;
    URL.revokeObjectURL(u);
    urlsRef.current = urlsRef.current.filter(x => x !== u);
  }, []);
  useEffect(() => () => { urlsRef.current.forEach(URL.revokeObjectURL); }, []);

  // ── Fetch profile
  useEffect(() => {
    if (!getToken()) { nav("/auth"); return; }
    (async () => {
      try {
        setLoading(true);
        const { data } = await api.get("/me");
        const init = {
          name:              data.name || "",
          username:          data.username || "",
          email:             data.email || "",
          email_verified:    data.email_verified ?? false,
          phone:             data.phone ? fmtPhone(data.phone) : "",
          bio:               data.bio || "",
          profile_image:     data.profile_image || "",
          store_logo:        data.store_logo || "",
          location_state:    data.location?.state || data.location_state || "",
          location_city:     data.location?.city  || data.location_city  || "",
          store_name:        data.store_name || "",
          store_description: data.store_description || "",
          store_category:    data.store_category || "",
          business_hours:    data.business_hours || {},
        };
        setOrig(init);
        setCooldown(data.username_cooldown ?? null);

        const dr = loadDraft();
        if (dr) { setForm({ ...init, ...dr }); setHasDraft(true); setDirty(true); }
        else setForm(init);
      } catch (e) {
        if (e.response?.status === 401) nav("/auth");
        else push(classifyError(e), "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [nav, push]);

  // ── onChange
  const onChange = useCallback((k, v) => {
    setForm(p => {
      const n = { ...p, [k]: v };
      if (["bio","store_description","store_name","name","phone","username"].includes(k)) {
        saveDraft({ [k]: v });
      }
      return n;
    });
    setErrors(p => ({ ...p, [k]: "" }));
    setDirty(true);
  }, []);

  const dismissDraft = useCallback(() => {
    clearDraft();
    setForm(orig);
    setHasDraft(false);
    setDirty(false);
  }, [orig]);

  // ── Image pick
  const pickImg = useCallback(async (file, tgt) => {
    if (file.size > MAX_FILE) { push("Image must be under 5 MB.", "error"); return; }
    try { await checkDimensions(file); } catch (e) { push(e.message, "error"); return; }
    const c = await compress(file);
    const rd = new FileReader();
    rd.onload = e => { setCropSrc(e.target.result); setCropTgt(tgt); };
    rd.readAsDataURL(c);
  }, [push]);

  // ── Upload
  const doUpload = useCallback(async (blob, tgt, existUrl) => {
    setUpl(tgt); setUplPct(0); setUplPh("uploading");
    const pUrl = existUrl || mkUrl(blob);
    if (tgt === "profile") setPpv(old => { if (old !== pUrl) rmUrl(old); return pUrl; });
    else setSpv(old => { if (old !== pUrl) rmUrl(old); return pUrl; });

    try {
      const fd = new FormData();
      fd.append("image", blob, "avatar.jpg");
      const oldUrl = tgt === "profile" ? form.profile_image : form.store_logo;
      if (oldUrl) fd.append("old_url", oldUrl);

      const { data } = await api.post("/upload/image", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: ev => {
          if (ev.total) {
            const p = Math.round(ev.loaded / ev.total * 100);
            setUplPct(p);
            if (p === 100) setUplPh("processing");
          }
        },
      });

      setUplPh("saving");
      if (!data.url) throw new Error("No URL returned");
      onChange(tgt === "profile" ? "profile_image" : "store_logo", data.url);
      setFailUp(null);
      push("Photo uploaded ✔");
    } catch (e) {
      const msg = classifyError(e);
      setFailUp({ blob, target: tgt, errorMsg: msg, previewUrl: pUrl });
      setShowRetry(true);
      if (tgt === "profile") setPpv(""); else setSpv("");
    } finally {
      setUpl(""); setUplPct(0); setUplPh("uploading");
    }
  }, [mkUrl, rmUrl, onChange, push, form.profile_image, form.store_logo]);

  const onCropOk    = useCallback(async b => { setCropSrc(null); await doUpload(b, cropTgt, null); }, [cropTgt, doUpload]);
  const retryUp     = useCallback(async () => { setShowRetry(false); if (!failUp) return; await doUpload(failUp.blob, failUp.target, failUp.previewUrl); }, [failUp, doUpload]);
  const cancelRetry = useCallback(() => { setShowRetry(false); if (failUp?.previewUrl) rmUrl(failUp.previewUrl); setFailUp(null); }, [failUp, rmUrl]);

  const rmProfile = useCallback(() => {
    const sv = form.profile_image, sp = ppv;
    rmUrl(ppv); setPpv(""); onChange("profile_image", "");
    push("Profile photo removed.", "info", {
      duration: 5000,
      action: { label: "Undo", onClick: () => { setPpv(sp); onChange("profile_image", sv); } },
    });
  }, [form.profile_image, ppv, rmUrl, onChange, push]);

  const rmStore = useCallback(() => {
    const sv = form.store_logo, sp = spv;
    rmUrl(spv); setSpv(""); onChange("store_logo", "");
    push("Store logo removed.", "info", {
      duration: 5000,
      action: { label: "Undo", onClick: () => { setSpv(sp); onChange("store_logo", sv); } },
    });
  }, [form.store_logo, spv, rmUrl, onChange, push]);

  // ── Validate
  const validate = useCallback(() => {
    const e = {};
    if (!form.name.trim())          e.name = "Name is required";
    else if (form.name.trim().length < 2) e.name = "At least 2 characters";
    if (form.username && !/^[a-z0-9_]{3,20}$/.test(form.username)) e.username = "3–20 chars: letters, numbers, underscores";

    const rp = stripPhone(form.phone);
    if (rp && !/^\+?\d{7,15}$/.test(rp)) e.phone = "Enter a valid phone number";
    if ((form.bio?.length||0) > MAX_BIO) e.bio = `Max ${MAX_BIO} characters`;
    if ((form.store_description?.length||0) > MAX_STORE_DESC) e.store_description = `Max ${MAX_STORE_DESC} characters`;

    if (cooldown && !cooldown.can_change &&
        form.username && form.username !== orig?.username) {
      e.username = `Available in ${cooldown.days_left} day${cooldown.days_left !== 1 ? "s" : ""}`;
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }, [form, cooldown, orig?.username]);

  const getChanged = useCallback(() => {
    if (!orig) return {};
    const ch = {};
    for (const k of Object.keys(form)) {
      if (k === "email" || k === "email_verified") continue;
      const ov = k === "phone" ? stripPhone(orig[k]||"") : JSON.stringify(orig[k]);
      const cv = k === "phone" ? stripPhone(form[k]||"") : JSON.stringify(form[k]);
      if (ov !== cv) {
        if (k === "phone") ch.phone = stripPhone(form[k]);
        else if (k === "location_state" || k === "location_city") {
          if (!ch.location) ch.location = { state: form.location_state, city: form.location_city };
        }
        else ch[k] = form[k];
      }
    }
    delete ch.location_state;
    delete ch.location_city;
    return ch;
  }, [form, orig]);

  const unBlocking = useMemo(() => {
    if (!form.username || form.username === orig?.username) return false;
    if (cooldown && !cooldown.can_change) return true;
    return usernameStatus === "checking" ||
           usernameStatus === "taken"    ||
           usernameStatus === "locked";
  }, [form.username, orig?.username, cooldown, usernameStatus]);

  const saveDisabled = saving || !!upl || !dirty || unBlocking;

  const save = useCallback(async () => {
    if (savingRef.current) return;
    if (unBlocking) {
      const isLocked = cooldown && !cooldown.can_change &&
                       form.username && form.username !== orig?.username;
      push(
        isLocked
          ? "Username locked. Change back or wait 30 days."
          : usernameStatus === "taken"
            ? `"${form.username}" is already taken.`
            : "Still checking username, please wait…",
        "error"
      );
      return;
    }
    if (!validate()) { push("Fix the errors below.", "error"); return; }

    const ch = getChanged();
    if (!Object.keys(ch).length) { flashSaved(); setDirty(false); return; }

    const prevF = { ...form }, prevO = orig ? { ...orig } : null;
    savingRef.current = true;
    setSaving(true);
    setDirty(false);
    setOrig(p => ({ ...p, ...form }));

    try {
      const { data } = await api.patch("/me", ch, {
        headers: { "Content-Type": "application/json" },
      });

      if (data?.username_cooldown) setCooldown(data.username_cooldown);

      setPpv(old => { rmUrl(old); return ""; });
      setSpv(old => { rmUrl(old); return ""; });
      clearDraft();
      setHasDraft(false);
      flashSaved();

      onProfileUpdate?.({
        name:            form.name,
        profile_image:   form.profile_image,
        username:        form.username,
        store_name:      form.store_name,
        email_verified:  form.email_verified,
      });
    } catch (e) {
      setForm(prevF);
      setOrig(prevO);
      setDirty(true);

      if (e.response?.data?.username_cooldown) {
        setCooldown(e.response.data.username_cooldown);
      }

      const se = e.response?.data?.errors;
      if (se) setErrors(se);
      push(classifyError(e), "error");
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  }, [
    unBlocking, cooldown, form, orig, usernameStatus,
    validate, getChanged, push, flashSaved, rmUrl, onProfileUpdate,
  ]);

  const reqDiscard = useCallback(fn => {
    if (!dirty) { fn?.(); return; }
    setPendingDiscard(() => fn || null);
    setShowDiscard(true);
  }, [dirty]);

  const doDiscard = useCallback(() => {
    setShowDiscard(false);
    if (!orig) return;
    setForm(orig);
    setErrors({});
    setDirty(false);
    rmUrl(ppv); rmUrl(spv);
    setPpv(""); setSpv("");
    clearDraft();
    setHasDraft(false);
    pendingDiscard?.();
    setPendingDiscard(null);
  }, [orig, ppv, spv, rmUrl, pendingDiscard]);

  const cancelDiscard = useCallback(() => {
    setShowDiscard(false);
    setPendingDiscard(null);
  }, []);

  // Keyboard
  useEffect(() => {
    const h = e => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (!saveDisabled) save();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [saveDisabled, save]);

  useEffect(() => {
    const h = e => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  return {
    /* state */
    form, orig, errors, dirty, cooldown, usernameStatus,
    ppv, spv, upl, uplPct, uplPh,
    failUp, showRetry, cropSrc, cropTgt,
    loading, saving, hasDraft, showDiscard,
    saveDisabled, unBlocking,

    /* setters */
    setUsernameStatus, setCropSrc,

    /* actions */
    nav,
    onChange, dismissDraft,
    pickImg, doUpload, onCropOk, retryUp, cancelRetry,
    rmProfile, rmStore,
    save, reqDiscard, doDiscard, cancelDiscard,
  };
}