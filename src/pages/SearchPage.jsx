<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Search API Tester</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: system-ui, sans-serif;
      background: #f5f5f5;
      padding: 24px;
      color: #333;
    }

    h1 {
      font-size: 20px;
      margin-bottom: 20px;
      color: #111;
    }

    .card {
      background: #fff;
      border-radius: 10px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.1);
    }

    .row {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }

    input, select {
      padding: 9px 12px;
      border: 1px solid #ddd;
      border-radius: 7px;
      font-size: 14px;
      flex: 1;
      min-width: 140px;
      outline: none;
    }

    input:focus, select:focus {
      border-color: #4f46e5;
    }

    button {
      padding: 9px 20px;
      border: none;
      border-radius: 7px;
      font-size: 14px;
      cursor: pointer;
      font-weight: 600;
    }

    .btn-primary {
      background: #4f46e5;
      color: #fff;
    }

    .btn-primary:hover { background: #4338ca; }

    .btn-secondary {
      background: #e5e7eb;
      color: #333;
    }

    .btn-secondary:hover { background: #d1d5db; }

    .btn-danger {
      background: #ef4444;
      color: #fff;
    }

    /* Status badges */
    .badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }

    .badge-green  { background: #d1fae5; color: #065f46; }
    .badge-red    { background: #fee2e2; color: #991b1b; }
    .badge-yellow { background: #fef9c3; color: #854d0e; }
    .badge-blue   { background: #dbeafe; color: #1e40af; }

    /* Stats row */
    .stats {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }

    .stat {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 10px 16px;
      text-align: center;
      min-width: 100px;
    }

    .stat-value {
      font-size: 22px;
      font-weight: 700;
      color: #4f46e5;
    }

    .stat-label {
      font-size: 11px;
      color: #6b7280;
      margin-top: 2px;
    }

    /* Product grid */
    .products-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 14px;
    }

    .product-card {
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
      transition: box-shadow 0.2s;
    }

    .product-card:hover {
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }

    .product-img {
      width: 100%;
      height: 130px;
      object-fit: cover;
      background: #f3f4f6;
      display: block;
    }

    .product-img-placeholder {
      width: 100%;
      height: 130px;
      background: linear-gradient(135deg, #e5e7eb, #f3f4f6);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
    }

    .product-body {
      padding: 10px;
    }

    .product-title {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .product-price {
      font-size: 14px;
      font-weight: 700;
      color: #4f46e5;
      margin-bottom: 4px;
    }

    .product-meta {
      font-size: 11px;
      color: #6b7280;
    }

    /* Raw JSON */
    pre {
      background: #1e1e2e;
      color: #cdd6f4;
      border-radius: 8px;
      padding: 16px;
      font-size: 12px;
      overflow-x: auto;
      max-height: 400px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-all;
    }

    /* Log */
    .log-entry {
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      margin-bottom: 6px;
      font-family: monospace;
      border-left: 3px solid transparent;
    }

    .log-info    { background: #eff6ff; border-color: #3b82f6; color: #1e40af; }
    .log-success { background: #f0fdf4; border-color: #22c55e; color: #15803d; }
    .log-error   { background: #fef2f2; border-color: #ef4444; color: #b91c1c; }
    .log-warn    { background: #fffbeb; border-color: #f59e0b; color: #92400e; }

    /* URL display */
    .url-display {
      background: #f3f4f6;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 8px 12px;
      font-family: monospace;
      font-size: 12px;
      word-break: break-all;
      margin-bottom: 12px;
      color: #374151;
    }

    /* Tabs */
    .tabs {
      display: flex;
      gap: 4px;
      margin-bottom: 16px;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 0;
    }

    .tab {
      padding: 8px 16px;
      border: none;
      background: none;
      font-size: 14px;
      font-weight: 500;
      color: #6b7280;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
      border-radius: 0;
    }

    .tab.active {
      color: #4f46e5;
      border-bottom-color: #4f46e5;
    }

    .tab-panel { display: none; }
    .tab-panel.active { display: block; }

    /* Spinner */
    .spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid #fff;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
      vertical-align: middle;
      margin-right: 6px;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    label {
      font-size: 12px;
      font-weight: 600;
      color: #374151;
      display: block;
      margin-bottom: 4px;
    }

    .field { margin-bottom: 12px; }

    .section-title {
      font-size: 13px;
      font-weight: 700;
      color: #374151;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .empty {
      text-align: center;
      padding: 40px;
      color: #9ca3af;
      font-size: 14px;
    }

    .empty-icon { font-size: 40px; margin-bottom: 8px; }
  </style>
</head>
<body>

<h1>🔍 Search API Tester</h1>

<!-- Controls -->
<div class="card">
  <div class="section-title">Query Parameters</div>

  <div class="row">
    <div class="field" style="flex:2; min-width:200px;">
      <label>Search Query (q)</label>
      <input id="inp-q" type="text" placeholder="e.g. iPhone, laptop..." value="phone" />
    </div>
    <div class="field" style="flex:1; min-width:140px;">
      <label>Sort</label>
      <select id="inp-sort">
        <option value="relevance">Relevance</option>
        <option value="newest">Newest</option>
        <option value="price_low">Price Low→High</option>
        <option value="price_high">Price High→Low</option>
        <option value="popular">Popular</option>
      </select>
    </div>
    <div class="field" style="flex:1; min-width:100px;">
      <label>Page</label>
      <input id="inp-page" type="number" value="1" min="1" />
    </div>
    <div class="field" style="flex:1; min-width:100px;">
      <label>Limit</label>
      <input id="inp-limit" type="number" value="12" min="1" max="80" />
    </div>
  </div>

  <div class="row">
    <div class="field" style="flex:1; min-width:140px;">
      <label>Category</label>
      <input id="inp-category" type="text" placeholder="Electronics..." />
    </div>
    <div class="field" style="flex:1; min-width:140px;">
      <label>Condition</label>
      <select id="inp-condition">
        <option value="">Any</option>
        <option value="New">New</option>
        <option value="Used - Like New">Used - Like New</option>
        <option value="Used - Good">Used - Good</option>
        <option value="Used - Fair">Used - Fair</option>
      </select>
    </div>
    <div class="field" style="flex:1; min-width:120px;">
      <label>Min Price (₦)</label>
      <input id="inp-price-min" type="number" placeholder="0" />
    </div>
    <div class="field" style="flex:1; min-width:120px;">
      <label>Max Price (₦)</label>
      <input id="inp-price-max" type="number" placeholder="∞" />
    </div>
    <div class="field" style="flex:1; min-width:140px;">
      <label>Location</label>
      <input id="inp-location" type="text" placeholder="Lagos..." />
    </div>
  </div>

  <div class="row">
    <div class="field" style="flex:1; min-width:200px;">
      <label>Base URL</label>
      <input id="inp-baseurl" type="text" value="/api/search" />
    </div>
  </div>

  <div class="row">
    <button class="btn-primary" onclick="runSearch()" id="search-btn">
      🔍 Search
    </button>
    <button class="btn-secondary" onclick="clearAll()">🗑 Clear</button>
    <button class="btn-secondary" onclick="testEmpty()">Test Empty Query</button>
    <button class="btn-secondary" onclick="testBadUrl()">Test Bad URL</button>
  </div>

  <!-- Live URL preview -->
  <div class="url-display" id="url-preview">/api/search?q=phone&page=1&limit=12&sort=relevance</div>
</div>

<!-- Results -->
<div class="card">
  <!-- Tabs -->
  <div class="tabs">
    <button class="tab active" onclick="switchTab('results')">📦 Results</button>
    <button class="tab" onclick="switchTab('raw')">📄 Raw JSON</button>
    <button class="tab" onclick="switchTab('log')">📋 Log</button>
  </div>

  <!-- Stats -->
  <div class="stats" id="stats" style="display:none;">
    <div class="stat">
      <div class="stat-value" id="stat-status">—</div>
      <div class="stat-label">HTTP Status</div>
    </div>
    <div class="stat">
      <div class="stat-value" id="stat-total">—</div>
      <div class="stat-label">Total Found</div>
    </div>
    <div class="stat">
      <div class="stat-value" id="stat-returned">—</div>
      <div class="stat-label">Returned</div>
    </div>
    <div class="stat">
      <div class="stat-value" id="stat-pages">—</div>
      <div class="stat-label">Total Pages</div>
    </div>
    <div class="stat">
      <div class="stat-value" id="stat-time">—</div>
      <div class="stat-label">Time (ms)</div>
    </div>
  </div>

  <!-- Tab Panels -->
  <div class="tab-panel active" id="panel-results">
    <div class="empty" id="empty-msg">
      <div class="empty-icon">🔍</div>
      <div>Hit Search to see results</div>
    </div>
    <div class="products-grid" id="products-grid"></div>
  </div>

  <div class="tab-panel" id="panel-raw">
    <pre id="raw-json">// JSON response will appear here</pre>
  </div>

  <div class="tab-panel" id="panel-log">
    <div id="log-container">
      <div class="log-entry log-info">Ready — fill in the fields and click Search.</div>
    </div>
  </div>
</div>

<script>
  /* ── Tab switching ── */
  function switchTab(name) {
    document.querySelectorAll(".tab").forEach((t, i) => {
      const panels = ["results", "raw", "log"];
      t.classList.toggle("active", panels[i] === name);
    });
    document.querySelectorAll(".tab-panel").forEach((p) => {
      p.classList.toggle("active", p.id === `panel-${name}`);
    });
  }

  /* ── Log ── */
  function log(msg, type = "info") {
    const el = document.createElement("div");
    el.className = `log-entry log-${type}`;
    el.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    document.getElementById("log-container").prepend(el);
  }

  /* ── Build URL from inputs ── */
  function buildUrl() {
    const base     = document.getElementById("inp-baseurl").value.trim() || "/api/search";
    const q        = document.getElementById("inp-q").value.trim();
    const sort     = document.getElementById("inp-sort").value;
    const page     = document.getElementById("inp-page").value;
    const limit    = document.getElementById("inp-limit").value;
    const category = document.getElementById("inp-category").value.trim();
    const condition= document.getElementById("inp-condition").value;
    const priceMin = document.getElementById("inp-price-min").value.trim();
    const priceMax = document.getElementById("inp-price-max").value.trim();
    const location = document.getElementById("inp-location").value.trim();

    const params = new URLSearchParams();
    if (q)         params.set("q",         q);
    if (sort)      params.set("sort",      sort);
    if (page)      params.set("page",      page);
    if (limit)     params.set("limit",     limit);
    if (category)  params.set("category",  category);
    if (condition) params.set("condition", condition);
    if (priceMin)  params.set("price_min", priceMin);
    if (priceMax)  params.set("price_max", priceMax);
    if (location)  params.set("location",  location);

    return `${base}?${params.toString()}`;
  }

  /* ── Live URL preview ── */
  ["inp-q","inp-sort","inp-page","inp-limit","inp-category",
   "inp-condition","inp-price-min","inp-price-max","inp-location","inp-baseurl"]
    .forEach((id) => {
      document.getElementById(id)
        ?.addEventListener("input", () => {
          document.getElementById("url-preview").textContent = buildUrl();
        });
    });

  /* ── Helpers ── */
  function naira(n) {
    return "₦" + Number(n || 0).toLocaleString("en-NG");
  }

  function testEmpty() {
    document.getElementById("inp-q").value = "";
    runSearch();
  }

  function testBadUrl() {
    document.getElementById("inp-baseurl").value = "/api/search-broken";
    runSearch();
  }

  function clearAll() {
    document.getElementById("products-grid").innerHTML = "";
    document.getElementById("raw-json").textContent = "// cleared";
    document.getElementById("empty-msg").style.display = "block";
    document.getElementById("stats").style.display = "none";
    log("Cleared", "info");
  }

  /* ── Main search ── */
  async function runSearch() {
    const url = buildUrl();
    const btn = document.getElementById("search-btn");

    btn.innerHTML = '<span class="spinner"></span>Searching…';
    btn.disabled  = true;
    document.getElementById("url-preview").textContent = url;
    document.getElementById("empty-msg").style.display  = "none";
    document.getElementById("products-grid").innerHTML  = "";

    log(`GET ${url}`, "info");
    const t0 = Date.now();

    try {
      const res  = await fetch(url);
      const ms   = Date.now() - t0;
      const text = await res.text();

      /* HTTP status */
      const statusBadge = res.ok ? "✅" : "❌";
      log(`${statusBadge} ${res.status} ${res.statusText} — ${ms}ms`, res.ok ? "success" : "error");

      /* Try parse JSON */
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        log("❌ Response is not valid JSON!", "error");
        log(`Raw: ${text.slice(0, 300)}`, "warn");
        document.getElementById("raw-json").textContent = text;
        switchTab("raw");
        return;
      }

      /* Raw JSON tab */
      document.getElementById("raw-json").textContent =
        JSON.stringify(data, null, 2);

      /* Stats */
      const products = Array.isArray(data.products) ? data.products : [];
      document.getElementById("stat-status").textContent   = res.status;
      document.getElementById("stat-total").textContent    = data.total ?? "?";
      document.getElementById("stat-returned").textContent = products.length;
      document.getElementById("stat-pages").textContent    = data.totalPages ?? "?";
      document.getElementById("stat-time").textContent     = ms;
      document.getElementById("stats").style.display       = "flex";

      /* Diagnose */
      if (!res.ok) {
        log(`Server error: ${data.message || "unknown"}`, "error");
        if (data.debug) log(`Debug: ${data.debug}`, "warn");
      }

      if (!Array.isArray(data.products)) {
        log('⚠️ Response missing "products" array!', "warn");
        log(`Keys received: ${Object.keys(data).join(", ")}`, "warn");
      }

      if (products.length === 0 && res.ok) {
        log("⚠️ Got 0 products — check your DB or query", "warn");
        document.getElementById("empty-msg").style.display = "block";
        document.getElementById("empty-msg").innerHTML =
          `<div class="empty-icon">📭</div>
           <div>0 products returned</div>
           <div style="font-size:11px;margin-top:6px;color:#6b7280;">
             total=${data.total} • query="${data.query}"
           </div>`;
      }

      /* Suggestions */
      if (data.suggestions?.length > 0) {
        log(`Suggestions: ${data.suggestions.join(", ")}`, "info");
      }

      /* Render cards */
      const grid = document.getElementById("products-grid");
      products.forEach((p, i) => {
        const card = document.createElement("div");
        card.className = "product-card";

        const img   = (p.images?.[0]) || p.image || p.main_image || null;
        const city  = p.location_city || p.location?.city || "";
        const price = naira(p.price);

        card.innerHTML = `
          ${img
            ? `<img class="product-img" src="${img}"
                    alt="${p.title}"
                    onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
               />
               <div class="product-img-placeholder" style="display:none">📦</div>`
            : `<div class="product-img-placeholder">📦</div>`
          }
          <div class="product-body">
            <div class="product-title" title="${p.title || ''}">${p.title || "Untitled"}</div>
            <div class="product-price">${price}</div>
            <div class="product-meta">
              ${p.condition  ? `<span class="badge badge-blue">${p.condition}</span> ` : ""}
              ${p.is_promoted ? `<span class="badge badge-yellow">⭐ Featured</span> ` : ""}
              ${city         ? `📍 ${city}` : ""}
            </div>
            <div class="product-meta" style="margin-top:4px;color:#9ca3af;">
              ID: ${p.id} &nbsp;|&nbsp; #${i + 1}
            </div>
          </div>
        `;
        grid.appendChild(card);
      });

      if (products.length > 0) {
        log(`✅ Rendered ${products.length} product(s)`, "success");
      }

    } catch (err) {
      const ms = Date.now() - t0;
      log(`❌ Fetch failed after ${ms}ms: ${err.message}`, "error");
      log("Is your server running? Check the Base URL.", "warn");
      document.getElementById("empty-msg").style.display = "block";
      document.getElementById("empty-msg").innerHTML =
        `<div class="empty-icon">🚫</div>
         <div>Network Error</div>
         <div style="font-size:11px;margin-top:6px;color:#ef4444;">${err.message}</div>`;
    } finally {
      btn.innerHTML = "🔍 Search";
      btn.disabled  = false;
    }
  }

  /* ── Enter key on query input ── */
  document.getElementById("inp-q")
    .addEventListener("keydown", (e) => {
      if (e.key === "Enter") runSearch();
    });

  /* ── Init URL preview ── */
  document.getElementById("url-preview").textContent = buildUrl();
</script>
</body>
</html>