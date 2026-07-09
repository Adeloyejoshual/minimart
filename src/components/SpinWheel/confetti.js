export function fireConfetti(big = false) {
  const container = document.createElement("div");
  container.style.cssText =
    "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden";
  document.body.appendChild(container);

  const colors = [
    "#e8630a", "#6366f1", "#16a34a",
    "#f59e0b", "#ec4899", "#0891b2",
  ];
  const count = big ? 160 : 100;

  for (let i = 0; i < count; i++) {
    const el    = document.createElement("div");
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size  = Math.random() * (big ? 12 : 8) + 5;
    el.style.cssText = `
      position:absolute;
      top:-10px;
      left:${Math.random() * 100}%;
      width:${size}px;
      height:${size}px;
      background:${color};
      border-radius:${Math.random() > 0.5 ? "50%" : "2px"};
      animation:sw-confetti ${Math.random() * 1500 + 1500}ms
        ${Math.random() * 800}ms ease-in forwards;
    `;
    container.appendChild(el);
  }

  setTimeout(() => {
    if (document.body.contains(container))
      document.body.removeChild(container);
  }, 3_500);
}