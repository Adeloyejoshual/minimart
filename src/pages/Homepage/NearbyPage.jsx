// src/pages/Homepage/NearbyPage.jsx
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  memo,
} from "react";
import { useNavigate } from "react-router-dom";
import TopNav      from "../../components/TopNav";
import BottomNav   from "../../components/BottomNav";
import Footer      from "../../components/Footer";
import MasonryCard from "../../components/MasonryCard";
import "../../styles/NearbyPage.css";

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════ */
var BASE_URL  = import.meta.env.VITE_API_BASE_URL || window.location.origin;
var API       = BASE_URL + "/api";
var PAGE_SIZE = 40;
var GPS_KEY   = "loemart_gps";
var GPS_TTL   = 10 * 60000;
var GPS_OPTS  = { timeout: 6000, enableHighAccuracy: false, maximumAge: 300000 };

/* ══════════════════════════════════════════════════════════════
   SVG ICONS
══════════════════════════════════════════════════════════════ */
function IcoBack() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  );
}

function IcoGPS() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}

function IcoBell() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}

function IcoChevronUp() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 15l-6-6-6 6" />
    </svg>
  );
}

function IcoArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function IcoLocation() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IcoRefresh() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 4v6h-6" />
      <path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  );
}

function IcoLayers() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function IcoDone() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function IcoEmpty() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="11" cy="11" r="8" opacity="0.35" />
      <path d="M21 21l-4.35-4.35" opacity="0.35" />
      <path d="M8 11h6" strokeWidth="2" />
    </svg>
  );
}

function IcoError() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" opacity="0.25" />
      <path d="M12 8v4M12 16h.01" strokeWidth="2.5" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════
   GPS CACHE
══════════════════════════════════════════════════════════════ */
function readCachedGps() {
  try {
    var raw = sessionStorage.getItem(GPS_KEY);
    if (!raw) return null;
    var parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts < GPS_TTL) return parsed.coords;
  } catch (e) {}
  return null;
}

function writeCachedGps(coords) {
  try {
    sessionStorage.setItem(GPS_KEY, JSON.stringify({ coords: coords, ts: Date.now() }));
  } catch (e) {}
}

/* ══════════════════════════════════════════════════════════════
   NORMALIZE + DEDUP
══════════════════════════════════════════════════════════════ */
function normalizeProduct(p) {
  if (!p || typeof p !== "object" || !p.id) return null;
  var img = p.image || null;
  if (!img && Array.isArray(p.images) && p.images.length > 0) {
    img = typeof p.images[0] === "string" ? p.images[0] : (p.images[0] && p.images[0].url) || null;
  }
  if (!img) img = p.main_image || p.thumbnail_url || null;

  return Object.assign({}, p, {
    price: Number(p.price || 0),
    is_promoted: !!p.is_promoted,
    image: img,
    location_city: (p.location && p.location.city) || p.location_city || null,
    location_state: (p.location && p.location.state) || p.location_state || null,
  });
}

function dedup(arr) {
  var seen = {};
  var result = [];
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] && !seen[arr[i].id]) {
      seen[arr[i].id] = true;
      result.push(arr[i]);
    }
  }
  return result;
}

/* ══════════════════════════════════════════════════════════════
   FETCH
══════════════════════════════════════════════════════════════ */
function fetchNearbyPage(options) {
  var pg = (options && options.pageParam) || 0;
  var coords = (options && options.coords) || null;

  function makeParams(section) {
    var p = new URLSearchParams({ page: String(pg), limit: String(PAGE_SIZE) });
    if (section) p.set("section", section);
    if (coords) { p.set("lat", String(coords.lat)); p.set("lng", String(coords.lng)); }
    return p;
  }

  return fetch(API + "/homepage?" + makeParams("nearby").toString())
    .then(function (res) {
      if (!res.ok) throw new Error("fail");
      return res.json();
    })
    .then(function (data) {
      if (Array.isArray(data.products) && data.products.length > 0) return data;
      throw new Error("empty");
    })
    .catch(function () {
      return fetch(API + "/homepage?" + makeParams().toString())
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        });
    });
}

/* ══════════════════════════════════════════════════════════════
   useIsDesktop
══════════════════════════════════════════════════════════════ */
function useIsDesktop(bp) {
  var breakpoint = bp || 1024;
  var s = useState(function () { return window.innerWidth >= breakpoint; });
  var isDesktop = s[0]; var setDesktop = s[1];

  useEffect(function () {
    var mq = window.matchMedia("(min-width: " + breakpoint + "px)");
    function fn(e) { setDesktop(e.matches); }
    mq.addEventListener("change", fn);
    return function () { mq.removeEventListener("change", fn); };
  }, [breakpoint]);

  return isDesktop;
}

/* ══════════════════════════════════════════════════════════════
   SMALL SHARED COMPONENTS
══════════════════════════════════════════════════════════════ */
var CardWrap = memo(function CardWrap(props) {
  return (
    <div className={"nb-card-wrap" + (props.elite ? " nb-card-wrap--elite" : "")}>
      <MasonryCard product={props.product} priority={props.priority}
        onView={props.onView} onClick={props.onClick} />
    </div>
  );
});

function Toast(props) {
  if (!props.count || props.count <= 0) return null;
  return (
    <button className={props.elite ? "elite-toast" : "nb-toast"} onClick={props.onDismiss} aria-live="polite">
      <span className={props.elite ? "elite-toast-dot" : "nb-toast-dot"} aria-hidden="true" />
      <IcoBell />
      {props.count} new listing{props.count !== 1 ? "s" : ""} — tap to refresh
    </button>
  );
}

function ScrollTop(props) {
  var vs = useState(false); var visible = vs[0]; var setVisible = vs[1];
  useEffect(function () {
    function fn() { setVisible(window.scrollY > 320); }
    window.addEventListener("scroll", fn, { passive: true });
    return function () { window.removeEventListener("scroll", fn); };
  }, []);

  return (
    <button
      className={(props.elite ? "elite-scroll-top" : "nb-scroll-top") + (visible ? " visible" : "")}
      onClick={function () { window.scrollTo({ top: 0, behavior: "smooth" }); }}
      aria-label="Scroll to top"
    >
      <IcoChevronUp />
    </button>
  );
}

function Empty(props) {
  return (
    <div className={props.elite ? "elite-empty" : "nb-empty"} role="status">
      <span className={props.elite ? "elite-empty-icon" : "nb-empty-icon"}>
        <IcoEmpty />
      </span>
      <h3 className={props.elite ? "elite-empty-title" : "nb-empty-title"}>
        {props.gpsStatus === "denied" ? "Location access denied" : "No nearby listings found"}
      </h3>
      <p className={props.elite ? "elite-empty-sub" : "nb-empty-sub"}>
        {props.gpsStatus === "denied"
          ? "We couldn't detect your location. Showing listings from across Nigeria."
          : "There are no listings in your area yet. More sellers joining daily!"}
      </p>
      <button className={props.elite ? "elite-empty-btn" : "nb-empty-btn"} onClick={props.onBrowse}>
        Browse All Listings
      </button>
    </div>
  );
}

function ErrBanner(props) {
  return (
    <div className={props.elite ? "elite-err" : "nb-err"} role="alert">
      <span className={props.elite ? "elite-err-icon" : "nb-err-icon"}>
        <IcoError />
      </span>
      <p className={props.elite ? "elite-err-title" : "nb-err-title"}>Could not load listings</p>
      <p className={props.elite ? "elite-err-msg" : "nb-err-msg"}>{props.message}</p>
      <button className={props.elite ? "elite-err-btn" : "nb-err-btn"} onClick={props.onRetry}>Try again</button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MOBILE COMPONENTS
══════════════════════════════════════════════════════════════ */
var MobHeader = memo(function MobHeader(props) {
  var chipText = "Locating...";
  var chipCls  = "nb-chip--pending";
  if (props.gps === "gps")    { chipText = "GPS Live"; chipCls = "nb-chip--gps"; }
  if (props.gps === "denied") { chipText = "Manual";   chipCls = "nb-chip--manual"; }

  return (
    <div className="nb-header">
      <button className="nb-back" onClick={props.onBack} aria-label="Go back"><IcoBack /></button>
      <div className="nb-title-wrap">
        <h1 className="nb-title">Near You</h1>
        <span className={"nb-chip " + chipCls}>
          {props.gps === "pending" && <span className="nb-chip-spin" aria-hidden="true" />}
          {props.gps === "gps" && <span className="nb-chip-dot" aria-hidden="true" />}
          {chipText}
        </span>
      </div>
      {props.gps === "denied" && (
        <button className="nb-gps-btn" onClick={props.onGps} aria-label="Enable GPS">
          <IcoGPS /> Enable GPS
        </button>
      )}
    </div>
  );
});

var MobLocBanner = memo(function MobLocBanner(props) {
  if (!props.label) return null;
  return (
    <div className="nb-loc-banner" role="status" aria-live="polite">
      <div className="nb-loc-left">
        <span className="nb-loc-icon" aria-hidden="true">{props.gps === "gps" ? "📡" : "📍"}</span>
        <div className="nb-loc-text">
          <span className="nb-loc-label">Showing listings near</span>
          <strong className="nb-loc-place">{props.label}</strong>
        </div>
      </div>
      {props.count > 0 && (
        <span className="nb-loc-count">{props.count.toLocaleString()} listing{props.count !== 1 ? "s" : ""}</span>
      )}
    </div>
  );
});

var MobGpsPrompt = memo(function MobGpsPrompt(props) {
  return (
    <div className="nb-gps-prompt" role="dialog" aria-label="Enable location">
      <div className="nb-gps-prompt-icon" aria-hidden="true">📍</div>
      <div className="nb-gps-prompt-body">
        <h3 className="nb-gps-prompt-title">See listings near you</h3>
        <p className="nb-gps-prompt-sub">Allow location access to find deals closest to you first.</p>
      </div>
      <div className="nb-gps-prompt-actions">
        <button className="nb-gps-prompt-allow" onClick={props.onAllow}>Allow Location</button>
        <button className="nb-gps-prompt-skip" onClick={props.onSkip}>Maybe later</button>
      </div>
    </div>
  );
});

var SKEL_H = [240, 300, 220, 280, 260, 230, 310, 250, 270, 240];
var Skeleton = memo(function Skeleton() {
  return (
    <>
      <div className="nb-sk nb-sk-banner nb-shimmer" aria-hidden="true" />
      <div className="nb-masonry" aria-busy="true">
        {SKEL_H.map(function (h, i) {
          return <div key={i} className="nb-sk nb-shimmer" style={{ height: h }} aria-hidden="true" />;
        })}
      </div>
    </>
  );
});

/* ══════════════════════════════════════════════════════════════
   DESKTOP COMPONENTS
══════════════════════════════════════════════════════════════ */
var DeskTopBar = memo(function DeskTopBar(props) {
  var time = null;
  if (props.updated) {
    time = new Date(props.updated).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="elite-topbar">
      <div className="elite-topbar-left">
        <nav className="elite-bc" aria-label="Breadcrumb">
          <span className="elite-bc-home">Home</span>
          <span className="elite-bc-sep">›</span>
          <span className="elite-bc-cur">Near You</span>
        </nav>
        {props.locLabel && (
          <span className="elite-loc"><IcoLocation />{props.locLabel}</span>
        )}
        {props.total > 0 && (
          <span className="elite-count">{props.total.toLocaleString()} listings</span>
        )}
        {time && (
          <span className="elite-updated">
            <span className="elite-pulse" aria-hidden="true" />
            Updated {time}
          </span>
        )}
      </div>
      <div className="elite-topbar-right">
        <button className="elite-refresh-btn" onClick={props.onRefresh}>
          <IcoRefresh /> Refresh
        </button>
      </div>
    </div>
  );
});

var DeskSidebar = memo(function DeskSidebar(props) {
  return (
    <aside className="elite-sidebar">
      <div className="elite-brand">
        <div className="elite-brand-icon"><IcoLayers /></div>
        <div>
          <span className="elite-brand-name">Loemart</span>
          <span className="elite-brand-sub">Nearby</span>
        </div>
      </div>

      <div className="elite-live">
        <div className="elite-live-pulse" aria-hidden="true" />
        <div>
          <span className="elite-live-num">{props.total != null ? props.total.toLocaleString() : "—"}</span>
          <span className="elite-live-label">listings near you</span>
        </div>
      </div>

      <button className="elite-side-btn" onClick={props.onRefresh}>
        <IcoRefresh /> Refresh Feed
      </button>

      <button className="elite-side-btn elite-side-btn--ghost" onClick={props.onBack}>
        <IcoBack /> All Listings
      </button>
    </aside>
  );
});

/* ══════════════════════════════════════════════════════════════
   FEED END
══════════════════════════════════════════════════════════════ */
function FeedEnd(props) {
  if (props.elite) {
    return (
      <div className="elite-feed-end">
        <div className="elite-feed-end-line" />
        <div className="elite-feed-end-center">
          <span className="elite-feed-end-icon"><IcoDone /></span>
          <p className="elite-feed-end-text">You&apos;ve seen all nearby listings</p>
          <button className="elite-feed-end-btn" onClick={props.onBrowse}>
            Browse all <IcoArrowRight />
          </button>
        </div>
        <div className="elite-feed-end-line" />
      </div>
    );
  }
  return (
    <div className="nb-feed-end-wrap">
      <p className="nb-feed-end">You&apos;ve seen all nearby listings</p>
      <button className="nb-feed-end-btn" onClick={props.onBrowse}>
        Browse all <IcoArrowRight />
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════════════ */
export default function NearbyPage(props) {
  var user = props.user;
  var navigate = useNavigate();
  var isDesktop = useIsDesktop();

  /* GPS */
  var cs = useState(function () { return readCachedGps(); });
  var coords = cs[0]; var setCoords = cs[1];

  var gs = useState(function () { return readCachedGps() ? "gps" : "pending"; });
  var gpsStatus = gs[0]; var setGpsStatus = gs[1];

  var ps = useState(false);
  var showPrompt = ps[0]; var setShowPrompt = ps[1];

  var gpsAttempted = useRef(false);

  var requestGps = useCallback(function () {
    if (!navigator.geolocation) { setGpsStatus("denied"); return; }
    setGpsStatus("pending");
    setShowPrompt(false);
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        var c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        writeCachedGps(c);
        setCoords(c);
        setGpsStatus("gps");
      },
      function () { setGpsStatus("denied"); },
      GPS_OPTS
    );
  }, []);

  useEffect(function () {
    if (gpsAttempted.current || coords) return;
    gpsAttempted.current = true;
    if (!navigator.geolocation) { setGpsStatus("denied"); return; }
    setShowPrompt(true);
    var t = setTimeout(requestGps, 800);
    return function () { clearTimeout(t); };
  }, [coords, requestGps]);

  /* Data */
  var d1 = useState([]); var products = d1[0]; var setProducts = d1[1];
  var d2 = useState({}); var meta = d2[0]; var setMeta = d2[1];
  var d3 = useState(true); var loading = d3[0]; var setLoading = d3[1];
  var d4 = useState(false); var loadingMore = d4[0]; var setLoadingMore = d4[1];
  var d5 = useState(null); var error = d5[0]; var setError = d5[1];
  var d6 = useState(false); var hasMore = d6[0]; var setHasMore = d6[1];
  var d7 = useState(0); var page = d7[0]; var setPage = d7[1];

  var productsRef = useRef([]);
  var sentinelRef = useRef(null);

  var load = useCallback(function (pg, append) {
    return fetchNearbyPage({ pageParam: pg || 0, coords: coords })
      .then(function (data) {
        var raw = Array.isArray(data.products) ? data.products : [];
        var normalized = dedup(raw).map(normalizeProduct).filter(Boolean);
        var merged = append ? dedup(productsRef.current.concat(normalized)) : normalized;
        productsRef.current = merged;
        setProducts(merged);
        setMeta(data.meta || {});
        var more = data.hasMore != null ? data.hasMore
          : (data.meta && data.meta.has_more != null) ? data.meta.has_more
          : raw.length >= PAGE_SIZE;
        setHasMore(more);
      })
      .catch(function (err) {
        if (!append) setError(err.message || "Could not load listings.");
      });
  }, [coords]);

  useEffect(function () {
    setLoading(true); setError(null); setPage(0);
    productsRef.current = [];
    load(0, false).finally(function () { setLoading(false); });
  }, [load]);

  var loadMore = useCallback(function () {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    var next = page + 1;
    load(next, true)
      .then(function () { setPage(next); })
      .finally(function () { setLoadingMore(false); });
  }, [loadingMore, hasMore, page, load]);

  useEffect(function () {
    var el = sentinelRef.current;
    if (!el || !hasMore) return;
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) loadMore();
    }, { threshold: 0.1 });
    io.observe(el);
    return function () { io.disconnect(); };
  }, [hasMore, loadingMore, loadMore]);

  var locLabel = useMemo(function () {
    if (meta && meta.location) return meta.location;
    if (products.length > 0) {
      var p = products[0];
      var c = p.location_city || (p.location && p.location.city);
      var s = p.location_state || (p.location && p.location.state);
      return [c, s].filter(Boolean).join(", ") || null;
    }
    return null;
  }, [meta, products]);

  var total = (meta && meta.total != null) ? meta.total : products.length;

  var trackView = useCallback(function (id) {
    if (!id) return;
    fetch(API + "/products/" + id + "/view", { method: "POST", keepalive: true }).catch(function () {});
  }, []);

  var handleClick = useCallback(function (product) {
    if (!product || !product.id) return;
    fetch(API + "/products/" + product.id + "/click", { method: "POST", keepalive: true }).catch(function () {});
    navigate("/product/" + (product.slug || product.id));
  }, [navigate]);

  var handleRetry = useCallback(function () {
    setError(null); setLoading(true); productsRef.current = [];
    load(0, false).finally(function () { setLoading(false); });
  }, [load]);

  var handleRefresh = useCallback(function () {
    setLoading(true); productsRef.current = [];
    load(0, false).finally(function () { setLoading(false); });
  }, [load]);

  function goHome() { navigate("/"); }
  function goBack() { navigate(-1); }

  /* Grid */
  function Grid(gp) {
    var elite = gp.elite || false;
    return (
      <>
        <div className={"nb-masonry" + (elite ? " nb-masonry--desktop" : "")} role="list" aria-label="Nearby listings">
          {products.map(function (p, i) {
            return (
              <div key={p.id} role="listitem">
                <CardWrap product={p} priority={i < (elite ? 8 : 6)} onView={trackView} onClick={handleClick} elite={elite} />
              </div>
            );
          })}
        </div>
        <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />
        {loadingMore && (
          <div className={elite ? "elite-loading-more" : "nb-loading-more"} aria-live="polite">
            {elite
              ? <div className="elite-dots"><span /><span /><span /></div>
              : <span className="nb-spinner" aria-hidden="true" />}
            Loading more...
          </div>
        )}
        {!hasMore && products.length > 0 && (
          <FeedEnd elite={elite} onBrowse={goHome} />
        )}
      </>
    );
  }

  /* ══════════════════════ DESKTOP ══════════════════════ */
  if (isDesktop) {
    return (
      <div className="nb-root nb-root--elite">
        <TopNav user={user} />
        <Toast count={0} onDismiss={handleRefresh} elite />
        <div className="elite-layout">
          <DeskSidebar onBack={goHome} total={total} onRefresh={handleRefresh} />
          <main className="elite-main" id="nb-main">
            <DeskTopBar locLabel={locLabel} total={total} updated={Date.now()} onRefresh={handleRefresh} />
            {error && <ErrBanner message={error} onRetry={handleRetry} elite />}
            {loading && <Skeleton />}
            {!loading && !error && products.length === 0 && (
              <Empty gpsStatus={gpsStatus} onBrowse={goHome} elite />
            )}
            {!loading && products.length > 0 && <Grid elite />}
            {!loading && <Footer />}
          </main>
        </div>
        <ScrollTop elite />
      </div>
    );
  }

  /* ══════════════════════ MOBILE ══════════════════════ */
  return (
    <div className="nb-root">
      <TopNav user={user} />
      <Toast count={0} onDismiss={handleRefresh} />
      <main className="nb-page" id="nb-main">
        <MobHeader gps={gpsStatus} onBack={goBack} onGps={requestGps} />

        {showPrompt && gpsStatus === "pending" && (
          <MobGpsPrompt
            onAllow={function () { setShowPrompt(false); requestGps(); }}
            onSkip={function () { setShowPrompt(false); setGpsStatus("denied"); }}
          />
        )}

        {!loading && locLabel && (
          <MobLocBanner label={locLabel} gps={gpsStatus} count={total} />
        )}

        {error && <ErrBanner message={error} onRetry={handleRetry} />}
        {loading && <Skeleton />}
        {!loading && !error && products.length === 0 && (
          <Empty gpsStatus={gpsStatus} onBrowse={goHome} />
        )}
        {!loading && products.length > 0 && <Grid />}
        {!loading && <Footer />}
      </main>
      <ScrollTop />
      <BottomNav />
    </div>
  );
}