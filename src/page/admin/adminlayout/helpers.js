import { PILL, TT, fmtDate } from "./helpers";

export const Pill = ({ s }) => (
  <span className={PILL[s] || "pill pd"}>{s || "—"}</span>
);

export const StatCard = ({ label, value, color = "c-blue", delta }) => (
  <div className="sc">
    <div className="sc-label">{label}</div>
    <div className={`sc-val ${color}`}>{value}</div>
    {delta && <div className="sc-delta">{delta}</div>}
  </div>
);

export const Card = ({ title, actions, tabs, children }) => (
  <div className="card">
    {tabs}
    {(title || actions) && (
      <div className="card-hd">
        {title   && <span className="card-title">{title}</span>}
        {actions && <div className="card-acts">{actions}</div>}
      </div>
    )}
    {children}
  </div>
);

export const LogItem = ({ log }) => (
  <div className="log-item">
    <span className="log-time">{fmtDate(log.created_at)}</span>
    <span className="log-body">
      {log.details}
      {log.admin_name && (
        <> — <span className="log-admin">{log.admin_name}</span></>
      )}
    </span>
  </div>
);

export const Rfr = ({ onClick }) => (
  <button className="btn b-ghost" onClick={onClick}>Refresh</button>
);

export const Srch = ({ value, onChange, placeholder }) => (
  <input
    className="input input-sm"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder || "Search…"}
  />
);