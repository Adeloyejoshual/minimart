import React from "react";

const categories = [
  { icon: "📱", name: "Phones & Tablets" },
  { icon: "💻", name: "Computers" },
  { icon: "📺", name: "Electronics" },
  { icon: "👗", name: "Fashion" },
  { icon: "🛋️", name: "Home & Living" },
  { icon: "🛒", name: "Groceries" },
  { icon: "💄", name: "Beauty" },
  { icon: "🚗", name: "Automotive" },
];

const benefits = [
  {
    icon: "🛍️",
    title: "More Ways to Shop",
    text: "Explore local listings or shop products through our online marketplace.",
  },
  {
    icon: "🤝",
    title: "Connect with Sellers",
    text: "Discover local sellers and connect directly when shopping locally.",
  },
  {
    icon: "🚚",
    title: "Managed Delivery",
    text: "Enjoy managed delivery on eligible marketplace purchases.",
  },
  {
    icon: "🌍",
    title: "Built for Local Commerce",
    text: "Discover products, support businesses and grow with Loemart.",
  },
];

export default function Testpage() {
  return (
    <div className="lm-test">

      <style>{`
        .lm-test {
          --orange: #FF5C00;
          --orange-light: #FF8040;
          --dark: #141210;
          --muted: #77716b;
          --bg: #F7F4EF;
          font-family: Inter, Arial, sans-serif;
          color: var(--dark);
          background: #fff;
          min-height: 100vh;
        }

        .lm-test * {
          box-sizing: border-box;
        }

        .lm-test a {
          text-decoration: none;
          color: inherit;
        }

        .lm-container {
          width: min(1200px, 92%);
          margin: auto;
        }

        .lm-header {
          background: white;
          border-bottom: 1px solid #eee;
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .lm-header-inner {
          min-height: 76px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 25px;
        }

        .lm-logo {
          font-size: 29px;
          font-weight: 950;
          letter-spacing: -1.8px;
          color: var(--orange);
          white-space: nowrap;
        }

        .lm-search {
          flex: 1;
          max-width: 510px;
          display: flex;
          align-items: center;
          background: #f5f4f2;
          border: 1px solid #ece9e5;
          border-radius: 9px;
          padding: 5px;
        }

        .lm-search input {
          flex: 1;
          min-width: 0;
          border: none;
          outline: none;
          background: transparent;
          padding: 12px;
          font-size: 14px;
        }

        .lm-search button {
          border: none;
          border-radius: 7px;
          background: var(--orange);
          color: white;
          padding: 12px 20px;
          font-weight: 700;
          cursor: pointer;
        }

        .lm-header-actions {
          display: flex;
          align-items: center;
          gap: 20px;
          font-size: 13px;
          font-weight: 700;
        }

        .lm-header-actions a:hover {
          color: var(--orange);
        }

        .lm-hero {
          padding: 65px 0 55px;
          background:
            radial-gradient(circle at 90% 10%, #ffe2d2 0, transparent 35%),
            linear-gradient(135deg, #fff8f3, #fff 70%);
        }

        .lm-hero-content {
          text-align: center;
          max-width: 750px;
          margin: auto;
        }

        .lm-eyebrow {
          display: inline-block;
          color: var(--orange);
          background: #fff0e8;
          padding: 9px 16px;
          border-radius: 30px;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .7px;
          text-transform: uppercase;
        }

        .lm-hero h1 {
          font-size: clamp(36px, 5vw, 61px);
          line-height: 1.08;
          letter-spacing: -2.5px;
          margin: 23px 0 15px;
          font-weight: 900;
        }

        .lm-hero h1 span {
          color: var(--orange);
        }

        .lm-hero p {
          font-size: 16px;
          color: var(--muted);
          line-height: 1.8;
          max-width: 590px;
          margin: auto;
        }

        .lm-marketplaces {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 22px;
          margin-top: 43px;
          text-align: left;
        }

        .lm-market-card {
          border-radius: 18px;
          padding: 30px;
          min-height: 310px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          overflow: hidden;
          position: relative;
          transition: transform .25s, box-shadow .25s;
        }

        .lm-market-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 18px 40px rgba(0,0,0,.10);
        }

        .lm-local {
          background: #171512;
          color: white;
        }

        .lm-market {
          background: linear-gradient(135deg, #FF5C00, #FF8749);
          color: white;
        }

        .lm-card-tag {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1px;
          opacity: .8;
          text-transform: uppercase;
        }

        .lm-card-icon {
          font-size: 48px;
          margin: 17px 0;
        }

        .lm-market-card h2 {
          font-size: 28px;
          margin: 0 0 12px;
          letter-spacing: -.8px;
        }

        .lm-market-card p {
          color: rgba(255,255,255,.78);
          font-size: 14px;
          line-height: 1.8;
          margin: 0;
          max-width: 370px;
        }

        .lm-card-bottom {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          margin-top: 28px;
        }

        .lm-card-btn {
          background: white;
          color: var(--dark) !important;
          padding: 13px 19px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 800;
          display: inline-block;
          transition: .2s;
        }

        .lm-local .lm-card-btn {
          color: var(--orange) !important;
        }

        .lm-card-btn:hover {
          transform: translateY(-2px);
        }

        .lm-arrow {
          font-size: 30px;
          opacity: .65;
        }

        .lm-section {
          padding: 65px 0;
        }

        .lm-section-heading {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 28px;
        }

        .lm-section-heading h2 {
          font-size: 27px;
          letter-spacing: -.8px;
          margin: 0 0 8px;
        }

        .lm-section-heading p {
          color: var(--muted);
          margin: 0;
          font-size: 14px;
        }

        .lm-see-all {
          color: var(--orange) !important;
          font-size: 13px;
          font-weight: 800;
          white-space: nowrap;
        }

        .lm-categories {
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          gap: 14px;
        }

        .lm-category {
          background: #faf9f7;
          border: 1px solid #f0eeeb;
          border-radius: 13px;
          padding: 23px 10px;
          text-align: center;
          transition: .2s;
        }

        .lm-category:hover {
          border-color: var(--orange);
          background: #fff7f2;
          transform: translateY(-3px);
        }

        .lm-category-icon {
          font-size: 30px;
          display: block;
          margin-bottom: 12px;
        }

        .lm-category-name {
          font-size: 12px;
          font-weight: 750;
          line-height: 1.4;
        }

        .lm-local-banner {
          background: #171512;
          color: white;
          border-radius: 18px;
          padding: 40px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 25px;
          overflow: hidden;
        }

        .lm-local-banner h2 {
          font-size: 27px;
          margin: 0 0 12px;
        }

        .lm-local-banner p {
          color: #bdb7b0;
          font-size: 14px;
          line-height: 1.7;
          max-width: 540px;
          margin: 0;
        }

        .lm-banner-btn {
          background: var(--orange);
          color: white !important;
          padding: 15px 23px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 800;
          white-space: nowrap;
        }

        .lm-benefits {
          background: var(--bg);
        }

        .lm-benefit-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 18px;
        }

        .lm-benefit {
          background: white;
          padding: 25px 20px;
          border-radius: 13px;
          border: 1px solid #eee9e4;
        }

        .lm-benefit-icon {
          font-size: 30px;
          margin-bottom: 18px;
        }

        .lm-benefit h3 {
          font-size: 15px;
          margin: 0 0 10px;
        }

        .lm-benefit p {
          color: var(--muted);
          font-size: 13px;
          line-height: 1.7;
          margin: 0;
        }

        .lm-footer {
          background: #141210;
          color: white;
          padding: 45px 0 22px;
        }

        .lm-footer-top {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr;
          gap: 35px;
          padding-bottom: 35px;
        }

        .lm-footer-logo {
          color: var(--orange);
          font-size: 28px;
          font-weight: 950;
          letter-spacing: -1.5px;
          margin-bottom: 15px;
        }

        .lm-footer-about {
          color: #aaa39c;
          font-size: 13px;
          line-height: 1.8;
          max-width: 300px;
        }

        .lm-footer h4 {
          font-size: 13px;
          margin: 5px 0 20px;
        }

        .lm-footer-links {
          display: flex;
          flex-direction: column;
          gap: 13px;
        }

        .lm-footer-links a {
          color: #aaa39c;
          font-size: 12px;
        }

        .lm-footer-links a:hover {
          color: var(--orange-light);
        }

        .lm-footer-bottom {
          border-top: 1px solid #302b26;
          padding-top: 20px;
          display: flex;
          justify-content: space-between;
          gap: 15px;
          color: #918980;
          font-size: 11px;
        }

        @media(max-width: 900px) {
          .lm-categories {
            grid-template-columns: repeat(4, 1fr);
          }

          .lm-benefit-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .lm-footer-top {
            grid-template-columns: 2fr 1fr 1fr;
          }

          .lm-footer-about-column {
            grid-column: 1 / -1;
          }
        }

        @media(max-width: 600px) {
          .lm-container {
            width: 92%;
          }

          .lm-header-inner {
            min-height: 62px;
            flex-wrap: wrap;
            gap: 10px;
            padding: 12px 0;
          }

          .lm-logo {
            font-size: 25px;
          }

          .lm-header-actions {
            gap: 13px;
            font-size: 11px;
          }

          .lm-search {
            order: 3;
            flex-basis: 100%;
            max-width: none;
          }

          .lm-search input {
            font-size: 12px;
          }

          .lm-hero {
            padding: 43px 0 35px;
          }

          .lm-hero h1 {
            font-size: 38px;
            letter-spacing: -1.7px;
          }

          .lm-hero p {
            font-size: 13px;
          }

          .lm-marketplaces {
            grid-template-columns: 1fr;
            gap: 14px;
            margin-top: 30px;
          }

          .lm-market-card {
            min-height: 270px;
            padding: 23px;
          }

          .lm-market-card h2 {
            font-size: 25px;
          }

          .lm-section {
            padding: 43px 0;
          }

          .lm-section-heading h2 {
            font-size: 22px;
          }

          .lm-section-heading p {
            font-size: 12px;
          }

          .lm-categories {
            grid-template-columns: repeat(4, 1fr);
            gap: 9px;
          }

          .lm-category {
            padding: 17px 5px;
            border-radius: 10px;
          }

          .lm-category-icon {
            font-size: 25px;
          }

          .lm-category-name {
            font-size: 10px;
          }

          .lm-local-banner {
            padding: 27px 22px;
            flex-direction: column;
            align-items: flex-start;
          }

          .lm-local-banner h2 {
            font-size: 23px;
          }

          .lm-benefit-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }

          .lm-benefit {
            padding: 19px 14px;
          }

          .lm-benefit h3 {
            font-size: 13px;
          }

          .lm-benefit p {
            font-size: 11px;
          }

          .lm-footer {
            padding-top: 35px;
          }

          .lm-footer-top {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 15px;
          }

          .lm-footer-about-column {
            grid-column: 1 / -1;
          }

          .lm-footer h4 {
            font-size: 12px;
          }

          .lm-footer-links {
            gap: 12px;
          }

          .lm-footer-links a {
            font-size: 11px;
          }

          .lm-footer-bottom {
            flex-direction: column;
            line-height: 1.6;
          }
        }

        @media(max-width: 360px) {
          .lm-header-actions {
            gap: 8px;
          }

          .lm-benefit-grid {
            grid-template-columns: 1fr;
          }

          .lm-categories {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>

      {/* HEADER */}
      <header className="lm-header">
        <div className="lm-container lm-header-inner">

          <a href="/loemart" className="lm-logo">
            loemart<span style={{color:"#141210"}}>.</span>
          </a>

          <form
            className="lm-search"
            onSubmit={(e) => e.preventDefault()}
          >
            <input
              type="search"
              placeholder="Search products, brands and more..."
              aria-label="Search Loemart"
            />
            <button type="submit">Search</button>
          </form>

          <div className="lm-header-actions">
            <a href="/login">Account</a>
            <a href="/nearby">Explore</a>
            <a href="/trending">Shop</a>
          </div>

        </div>
      </header>

      {/* HERO */}
      <section className="lm-hero">
        <div className="lm-container">

          <div className="lm-hero-content">
            <span className="lm-eyebrow">
              Nigeria's Neighbourhood Marketplace
            </span>

            <h1>
              Everything you need.<br />
              <span>One Loemart.</span>
            </h1>

            <p>
              Discover amazing products, connect with local sellers
              and shop conveniently across Nigeria.
              One platform. Two ways to shop.
            </p>
          </div>

          {/* TWO MARKETPLACES */}
          <div className="lm-marketplaces">

            <article className="lm-market-card lm-local">

              <div>
                <div className="lm-card-tag">
                  MARKETPLACE 01 · LOCAL
                </div>

                <div className="lm-card-icon">🏪</div>

                <h2>Loemart Local</h2>

                <p>
                  Buy and sell around you. Discover local listings,
                  connect directly with sellers and arrange pickup
                  or delivery.
                </p>
              </div>

              <div className="lm-card-bottom">
                <a href="/nearby" className="lm-card-btn">
                  Explore Local →
                </a>

                <span className="lm-arrow">↗</span>
              </div>

            </article>

            <article className="lm-market-card lm-market">

              <div>
                <div className="lm-card-tag">
                  MARKETPLACE 02 · ONLINE SHOPPING
                </div>

                <div className="lm-card-icon">🛍️</div>

                <h2>Loemart Market</h2>

                <p>
                  Discover products, add your favourites to cart
                  and enjoy convenient online checkout with
                  Managed Delivery by Loemart.
                </p>
              </div>

              <div className="lm-card-bottom">
                <a href="/trending" className="lm-card-btn">
                  Shop Marketplace →
                </a>

                <span className="lm-arrow">↗</span>
              </div>

            </article>

          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="lm-section">
        <div className="lm-container">

          <div className="lm-section-heading">
            <div>
              <h2>Explore Categories</h2>
              <p>Discover what you're looking for.</p>
            </div>

            <a href="/trending" className="lm-see-all">
              Explore all →
            </a>
          </div>

          <div className="lm-categories">
            {categories.map((category) => (
              <a
                href="/trending"
                className="lm-category"
                key={category.name}
              >
                <span className="lm-category-icon">
                  {category.icon}
                </span>

                <span className="lm-category-name">
                  {category.name}
                </span>
              </a>
            ))}
          </div>

        </div>
      </section>

      {/* LOCAL MARKETPLACE PROMOTION */}
      <section className="lm-section" style={{paddingTop:10}}>
        <div className="lm-container">

          <div className="lm-local-banner">
            <div>
              <h2>Have something to sell?</h2>

              <p>
                Turn your items into opportunities.
                Reach potential buyers and list your products
                on Loemart Local.
              </p>
            </div>

            <a href="/minimart/add" className="lm-banner-btn">
              Start Selling →
            </a>
          </div>

        </div>
      </section>

      {/* BENEFITS */}
      <section className="lm-section lm-benefits">
        <div className="lm-container">

          <div className="lm-section-heading">
            <div>
              <h2>Why Loemart?</h2>
              <p>More opportunities. More convenience. One platform.</p>
            </div>
          </div>

          <div className="lm-benefit-grid">
            {benefits.map((benefit) => (
              <article className="lm-benefit" key={benefit.title}>
                <div className="lm-benefit-icon">
                  {benefit.icon}
                </div>

                <h3>{benefit.title}</h3>

                <p>{benefit.text}</p>
              </article>
            ))}
          </div>

        </div>
      </section>

      {/* FOOTER */}
      <footer className="lm-footer">
        <div className="lm-container">

          <div className="lm-footer-top">

            <div className="lm-footer-about-column">
              <div className="lm-footer-logo">
                loemart.
              </div>

              <p className="lm-footer-about">
                Loemart is your neighbourhood marketplace.
                Discover products, connect with sellers and
                experience a better way to buy and sell across Nigeria.
              </p>
            </div>

            <div>
              <h4>Marketplace</h4>

              <div className="lm-footer-links">
                <a href="/nearby">Loemart Local</a>
                <a href="/trending">Loemart Market</a>
                <a href="/deals">Deals</a>
                <a href="/latest">Latest Listings</a>
              </div>
            </div>

            <div>
              <h4>Sellers</h4>

              <div className="lm-footer-links">
                <a href="/minimart/add">Start Selling</a>
                <a href="/seller-guide">Seller Guide</a>
                <a href="/pricing">Pricing</a>
                <a href="/promoted">Promotions</a>
              </div>
            </div>

            <div>
              <h4>Support</h4>

              <div className="lm-footer-links">
                <a href="/contact">Contact Us</a>
                <a href="/help">Help Centre</a>
                <a href="/privacy">Privacy Policy</a>
                <a href="/terms">Terms & Conditions</a>
              </div>
            </div>

          </div>

          <div className="lm-footer-bottom">
            <span>© {new Date().getFullYear()} Loemart. All rights reserved.</span>
            <span>Buy. Sell. Connect. Grow.</span>
          </div>

        </div>
      </footer>

    </div>
  );
}