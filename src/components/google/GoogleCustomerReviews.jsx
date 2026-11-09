/**
 * src/components/google/GoogleCustomerReviews.jsx
 *
 * Google Customer Reviews opt-in for eligible Loemart Market orders.
 * The survey invitation is rendered once per confirmed order.
 */

import { useEffect } from "react";

const GOOGLE_MERCHANT_ID = 5901136034;
const GOOGLE_SCRIPT_ID = "loemart-google-customer-reviews";
const GOOGLE_SCRIPT_URL =
  "https://apis.google.com/js/platform.js?onload=renderOptIn";

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getEstimatedDeliveryDate(order) {
  const deliveryDates = (order.orders ?? [])
    .map((sellerOrder) => sellerOrder.estimated_delivery_at)
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()));

  if (deliveryDates.length) {
    return formatLocalDate(
      new Date(Math.max(...deliveryDates.map((date) => date.getTime())))
    );
  }

  // Match Loemart's existing delivery estimate when a carrier ETA is not assigned yet.
  const estimatedDate = new Date(order.created_at);
  if (Number.isNaN(estimatedDate.getTime())) return null;

  const state = String(order.state ?? "").trim().toLowerCase();
  const isLocalDelivery = state === "osun" || state === "ondo";
  estimatedDate.setDate(estimatedDate.getDate() + (isLocalDelivery ? 2 : 7));

  return formatLocalDate(estimatedDate);
}

export default function GoogleCustomerReviews({ order, trackingId }) {
  useEffect(() => {
    if (!order || !trackingId) return undefined;

    const email = String(order.customer_email ?? "").trim();
    const isCashOnDelivery = order.payment_method === "CASH_ON_DELIVERY";
    const isPaidOnline = order.payment_status === "paid";
    const isEligibleOrder = isCashOnDelivery || isPaidOnline;
    const isCancelled = order.status === "cancelled";

    if (!email || !isEligibleOrder || isCancelled) return undefined;

    const estimatedDeliveryDate = getEstimatedDeliveryDate(order);
    if (!estimatedDeliveryDate) return undefined;

    const storageKey = `loemart_google_customer_reviews_${trackingId}`;

    try {
      if (window.localStorage.getItem(storageKey) === "submitted") {
        return undefined;
      }
    } catch {
      // Continue if browser storage is unavailable.
    }

    let cancelled = false;

    const renderSurveyOptIn = () => {
      if (cancelled || !window.gapi?.load) return;

      window.gapi.load("surveyoptin", () => {
        if (cancelled || !window.gapi?.surveyoptin?.render) return;

        try {
          window.gapi.surveyoptin.render({
            merchant_id: GOOGLE_MERCHANT_ID,
            order_id: String(trackingId),
            email,
            delivery_country: "NG",
            estimated_delivery_date: estimatedDeliveryDate,
          });

          try {
            window.localStorage.setItem(storageKey, "submitted");
          } catch {
            // A storage failure must not prevent the Google opt-in.
          }
        } catch (error) {
          console.error("[Google Customer Reviews] Opt-in render failed:", error);
        }
      });
    };

    window.renderOptIn = renderSurveyOptIn;

    const existingScript = document.getElementById(GOOGLE_SCRIPT_ID);
    if (window.gapi?.load) {
      renderSurveyOptIn();
    } else if (!existingScript) {
      const script = document.createElement("script");
      script.id = GOOGLE_SCRIPT_ID;
      script.src = GOOGLE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        console.error("[Google Customer Reviews] Could not load Google platform.js");
      };
      document.head.appendChild(script);
    } else {
      existingScript.addEventListener("load", renderSurveyOptIn, { once: true });
    }

    return () => {
      cancelled = true;
      if (window.renderOptIn === renderSurveyOptIn) {
        delete window.renderOptIn;
      }
    };
  }, [order, trackingId]);

  return null;
}
