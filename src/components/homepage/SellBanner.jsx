// src/components/homepage/SellBanner.jsx
import { memo } from "react";
import { useNavigate } from "react-router-dom";

const SellBanner = memo(function SellBanner() {
  const navigate = useNavigate();

  return (
    <section
      className="hm-sell-banner"
      aria-label="Start selling on Loemart"
    >
      <div className="hm-sell-banner-blob"
           aria-hidden="true" />

      <div className="hm-sell-banner-content">
        <div className="hm-sell-banner-text">
          <h2 className="hm-sell-banner-h2">
            Start Selling on Loemart
          </h2>
          <p className="hm-sell-banner-p">
            List your products for free and reach thousands
            of buyers across Nigeria.
          </p>
        </div>

        <button
          className="hm-sell-banner-btn"
          onClick={() => navigate("/minimart/add")}
        >
          List for Free →
        </button>
      </div>
    </section>
  );
});

export default SellBanner;