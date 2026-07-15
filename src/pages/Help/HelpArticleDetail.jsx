// ════════════════════════════════════════════════════════════
// FILE: src/pages/Help/HelpArticleDetail.jsx
// ════════════════════════════════════════════════════════════

import '../../styles/help/article-detail.css';

import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  IconThumbsUp,
  IconThumbsDown,
  IconEye,
  IconClock,
  IconTag,
  IconMessageCircle,
  IconArrowLeft,
  IconChevronRight,
  IconBookOpen,
} from '../../components/help/icons/HelpIcons';

/* ════════════════════════════════════════════════════════════
   STATIC ARTICLES DATA
   In production replace with:
   GET /api/help/articles/:slug
════════════════════════════════════════════════════════════ */
const ARTICLES = {
  'how-to-create-account': {
    title:        'How do I create a Loemart account?',
    category:     'Account',
    categorySlug: 'account',
    content: `
      <p>Creating a Loemart account is quick and free. Follow these steps to get started:</p>
      <ol>
        <li>Download the <strong>Loemart app</strong> from the App Store or Google Play, or visit the Loemart website on your browser.</li>
        <li>On the homepage, tap or click <strong>Sign Up</strong>.</li>
        <li>Enter your full name, email address or phone number, and choose a secure password.</li>
        <li>Verify your phone number or email address using the OTP (One-Time Password) sent to you.</li>
        <li>Complete your profile by adding a profile photo and your location to get the best experience.</li>
      </ol>
      <p>Once your account is created you can start browsing, buying, and selling on Loemart.</p>
    `,
    tags:       ['account', 'signup', 'register', 'new account'],
    views:      1240,
    helpful:    89,
    notHelpful: 3,
    date:       '15 January 2025',
    related: [
      { slug: 'verify-phone-number',  title: 'How do I verify my phone number?' },
      { slug: 'forgot-password',       title: 'I forgot my password. What should I do?' },
      { slug: 'account-security',      title: 'How can I keep my account secure?' },
    ],
  },
  'verify-phone-number': {
    title:        'How do I verify my phone number?',
    category:     'Account',
    categorySlug: 'account',
    content: `
      <p>Phone verification helps keep your account secure and ensures you can receive important notifications.</p>
      <h3>Steps to verify your phone number</h3>
      <ol>
        <li>After entering your phone number during registration or in your profile settings, tap <strong>Send OTP</strong>.</li>
        <li>You will receive a 6-digit One-Time Password (OTP) via SMS within a few seconds.</li>
        <li>Enter the OTP in the verification field on screen.</li>
        <li>If the OTP is correct, your phone number will be verified immediately.</li>
      </ol>
      <h3>Did not receive the OTP?</h3>
      <ul>
        <li>Check that your phone number is entered correctly.</li>
        <li>Ensure you have a working mobile signal.</li>
        <li>Wait for the countdown timer to expire, then tap <strong>Resend OTP</strong>.</li>
        <li>Check that your phone is not blocking SMS from unknown numbers.</li>
      </ul>
      <p>If the issue persists, please contact our support team for assistance.</p>
    `,
    tags:       ['otp', 'verification', 'phone', 'sms'],
    views:      890,
    helpful:    67,
    notHelpful: 5,
    date:       '15 January 2025',
    related: [
      { slug: 'how-to-create-account', title: 'How do I create a Loemart account?' },
      { slug: 'account-security',       title: 'How can I keep my account secure?' },
    ],
  },
  'forgot-password': {
    title:        'I forgot my password. What should I do?',
    category:     'Account',
    categorySlug: 'account',
    content: `
      <p>Do not worry — resetting your password on Loemart is straightforward.</p>
      <h3>How to reset your password</h3>
      <ol>
        <li>On the login screen, tap <strong>Forgot Password</strong> below the login button.</li>
        <li>Enter the email address or phone number linked to your account.</li>
        <li>You will receive a reset link or OTP via email or SMS.</li>
        <li>Follow the link or enter the OTP to set a new password.</li>
        <li>Choose a strong password that you have not used before.</li>
      </ol>
      <h3>Tips for a strong password</h3>
      <ul>
        <li>Use at least 8 characters.</li>
        <li>Mix uppercase and lowercase letters, numbers, and symbols.</li>
        <li>Never use your name, birthday, or easily guessable words.</li>
        <li>Do not share your password with anyone, including Loemart support staff.</li>
      </ul>
      <p>If you no longer have access to your registered email or phone number, please contact our support team for account recovery assistance.</p>
    `,
    tags:       ['password', 'reset', 'login', 'forgot'],
    views:      2100,
    helpful:    156,
    notHelpful: 8,
    date:       '15 January 2025',
    related: [
      { slug: 'account-security',   title: 'How can I keep my account secure?' },
      { slug: 'verify-phone-number', title: 'How do I verify my phone number?' },
    ],
  },
  'account-security': {
    title:        'How can I keep my account secure?',
    category:     'Account',
    categorySlug: 'account',
    content: `
      <p>Your account security is important to us. Here are the best practices to keep your Loemart account safe:</p>
      <h3>Password security</h3>
      <ul>
        <li>Use a unique, strong password for your Loemart account.</li>
        <li>Never reuse passwords from other websites or apps.</li>
        <li>Change your password regularly, especially if you suspect any suspicious activity.</li>
      </ul>
      <h3>OTP and login codes</h3>
      <ul>
        <li><strong>Never share your OTP</strong> with anyone, including people claiming to be Loemart staff.</li>
        <li>Loemart will never ask for your OTP via phone call, WhatsApp, or social media.</li>
      </ul>
      <h3>Recognising phishing attempts</h3>
      <ul>
        <li>Always access Loemart through the official app or website only.</li>
        <li>Be suspicious of emails or messages asking you to click links and enter your login details.</li>
        <li>Check that the website URL is the official Loemart domain before entering any information.</li>
      </ul>
      <h3>Payment safety</h3>
      <ul>
        <li>Only complete payments through official Loemart checkout channels.</li>
        <li>Never transfer money directly to a seller outside the Loemart platform.</li>
      </ul>
      <p>If you notice any suspicious activity on your account, change your password immediately and contact our support team.</p>
    `,
    tags:       ['security', 'password', 'safe', 'phishing', 'otp'],
    views:      560,
    helpful:    45,
    notHelpful: 2,
    date:       '15 January 2025',
    related: [
      { slug: 'forgot-password',    title: 'I forgot my password. What should I do?' },
      { slug: 'report-scam',         title: 'How do I report a scam or suspicious activity?' },
    ],
  },
  'how-to-start-selling': {
    title:        'How do I start selling?',
    category:     'Selling',
    categorySlug: 'selling',
    content: `
      <p>Selling on Loemart is simple and open to everyone. Here is how to get started:</p>
      <ol>
        <li>Sign in to your Loemart account.</li>
        <li>Tap <strong>Sell</strong> on the navigation bar or homepage.</li>
        <li>If prompted, complete your <strong>seller profile</strong> — this helps buyers trust your store.</li>
        <li>Create your first product listing by adding photos, a title, description, price, and location.</li>
        <li>Submit the listing for review if required, or publish immediately.</li>
      </ol>
      <h3>Tips for successful selling</h3>
      <ul>
        <li>Use clear, high-quality photos taken in good lighting.</li>
        <li>Write detailed and honest product descriptions.</li>
        <li>Price your items competitively by checking similar listings.</li>
        <li>Respond promptly to buyer messages to build trust.</li>
      </ul>
      <p>Consider upgrading to a seller subscription to access premium features like boosted listings and higher visibility.</p>
    `,
    tags:       ['sell', 'seller', 'listing', 'start selling'],
    views:      1500,
    helpful:    120,
    notHelpful: 4,
    date:       '15 January 2025',
    related: [
      { slug: 'how-to-post-product',       title: 'How do I post a product?' },
      { slug: 'listing-rejected-removed',   title: 'Why was my listing rejected or removed?' },
      { slug: 'how-subscriptions-work',     title: 'How do subscriptions work?' },
    ],
  },
  'how-to-post-product': {
    title:        'How do I post a product?',
    category:     'Selling',
    categorySlug: 'selling',
    content: `
      <p>Follow these steps to post a product on Loemart:</p>
      <ol>
        <li>Tap <strong>Sell</strong> from the navigation bar.</li>
        <li>Select the most appropriate <strong>category</strong> for your item. Choosing the right category helps buyers find your product.</li>
        <li>Upload <strong>clear photos</strong> of the item. You can add multiple images. The first image will be your main product photo.</li>
        <li>Enter a descriptive <strong>title</strong> — be specific (e.g. "Samsung Galaxy A54 128GB Black" rather than just "Phone").</li>
        <li>Write a thorough <strong>description</strong> including condition, features, dimensions, and any defects.</li>
        <li>Set your <strong>price</strong>. You can enable price negotiation if you are open to offers.</li>
        <li>Add your <strong>location</strong> so buyers nearby can find your listing.</li>
        <li>Review your listing and tap <strong>Publish</strong>.</li>
      </ol>
      <p>Some listings may be reviewed before going live to ensure they meet our policies.</p>
    `,
    tags:       ['listing', 'product', 'sell', 'post', 'publish'],
    views:      980,
    helpful:    78,
    notHelpful: 6,
    date:       '15 January 2025',
    related: [
      { slug: 'how-to-start-selling',      title: 'How do I start selling?' },
      { slug: 'product-pending-review',     title: 'Why is my product pending review?' },
      { slug: 'listing-rejected-removed',   title: 'Why was my listing rejected or removed?' },
    ],
  },
  'product-pending-review': {
    title:        'Why is my product pending review?',
    category:     'Selling',
    categorySlug: 'selling',
    content: `
      <p>When you submit a listing on Loemart, it may be placed under review before going live. This is a normal part of our quality and safety process.</p>
      <h3>Why listings are reviewed</h3>
      <ul>
        <li>To ensure all listings comply with Loemart marketplace policies.</li>
        <li>To check that the item is not prohibited or restricted.</li>
        <li>To verify that the listing contains accurate and non-misleading information.</li>
        <li>To maintain a safe and trustworthy marketplace for buyers.</li>
      </ul>
      <h3>How long does a review take?</h3>
      <p>Most listings are reviewed and approved quickly. However, during periods of high volume, reviews may take slightly longer. You will receive a notification when your listing is approved or if action is required.</p>
      <h3>What should I do while waiting?</h3>
      <p>No action is needed from you unless we contact you. Make sure your notification settings are enabled so you do not miss any updates.</p>
    `,
    tags:       ['pending', 'review', 'listing', 'approval'],
    views:      430,
    helpful:    34,
    notHelpful: 1,
    date:       '15 January 2025',
    related: [
      { slug: 'listing-rejected-removed', title: 'Why was my listing rejected or removed?' },
      { slug: 'how-to-post-product',       title: 'How do I post a product?' },
    ],
  },
  'listing-rejected-removed': {
    title:        'Why was my listing rejected or removed?',
    category:     'Selling',
    categorySlug: 'selling',
    content: `
      <p>Listings may be rejected or removed from Loemart for the following reasons:</p>
      <h3>Common reasons for rejection or removal</h3>
      <ul>
        <li><strong>Prohibited items</strong> — The item is not allowed to be sold on Loemart (e.g. illegal goods, weapons, counterfeit products).</li>
        <li><strong>Misleading information</strong> — The title or description does not accurately represent the product.</li>
        <li><strong>Inappropriate images</strong> — Photos that violate our content guidelines.</li>
        <li><strong>Duplicate listings</strong> — Multiple identical listings for the same item by the same seller.</li>
        <li><strong>Wrong category</strong> — The item was listed in a category it does not belong to.</li>
        <li><strong>Policy violations</strong> — Any breach of Loemart seller policies or terms of service.</li>
      </ul>
      <h3>What can I do?</h3>
      <ul>
        <li>Review our <strong>Seller Policies</strong> and marketplace rules.</li>
        <li>Correct the issue and repost your listing in compliance with our guidelines.</li>
        <li>If you believe the removal was a mistake, you can <strong>file an appeal</strong> through Help and Support.</li>
      </ul>
      <p>Repeated violations may result in account restrictions or suspension.</p>
    `,
    tags:       ['rejected', 'removed', 'violation', 'policy', 'banned'],
    views:      670,
    helpful:    52,
    notHelpful: 7,
    date:       '15 January 2025',
    related: [
      { slug: 'product-pending-review', title: 'Why is my product pending review?' },
      { slug: 'how-to-post-product',     title: 'How do I post a product?' },
    ],
  },
  'how-to-buy': {
    title:        'How do I buy an item?',
    category:     'Buying',
    categorySlug: 'buying',
    content: `
      <p>Buying on Loemart is safe and straightforward. Here is how:</p>
      <ol>
        <li><strong>Browse or search</strong> for the item you want using the search bar or product categories.</li>
        <li>Open the product listing and review the photos, description, price, and seller information.</li>
        <li>If you have questions, tap <strong>Message Seller</strong> to chat with the seller before purchasing.</li>
        <li>When you are ready, tap <strong>Buy Now</strong> or <strong>Add to Cart</strong>.</li>
        <li>Select your delivery address and preferred delivery method.</li>
        <li>Choose your payment method and complete the checkout.</li>
        <li>You will receive an order confirmation with tracking details.</li>
      </ol>
      <h3>Important</h3>
      <ul>
        <li>Always complete payments through the official Loemart checkout.</li>
        <li>Never pay a seller directly outside the platform.</li>
        <li>Keep your order confirmation for reference.</li>
      </ul>
    `,
    tags:       ['buy', 'purchase', 'checkout', 'order'],
    views:      2300,
    helpful:    180,
    notHelpful: 5,
    date:       '15 January 2025',
    related: [
      { slug: 'payment-safety',        title: 'Is it safe to pay on Loemart?' },
      { slug: 'wrong-or-damaged-item',  title: 'What should I do if I receive the wrong or damaged item?' },
      { slug: 'delivery-fees',          title: 'How are delivery fees calculated?' },
    ],
  },
  'wrong-or-damaged-item': {
    title:        'What should I do if I receive the wrong or damaged item?',
    category:     'Buying',
    categorySlug: 'buying',
    content: `
      <p>We are sorry to hear you received the wrong or damaged item. Please follow these steps:</p>
      <ol>
        <li><strong>Do not dispose of the item</strong> or its packaging — you may need to return it.</li>
        <li>Take clear <strong>photographs</strong> of the item, packaging, and any visible damage or differences from what was advertised.</li>
        <li>Go to <strong>Help and Support</strong> and submit a support ticket or open a dispute.</li>
        <li>Include your <strong>order ID</strong>, a description of the issue, and attach your photos.</li>
        <li>Our team will review your case and respond within 48 hours.</li>
      </ol>
      <h3>Possible resolutions</h3>
      <ul>
        <li>Full or partial <strong>refund</strong> depending on the situation.</li>
        <li><strong>Replacement</strong> if the seller agrees and stock is available.</li>
        <li>A <strong>return</strong> may be arranged where applicable.</li>
      </ul>
      <p>For the best outcome, report the issue as soon as possible after receiving your order.</p>
    `,
    tags:       ['wrong item', 'damaged', 'refund', 'return', 'dispute'],
    views:      1100,
    helpful:    95,
    notHelpful: 4,
    date:       '15 January 2025',
    related: [
      { slug: 'how-to-buy',      title: 'How do I buy an item?' },
      { slug: 'payment-safety',   title: 'Is it safe to pay on Loemart?' },
    ],
  },
  'payment-methods': {
    title:        'What payment methods are available?',
    category:     'Payments',
    categorySlug: 'payments',
    content: `
      <p>Loemart supports a variety of secure payment options to make your shopping experience convenient.</p>
      <h3>Available payment methods</h3>
      <ul>
        <li><strong>Debit and Credit Cards</strong> — Visa, Mastercard, and other major cards.</li>
        <li><strong>Bank Transfer</strong> — Pay directly from your bank account.</li>
        <li><strong>Loemart Wallet</strong> — Use your wallet balance for instant payments.</li>
        <li><strong>USSD</strong> — Pay using your phone's USSD banking code.</li>
      </ul>
      <p>All available payment methods for your order will be displayed on the checkout screen. The methods available may vary depending on your location and the type of order.</p>
      <h3>Is my payment information stored?</h3>
      <p>Loemart does not store your full card details. All payment processing is handled by our certified payment partners who comply with the highest security standards (PCI DSS).</p>
    `,
    tags:       ['payment', 'checkout', 'methods', 'card', 'bank transfer'],
    views:      1800,
    helpful:    130,
    notHelpful: 3,
    date:       '15 January 2025',
    related: [
      { slug: 'payment-safety',   title: 'Is it safe to pay on Loemart?' },
      { slug: 'how-wallet-works',  title: 'How does the Loemart wallet work?' },
    ],
  },
  'payment-safety': {
    title:        'Is it safe to pay on Loemart?',
    category:     'Payments',
    categorySlug: 'payments',
    content: `
      <p>Yes. Your safety is our top priority. Here is how we protect your payments:</p>
      <h3>How we protect you</h3>
      <ul>
        <li><strong>Certified payment partners</strong> — We work with PCI DSS-compliant payment processors to handle all transactions securely.</li>
        <li><strong>Encrypted connections</strong> — All payment data is transmitted using industry-standard SSL encryption.</li>
        <li><strong>Buyer protection</strong> — Your payment is held securely until you confirm receipt of your order.</li>
        <li><strong>Fraud monitoring</strong> — Our systems continuously monitor for suspicious transaction activity.</li>
      </ul>
      <h3>How you can stay safe</h3>
      <ul>
        <li>Always pay through the <strong>official Loemart checkout</strong> — never send money directly to a seller via bank transfer, mobile money, or any other method outside the platform.</li>
        <li>Ignore any seller asking you to pay outside Loemart — this is a scam.</li>
        <li>If a deal seems too good to be true, it probably is.</li>
      </ul>
      <p>If you experience any payment issues or suspicious activity, report it immediately through our Help and Support centre.</p>
    `,
    tags:       ['safe', 'payment', 'security', 'fraud', 'scam'],
    views:      900,
    helpful:    72,
    notHelpful: 2,
    date:       '15 January 2025',
    related: [
      { slug: 'payment-methods', title: 'What payment methods are available?' },
      { slug: 'account-security', title: 'How can I keep my account secure?' },
      { slug: 'report-scam',       title: 'How do I report a scam?' },
    ],
  },
  'how-wallet-works': {
    title:        'How does the Loemart wallet work?',
    category:     'Wallet',
    categorySlug: 'wallet',
    content: `
      <p>The Loemart Wallet is a secure digital wallet that holds your funds within the Loemart platform.</p>
      <h3>What the wallet stores</h3>
      <ul>
        <li>Sales proceeds from items you have sold.</li>
        <li>Refunds from cancelled or returned orders.</li>
        <li>Reward earnings from promotions such as Spin and Win or referral bonuses.</li>
      </ul>
      <h3>How to access your wallet</h3>
      <ol>
        <li>Go to your <strong>Profile</strong>.</li>
        <li>Tap <strong>Wallet</strong> from the menu.</li>
        <li>Here you can view your <strong>balance</strong>, <strong>transaction history</strong>, and initiate withdrawals.</li>
      </ol>
      <h3>Using your wallet balance</h3>
      <p>You can use your wallet balance to pay for orders on Loemart. Simply select Wallet as your payment method during checkout.</p>
    `,
    tags:       ['wallet', 'balance', 'funds', 'earnings'],
    views:      1400,
    helpful:    110,
    notHelpful: 3,
    date:       '15 January 2025',
    related: [
      { slug: 'how-to-withdraw',  title: 'How do I withdraw my earnings?' },
      { slug: 'payment-methods',   title: 'What payment methods are available?' },
    ],
  },
  'how-to-withdraw': {
    title:        'How do I withdraw my earnings?',
    category:     'Wallet',
    categorySlug: 'wallet',
    content: `
      <p>You can withdraw your wallet earnings to your bank account by following these steps:</p>
      <ol>
        <li>Go to your <strong>Profile</strong> and tap <strong>Wallet</strong>.</li>
        <li>Tap <strong>Withdraw</strong>.</li>
        <li>Enter the amount you wish to withdraw. Ensure it does not exceed your available balance.</li>
        <li>Confirm or add your <strong>bank account details</strong> (bank name, account number, account name).</li>
        <li>Review the withdrawal details and tap <strong>Confirm</strong>.</li>
      </ol>
      <h3>Withdrawal processing time</h3>
      <p>Withdrawals are typically processed within 1 to 3 business days, depending on your bank. You will receive a notification once the transfer is initiated.</p>
      <h3>Minimum withdrawal amount</h3>
      <p>There is a minimum withdrawal amount which will be displayed in the Wallet section of your account.</p>
      <p>If you experience any issues with a withdrawal, please contact our support team with your transaction reference number.</p>
    `,
    tags:       ['withdraw', 'earnings', 'bank', 'transfer', 'payout'],
    views:      1600,
    helpful:    125,
    notHelpful: 4,
    date:       '15 January 2025',
    related: [
      { slug: 'how-wallet-works',  title: 'How does the Loemart wallet work?' },
      { slug: 'payment-methods',    title: 'What payment methods are available?' },
    ],
  },
  'delivery-fees': {
    title:        'How are delivery fees calculated?',
    category:     'Delivery',
    categorySlug: 'delivery',
    content: `
      <p>Delivery fees on Loemart vary based on several factors.</p>
      <h3>Factors that affect delivery fees</h3>
      <ul>
        <li><strong>Order value</strong> — Some orders qualify for free or reduced-cost delivery above a certain amount.</li>
        <li><strong>Delivery location</strong> — Deliveries to more distant locations may incur higher fees.</li>
        <li><strong>Delivery method</strong> — Standard, express, or same-day delivery options have different pricing.</li>
        <li><strong>Item size and weight</strong> — Larger or heavier items may have higher delivery costs.</li>
        <li><strong>Seller location</strong> — Distance between the seller and buyer affects the fee.</li>
      </ul>
      <h3>When will I see the delivery fee?</h3>
      <p>The applicable delivery fee is always shown clearly on the <strong>order summary screen</strong> before you complete payment. You will never be charged a delivery fee you have not seen and agreed to.</p>
      <h3>Free delivery</h3>
      <p>Some sellers offer free delivery on certain items or above a minimum order value. Look for the <strong>Free Delivery</strong> badge on product listings.</p>
    `,
    tags:       ['delivery', 'fee', 'shipping', 'cost'],
    views:      1900,
    helpful:    140,
    notHelpful: 6,
    date:       '15 January 2025',
    related: [
      { slug: 'how-to-buy',            title: 'How do I buy an item?' },
      { slug: 'wrong-or-damaged-item',  title: 'What should I do if I receive the wrong or damaged item?' },
    ],
  },
  'spin-and-win': {
    title:        'How does Spin and Win work?',
    category:     'Promotions & Coupons',
    categorySlug: 'promotions-coupons',
    content: `
      <p>Spin and Win is Loemart's exciting daily reward feature where you can win prizes simply by spinning the wheel.</p>
      <h3>How to play</h3>
      <ol>
        <li>Go to your <strong>Profile</strong> and tap <strong>Spin and Win</strong>.</li>
        <li>Tap the <strong>Spin</strong> button to spin the reward wheel.</li>
        <li>The wheel will land on a prize — claim it immediately.</li>
      </ol>
      <h3>Possible prizes</h3>
      <ul>
        <li>Discount coupons for your next purchase.</li>
        <li>Free shipping vouchers.</li>
        <li>Airtime credits.</li>
        <li>Wallet bonus credits.</li>
        <li>Referral reward multipliers.</li>
      </ul>
      <h3>Eligibility</h3>
      <p>Spin and Win is available to eligible users. The number of daily spins available to you will be shown in the Spin and Win section. Keep an eye on special promotions that grant bonus spins.</p>
      <p>Prizes are credited to your account immediately and can be found in the <strong>Coupons and Rewards</strong> section of your profile.</p>
    `,
    tags:       ['spin', 'win', 'reward', 'wheel', 'coupon'],
    views:      3200,
    helpful:    250,
    notHelpful: 8,
    date:       '15 January 2025',
    related: [
      { slug: 'redeem-coupon',    title: 'How do I redeem a coupon?' },
      { slug: 'referral-program',  title: 'How does the referral program work?' },
    ],
  },
  'redeem-coupon': {
    title:        'How do I redeem a coupon?',
    category:     'Promotions & Coupons',
    categorySlug: 'promotions-coupons',
    content: `
      <p>Redeeming a coupon on Loemart is simple. Here is how:</p>
      <ol>
        <li>Add the item(s) you want to purchase to your cart.</li>
        <li>Proceed to <strong>Checkout</strong>.</li>
        <li>On the order summary page, look for the <strong>Enter Coupon Code</strong> field.</li>
        <li>Type or paste your coupon code and tap <strong>Apply</strong>.</li>
        <li>If the coupon is valid and the order meets its requirements, the discount will be applied automatically.</li>
      </ol>
      <h3>Coupon requirements</h3>
      <p>Some coupons have specific conditions:</p>
      <ul>
        <li>Minimum order value.</li>
        <li>Applicable to specific product categories only.</li>
        <li>Single use — can only be redeemed once.</li>
        <li>Expiry date — the coupon must be used before it expires.</li>
      </ul>
      <h3>Where to find your coupons</h3>
      <p>You can view all your available coupons in <strong>Profile &gt; Coupons and Promos</strong>.</p>
    `,
    tags:       ['coupon', 'discount', 'promo', 'voucher', 'code'],
    views:      2800,
    helpful:    210,
    notHelpful: 5,
    date:       '15 January 2025',
    related: [
      { slug: 'spin-and-win',     title: 'How does Spin and Win work?' },
      { slug: 'referral-program',  title: 'How does the referral program work?' },
    ],
  },
  'referral-program': {
    title:        'How does the referral program work?',
    category:     'Promotions & Coupons',
    categorySlug: 'promotions-coupons',
    content: `
      <p>The Loemart Referral Program rewards you for inviting friends to join the platform.</p>
      <h3>How it works</h3>
      <ol>
        <li>Go to <strong>Profile &gt; Refer and Earn</strong> to find your unique referral code or invite link.</li>
        <li>Share your code or link with friends via WhatsApp, SMS, social media, or any other method.</li>
        <li>When your friend signs up using your referral code and meets the program requirements, you both receive rewards.</li>
      </ol>
      <h3>What are the rewards?</h3>
      <ul>
        <li>You receive a <strong>wallet credit</strong> or coupon for each successful referral.</li>
        <li>Your referred friend may also receive a welcome bonus.</li>
      </ul>
      <h3>Program requirements</h3>
      <ul>
        <li>Your friend must be a new Loemart user (not previously registered).</li>
        <li>They must complete registration using your referral code or link.</li>
        <li>Some referral programs require the referred user to complete a first purchase before rewards are credited.</li>
      </ul>
      <p>Referral rewards are credited to your wallet automatically once all conditions are met.</p>
    `,
    tags:       ['referral', 'invite', 'reward', 'earn', 'bonus'],
    views:      2100,
    helpful:    175,
    notHelpful: 6,
    date:       '15 January 2025',
    related: [
      { slug: 'spin-and-win',  title: 'How does Spin and Win work?' },
      { slug: 'redeem-coupon',  title: 'How do I redeem a coupon?' },
    ],
  },
  'report-scam': {
    title:        'How do I report a scam or suspicious activity?',
    category:     'Safety & Security',
    categorySlug: 'safety-security',
    content: `
      <p>If you encounter any suspicious activity, scam, or fraudulent behaviour on Loemart, please report it immediately.</p>
      <h3>How to report</h3>
      <ol>
        <li>Go to <strong>Help and Support</strong> from your profile menu.</li>
        <li>Select <strong>Report a Problem</strong>.</li>
        <li>Choose the most appropriate category (e.g. Scam, Fraud, Fake Seller).</li>
        <li>Provide as much detail as possible including usernames, order IDs, screenshots, and dates.</li>
        <li>Submit your report. Our safety team will review it promptly.</li>
      </ol>
      <h3>Common scams to watch out for</h3>
      <ul>
        <li>Sellers asking you to pay outside the Loemart platform.</li>
        <li>Fake products listed at unusually low prices.</li>
        <li>Requests for your OTP or personal banking details.</li>
        <li>Sellers who disappear after receiving payment.</li>
      </ul>
      <p>Your report is confidential. We take all reports seriously and will act swiftly on valid reports. False reports may result in account action.</p>
    `,
    tags:       ['scam', 'report', 'safety', 'fraud', 'suspicious'],
    views:      780,
    helpful:    62,
    notHelpful: 3,
    date:       '15 January 2025',
    related: [
      { slug: 'account-security', title: 'How can I keep my account secure?' },
      { slug: 'payment-safety',    title: 'Is it safe to pay on Loemart?' },
    ],
  },
  'report-bug': {
    title:        'How can I report a bug?',
    category:     'Technical Issues',
    categorySlug: 'technical-issues',
    content: `
      <p>Encountered a bug or technical issue on the Loemart app or website? We want to know about it so we can fix it quickly.</p>
      <h3>How to report a bug</h3>
      <ol>
        <li>Go to <strong>Help and Support</strong> from your profile menu.</li>
        <li>Select <strong>Leave Feedback</strong> and choose <strong>Report Bug</strong>.</li>
        <li>Describe the issue clearly:
          <ul>
            <li>What were you trying to do?</li>
            <li>What happened instead?</li>
            <li>Does it happen every time or occasionally?</li>
          </ul>
        </li>
        <li>Attach <strong>screenshots or a screen recording</strong> if possible — this helps us identify the issue faster.</li>
        <li>Include your <strong>device type</strong> and <strong>app version</strong>.</li>
        <li>Submit the report.</li>
      </ol>
      <h3>In the meantime</h3>
      <ul>
        <li>Try <strong>closing and reopening</strong> the app.</li>
        <li>Check for an <strong>app update</strong> in the App Store or Google Play.</li>
        <li>Try clearing the app cache in your device settings.</li>
        <li>If the issue is urgent and affecting your ability to buy or sell, submit a <strong>support ticket</strong> for faster assistance.</li>
      </ul>
    `,
    tags:       ['bug', 'technical', 'issue', 'error', 'crash'],
    views:      450,
    helpful:    35,
    notHelpful: 2,
    date:       '15 January 2025',
    related: [
      { slug: 'contact-loemart-support', title: 'How do I contact Loemart Support?' },
    ],
  },
  'contact-loemart-support': {
    title:        'How do I contact Loemart Support?',
    category:     'Technical Issues',
    categorySlug: 'technical-issues',
    content: `
      <p>Our support team is here to help you with any issues or questions you may have.</p>
      <h3>Ways to contact us</h3>
      <ul>
        <li><strong>Support Tickets</strong> — The fastest way to get help. Go to <strong>Help and Support &gt; Submit a Ticket</strong>. Describe your issue and our team will respond as quickly as possible.</li>
        <li><strong>Help Center</strong> — Search our knowledge base for instant answers to common questions without waiting for a response.</li>
      </ul>
      <h3>How to submit a support ticket</h3>
      <ol>
        <li>Go to <strong>Profile &gt; Help and Support</strong>.</li>
        <li>Tap <strong>Submit a Ticket</strong>.</li>
        <li>Select the relevant category, enter a subject, and describe your issue in detail.</li>
        <li>Attach any relevant screenshots or documents.</li>
        <li>Submit the ticket.</li>
      </ol>
      <p>You will receive a unique ticket number. Use it to track the progress of your request in the <strong>My Tickets</strong> section.</p>
      <h3>Response times</h3>
      <ul>
        <li>General inquiries: within 24 hours.</li>
        <li>High priority issues: within 4 hours.</li>
        <li>Disputes and appeals: within 3 to 5 business days.</li>
      </ul>
    `,
    tags:       ['contact', 'support', 'help', 'ticket', 'customer service'],
    views:      1300,
    helpful:    98,
    notHelpful: 4,
    date:       '15 January 2025',
    related: [
      { slug: 'report-bug',   title: 'How can I report a bug?' },
      { slug: 'report-scam',   title: 'How do I report a scam or suspicious activity?' },
    ],
  },
};

/* ════════════════════════════════════════════════════════════
   COMPONENT
════════════════════════════════════════════════════════════ */
export default function HelpArticleDetail() {
  const { slug }   = useParams();
  const navigate   = useNavigate();
  const article    = ARTICLES[slug];

  /* ── Helpful / Not helpful vote ── */
  const [vote,         setVote]         = useState(null); // 'yes' | 'no' | null
  const [helpfulCount, setHelpfulCount] = useState(
    article ? article.helpful : 0
  );
  const [notHelpfulCount, setNotHelpfulCount] = useState(
    article ? article.notHelpful : 0
  );

  /* Scroll to top on slug change */
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    /* Reset vote state for new article */
    setVote(null);
    if (article) {
      setHelpfulCount(article.helpful);
      setNotHelpfulCount(article.notHelpful);
    }
  }, [slug, article]);

  const handleVote = (type) => {
    if (vote !== null) return; /* already voted */
    setVote(type);
    if (type === 'yes') setHelpfulCount((n) => n + 1);
    if (type === 'no')  setNotHelpfulCount((n) => n + 1);
  };

  /* ── Article not found ── */
  if (!article) {
    return (
      <div className="article-detail-page">
        <div className="article-detail-container">
          <div className="article-not-found">
            <h2 className="article-not-found-title">Article not found</h2>
            <p className="article-not-found-desc">
              This article may have been moved or does not exist.
            </p>
            <Link to="/help" className="article-not-found-btn">
              Back to Help Center
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="article-detail-page">
      <div className="article-detail-container">

        {/* ── Breadcrumb ── */}
        <nav className="article-breadcrumb" aria-label="Breadcrumb">
          <Link to="/help" className="article-breadcrumb-link">
            Help Center
          </Link>
          <span className="article-breadcrumb-sep">/</span>
          <Link
            to={`/help/category/${article.categorySlug}`}
            className="article-breadcrumb-link"
          >
            {article.category}
          </Link>
          <span className="article-breadcrumb-sep">/</span>
          <span className="article-breadcrumb-current">{article.title}</span>
        </nav>

        {/* ── Article Card ── */}
        <article className="article-card">
          {/* Category badge */}
          <span className="article-category-badge">{article.category}</span>

          {/* Title */}
          <h1 className="article-title">{article.title}</h1>

          {/* Meta */}
          <div className="article-meta">
            <span className="article-meta-item">
              <IconClock size={14} />
              Updated {article.date}
            </span>
            <span className="article-meta-item">
              <IconEye size={14} />
              {article.views.toLocaleString()} views
            </span>
          </div>

          <div className="article-divider" />

          {/* Content */}
          <div
            className="article-content"
            dangerouslySetInnerHTML={{ __html: article.content }}
          />

          {/* Tags */}
          {article.tags?.length > 0 && (
            <div className="article-tags">
              <IconTag size={14} className="article-tags-icon" />
              {article.tags.map((tag) => (
                <span key={tag} className="article-tag">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </article>

        {/* ── Was this helpful? ── */}
        <div className="article-helpful">
          <p className="article-helpful-title">Was this article helpful?</p>

          {vote === null ? (
            <div className="article-helpful-buttons">
              <button
                onClick={() => handleVote('yes')}
                className="article-helpful-yes"
                aria-label="Yes, this was helpful"
              >
                <IconThumbsUp size={16} />
                Yes ({helpfulCount})
              </button>
              <button
                onClick={() => handleVote('no')}
                className="article-helpful-no"
                aria-label="No, this was not helpful"
              >
                <IconThumbsDown size={16} />
                No ({notHelpfulCount})
              </button>
            </div>
          ) : (
            <div className="article-helpful-thanks">
              <p className="article-helpful-thanks-text">
                {vote === 'yes'
                  ? 'Thank you for your feedback!'
                  : 'Thanks — we will work on improving this article.'}
              </p>
            </div>
          )}
        </div>

        {/* ── Related Articles ── */}
        {article.related?.length > 0 && (
          <div className="article-related">
            <h3 className="article-related-title">Related Articles</h3>
            <div className="article-related-list">
              {article.related.map((rel) => (
                <Link
                  key={rel.slug}
                  to={`/help/article/${rel.slug}`}
                  className="article-related-item"
                >
                  <div className="article-related-icon">
                    <IconBookOpen size={16} />
                  </div>
                  <span className="article-related-label">{rel.title}</span>
                  <IconChevronRight size={14} className="article-related-arrow" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Still need help CTA ── */}
        <div className="article-cta">
          <div className="article-cta-text">
            <p className="article-cta-title">Still need help?</p>
            <p className="article-cta-desc">
              Our support team is ready to assist you.
            </p>
          </div>
          <Link to="/support/contact" className="article-cta-btn">
            <IconMessageCircle size={16} />
            Contact Support
          </Link>
        </div>

      </div>
    </div>
  );
}