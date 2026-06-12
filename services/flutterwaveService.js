// server/services/flutterwaveService.js

const axios = require("axios");

const FLW_BASE_URL  = "https://api.flutterwave.com/v3";
const FLW_SECRET    = process.env.FLW_SECRET_KEY;

/**
 * Creates a Flutterwave hosted payment link
 * User is redirected to this link to pay
 */
exports.createPaymentLink = async ({
  amount,
  currency,
  reference,
  orderId,
  customerEmail,
  customerName,
  customerPhone,
  redirectUrl,
}) => {
  const payload = {
    tx_ref:       reference,
    amount,
    currency,
    redirect_url: redirectUrl,
    customer: {
      email:        customerEmail,
      name:         customerName,
      phonenumber:  customerPhone,
    },
    customizations: {
      title:       "MiniMart Payment",
      description: `Payment for Order ${orderId}`,
      logo:        process.env.LOGO_URL || "",
    },
    meta: {
      order_id: orderId,
    },
  };

  const response = await axios.post(
    `${FLW_BASE_URL}/payments`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${FLW_SECRET}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (response.data?.status !== "success") {
    throw new Error(
      response.data?.message || "Failed to create payment link"
    );
  }

  // Returns the hosted payment URL
  return response.data.data.link;
};

/**
 * Verify a transaction by ID
 * Called after user returns from Flutterwave
 */
exports.verifyTransaction = async (transactionId) => {
  const response = await axios.get(
    `${FLW_BASE_URL}/transactions/${transactionId}/verify`,
    {
      headers: {
        Authorization: `Bearer ${FLW_SECRET}`,
      },
    }
  );

  return response.data?.data;
};