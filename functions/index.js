const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const cors = require("cors")({ origin: true });

admin.initializeApp();

exports.verifyPaystackPayment = functions.https.onRequest(
  (req, res) => {
    cors(req, res, async () => {
      try {
        const { reference } = req.body;

        if (!reference) {
          return res.status(400).json({ error: "Reference required" });
        }

        // 🔐 VERIFY WITH PAYSTACK (SECRET KEY)
        const paystackRes = await axios.get(
          `https://api.paystack.co/transaction/verify/${reference}`,
          {
            headers: {
              Authorization: `Bearer ${functions.config().paystack.secret}`,
            },
          }
        );

        const data = paystackRes.data.data;

        if (data.status !== "success") {
          return res.status(400).json({ error: "Payment not successful" });
        }

        // ✅ SAVE VERIFIED PAYMENT
        await admin.firestore().collection("payments").add({
          reference: data.reference,
          amount: data.amount / 100,
          email: data.customer.email,
          userId: data.metadata?.userId || null,
          channel: data.channel,
          verified: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return res.json({
          verified: true,
          reference: data.reference,
        });
      } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Verification failed" });
      }
    });
  }
);