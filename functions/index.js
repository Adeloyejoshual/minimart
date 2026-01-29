const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const cors = require("cors")({ origin: true });

admin.initializeApp();
const db = admin.firestore();


// =====================================================
// 💳 PAYSTACK PAYMENT VERIFICATION (SECURE VERSION)
// =====================================================
exports.verifyPaystackPayment = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      // Only allow POST
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const { reference } = req.body;

      if (!reference || typeof reference !== "string") {
        return res.status(400).json({ error: "Valid payment reference required" });
      }

      // 🔐 Verify transaction with Paystack
      const paystackRes = await axios.get(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${functions.config().paystack.secret}`,
          },
        }
      );

      const data = paystackRes.data?.data;

      if (!data || data.status !== "success") {
        return res.status(400).json({ error: "Payment not successful" });
      }

      // 🚫 Prevent duplicate verification
      const existing = await db
        .collection("payments")
        .where("reference", "==", data.reference)
        .limit(1)
        .get();

      if (!existing.empty) {
        return res.json({ verified: true, message: "Payment already verified" });
      }

      // ✅ Save payment
      await db.collection("payments").add({
        reference: data.reference,
        amount: data.amount / 100,
        email: data.customer.email,
        userId: data.metadata?.userId || null,
        channel: data.channel,
        currency: data.currency,
        paidAt: new Date(data.paid_at),
        verified: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.json({
        verified: true,
        reference: data.reference,
      });

    } catch (error) {
      console.error("Paystack verification error:", error.response?.data || error.message);
      return res.status(500).json({ error: "Payment verification failed" });
    }
  });
});


// =====================================================
// 🚨 REPORT ACTIVITY LOGGER (SELLER MONITORING)
// =====================================================
exports.logReportActivity = functions.firestore
  .document("reports/{reportId}")
  .onCreate(async (snap, context) => {
    try {
      const report = snap.data();

      if (!report) return;

      const { sellerId, reason = "No reason provided", reporterId } = report;

      if (!sellerId) {
        console.warn("Report missing sellerId");
        return;
      }

      // 📝 Save log entry
      await db.collection("reportLogs").add({
        sellerId,
        reportId: context.params.reportId,
        reason,
        reporterId: reporterId || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 📊 Count seller reports
      const reportsSnapshot = await db
        .collection("reports")
        .where("sellerId", "==", sellerId)
        .get();

      const reportCount = reportsSnapshot.size;

      // 🚩 Auto-flag seller if too many reports
      if (reportCount >= 5) {
        await db.collection("flaggedSellers").doc(sellerId).set({
          sellerId,
          reportCount,
          flaggedAt: admin.firestore.FieldValue.serverTimestamp(),
          status: "under_review",
        });
      }

      console.log(`Report logged for seller ${sellerId}`);

    } catch (error) {
      console.error("Error logging report activity:", error);
    }
  });