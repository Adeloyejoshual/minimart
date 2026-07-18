// src/utils/syncFavourites.js

const FAV_KEY = "loemart_favs";

const loadFavs = () => {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || "{}"); }
  catch { return {}; }
};

const saveFavs = (f) => {
  try { localStorage.setItem(FAV_KEY, JSON.stringify(f)); } catch {}
};

/**
 * Called on LOGIN — pulls saved IDs from DB and merges into localStorage.
 * Any items saved as guest are also pushed up to the DB.
 */
export const syncFavouritesOnLogin = async (token, userId) => {
  if (!token || !userId) return;

  const BASE_URL = import.meta.env.VITE_API_BASE_URL;

  try {
    /* Step 1 — fetch all saved IDs from DB for this user */
    const res = await fetch(`${BASE_URL}/api/favorites/ids`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return;
    const { ids: dbIds = [] } = await res.json();

    /* Step 2 — get current localStorage favs (may be from guest or old user) */
    const localFavs = loadFavs();

    /* Step 3 — build fresh object with ONLY this user's DB items */
    const merged = {};
    dbIds.forEach((id) => { merged[id] = true; });

    /* Step 4 — find guest items not yet in DB and push them up */
    const localIds    = Object.keys(localFavs);
    const dbIdSet     = new Set(dbIds);
    const guestOnly   = localIds.filter((id) => !dbIdSet.has(id));

    if (guestOnly.length > 0) {
      /* Push guest saves to DB in background — don't await */
      Promise.allSettled(
        guestOnly.map((productId) =>
          fetch(`${BASE_URL}/api/favorites/${productId}`, {
            method  : "POST",
            headers : {
              "Content-Type"  : "application/json",
              Authorization   : `Bearer ${token}`,
            },
          }).then((r) => {
            /* If save succeeded, add to merged */
            if (r.ok) merged[productId] = true;
          })
        )
      );
    }

    /* Step 5 — overwrite localStorage with this user's items only */
    saveFavs(merged);

  } catch {
    /* Non-critical — silently ignore */
  }
};

/**
 * Called on LOGOUT — clears localStorage favs completely.
 * Prevents bleed-over to next user on same device.
 */
export const clearFavouritesOnLogout = () => {
  try {
    localStorage.removeItem(FAV_KEY);
  } catch {}
};