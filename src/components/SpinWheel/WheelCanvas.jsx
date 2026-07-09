import { useRef, useEffect, useCallback, useMemo } from "react";

export default function WheelCanvas({
  segments,
  targetSegmentId,
  spinning,
  onSpinEnd,
  onTick,
}) {
  const canvasRef   = useRef(null);
  const rafRef      = useRef(null);
  const angleRef    = useRef(0);
  const lastTickSeg = useRef(-1);

  const size = useMemo(
    () =>
      Math.min(
        typeof window !== "undefined" ? window.innerWidth - 48 : 320,
        320
      ),
    []
  );

  /* ── Draw ── */
  const draw = useCallback(
    (angle) => {
      const canvas = canvasRef.current;
      if (!canvas || !segments.length) return;

      const ctx    = canvas.getContext("2d");
      const W      = canvas.width;
      const H      = canvas.height;
      const cx     = W / 2;
      const cy     = H / 2;
      const radius = Math.min(cx, cy) - 4;
      const arc    = (2 * Math.PI) / segments.length;

      ctx.clearRect(0, 0, W, H);

      /* Outer glow ring */
      ctx.save();
      ctx.shadowBlur  = 20;
      ctx.shadowColor = "rgba(232,99,10,.3)";
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 4, 0, 2 * Math.PI);
      ctx.strokeStyle = "#e8630a";
      ctx.lineWidth   = 3;
      ctx.stroke();
      ctx.restore();

      /* Segments */
      segments.forEach((seg, i) => {
        const startAngle =
          arc * i + (angle * Math.PI) / 180 - Math.PI / 2;
        const endAngle = startAngle + arc;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle =
          i % 2 === 0 ? seg.color : seg.color + "cc";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.3)";
        ctx.lineWidth   = 1.5;
        ctx.stroke();

        /* Label */
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(startAngle + arc / 2);
        ctx.textAlign = "right";

        ctx.font      = `${radius * 0.13}px serif`;
        ctx.fillStyle = "#fff";
        ctx.fillText(seg.emoji || "★", radius * 0.82, 5);

        ctx.font        = `bold ${radius * 0.085}px 'DM Sans',sans-serif`;
        ctx.fillStyle   = "#fff";
        ctx.shadowColor = "rgba(0,0,0,.4)";
        ctx.shadowBlur  = 4;
        ctx.fillText(seg.label, radius * 0.62, -radius * 0.01 + 5);
        ctx.restore();
      });

      /* Center cap */
      const grad = ctx.createRadialGradient(
        cx, cy, 0, cx, cy, radius * 0.12
      );
      grad.addColorStop(0, "#fff");
      grad.addColorStop(1, "#f0ede8");

      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.12, 0, 2 * Math.PI);
      ctx.fillStyle   = grad;
      ctx.fill();
      ctx.strokeStyle = "#e8630a";
      ctx.lineWidth   = 3;
      ctx.stroke();

      ctx.font      = `bold ${radius * 0.08}px sans-serif`;
      ctx.fillStyle = "#e8630a";
      ctx.textAlign = "center";
      ctx.fillText("★", cx, cy + 5);
    },
    [segments]
  );

  useEffect(() => { draw(angleRef.current); }, [draw]);

  /* ── Animation ── */
  useEffect(() => {
    if (!spinning || !segments.length || targetSegmentId == null) return;

    const segCount    = segments.length;
    const segAngle    = 360 / segCount;
    const targetIdx   = segments.findIndex((s) => s.id === targetSegmentId);
    if (targetIdx < 0) return;

    const segMidpoint  = segAngle * targetIdx + segAngle / 2;
    const stopAngle    = 360 - segMidpoint;
    const rotations    = (5 + Math.floor(Math.random() * 3)) * 360;
    const finalAngle   = stopAngle + rotations;
    const TOTAL_FRAMES = 130 + Math.floor(Math.random() * 40);
    let   frame        = 0;

    const animate = () => {
      frame++;
      const progress       = frame / TOTAL_FRAMES;
      const eased          = 1 - Math.pow(1 - progress, 3);
      angleRef.current     = eased * finalAngle;
      draw(angleRef.current % 360);

      const curSeg =
        Math.floor((angleRef.current % 360) / segAngle) % segCount;
      if (curSeg !== lastTickSeg.current) {
        lastTickSeg.current = curSeg;
        onTick?.();
      }

      if (frame < TOTAL_FRAMES) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        angleRef.current = finalAngle % 360;
        draw(angleRef.current);
        onSpinEnd?.();
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [spinning, targetSegmentId, segments, draw, onSpinEnd, onTick]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{
        display     : "block",
        maxWidth    : "100%",
        borderRadius: "50%",
      }}
      aria-label="Spin wheel"
      role="img"
    />
  );
}