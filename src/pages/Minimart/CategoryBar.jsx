import React, { memo, useRef, useEffect } from "react";
import categories from "../../config/categories";

const ALL_CATS = [{ id: "", name: "All", icon: "🛍️" }, ...categories];

const CategoryBar = memo(function CategoryBar({ active, onChange }) {
  const scrollRef = useRef();

  useEffect(() => {
    const el = scrollRef.current?.querySelector(".mp-cat-btn--active");
    el?.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
  }, [active]);

  return (
    <div className="mp-cats" ref={scrollRef} role="tablist" aria-label="Categories">
      {ALL_CATS.map((c) => (
        <button
          key={c.id}
          className={`mp-cat-btn ${active === c.id ? "mp-cat-btn--active" : ""}`}
          onClick={() => onChange(c.id)}
          role="tab"
          aria-selected={active === c.id}
        >
          <span className="mp-cat-icon">{c.icon}</span>
          <span className="mp-cat-label">{c.name}</span>
        </button>
      ))}
    </div>
  );
});

export default CategoryBar;