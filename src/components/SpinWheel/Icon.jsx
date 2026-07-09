import { Icons } from "./icons.jsx";

export default function Icon({ name, size = 20, className = "", style = {}, ...rest }) {
  const Fn = Icons[name];
  if (!Fn) return null;
  return (
    <span
      className={`sw-icon${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size, display: "inline-flex",
        alignItems: "center", justifyContent: "center",
        flexShrink: 0, lineHeight: 0, ...style }}
      aria-hidden="true"
      {...rest}
    >
      {Fn({ width: size, height: size })}
    </span>
  );
}