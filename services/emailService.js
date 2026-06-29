/**
 * server/services/emailService.js
 * Add this function alongside your existing email helpers
 */

const sendPasswordResetOtp = async ({ to, name, otp }) => {
  const subject = "Your Loemart Password Reset Code";

  const html = `
    <div style="
      font-family : Inter, Arial, sans-serif;
      max-width   : 480px;
      margin      : 0 auto;
      background  : #ffffff;
      border      : 1px solid #EDE8E3;
      border-radius: 12px;
      overflow    : hidden;
    ">
      <!-- Header -->
      <div style="
        background : linear-gradient(135deg, #1A0A00, #3D1A00);
        padding    : 28px 32px;
        text-align : center;
      ">
        <h1 style="
          color       : #FF5C00;
          font-size   : 24px;
          font-weight : 800;
          margin      : 0;
          letter-spacing: -0.5px;
        ">
          Loe<span style="color:#fff">mart</span>
        </h1>
      </div>

      <!-- Body -->
      <div style="padding: 32px;">
        <p style="font-size:15px; color:#1A0A00; margin:0 0 8px;">
          Hi <strong>${name}</strong>,
        </p>
        <p style="font-size:14px; color:#6B6560; line-height:1.6; margin:0 0 24px;">
          We received a request to reset your Loemart password.
          Use the code below to continue. It expires in
          <strong>15 minutes</strong>.
        </p>

        <!-- OTP -->
        <div style="
          background    : #FFF8F5;
          border        : 2px dashed #FF5C00;
          border-radius : 12px;
          padding       : 20px;
          text-align    : center;
          margin-bottom : 24px;
        ">
          <p style="
            font-size     : 36px;
            font-weight   : 800;
            letter-spacing: 10px;
            color         : #FF5C00;
            margin        : 0;
            font-family   : monospace;
          ">
            ${otp}
          </p>
          <p style="font-size:12px; color:#A09890; margin:8px 0 0;">
            This code expires in 15 minutes
          </p>
        </div>

        <!-- Warning -->
        <div style="
          background    : #FEF2F2;
          border        : 1px solid #FECACA;
          border-radius : 8px;
          padding       : 12px 16px;
          margin-bottom : 24px;
        ">
          <p style="font-size:13px; color:#DC2626; margin:0;">
            🔒 <strong>Never share this code.</strong>
            Loemart will never ask for it via phone or chat.
            If you didn't request this, you can safely ignore this email.
          </p>
        </div>

        <p style="font-size:13px; color:#A09890; margin:0;">
          This code is valid for one use only and expires after 15 minutes.
        </p>
      </div>

      <!-- Footer -->
      <div style="
        background  : #FAF8F5;
        padding     : 16px 32px;
        text-align  : center;
        border-top  : 1px solid #EDE8E3;
      ">
        <p style="font-size:12px; color:#A09890; margin:0;">
          © ${new Date().getFullYear()} Loemart. All rights reserved.
        </p>
      </div>
    </div>
  `;

  /* Use whichever mailer you already have (nodemailer / sendgrid / resend) */
  await transporter.sendMail({
    from    : `"Loemart Security" <${process.env.MAIL_FROM}>`,
    to,
    subject,
    html,
  });
};

module.exports = {
  // ...your existing exports
  sendPasswordResetOtp,
};