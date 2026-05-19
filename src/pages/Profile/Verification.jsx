// React Dashboard UI inspired by finance/investment apps
// TailwindCSS required

import {
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  Users,
  Home,
  Gift,
  User,
} from "lucide-react";

export default function Dashboard() {
  const plans = [
    {
      name: "Starter Plan",
      price: "₦3,000",
      income: "₦900/day",
    },
    {
      name: "Silver Plan",
      price: "₦10,000",
      income: "₦3,500/day",
    },
    {
      name: "Gold Plan",
      price: "₦30,000",
      income: "₦9,000/day",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-100 pb-24">
      {/* Header */}
      <div className="bg-green-600 text-white p-5 rounded-b-3xl shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm opacity-80">Total Balance</p>
            <h1 className="text-3xl font-bold">₦120,000</h1>
          </div>

          <div className="bg-white/20 p-3 rounded-2xl">
            <Wallet size={28} />
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          <button className="bg-white text-green-700 rounded-2xl py-3 font-semibold flex flex-col items-center">
            <ArrowDownCircle />
            Recharge
          </button>

          <button className="bg-white text-green-700 rounded-2xl py-3 font-semibold flex flex-col items-center">
            <ArrowUpCircle />
            Withdraw
          </button>

          <button className="bg-white text-green-700 rounded-2xl py-3 font-semibold flex flex-col items-center">
            <Users />
            Invite
          </button>
        </div>
      </div>

      {/* Banner */}
      <div className="mx-4 mt-5 bg-gradient-to-r from-green-500 to-green-700 text-white p-5 rounded-3xl shadow">
        <h2 className="text-xl font-bold">Premium Membership</h2>
        <p className="opacity-90 mt-1">
          Unlock exclusive benefits and rewards
        </p>

        <button className="mt-4 bg-white text-green-700 px-5 py-2 rounded-xl font-semibold">
          Upgrade Now
        </button>
      </div>

      {/* Plans */}
      <div className="mt-6 px-4">
        <h2 className="text-xl font-bold mb-4">Available Plans</h2>

        <div className="space-y-4">
          {plans.map((plan, index) => (
            <div
              key={index}
              className="bg-white rounded-3xl p-5 shadow-md"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold">{plan.name}</h3>
                  <p className="text-gray-500">{plan.price}</p>
                </div>

                <div className="text-right">
                  <p className="text-green-600 font-bold text-lg">
                    {plan.income}
                  </p>
                  <p className="text-gray-400 text-sm">Daily Income</p>
                </div>
              </div>

              <button className="w-full mt-4 bg-green-600 text-white py-3 rounded-2xl font-semibold">
                Join Plan
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-3">
        <button className="flex flex-col items-center text-green-600">
          <Home />
          <span className="text-xs">Home</span>
        </button>

        <button className="flex flex-col items-center text-gray-500">
          <Gift />
          <span className="text-xs">Rewards</span>
        </button>

        <button className="flex flex-col items-center text-gray-500">
          <User />
          <span className="text-xs">Profile</span>
        </button>
      </div>
    </div>
  );
}