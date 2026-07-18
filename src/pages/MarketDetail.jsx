import { Link } from "react-router-dom";

export default function ComingSoon() {
  return (
    <>
      <style>{`
        .coming-soon-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: var(--bg-color, #f8fafc);
        }

        .coming-soon-card {
          width: 100%;
          max-width: 500px;
          padding: 40px 28px;
          text-align: center;
          background: var(--card-bg, #fff);
          border: 1px solid rgba(0,0,0,.08);
          border-radius: 20px;
          box-shadow: 0 10px 30px rgba(0,0,0,.08);
          animation: fadeIn .35s ease;
        }

        .coming-soon-icon {
          font-size: 56px;
          margin-bottom: 16px;
        }

        .coming-soon-card h1 {
          margin: 0;
          font-size: 2rem;
          font-weight: 700;
          color: var(--text-color, #111827);
        }

        .coming-soon-card p {
          margin: 16px 0 28px;
          color: var(--text-secondary, #6b7280);
          font-size: 1rem;
          line-height: 1.7;
        }

        .coming-soon-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 12px 24px;
          background: #e8630a;
          color: #fff;
          text-decoration: none;
          border-radius: 10px;
          font-weight: 600;
          transition: all .2s ease;
        }

        .coming-soon-btn:hover {
          opacity: .92;
          transform: translateY(-2px);
        }

        .coming-soon-btn:active {
          transform: translateY(0);
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 600px) {
          .coming-soon-card {
            padding: 32px 24px;
          }

          .coming-soon-icon {
            font-size: 48px;
          }

          .coming-soon-card h1 {
            font-size: 1.75rem;
          }

          .coming-soon-btn {
            width: 100%;
          }
        }
      `}</style>

      <main className="coming-soon-page">
        <div className="coming-soon-card">
          <div className="coming-soon-icon">✨</div>

          <h1>Coming Soon</h1>

          <p>
            This feature is currently under development and will be available
            in a future update. Thank you for your patience!
          </p>

          <Link to="/" className="coming-soon-btn">
            Back to Home
          </Link>
        </div>
      </main>
    </>
  );
}