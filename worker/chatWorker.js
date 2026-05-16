// worker/chatWorker.js
import { sub, pub } from "../config/redis.js";
import { pool } from "../config/db.js";

sub.subscribe("chat_events");

sub.on("message", async (_, message) => {
  const event = JSON.parse(message);

  if (event.type === "NEW_MESSAGE") {
    const m = event.payload;

    // idempotency check
    const exists = await pool.query(
      `SELECT 1 FROM chat_messages WHERE client_message_id = $1`,
      [m.client_message_id]
    );

    if (exists.rowCount) return;

    // insert message
    await pool.query(`
      INSERT INTO chat_messages (
        id, thread_id, sender_id, message, status, client_message_id
      ) VALUES ($1,$2,$3,$4,$5,$6)
    `, [
      m.id,
      m.thread_id,
      m.sender_id,
      m.message,
      "sent",
      m.client_message_id
    ]);

    // update thread
    await pool.query(`
      UPDATE chat_threads
      SET last_message = $1,
          last_message_at = now()
      WHERE id = $2
    `, [m.message, m.thread_id]);

    // emit delivered event
    await pub.publish("chat_events", JSON.stringify({
      type: "DELIVERED",
      threadId: m.thread_id,
      payload: { messageId: m.id }
    }));
  }
});