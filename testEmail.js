import { sendMail } from "./sendMail.js";

(async () => {
  const result = await sendMail(
    "recipient@example.com",
    "Welcome to MiniMart",
    "Hello! Your account has been created successfully."
  );

  if (result) console.log("Test email sent successfully!");
  else console.log("Failed to send test email.");
})();