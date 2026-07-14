import "./styles/desktop-plan-comparison.css";

interface Plan {
  id:                string;
  slug:              string;
  name:              string;
  badge:             string;
  monthlyPriceNaira: number;
  yearlyPriceNaira:  number;
  rank:              number;
  featureKeys:       Record<string, string>;
}

interface Props {
  plans:           Plan[];
  cycle:           "monthly" | "yearly";
  currentPlan:     string | undefined;
  isCurrentActive: boolean;
  initiating:      string | null;
  onSelect:        (slug: string) => void;
}

const FEATURE_LABELS: Record<string, string> = {
  auto_renewal:          "Auto Renewal",
  search_boost:          "Search Boost",
  analytics:             "Analytics",
  support_level:         "Support Level",
  seller_badge:          "Seller Badge",
  featured_listings:     "Featured Listings",
  featured_quota:        "Featured Slots/mo",
  business_verification: "Business Verification",
  team_accounts:         "Team Accounts",
  inventory_management:  "Inventory Management",
  homepage_promotion:    "Homepage Promotion",
  advertising_credits:   "Ad Credits (₦/mo)",
  dedicated_manager:     "Dedicated Manager",
  early_access:          "Early Access",
  api_access:            "API Access",
  custom_branding:       "Custom Branding",
  vip_support:           "VIP Support",
};

const renderCell = (key: string, value: string) => {
  if (value === "true")
    return (
      <span className="dpc-cell dpc-cell--yes">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </span>
    );
  if (value === "false")
    return <span className="dpc-cell dpc-cell--no">—</span>;
  if (key === "advertising_credits" && value !== "0")
    return <span className="dpc-cell dpc-cell--credits">₦{Number(value).toLocaleString("en-NG")}</span>;
  if (value === "0")
    return <span className="dpc-cell dpc-cell--no">—</span>;
  return <span className="dpc-cell dpc-cell--text">{value}</span>;
};

const DesktopPlanComparison = ({
  plans, cycle, currentPlan, isCurrentActive, initiating, onSelect,
}: Props) => {
  // Collect all feature keys that appear in at least one plan
  const allFeatureKeys = [
    ...new Set(plans.flatMap((p) => Object.keys(p.featureKeys))),
  ].filter((k) => FEATURE_LABELS[k]);

  return (
    <div className="dpc-wrap">
      <div className="dpc-table-scroll">
        <table className="dpc-table">
          <thead>
            <tr>
              <th className="dpc-table__feature-col">Feature</th>
              {plans.map((plan) => {
                const isCurrentPlan = isCurrentActive && currentPlan === plan.slug;
                const price = cycle === "yearly"
                  ? plan.yearlyPriceNaira
                  : plan.monthlyPriceNaira;

                return (
                  <th
                    key={plan.id}
                    className={`dpc-table__plan-col ${plan.slug === "diamond" ? "dpc-table__plan-col--diamond" : ""}`}
                  >
                    <div className="dpc-th-content">
                      <span className="dpc-th-badge">{plan.badge}</span>
                      <span className="dpc-th-name">{plan.name}</span>
                      <span className="dpc-th-price">
                        ₦{price.toLocaleString("en-NG")}
                        <span className="dpc-th-period">/{cycle === "yearly" ? "yr" : "mo"}</span>
                      </span>
                      {isCurrentPlan ? (
                        <span className="dpc-th-current">Current Plan</span>
                      ) : (
                        <button
                          onClick={() => onSelect(plan.slug)}
                          disabled={!!initiating}
                          className={`dpc-th-btn ${plan.slug === "diamond" || plan.slug === "elite" ? "dpc-th-btn--accent" : "dpc-th-btn--default"}`}
                        >
                          {initiating === plan.slug ? (
                            <><span className="dpc-spinner" /> Processing...</>
                          ) : isCurrentActive ? (
                            "Switch"
                          ) : (
                            "Get Started"
                          )}
                        </button>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {allFeatureKeys.map((key) => (
              <tr key={key} className="dpc-table__row">
                <td className="dpc-table__feature-label">
                  {FEATURE_LABELS[key]}
                </td>
                {plans.map((plan) => (
                  <td key={plan.id} className="dpc-table__cell">
                    {renderCell(key, plan.featureKeys[key] ?? "false")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DesktopPlanComparison;