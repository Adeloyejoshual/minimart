import { Card } from "../adminlayout/atoms";
import { TOGGLES } from "../adminlayout/nav";

export default function System({ system, toggleSystem, confirm }) {
  return (
    <>
      <div className="ph">
        <div className="ph-left">
          <h1>System Control</h1>
          <div className="ph-sub">Platform-wide toggles and configuration</div>
        </div>
      </div>

      <Card title="Platform Switches">
        {TOGGLES.map(({ key, label, desc, danger }) => (
          <div key={key} className="toggle-row">
            <div className="toggle-info">
              <h4>{label}</h4>
              <p>{desc}</p>
            </div>
            <button
              className={`sw ${system[key] ? "on" : "off"}`}
              role="switch"
              aria-checked={system[key]}
              aria-label={label}
              onClick={() =>
                confirm({
                  title:   `${system[key] ? "Disable" : "Enable"} ${label}?`,
                  body:    "This will take effect immediately across the platform.",
                  danger,
                  confirm: system[key] ? "Turn Off" : "Turn On",
                  action:  () => toggleSystem(key, system),
                })
              }
            />
          </div>
        ))}
      </Card>

      <Card title="Danger Zone">
        <div className="danger-zone">
          <h4>Hard Reset (coming soon)</h4>
          <p>Clear all sessions, revoke tokens, and force re-login for every user and admin.</p>
          <button className="btn b-red" disabled>Force Re-Login All</button>
        </div>
        <div className="danger-zone" style={{ margin: "0 18px 18px" }}>
          <h4>Flush Cache (coming soon)</h4>
          <p>Clear Redis trending, search, and session caches.</p>
          <button className="btn b-amber" disabled>Flush Redis Cache</button>
        </div>
      </Card>
    </>
  );
}