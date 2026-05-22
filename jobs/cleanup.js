import cron          from 'node-cron';
import { pool }      from '../db.js';
import { writeAudit } from '../lib/audit.js';

export const startCleanupJobs = () => {

  cron.schedule('0 3 * * *', async () => {
    const client = await pool.connect();

    try {
      const { rowCount: expired } = await client.query(`
        UPDATE email_verifications
        SET status = 'expired'
        WHERE status     = 'active'
          AND expires_at < NOW()
      `);

      const { rowCount: deleted } = await client.query(`
        DELETE FROM email_verifications
        WHERE expires_at < NOW() - INTERVAL '7 days'
      `);

      const { rowCount: devices } = await client.query(`
        DELETE FROM user_devices
        WHERE last_seen < NOW() - INTERVAL '90 days'
      `);

      console.log(
        `[Cleanup] ${expired} expired | ${deleted} deleted | ${devices} devices removed`
      );

      await writeAudit({
        actorId    : null,
        action     : 'cleanup_ran',
        targetType : 'system',
        metadata   : { expired, deleted, devices },
      });

    } catch (err) {
      console.error('[Cleanup Error]', err.message);
    } finally {
      client.release();
    }
  });

  console.log('[Jobs] Cleanup scheduled — daily 03:00 AM');
};