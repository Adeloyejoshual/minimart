const cron   = require("node-cron");
const { pool } = require("../db");

// ── Runs every day at 03:00 AM ────────────────────────────────────────────────
const startOtpCleanup = () => {
  cron.schedule("0 3 * * *", async () => {
    const client = await pool.connect();
    try {
      // Remove OTPs older than 1 day
      const { rowCount: otpCount } = await client.query(`
        DELETE FROM email_verifications
        WHERE expires_at < NOW() - INTERVAL '1 day'
      `);

      // Remove stale device records (90 days inactive)
      const { rowCount: deviceCount } = await client.query(`
        DELETE FROM user_devices
        WHERE last_seen < NOW() - INTERVAL '90 days'
      `);

      console.log(
        `[OTP Cleanup] Removed ${otpCount} expired OTPs,`,
        `${deviceCount} stale devices`
      );
    } catch (err) {
      console.error("[OTP Cleanup Error]", err.message);
    } finally {
      client.release();
    }
  });

  console.log("[OTP Cleanup] Scheduled — runs daily at 03:00 AM");
};

module.exports = { startOtpCleanup };