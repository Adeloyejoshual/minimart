import { Link } from "react-router-dom";
import BottomNav from "../components/BottomNav";

export default function ComingSoon() {
  return (
    <>
      <style>{`
        /* Your CSS here */
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

      <BottomNav />
    </>
  );
}