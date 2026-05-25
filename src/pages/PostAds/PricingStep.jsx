import React, { useMemo } from "react";
import {
  FiDollarSign,
  FiTrendingUp,
  FiInfo,
  FiCheckCircle,
  FiAlertTriangle,
  FiBox,
  FiZap,
  FiShield,
} from "react-icons/fi";

/* ─────────────────────────────────────────────
   FUTURE-GENERATION PRICING ENGINE
───────────────────────────────────────────── */

export default function PricingStep({
  basePrice,
  setBasePrice,

  originalPrice,
  setOriginalPrice,

  costPrice,
  setCostPrice,

  taxRate = 0,

  currency = "NGN",

  variants = [],

  discountPct = 0,
}) {

  /* ─────────────────────────────────────────
     FORMATTERS
  ───────────────────────────────────────── */

  const formatNumber = (value) => {
    if (!value) return "";
    return Number(value).toLocaleString();
  };

  const parseValue = (value) => {
    return Number(
      String(value).replace(/\D/g, "")
    ) || 0;
  };

  /* ─────────────────────────────────────────
     SMART ANALYTICS
  ───────────────────────────────────────── */

  const calculatedProfit = useMemo(() => {
    return (
      parseValue(basePrice) -
      parseValue(costPrice)
    );
  }, [basePrice, costPrice]);

  const estimatedTax = useMemo(() => {
    return (
      parseValue(basePrice) *
      (taxRate / 100)
    );
  }, [basePrice, taxRate]);

  const estimatedPayout = useMemo(() => {
    return (
      parseValue(basePrice) -
      estimatedTax
    );
  }, [basePrice, estimatedTax]);

  const pricingHealth = useMemo(() => {

    if (
      parseValue(basePrice) <=
      parseValue(costPrice)
    ) {
      return {
        label: "Low Profit Margin",
        className: "warning",
      };
    }

    if (discountPct >= 50) {
      return {
        label: "Aggressive Discount",
        className: "danger",
      };
    }

    return {
      label: "Healthy Pricing",
      className: "success",
    };

  }, [
    basePrice,
    costPrice,
    discountPct,
  ]);

  return (
    <div className="pa-pricing-page">

      {/* ─────────────────────────────────────
         HEADER
      ───────────────────────────────────── */}

      <div className="pa-pricing-header">

        <div>

          <h2 className="pa-pricing-heading">
            Pricing & Revenue
          </h2>

          <p className="pa-pricing-subheading">
            Configure intelligent marketplace pricing,
            profit analysis, taxes, and revenue insights
          </p>

        </div>

        {/* HEALTH */}
        <div
          className={`pa-pricing-health pa-pricing-health--${pricingHealth.className}`}
        >

          <FiShield size={16} />

          {pricingHealth.label}

        </div>

      </div>

      {/* ─────────────────────────────────────
         DELIVERY NOTE
      ───────────────────────────────────── */}

      <div className="pa-delivery-card">

        <div className="pa-delivery-icon">
          🚚
        </div>

        <div>

          <strong>
            Delivery handled during checkout
          </strong>

          <p>
            Buyers choose shipping methods,
            delivery speed, and payment options
            during order processing.
          </p>

        </div>

      </div>

      {/* ─────────────────────────────────────
         MAIN GRID
      ───────────────────────────────────── */}

      <div className="pa-pricing-layout">

        {/* ─────────────────────────────────
           LEFT SIDE
        ───────────────────────────────── */}

        <div className="pa-pricing-main">

          {/* BASE PRICE */}
          <div className="pa-pricing-card">

            <div className="pa-pricing-card-head">

              <div>
                <h3>Base Price</h3>
                <p>
                  Primary selling price shown
                  to buyers
                </p>
              </div>

              <FiDollarSign size={18} />

            </div>

            <div className="pa-price-field">

              <label>
                Selling Price *
              </label>

              <div className="pa-price-input-wrap">

                <span className="pa-price-currency">
                  ₦
                </span>

                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={formatNumber(basePrice)}
                  onChange={(e) =>
                    setBasePrice(
                      e.target.value.replace(/\D/g, "")
                    )
                  }
                />

              </div>

            </div>

            {/* ORIGINAL PRICE */}
            <div className="pa-price-field">

              <label>
                Original Price
              </label>

              <div className="pa-price-input-wrap pa-price-input-wrap--secondary">

                <span className="pa-price-currency">
                  ₦
                </span>

                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={formatNumber(originalPrice)}
                  onChange={(e) =>
                    setOriginalPrice(
                      e.target.value.replace(/\D/g, "")
                    )
                  }
                />

              </div>

            </div>

            {/* COST PRICE */}
            <div className="pa-price-field">

              <label>
                Cost Price
              </label>

              <div className="pa-price-input-wrap">

                <span className="pa-price-currency">
                  ₦
                </span>

                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={formatNumber(costPrice)}
                  onChange={(e) =>
                    setCostPrice(
                      e.target.value.replace(/\D/g, "")
                    )
                  }
                />

              </div>

            </div>

            {/* DISCOUNT */}
            {discountPct > 0 && (
              <div className="pa-discount-preview">

                <div className="pa-discount-left">

                  <FiZap size={15} />

                  <span>
                    Buyer saves
                  </span>

                </div>

                <div className="pa-discount-right">

                  <strong>
                    ₦
                    {(
                      parseValue(originalPrice) -
                      parseValue(basePrice)
                    ).toLocaleString()}
                  </strong>

                  <span>
                    -{discountPct}%
                  </span>

                </div>

              </div>
            )}

          </div>

        </div>

        {/* ─────────────────────────────────
           RIGHT SIDE
        ───────────────────────────────── */}

        <div className="pa-pricing-sidebar">

          {/* ANALYTICS */}
          <div className="pa-pricing-side-card">

            <div className="pa-pricing-side-head">

              <FiTrendingUp size={17} />

              Revenue Insights

            </div>

            <div className="pa-pricing-metrics">

              <div className="pa-pricing-metric">

                <span>
                  Estimated Profit
                </span>

                <strong>
                  ₦
                  {calculatedProfit.toLocaleString()}
                </strong>

              </div>

              <div className="pa-pricing-metric">

                <span>
                  Estimated Tax
                </span>

                <strong>
                  ₦
                  {estimatedTax.toLocaleString()}
                </strong>

              </div>

              <div className="pa-pricing-metric">

                <span>
                  Estimated Payout
                </span>

                <strong>
                  ₦
                  {estimatedPayout.toLocaleString()}
                </strong>

              </div>

              <div className="pa-pricing-metric">

                <span>
                  Variants
                </span>

                <strong>
                  {variants.length}
                </strong>

              </div>

            </div>

          </div>

          {/* RECOMMENDATIONS */}
          <div className="pa-pricing-side-card">

            <div className="pa-pricing-side-head">

              <FiInfo size={17} />

              Smart Recommendations

            </div>

            <div className="pa-pricing-recommendations">

              {parseValue(basePrice) <= 0 && (
                <div className="pa-price-tip warning">
                  <FiAlertTriangle size={15} />
                  Add a valid selling price
                </div>
              )}

              {filledCondition(
                parseValue(basePrice) >
                parseValue(costPrice)
              ) && (
                <div className="pa-price-tip success">
                  <FiCheckCircle size={15} />
                  Profit margin looks healthy
                </div>
              )}

              {discountPct >= 20 && (
                <div className="pa-price-tip info">
                  <FiZap size={15} />
                  Discounts above 20% increase conversion
                </div>
              )}

              {variants.length > 5 && (
                <div className="pa-price-tip info">
                  <FiBox size={15} />
                  Multiple variants improve discoverability
                </div>
              )}

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}

/* ─────────────────────────────────────────────
   HELPER
───────────────────────────────────────────── */

function filledCondition(condition) {
  return Boolean(condition);
}