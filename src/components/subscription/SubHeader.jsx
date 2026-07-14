import { useNavigate } from "react-router-dom";

const SubHeader = ({ title, showPlans = true }) => {
  const navigate = useNavigate();

  return (
    <header className="sub-page-header">
      <div className="sub-page-header__left">
        <button
          onClick={() => navigate(-1)}
          className="sub-page-header__back"
          aria-label="Go back"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <h1 className="sub-page-header__title">{title}</h1>
      </div>

      <div className="sub-page-header__right">
        {showPlans && (
          <button
            onClick={() => navigate("/seller/subscription/plans")}
            className="sub-page-header__action"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" />
              <path d="M3 20h18" />
            </svg>
            Plans
          </button>
        )}

        <button
          onClick={() => navigate("/profile")}
          className="sub-page-header__action"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          Profile
        </button>
      </div>
    </header>
  );
};

export default SubHeader;