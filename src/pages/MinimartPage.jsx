
// src/pages/ComingSoon.jsx

import { Link } from "react-router-dom";
import BottomNav from "../components/BottomNav";

export default function ComingSoon() {
  return (
    <>
      <style>{`
        :root {
          --primary: #e8630a;
          --bg: var(--bg-color, #f8fafc);
          --card: var(--card-bg, #ffffff);
          --text: var(--text-color, #111827);
          --muted: var(--text-secondary, #6b7280);
        }

        * {
          box-sizing: border-box;
        }

        .coming-page {
          min-height: 100vh;
          background: var(--bg);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 20px 100px;
        }

        .coming-card {
          width: 100%;
          max-width: 520px;
          background: var(--card);
          border-radius: 20px;
          padding: 40px 28px;
          text-align: center;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08);
          border: 1px solid rgba(0, 0, 0, 0.08);
          animation: fadeIn .35s ease;
        }

        .coming-icon {
          width: 88px;
          height: 88px;
          margin: 0 auto 24px;
          border-radius: 50%;
          background: rgba(232, 99, 10, 0.12);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 42px;
        }

        .coming-title {
          margin: 0;
          color: var(--text);
          font-size: 2rem;
          font-weight: 700;
        }

        .coming-text {
          margin: 18px 0 32px;
          color: var(--muted);
          font-size: 1rem;
          line-height: 1.8;
        }

        .coming-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          max-width: 220px;
          padding: 14px 24px;
          border-radius: 12px;
          background: var(--primary);
          color: #fff;
          text-decoration: none;
          font-size: 1rem;
          font-weight: 600;
          transition: all .25s ease;
        }

        .coming-btn:hover {
          transform: translateY(-2px);
          opacity: .95;
        }

        .coming-btn:active {
          transform: scale(.98);
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 600px) {
          .coming-page {
            padding: 20px 16px 90px;
          }

          .coming-card {
            padding: 32px 22px;
          }

          .coming-title {
            font-size: 1.75rem;
          }

          .coming-text {
            font-size: .95rem;
          }

          .coming-icon {
            width: 76px;
            height: 76px;
            font-size: 36px;
          }

          .coming-btn {
            max-width: 100%;
          }
        }
      `}</style>

      <main className="coming-page">
        <div className="coming-card">
          <div className="coming-icon">✨</div>

          <h1 className="coming-title">Coming Soon</h1>

          <p className="coming-text">
            This feature is currently under development and will be available
            in a future update.
            <br />
            <br />
            Thank you for your patience!
          </p>

          <Link to="/" className="coming-btn">
            Back to Home
          </Link>
        </div>
      </main>

      <BottomNav />
    </>
  );
}