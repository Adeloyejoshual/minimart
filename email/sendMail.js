import nodemailer from "nodemailer";
import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

const {
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  GMAIL_REFRESH_TOKEN,
  GMAIL_USER_EMAIL
} = process.env;

const OAuth2 = google.auth.OAuth2;

const oAuth2Client = new OAuth2(
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  "https://developers.google.com/oauthplayground"
);

oAuth2Client.setCredentials({
  refresh_token: GMAIL_REFRESH_TOKEN
});

export const sendMail = async (to, subject, html) => {
  try {
    const accessToken = await oAuth2Client.getAccessToken();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: GMAIL_USER_EMAIL,
        clientId: GMAIL_CLIENT_ID,
        clientSecret: GMAIL_CLIENT_SECRET,
        refreshToken: GMAIL_REFRESH_TOKEN,
        accessToken: accessToken
      }
    });

    const mailOptions = {
      from: `"MiniMart" <${GMAIL_USER_EMAIL}>`,
      to,
      subject,
      html
    };

    return await transporter.sendMail(mailOptions);

  } catch (error) {
    console.error("Email sending failed:", error);
    throw new Error("Email sending failed");
  }
};