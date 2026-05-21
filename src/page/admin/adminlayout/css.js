export const css = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:ital,wght@0,400;0,500;1,400&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:       #080b14;
  --surface:  #0f1320;
  --panel:    #161c2e;
  --raised:   #1d2540;
  --border:   #222c44;
  --accent:   #4f8cff;
  --accent-d: #2563cc;
  --green:    #1dd6a0;
  --amber:    #f59e42;
  --red:      #f43f5e;
  --purple:   #a78bfa;
  --text:     #dde4f5;
  --muted:    #5e6e94;
  --font:     'Syne', sans-serif;
  --mono:     'DM Mono', monospace;
  --radius:   10px;
  --shadow:   0 4px 24px rgba(0,0,0,.45);
}

body {
  background: var(--bg); color: var(--text);
  font-family: var(--font); -webkit-font-smoothing: antialiased;
}

.wrap { display: flex; min-height: 100vh; }
.main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
.body { flex: 1; padding: 28px 32px; overflow-y: auto; }

.sidebar {
  width: 230px; flex-shrink: 0; background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex; flex-direction: column; padding: 0 0 20px;
}
.sb-logo {
  padding: 26px 20px 22px; font-size: 1.15rem; font-weight: 800;
  letter-spacing: -.02em; color: var(--accent);
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center; gap: 8px;
}
.sb-logo span { color: var(--text); }
.sb-section {
  padding: 18px 12px 6px; font-size: .62rem; font-weight: 700;
  color: var(--muted); text-transform: uppercase; letter-spacing: .1em;
}
.nav-btn {
  display: flex; align-items: center; gap: 10px; padding: 9px 14px;
  margin: 1px 8px; border-radius: 8px; cursor: pointer;
  color: var(--muted); font-size: .82rem; font-weight: 600;
  transition: background .14s, color .14s; border: none; background: none;
  width: calc(100% - 16px); text-align: left; font-family: var(--font);
}
.nav-btn:hover  { background: var(--panel); color: var(--text); }
.nav-btn.active { background: rgba(79,140,255,.13); color: var(--accent); }
.nav-icon { width: 18px; text-align: center; font-size: .9rem; flex-shrink: 0; }
.nav-badge {
  margin-left: auto; font-size: .6rem; font-family: var(--mono);
  background: var(--red); color: #fff; padding: 1px 6px;
  border-radius: 20px; font-weight: 700;
}
.sb-footer {
  margin-top: auto; padding: 14px 16px 0; border-top: 1px solid var(--border);
  font-size: .72rem; color: var(--muted); font-family: var(--mono);
}

.topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 32px; background: var(--surface);
  border-bottom: 1px solid var(--border); flex-shrink: 0; gap: 12px;
}
.topbar-title { font-size: 1rem; font-weight: 700; letter-spacing: -.01em; }
.topbar-right  { display: flex; align-items: center; gap: 10px; }
.notif-btn {
  position: relative; width: 34px; height: 34px; border-radius: 8px;
  background: var(--panel); border: 1px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; font-size: .85rem; transition: background .14s;
  color: var(--muted);
}
.notif-btn:hover { background: var(--raised); }
.notif-dot {
  position: absolute; top: 6px; right: 6px; width: 7px; height: 7px;
  border-radius: 50%; background: var(--red); border: 1.5px solid var(--surface);
}
.avatar {
  width: 34px; height: 34px; border-radius: 8px;
  background: linear-gradient(135deg, var(--accent-d), var(--accent));
  display: flex; align-items: center; justify-content: center;
  font-size: .78rem; font-weight: 800; color: #fff; cursor: pointer; flex-shrink: 0;
}
.live-chip {
  display: flex; align-items: center; gap: 5px; padding: 4px 10px;
  border-radius: 20px; background: rgba(29,214,160,.1); color: var(--green);
  font-size: .68rem; font-weight: 700; font-family: var(--mono);
}
.live-dot {
  width: 6px; height: 6px; border-radius: 50%; background: var(--green);
  animation: pulse 1.6s ease-in-out infinite;
}
@keyframes pulse {
  0%,100% { opacity:1; transform:scale(1); }
  50%      { opacity:.3; transform:scale(1.5); }
}

.ph {
  display: flex; align-items: flex-start; justify-content: space-between;
  margin-bottom: 24px; gap: 12px; flex-wrap: wrap;
}
.ph-left h1 { font-size: 1.5rem; font-weight: 800; letter-spacing: -.03em; line-height: 1.1; }
.ph-sub     { font-size: .8rem; color: var(--muted); margin-top: 3px; }
.ph-right   { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }

.sg { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 13px; margin-bottom: 24px; }
.sc {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 17px 18px;
  transition: border-color .18s, transform .18s; cursor: default;
}
.sc:hover { border-color: var(--accent); transform: translateY(-2px); }
.sc-label { font-size: .65rem; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .09em; margin-bottom: 7px; }
.sc-val   { font-size: 1.8rem; font-weight: 800; letter-spacing: -.04em; line-height: 1; }
.sc-delta { font-size: .7rem; color: var(--muted); margin-top: 4px; font-family: var(--mono); }
.c-blue   { color: var(--accent); }
.c-green  { color: var(--green); }
.c-amber  { color: var(--amber); }
.c-red    { color: var(--red); }
.c-purple { color: var(--purple); }

.card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 13px; margin-bottom: 20px; overflow: hidden;
}
.card-hd {
  display: flex; align-items: center; justify-content: space-between;
  padding: 13px 18px; border-bottom: 1px solid var(--border);
  gap: 10px; flex-wrap: wrap;
}
.card-title { font-size: .88rem; font-weight: 700; }
.card-acts  { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.chart-wrap { padding: 14px 18px 20px; }

.tabs { display: flex; gap: 3px; padding: 11px 14px 0; border-bottom: 1px solid var(--border); }
.tab  {
  padding: 6px 13px; border-radius: 7px 7px 0 0; font-size: .75rem;
  font-weight: 700; cursor: pointer; border: none; background: none;
  color: var(--muted); transition: color .14s, background .14s; font-family: var(--font);
}
.tab.active { background: var(--panel); color: var(--text); }

.tw { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: .78rem; }
th {
  padding: 9px 15px; text-align: left; font-size: .63rem; font-weight: 700;
  color: var(--muted); text-transform: uppercase; letter-spacing: .08em;
  white-space: nowrap; border-bottom: 1px solid var(--border);
}
td { padding: 10px 15px; border-bottom: 1px solid rgba(34,44,68,.6); vertical-align: middle; }
tr:last-child td { border-bottom: none; }
tr:hover td { background: rgba(79,140,255,.035); }
.mono { font-family: var(--mono); }
.dim  { color: var(--muted); }

.pill {
  display: inline-block; padding: 2px 8px; border-radius: 20px;
  font-size: .62rem; font-weight: 700; font-family: var(--mono);
  text-transform: uppercase; letter-spacing: .04em;
}
.pa { background: rgba(29,214,160,.12);  color: var(--green);  }
.pd { background: rgba(94,110,148,.12);  color: var(--muted);  }
.pp { background: rgba(245,158,66,.12);  color: var(--amber);  }
.pb { background: rgba(244,63,94,.12);   color: var(--red);    }
.pc { background: rgba(79,140,255,.12);  color: var(--accent); }
.pv { background: rgba(167,139,250,.12); color: var(--purple); }

.btn {
  padding: 5px 12px; border-radius: 7px; font-size: .72rem; font-weight: 700;
  cursor: pointer; border: 1px solid transparent;
  transition: opacity .14s, transform .1s; font-family: var(--font);
  white-space: nowrap; display: inline-flex; align-items: center; gap: 5px;
}
.btn:hover    { opacity: .82; transform: translateY(-1px); }
.btn:active   { transform: translateY(0); }
.btn:disabled { opacity: .35; cursor: not-allowed; transform: none; }
.b-blue  { background: rgba(79,140,255,.12);  color: var(--accent);  border-color: rgba(79,140,255,.25); }
.b-green { background: rgba(29,214,160,.12);  color: var(--green);   border-color: rgba(29,214,160,.25); }
.b-red   { background: rgba(244,63,94,.12);   color: var(--red);     border-color: rgba(244,63,94,.25);  }
.b-amber { background: rgba(245,158,66,.12);  color: var(--amber);   border-color: rgba(245,158,66,.25); }
.b-ghost { background: var(--panel);          color: var(--text);    border-color: var(--border);        }
.b-solid { background: var(--accent);         color: #fff;           border-color: var(--accent);        }
.b-purple{ background: rgba(167,139,250,.12); color: var(--purple);  border-color: rgba(167,139,250,.25);}

.input {
  background: var(--panel); border: 1px solid var(--border); color: var(--text);
  padding: 7px 12px; border-radius: 8px; font-size: .78rem;
  font-family: var(--font); outline: none; transition: border-color .14s;
}
.input:focus { border-color: var(--accent); }
.input-sm { width: 200px; }
select.input { cursor: pointer; }
textarea.input { resize: vertical; min-height: 70px; }

.toggle-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px; border-bottom: 1px solid rgba(34,44,68,.6);
}
.toggle-row:last-child { border-bottom: none; }
.toggle-info h4 { font-size: .85rem; font-weight: 700; margin-bottom: 2px; }
.toggle-info p  { font-size: .72rem; color: var(--muted); }
.sw {
  width: 44px; height: 24px; border-radius: 12px; border: none; cursor: pointer;
  position: relative; flex-shrink: 0; transition: background .2s;
}
.sw.on  { background: var(--green); }
.sw.off { background: var(--border); }
.sw::after {
  content: ''; position: absolute; top: 3px; width: 18px; height: 18px;
  border-radius: 50%; background: #fff; transition: left .2s;
}
.sw.on::after  { left: 23px; }
.sw.off::after { left: 3px; }

.log-list { max-height: 340px; overflow-y: auto; }
.log-item {
  display: flex; align-items: flex-start; gap: 11px;
  padding: 9px 18px; border-bottom: 1px solid rgba(34,44,68,.5);
}
.log-item:last-child { border-bottom: none; }
.log-time  { color: var(--muted); font-family: var(--mono); font-size: .67rem; white-space: nowrap; flex-shrink: 0; padding-top: 2px; }
.log-body  { flex: 1; font-size: .76rem; line-height: 1.55; }
.log-admin { color: var(--accent); font-weight: 700; }

.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.7);
  display: flex; align-items: center; justify-content: center;
  z-index: 9999; backdrop-filter: blur(3px); animation: fadein .15s ease;
}
@keyframes fadein { from { opacity: 0; } to { opacity: 1; } }
.modal {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 14px; padding: 28px 28px 22px; width: 420px; max-width: 96vw;
  box-shadow: var(--shadow); animation: slideup .18s ease;
}
.modal-wide { width: 560px; }
@keyframes slideup {
  from { transform: translateY(10px); opacity: 0; }
  to   { transform: none; opacity: 1; }
}
.modal-title { font-size: 1rem; font-weight: 800; margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid var(--border); }
.modal-btns  { display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px; }

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 16px 18px; }
.form-group { display: flex; flex-direction: column; gap: 5px; }
.form-group label { font-size: .65rem; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .07em; }
.form-group .input { width: 100%; }
.form-full { grid-column: 1 / -1; }

.plan-admin-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px; padding: 18px;
}
.plan-admin-card {
  background: var(--panel); border: 1px solid var(--border);
  border-radius: 12px; padding: 18px; display: flex; flex-direction: column; gap: 10px;
  transition: border-color .18s;
}
.plan-admin-card:hover { border-color: var(--accent); }
.plan-admin-card.inactive { opacity: .55; }
.plan-admin-name { font-size: 1rem; font-weight: 800; letter-spacing: -.02em; }
.plan-admin-price {
  font-size: 1.4rem; font-weight: 800; color: var(--green);
  font-family: var(--mono); letter-spacing: -.03em;
}
.plan-admin-price .original {
  font-size: .85rem; color: var(--muted);
  text-decoration: line-through; margin-right: 6px;
}
.plan-admin-price .discount-badge {
  font-size: .65rem; background: rgba(245,158,66,.15);
  color: var(--amber); border-radius: 20px; padding: 2px 7px;
  font-weight: 700; vertical-align: middle; margin-left: 4px;
}
.plan-admin-meta {
  font-size: .72rem; color: var(--muted); font-family: var(--mono);
  display: flex; gap: 10px; flex-wrap: wrap;
}
.plan-admin-features { list-style: none; display: flex; flex-direction: column; gap: 4px; }
.plan-admin-features li {
  font-size: .74rem; color: var(--text);
  display: flex; align-items: center; gap: 6px;
}
.plan-admin-features li::before {
  content: ''; width: 6px; height: 6px; border-radius: 50%;
  background: var(--green); flex-shrink: 0;
}
.plan-admin-actions { display: flex; gap: 6px; margin-top: 4px; }

.last-products-list { display: flex; flex-direction: column; }
.lp-row {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 18px; border-bottom: 1px solid rgba(34,44,68,.5);
  transition: background .12s;
}
.lp-row:last-child { border-bottom: none; }
.lp-row:hover { background: rgba(79,140,255,.03); }
.lp-thumb {
  width: 40px; height: 40px; border-radius: 8px; object-fit: cover;
  background: var(--raised); flex-shrink: 0; border: 1px solid var(--border);
}
.lp-thumb-ph {
  width: 40px; height: 40px; border-radius: 8px; background: var(--raised);
  border: 1px solid var(--border); flex-shrink: 0; display: flex;
  align-items: center; justify-content: center; color: var(--muted); font-size: .7rem;
}
.lp-info { flex: 1; min-width: 0; }
.lp-title {
  font-size: .82rem; font-weight: 700; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
}
.lp-meta { font-size: .68rem; color: var(--muted); margin-top: 2px; }
.lp-right { text-align: right; flex-shrink: 0; }
.lp-price { font-size: .8rem; font-weight: 700; color: var(--green); font-family: var(--mono); }
.lp-date  { font-size: .65rem; color: var(--muted); font-family: var(--mono); margin-top: 2px; }

.today-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(140px,1fr));
  gap: 10px; padding: 16px 18px;
}
.today-cell {
  background: var(--panel); border-radius: 9px; padding: 13px 14px;
  border: 1px solid var(--border);
}
.today-cell-label { font-size: .63rem; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; margin-bottom: 6px; }
.today-cell-val   { font-size: 1.45rem; font-weight: 800; letter-spacing: -.03em; }

.empty   { padding: 36px 18px; text-align: center; color: var(--muted); font-size: .82rem; }
.loading {
  display: flex; align-items: center; justify-content: center;
  height: 100vh; color: var(--muted); font-size: .88rem; gap: 8px;
}

.thumb { width: 28px; height: 28px; border-radius: 6px; object-fit: cover; flex-shrink: 0; }

.danger-zone {
  margin: 16px 18px 18px; padding: 14px 16px; border-radius: 9px;
  background: rgba(244,63,94,.06); border: 1px solid rgba(244,63,94,.2);
}
.danger-zone h4 { font-size: .78rem; font-weight: 800; color: var(--red); margin-bottom: 8px; text-transform: uppercase; letter-spacing: .06em; }
.danger-zone p  { font-size: .73rem; color: var(--muted); margin-bottom: 12px; line-height: 1.6; }

.divider { border: none; border-top: 1px solid var(--border); margin: 6px 0; }

::-webkit-scrollbar       { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: var(--surface); }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
`;