import axios from "axios";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

/**
 * Verify a Paystack transaction
 * @param {string} reference
 * @returns {Promise<Object>} transaction data
 */
export const verifyPaystackPayment = async (reference) => {
  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const data = response.data;

    if (data.status === true && data.data.status === "success") {
      return {
        success: true,
        amount: data.data.amount / 100, // convert kobo → naira
        reference: data.data.reference,
        email: data.data.customer.email,
      };
    }

    return { success: false };
  } catch (err) {
    console.error("❌ Paystack verification error:", err.message);
    return { success: false, error: err.message };
  }
};