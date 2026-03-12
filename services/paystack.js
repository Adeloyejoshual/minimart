// services/paystack.js
import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

/**
 * Verify Paystack payment by reference
 * @param {string} reference
 * @returns {Promise<Object>}
 */
export const verifyPaystackPayment = async (reference) => {
  try {
    const response = await axios.get(
      `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const { status, data } = response.data;

    if (status && data.status === 'success') {
      return {
        success: true,
        data: {
          reference: data.reference,
          amount: data.amount / 100, // kobo -> naira
          customer: data.customer,
          metadata: data.metadata
        }
      };
    }

    throw new Error('Payment verification failed');
  } catch (error) {
    console.error('Paystack verification error:', error.response?.data || error.message);
    throw new Error('Payment verification failed');
  }
};

/**
 * Initialize Paystack transaction
 * @param {string} email
 * @param {number} amount - in naira
 * @param {object} metadata
 * @returns {Promise<Object>}
 */
export const initializePaystackTransaction = async (email, amount, metadata = {}) => {
  try {
    const response = await axios.post(
      `${PAYSTACK_BASE_URL}/transaction/initialize`,
      {
        email,
        amount: Math.round(amount * 100), // naira -> kobo
        metadata: {
          ...metadata,
          platform: 'marketplace-app'
        },
        callback_url: `${process.env.FRONTEND_URL}/payment/success`,
        channels: ['card', 'bank_transfer', 'ussd']
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      success: true,
      data: response.data.data
    };
  } catch (error) {
    console.error('Paystack initialization error:', error.response?.data || error.message);
    throw new Error('Failed to initialize payment');
  }
};

/**
 * Handle Paystack webhook events
 * @param {Request} req
 * @param {Response} res
 */
export const handlePaystackWebhook = async (req, res) => {
  try {
    // Validate signature
    const hash = crypto
      .createHmac('sha512', PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(400).send('Invalid signature');
    }

    const event = req.body;

    if (event.event === 'charge.success') {
      const reference = event.data.reference;

      // Verify payment
      const verification = await verifyPaystackPayment(reference);

      // TODO: update your DB (e.g., mark product as promoted)
      console.log('✅ Payment confirmed:', verification.data);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Paystack webhook error:', error);
    res.status(400).send('Webhook error');
  }
};