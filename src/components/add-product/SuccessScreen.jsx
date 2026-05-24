import { FiCheckCircle, FiClock, FiEye, FiPlus } from "react-icons/fi";

const TIMELINE = [
  {
    n: 1,
    label: "Submitted",
    desc:  "Your product has been received",
    done:  true,
    active: false,
  },
  {
    n: 2,
    label: "Under Review",
    desc:  "Admin is verifying your listing",
    done:  false,
    active: true,
  },
  {
    n: 3,
    label: "Goes Live",
    desc:  "Buyers can discover and buy your item",
    done:  false,
    active: false,
  },
];

export default function SuccessScreen({ status, onAddAnother, navigate }) {
  const isPending = status !== "active";

  return (
    <div className="ap-success">
      <div
        className={`ap-success-icon ${isPending ? "ap-success-icon--pending" : ""}`}
      >
        {isPending
          ? <FiClock size={38} />
          : <FiCheckCircle size={38} />}
      </div>

      <h2>{isPending ? "Product Submitted ⏳" : "Product is Live! 🎉"}</h2>

      <p>
        {isPending
          ? "Your product is under review. We'll notify you once it's approved. This usually takes under 24 hours."
          : "Your product is now visible to buyers on Minimart."}
      </p>

      {isPending && (
        <div className="ap-pending-timeline">
          {TIMELINE.map((s) => (
            <div key={s.n} className="ap-timeline-step">
              <div
                className={[
                  "ap-timeline-dot",
                  s.done   ? "ap-timeline-dot--done"   : "",
                  s.active ? "ap-timeline-dot--active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {s.done ? "✓" : s.n}
              </div>
              <div>
                <strong>{s.label}</strong>
                <span>{s.desc}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="ap-success-btns">
        <button
          type="button"
          className="ap-btn-primary"
          onClick={() => navigate("/vendor/dashboard")}
        >
          <FiEye size={15} /> Go to Dashboard
        </button>
        <button
          type="button"
          className="ap-btn-secondary"
          onClick={onAddAnother}
        >
          <FiPlus size={15} /> Add Another Product
        </button>
      </div>
    </div>
  );
}