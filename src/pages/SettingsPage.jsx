import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Settings() {
  const [active, setActive] = useState("profile");
  const navigate = useNavigate();

  const renderContent = () => {
    switch (active) {

      case "profile":
        return (
          <div>
            <h2 className="text-xl font-semibold mb-4">Profile Information</h2>

            <input className="border p-2 w-full mb-2 rounded" placeholder="Full Name" />
            <input className="border p-2 w-full mb-2 rounded" placeholder="Email" />
            <input className="border p-2 w-full mb-2 rounded" placeholder="Phone Number" />
            <input className="border p-2 w-full mb-2 rounded" placeholder="Location" />

            <button className="bg-green-600 text-white px-4 py-2 rounded">
              Save Profile
            </button>
          </div>
        );

      case "security":
        return (
          <div>
            <h2 className="text-xl font-semibold mb-4">Security</h2>

            <input type="password" className="border p-2 w-full mb-2 rounded" placeholder="Current Password" />
            <input type="password" className="border p-2 w-full mb-2 rounded" placeholder="New Password" />

            <button className="bg-green-600 text-white px-4 py-2 rounded">
              Update Password
            </button>
          </div>
        );

      case "notifications":
        return (
          <div>
            <h2 className="text-xl font-semibold mb-4">Notifications</h2>

            <label className="flex items-center gap-2 mb-2">
              <input type="checkbox" />
              Email Notifications
            </label>

            <label className="flex items-center gap-2 mb-2">
              <input type="checkbox" />
              SMS Notifications
            </label>

            <label className="flex items-center gap-2">
              <input type="checkbox" />
              Order Updates
            </label>
          </div>
        );

      case "address":
        return (
          <div>
            <h2 className="text-xl font-semibold mb-4">Address</h2>

            <input className="border p-2 w-full mb-2 rounded" placeholder="Street Address" />
            <input className="border p-2 w-full mb-2 rounded" placeholder="City" />
            <input className="border p-2 w-full mb-2 rounded" placeholder="State" />

            <button className="bg-green-600 text-white px-4 py-2 rounded">
              Save Address
            </button>
          </div>
        );

      case "verification":
        return (
          <div>
            <h2 className="text-xl font-semibold mb-4">Seller Verification</h2>

            <p className="text-gray-500 mb-4">
              Upload a valid ID to become a verified seller.
            </p>

            <input type="file" className="mb-4" />

            <button className="bg-green-600 text-white px-4 py-2 rounded">
              Submit Verification
            </button>
          </div>
        );

      case "danger":
        return (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-red-600">Danger Zone</h2>

            <button className="bg-red-600 text-white px-4 py-2 rounded">
              Delete Account
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-100">

      {/* Sidebar */}

      <div className="w-64 bg-white shadow p-6">

        <h1 className="text-xl font-bold mb-6">Settings</h1>

        <ul className="space-y-3">

          <li><button onClick={() => setActive("profile")} className="w-full text-left">Profile</button></li>

          <li><button onClick={() => setActive("security")} className="w-full text-left">Security</button></li>

          <li><button onClick={() => setActive("notifications")} className="w-full text-left">Notifications</button></li>

          <li><button onClick={() => setActive("address")} className="w-full text-left">Address</button></li>

          <li><button onClick={() => setActive("verification")} className="w-full text-left">Seller Verification</button></li>

          <li><button onClick={() => setActive("danger")} className="w-full text-left text-red-600">Danger Zone</button></li>

        </ul>

      </div>

      {/* Main Content */}

      <div className="flex-1">

        {/* Header with back arrow */}

        <div className="bg-white shadow px-6 py-4 flex items-center gap-4">

          <button
            onClick={() => navigate(-1)}
            className="text-xl font-bold"
          >
            ←
          </button>

          <h1 className="text-xl font-semibold">
            Settings
          </h1>

        </div>

        <div className="p-8">

          <div className="bg-white p-6 rounded shadow max-w-xl">
            {renderContent()}
          </div>

        </div>

      </div>

    </div>
  );
}