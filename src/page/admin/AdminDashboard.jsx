import { useEffect, useState, useMemo, useCallback } from "react";
import axios from "axios";

// ── Layout ────────────────────────────────────────────────────
import Sidebar from "./adminlayout/Sidebar";
import Topbar  from "./adminlayout/Topbar";
import { css } from "./adminlayout/css";

// ── Pages ─────────────────────────────────────────────────────
import Overview           from "./SuperAdmin/Overview";
import Users              from "./SuperAdmin/Users";
import Admins             from "./SuperAdmin/Admins";
import Products           from "./SuperAdmin/Products";
import MarketProducts     from "./SuperAdmin/MarketProducts";
import Payments           from "./SuperAdmin/Payments";
import Orders             from "./SuperAdmin/Orders";
import Withdrawals        from "./SuperAdmin/Withdrawals";
import Logs               from "./SuperAdmin/Logs";
import Promotions         from "./SuperAdmin/Promotions";
import System             from "./SuperAdmin/System";
import Reports            from "./SuperAdmin/Reports";
import Verification       from "./SuperAdmin/Verification";
import VendorVerification from "./SuperAdmin/VendorVerification";
import Leaderboard        from "./SuperAdmin/Leaderboard";
import AirtimeCoupons     from "./SuperAdmin/AirtimeCoupons";
import CouponRedemption   from "./SuperAdmin/CouponRedemption";
import AdminSubscriptions from "./SuperAdmin/AdminSubscriptions";
import SupportAdmin       from "./Support";
import SourceAnalytics    from "./tabs/SourceAnalytics";
import NewsletterAdmin   from "./SuperAdmin/NewsletterAdmin"; /* ← NEW */

// ... (keep createApi, Confirm, useData, useDerived, useActions unchanged) ...

export default function AdminDashboard() {
  const token = useMemo(() => localStorage.getItem("admin_token"), []);
  const api   = useMemo(() => createApi(token), [token]);

  /* ── Read currentUser saved by AdminLogin.jsx ───────── */
  const currentUser = useMemo(() => {
    try {
      const stored = localStorage.getItem("admin");
      if (stored) return JSON.parse(stored);
    } catch {}
    return { id: null, name: null, email: null, role: null };
  }, []);

  const adminName = currentUser?.name || "Admin";

  const [page,       setPage]       = useState("overview");
  const [productTab, setProductTab] = useState("all");
  const [userQ,      setUserQ]      = useState("");
  const [productQ,   setProductQ]   = useState("");
  const [orderQ,     setOrderQ]     = useState("");
  const [payQ,       setPayQ]       = useState("");
  const [confirmCfg, setConfirmCfg] = useState(null);

  const confirm = useCallback((cfg) => setConfirmCfg(cfg), []);

  const data    = useData(api);
  const derived = useDerived({
    users: data.users, products: data.products,
    pending: data.pending, orders: data.orders,
    payments: data.payments, stats: data.stats,
    productTab, userQ, productQ, orderQ, payQ,
  });
  const actions = useActions(api, data.reload);

  /* ── Live log polling ────────────────────────────────── */
  const logRef = useMemo(() => ({ current: data.reload.logs }), []);
  useEffect(() => { logRef.current = data.reload.logs; });

  useEffect(() => {
    data.loadAll();
    const iv = setInterval(() => logRef.current(), LOG_POLL_INTERVAL);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Notification badge total ────────────────────────── */
  const totalNotifCount =
    data.pending.length           +
    data.marketPendingCount       +
    data.reportCount              +
    data.verificationPendingCount +
    data.vendorPendingCount       +
    data.withdrawalPendingCount   +
    data.airtimePendingCount      +
    data.supportPendingCount;

  if (data.loading) {
    return (
      <>
        <style>{css}</style>
        <div className="loading">
          <span className="live-dot" /> Loading admin panel...
        </div>
      </>
    );
  }

  /* ── Page map ────────────────────────────────────────── */
  const pageMap = {

    overview: (
      <Overview
        stats={data.stats}
        userStats={derived.userStats}
        salesData={derived.salesData}
        prodStatusData={derived.prodStatusData}
        logs={data.logs}
        products={data.products}
        pending={data.pending}
        lastProducts={derived.lastProducts}
        goTo={setPage}
      />
    ),

    users: (
      <Users
        filteredUsers={derived.filteredUsers}
        userQ={userQ}
        setUserQ={setUserQ}
        banUser={actions.banUser}
        unbanUser={actions.unbanUser}
        busy={actions.busy}
        reloadUsers={data.reload.users}
        confirm={confirm}
      />
    ),

    admins: (
      <Admins
        admins={data.admins}
        banAdmin={actions.banAdmin}
        unbanAdmin={actions.unbanAdmin}
        editAdminRole={actions.editAdminRole}
        registerAdmin={actions.registerAdmin}
        busy={actions.busy}
        reloadAdmins={data.reload.admins}
        confirm={confirm}
        currentUser={currentUser}
      />
    ),

    products: (
      <Products
        displayedProds={derived.displayedProds}
        products={data.products}
        pending={data.pending}
        productTab={productTab}
        setProductTab={setProductTab}
        productQ={productQ}
        setProductQ={setProductQ}
        approveProduct={actions.approveProduct}
        rejectProduct={actions.rejectProduct}
        busy={actions.busy}
        reloadProducts={data.reload.products}
        confirm={confirm}
      />
    ),

    market_products: (
      <MarketProducts
        confirm={confirm}
        onMutation={data.reload.marketPendingCount}
      />
    ),

    payments: (
      <Payments
        filteredPayments={derived.filteredPayments}
        payQ={payQ}
        setPayQ={setPayQ}
        refundPayment={actions.refundPayment}
        busy={actions.busy}
        reloadPayments={data.reload.payments}
        confirm={confirm}
      />
    ),

    orders: (
      <Orders
        filteredOrders={derived.filteredOrders}
        orderQ={orderQ}
        setOrderQ={setOrderQ}
        cancelOrder={actions.cancelOrder}
        busy={actions.busy}
        reloadOrders={data.reload.orders}
        confirm={confirm}
      />
    ),

    withdrawals: (
      <Withdrawals
        api={api}
        confirm={confirm}
        onMutation={data.reload.withdrawalCount}
      />
    ),

    logs: (
      <Logs
        logs={data.logs}
        reloadLogs={data.reload.logs}
      />
    ),

    promotions: (
      <Promotions
        plans={data.plans}
        savePlan={actions.savePlan}
        togglePlan={actions.togglePlan}
        busy={actions.busy}
        reloadPlans={data.reload.plans}
      />
    ),

    system: (
      <System
        system={data.system}
        toggleSystem={actions.toggleSystem}
        confirm={confirm}
      />
    ),

    reports: (
      <Reports confirm={confirm} />
    ),

    verification: (
      <Verification
        confirm={confirm}
        onMutation={data.reload.verificationCount}
      />
    ),

    vendor_verification: (
      <VendorVerification
        confirm={confirm}
        onMutation={data.reload.vendorCount}
      />
    ),

    leaderboard: (
      <Leaderboard
        api={api}
        referralStats={data.stats.referrals}
        confirm={confirm}
      />
    ),

    airtime_coupons: (
      <AirtimeCoupons
        api={api}
        confirm={confirm}
        onMutation={data.reload.airtimeCount}
      />
    ),

    coupon_redemption: (
      <CouponRedemption
        api={api}
        couponStats={data.stats.coupons}
      />
    ),

    subscriptions: (
      <AdminSubscriptions
        api={api}
        subscriptionStats={data.subscriptionStats ?? data.stats.subscriptions}
        cancelSellerSubscription={actions.cancelSellerSubscription}
        onMutation={data.reload.subscriptionStats}
        confirm={confirm}
      />
    ),

    support: (
      <SupportAdmin
        api={api}
        confirm={confirm}
        currentUser={currentUser}
        onMutation={data.reload.supportCount}
      />
    ),

    source_analytics: (
      <SourceAnalytics />
    ),

    /* ── Deal Newsletter Management ── */
    newsletter: (
      <NewsletterAdmin
        api={api}
        confirm={confirm}
      />
    ),
  };

  return (
    <>
      <style>{css}</style>
      <div className="wrap">
        <Sidebar
          page={page}
          setPage={setPage}
          pendingCount={data.pending.length}
          reportCount={data.reportCount}
          marketPendingCount={data.marketPendingCount}
          verificationPendingCount={data.verificationPendingCount}
          vendorPendingCount={data.vendorPendingCount}
          withdrawalPendingCount={data.withdrawalPendingCount}
          airtimePendingCount={data.airtimePendingCount}
          subscriptionActiveCount={data.subscriptionStats?.active ?? 0}
          supportPendingCount={data.supportPendingCount}
        />
        <div className="main">
          <Topbar
            page={page}
            adminName={adminName}
            notifCount={totalNotifCount}
          />
          <div className="body">
            {pageMap[page] ?? null}
          </div>
        </div>
      </div>
      <Confirm cfg={confirmCfg} onClose={() => setConfirmCfg(null)} />
    </>
  );
}