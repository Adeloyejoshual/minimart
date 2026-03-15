import { useState } from "react";

export default function Settings() {
  const [active, setActive] = useState("profile");

  const renderContent = () => {
    switch (active) {
      case "profile":
        return (
          <>
            <h2 className="text-xl font-semibold mb-4">Profile</h2>
            <input className="border p-2 w-full mb-2 rounded" placeholder="Full Name" />
            <input className="border p-2 w-full mb-2 rounded" placeholder="Email" />
            <button className="bg-green-600 text-white px-4 py-2 rounded">
              Save Changes
            </button>
          </>
        );

      case "security":
        return (
          <>
            <h2 className="text-xl font-semibold mb-4">Security</h2>
            <input type="password" className="border p-2 w-full mb-2 rounded" placeholder="New Password" />
            <button className="bg-green-600 text-white px-4 py-2 rounded">
              Update Password
            </button>
          </>
        );

      case "notifications":
        return (
          <>
            <h2 className="text-xl font-semibold mb-4">Notifications</h2>
            <label className="flex items-center gap-2">
              <input type="checkbox" />
              Email notifications
            </label>
            <label className="flex items-center gap-2 mt-2">
              <input type="checkbox" />
              SMS notifications
            </label>
          </>
        );

      case "bank":
        return (
          <>
            <h2 className="text-xl font-semibold mb-4">Bank Details</h2>
            <input className="border p-2 w-full mb-2 rounded" placeholder="Bank Name" />
            <input className="border p-2 w-full mb-2 rounded" placeholder="Account Number" />
            <button className="bg-green-600 text-white px-4 py-2 rounded">
              Save Bank
            </button>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-100">

      {/* Sidebar */}
      <div className="w-64 bg-white shadow p-4">

        <h1 className="text-xl font-bold mb-6">Settings</h1>

        <ul className="space-y-3">

          <li>
            <button onClick={() => setActive("profile")} className="w-full text-left">
              Profile
            </button>
          </li>

          <li>
            <button onClick={() => setActive("security")} className="w-full text-left">
              Security
            </button>
          </li>

          <li>
            <button onClick={() => setActive("notifications")} className="w-full text-left">
              Notifications
            </button>
          </li>

          <li>
            <button onClick={() => setActive("bank")} className="w-full text-left">
              Bank Details
            </button>
          </li>

        </ul>
      </div>

      {/* Content */}
      <div className="flex-1 p-8">

        <div className="bg-white p-6 rounded shadow max-w-xl">
          {renderContent()}
        </div>

      </div>

    </div>
  );
}