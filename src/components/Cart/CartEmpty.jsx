// src/components/Cart/CartEmpty.jsx
import React from "react";
import "../../styles/cart/cartEmpty.css";

const CATEGORIES = [
  { emoji: "📱", label: "Phones",    href: "/market?category=phones"    },
  { emoji: "👗", label: "Fashion",   href: "/market?category=fashion"   },
  { emoji: "🏠", label: "Home",      href: "/market?category=home"      },
  { emoji: "💻", label: "Computers", href: "/market?category=computers" },
  { emoji: "🎮", label: "Gaming",    href: "/market?category=gaming"    },
  { emoji: "📦", label: "All items", href: "/market"                    },
];

export default function CartEmpty() {
  return (
    <div
      className="cart-empty"
      role="main"
      aria-label="Empty cart"
    >

      <span className="cart-empty__icon" aria-hidden="true">
        🛒
      </span>

      <h2 className="cart-empty__title">
        Your cart is empty
      </h2>

      <p className="cart-empty__subtitle">
        Looks like you haven't added anything yet.
        Discover amazing deals waiting for you.
      </p>

      <a
        className="cart-empty__cta"
        href="/market"
        aria-label="Go to market to start shopping"
      >
        🛍️ Start Shopping
      </a>

      <p className="cart-empty__divider">
        or browse categories
      </p>

      <nav
        className="cart-empty__categories"
        aria-label="Product categories"
      >
        {CATEGORIES.map((cat) => (
          <a
            key={cat.href}
            href={cat.href}
            className="cart-empty__cat-link"
            aria-label={`Browse ${cat.label}`}
          >
            {cat.emoji} {cat.label}
          </a>
        ))}
      </nav>

    </div>
  );
}