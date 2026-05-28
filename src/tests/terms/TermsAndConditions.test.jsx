// src/tests/terms/TermsAndConditions.test.jsx
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter }              from "react-router-dom";
import TermsAndConditions            from "../../pages/TermsAndConditions";
import * as termsStorage             from "../../utils/termsStorage";
import * as acceptanceService        from "../../services/legal/acceptanceService";

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock("../../utils/termsStorage");
jest.mock("../../services/legal/acceptanceService");
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => jest.fn(),
}));

function renderWithRouter(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("TermsAndConditions page", () => {

  beforeEach(() => {
    jest.clearAllMocks();
    termsStorage.hasAcceptedCurrentVersion.mockReturnValue(false);
    acceptanceService.postAcceptance.mockResolvedValue({ success: true });
  });

  // ──────────────────────────────────────────────────────────────────────────

  it("renders the page title", () => {
    renderWithRouter(<TermsAndConditions />);
    expect(
      screen.getByText(/Terms of Use and Posting Rules/i)
    ).toBeInTheDocument();
  });

  // ──────────────────────────────────────────────────────────────────────────

  it("renders the progress bar with zero progress initially", () => {
    renderWithRouter(<TermsAndConditions />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveAttribute("aria-valuenow", "0");
  });

  // ──────────────────────────────────────────────────────────────────────────

  it("renders the accept button in disabled state initially", () => {
    renderWithRouter(<TermsAndConditions />);
    const btn = screen.getByRole("button", { name: /accept terms/i });
    expect(btn).toBeDisabled();
  });

  // ──────────────────────────────────────────────────────────────────────────

  it("renders checkbox in disabled state before reading", () => {
    renderWithRouter(<TermsAndConditions />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeDisabled();
  });

  // ──────────────────────────────────────────────────────────────────────────

  it("auto-unlocks for returning users who accepted current version", () => {
    termsStorage.hasAcceptedCurrentVersion.mockReturnValue(true);

    renderWithRouter(<TermsAndConditions />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeDisabled();
    expect(checkbox).toBeChecked();
  });

  // ──────────────────────────────────────────────────────────────────────────

  it("renders all required section headings", () => {
    renderWithRouter(<TermsAndConditions />);

    const expectedSections = [
      "Legal Compliance",
      "Payment and Transactions",
      "Prohibited Items",
      "Listing and Photo Guidelines",
      "Safety Guidelines",
      "Privacy and Data",
      "Fraud Reporting",
      "Account Suspension",
      "Limitation of Liability",
      "Electronic Acceptance",
      "Governing Law",
      "Changes to Terms",
      "Contact Us",
    ];

    expectedSections.forEach((heading) => {
      expect(
        screen.getByText(new RegExp(heading, "i"))
      ).toBeInTheDocument();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────

  it("renders the skip-to-content accessibility link", () => {
    renderWithRouter(<TermsAndConditions />);
    const skip = screen.getByText(/skip to content/i);
    expect(skip).toBeInTheDocument();
  });

  // ──────────────────────────────────────────────────────────────────────────

  it("does not allow acceptance with checkbox unchecked", () => {
    termsStorage.hasAcceptedCurrentVersion.mockReturnValue(true);

    renderWithRouter(<TermsAndConditions />);

    const checkbox = screen.getByRole("checkbox");
    const btn      = screen.getByRole("button", { name: /accept terms/i });

    // Uncheck the pre-checked box
    fireEvent.click(checkbox);
    expect(btn).toBeDisabled();
  });

});