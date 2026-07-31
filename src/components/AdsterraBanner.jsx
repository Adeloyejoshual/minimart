import { useEffect, useRef } from "react";

/**
 * Adsterra Banner Ad Component
 * Dynamically injects atOptions + invoke.js scripts
 */
export default function AdsterraBanner({
  adKey,
  width = 320,
  height = 50,
  className = "",
}) {
  const adRef  = useRef(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current || !adRef.current || !adKey || adKey.includes("YOUR_")) return;
    loaded.current = true;

    // Inject atOptions config
    const configScript = document.createElement("script");
    configScript.type = "text/javascript";
    configScript.innerHTML = `
      atOptions = {
        'key' : '${adKey}',
        'format' : 'iframe',
        'height' : ${height},
        'width' : ${width},
        'params' : {}
      };
    `;
    adRef.current.appendChild(configScript);

    // Inject invoke.js
    const invokeScript = document.createElement("script");
    invokeScript.type = "text/javascript";
    invokeScript.src = `//3nbf4.com/${adKey}/invoke.js`;
    invokeScript.async = true;
    adRef.current.appendChild(invokeScript);
  }, [adKey, width, height]);

  // Don't render if no valid key
  if (!adKey || adKey.includes("YOUR_")) return null;

  return (
    <div className={`adsterra-wrap ${className}`} style={{ minHeight: height + 20 }}>
      <span className="adsterra-label">Advertisement</span>
      <div
        ref={adRef}
        className="adsterra-slot"
        style={{ width, minHeight: height }}
      />
    </div>
  );
}