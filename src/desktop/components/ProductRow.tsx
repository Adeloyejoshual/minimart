// src/desktop/components/ProductRow.tsx

import { memo } from "react";
import { Ic } from "../../pages/Profile/components/icons";
import { getImg, PH, naira, fmtNum, timeAgo, daysLeft } from "../../pages/Profile/components/helpers";

interface ProductRowProps {
  product: any;
  onEdit: (p: any) => void;
  onDelete: (p: any) => void;
  onToggle: (p: any) => void;
  onRenew: (p: any) => void;
  onPromote: (p: any) => void;
  isDeleting: boolean;
}

function StatusBadge({ status, isActive }: { status: string; isActive?: boolean }) {
  const s =
    isActive && (status === "active" || status === "active_limited")
      ? "active"
      : status === "draft"
      ? "draft"
      : status === "paused"
      ? "paused"
      : status === "pending_payment"
      ? "pending"
      : status || "unknown";

  const labels: Record<string, string> = {
    active: "Active",
    draft: "Draft",
    paused: "Paused",
    pending: "Pending",
    unknown: "Unknown",
  };

  return (
    <span className={`dkd-badge dkd-badge--${s}`}>
      <span className="dkd-badge-dot" />
      {labels[s] || s}
    </span>
  );
}

function ExpiryBadge({
  activeUntil,
  isPromoted,
}: {
  activeUntil?: string;
  isPromoted?: boolean;
}) {
  const days = daysLeft(activeUntil);
  if (days === null) return null;
  if (days <= 0)
    return <span className="dkd-expiry dkd-expiry--expired">Expired</span>;
  if (days <= 3)
    return <span className="dkd-expiry dkd-expiry--critical">{days}d left</span>;
  if (days <= 7)
    return <span className="dkd-expiry dkd-expiry--warn">{days}d left</span>;
  if (isPromoted)
    return (
      <span className="dkd-expiry dkd-expiry--promoted">
        <Ic.Zap /> {days}d
      </span>
    );
  return <span className="dkd-expiry dkd-expiry--ok">{days}d left</span>;
}

const ProductRow = memo(function ProductRow({
  product,
  onEdit,
  onDelete,
  onToggle,
  onRenew,
  onPromote,
  isDeleting,
}: ProductRowProps) {
  const img = getImg(product);
  const active =
    (product.status === "active" || product.status === "active_limited") &&
    product.is_active !== false;
  const days = daysLeft(product.active_until);
  const expired = days !== null && days <= 0;

  return (
    <tr
      className={`dkd-trow${isDeleting ? " dkd-trow--del" : ""}${
        expired ? " dkd-trow--expired" : ""
      }`}
    >
      {/* Product */}
      <td>
        <div className="dkd-td-product">
          <div className="dkd-td-img">
            <img
              src={img}
              alt={product.title}
              onError={(e: any) => {
                e.currentTarget.src = PH;
              }}
            />
            {product.is_promoted && (
              <span className="dkd-td-promo-dot">
                <Ic.Zap />
              </span>
            )}
          </div>
          <div className="dkd-td-text">
            <p className="dkd-td-title">{product.title}</p>
            {product.category_name && (
              <span className="dkd-td-cat">{product.category_name}</span>
            )}
          </div>
        </div>
      </td>

      {/* Price */}
      <td className="dkd-td-price">{naira(product.price)}</td>

      {/* Status */}
      <td>
        <div className="dkd-td-status-wrap">
          <StatusBadge status={product.status} isActive={product.is_active} />
          <ExpiryBadge
            activeUntil={product.active_until}
            isPromoted={product.is_promoted}
          />
        </div>
      </td>

      {/* Views */}
      <td>
        <span className="dkd-td-metric">
          <Ic.Eye /> {fmtNum(product.views)}
        </span>
      </td>

      {/* Saves */}
      <td>
        <span className="dkd-td-metric">
          <Ic.Heart /> {fmtNum(product.favorites_count)}
        </span>
      </td>

      {/* Date */}
      <td className="dkd-td-date">{timeAgo(product.created_at)}</td>

      {/* Actions */}
      <td>
        <div className="dkd-td-actions">
          <button
            className="dkd-act dkd-act--edit"
            onClick={() => onEdit(product)}
            title="Edit"
          >
            <Ic.Edit />
          </button>
          <button
            className="dkd-act dkd-act--promote"
            onClick={() => onPromote(product)}
            title="Promote"
          >
            <Ic.Zap />
          </button>
          <button
            className={`dkd-act ${active ? "dkd-act--pause" : "dkd-act--play"}`}
            onClick={() => onToggle(product)}
            title={active ? "Pause" : "Activate"}
          >
            {active ? <Ic.Pause /> : <Ic.Play />}
          </button>
          {days !== null && days <= 7 && days > 0 && (
            <button
              className="dkd-act dkd-act--renew"
              onClick={() => onRenew(product)}
              title="Renew"
            >
              <Ic.Refresh />
            </button>
          )}
          <button
            className="dkd-act dkd-act--delete"
            onClick={() => onDelete(product)}
            title="Delete"
          >
            <Ic.Trash />
          </button>
        </div>
      </td>
    </tr>
  );
});

export default ProductRow;