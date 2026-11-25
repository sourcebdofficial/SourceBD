
import { useEffect, useState } from "react";
import "./Dashboard.css";

const API = "http://localhost:5000/api";

function BuyerDashboard({ user, onLogout, logoData }) {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [profile, setProfile] = useState(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [categories, setCategories] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [compareIds, setCompareIds] = useState([]);
  const [reviewsByProduct, setReviewsByProduct] = useState({});
  const [activeTab, setActiveTab] = useState("products");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [showVerificationSuccess, setShowVerificationSuccess] = useState(false);
  const [verificationForm, setVerificationForm] = useState({ name: "", phone: "", buyerType: "individual", organizationName: "", buyerDesignation: "", businessRegistrationNumber: "", address: "", city: "", postalCode: "", country: "Bangladesh", governmentIdType: "National ID", governmentIdNumber: "", governmentIdDocument: "", buyerBusinessDocument: "" });

  const token = localStorage.getItem("token");

  const request = async (url, options = {}) => {
    const response = await fetch(`${API}${url}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Request failed.");
    }

    return data;
  };

  const loadDashboard = async () => {
    setLoading(true);
    setMessage("");

    try {
      const results = await Promise.allSettled([
        fetch(`${API}/products`).then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || "Products failed to load.");
          return data;
        }),
        request("/orders/my"),
        request("/buyer/profile"),
        request("/sourcing/favorites"),
        request("/sourcing/inquiries/mine"),
        fetch(`${API}/sourcing/categories`).then((res) => res.json()),
      ]);

      if (results[0].status === "fulfilled") {
        const data = results[0].value;
        setProducts(Array.isArray(data) ? data : data.products || []);
      } else {
        setMessage(results[0].reason.message);
      }

      if (results[1].status === "fulfilled") {
        const data = results[1].value;
        setOrders(Array.isArray(data) ? data : data.orders || []);
      }

      if (results[2].status === "fulfilled") {
        const data = results[2].value;
        const buyer = data.buyer || data.user || data.profile || data;
        setProfile(buyer);
        setVerificationForm((previous) => ({ ...previous, ...Object.fromEntries(Object.keys(previous).filter((key) => !["governmentIdDocument", "buyerBusinessDocument"].includes(key)).map((key) => [key, buyer[key] || (key === "name" ? buyer.name : "") || (key === "phone" ? buyer.phone : "") || ""])) }));
      }
      if (results[3].status === "fulfilled") setFavorites(results[3].value.favorites || []);
      if (results[4].status === "fulfilled") setInquiries(results[4].value.inquiries || []);
      if (results[5].status === "fulfilled") setCategories(results[5].value.categories || []);
    } catch (error) {
      setMessage(error.message || "Unable to load dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial dashboard data load is intentionally one-time.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const placeOrder = async (product) => {
    const quantity = Number(
      window.prompt(
        `Enter quantity for ${product.name} (minimum ${product.minimumOrderQuantity || 1}):`,
        String(product.minimumOrderQuantity || 1)
      )
    );

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return;
    }

    if (quantity < (product.minimumOrderQuantity || 1)) {
      setMessage(
        `Minimum order quantity is ${product.minimumOrderQuantity || 1}.`
      );
      return;
    }

    const shippingAddress = window.prompt("Enter the full delivery address for this order:", profile?.address || "");
    if (!shippingAddress?.trim()) {
      setMessage("A delivery address is required to place an order.");
      return;
    }

    try {
      setMessage("");

      
await request("/orders", {
  method: "POST",
  body: JSON.stringify({
    productId: product._id,
    quantity,
    shippingAddress: shippingAddress.trim(),
  }),
});


      setMessage("Order placed successfully!");
      await loadDashboard();
      setActiveTab("orders");
    } catch (error) {
      setMessage(error.message || "Could not place order.");
    }
  };

  const cancelOrder = async (orderId) => {
    if (!window.confirm("Are you sure you want to cancel this order?")) {
      return;
    }

    try {
      await request(`/orders/${orderId}/cancel`, {
        method: "PATCH",
      });

      setMessage("Order cancelled successfully.");
      await loadDashboard();
    } catch (error) {
      setMessage(error.message || "Could not cancel order.");
    }
  };

  const filteredProducts = products.filter((product) => {
    const text = `${product.name || ""} ${product.category || ""} ${
      product.description || ""
    }`.toLowerCase();

    const productLocation = `${product.supplier?.city || ""} ${product.supplier?.address || ""}`.toLowerCase();
    return text.includes(search.toLowerCase()) &&
      (!category || product.category === category) &&
      (!location || productLocation.includes(location.toLowerCase()));
  });

  const isFavorite = (productId) => favorites.some((row) => String(row.product?._id || row.product) === String(productId));

  const handleVerificationChange = (event) => setVerificationForm((previous) => ({ ...previous, [event.target.name]: event.target.value }));

  const handleVerificationFile = async (event, field) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) { setMessage("Choose a PDF, JPG or PNG document."); event.target.value = ""; return; }
    if (file.size > 900_000) { setMessage("Each verification document must be smaller than 900 KB."); event.target.value = ""; return; }
    try {
      const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error("Could not read this document.")); reader.readAsDataURL(file); });
      setVerificationForm((previous) => ({ ...previous, [field]: dataUrl }));
      setMessage("");
    } catch (error) { setMessage(error.message); }
    event.target.value = "";
  };

  const submitBuyerVerification = async (event) => {
    event.preventDefault();
    if (verificationForm.buyerType === "business" && !verificationForm.buyerBusinessDocument) { setMessage("Add the business trade license before submitting."); return; }
    try {
      setMessage("");
      await request("/sourcing/buyer/verification", { method: "POST", body: JSON.stringify(verificationForm) });
      await loadDashboard();
      setShowVerificationSuccess(true);
    } catch (error) { setMessage(error.message || "Could not submit buyer verification."); }
  };

  const toggleFavorite = async (product) => {
    try {
      if (isFavorite(product._id)) await request(`/sourcing/favorites/${product._id}`, { method: "DELETE" });
      else await request("/sourcing/favorites", { method: "POST", body: JSON.stringify({ productId: product._id }) });
      const data = await request("/sourcing/favorites");
      setFavorites(data.favorites || []);
    } catch (error) { setMessage(error.message); }
  };

  const sendInquiry = async (product) => {
    const details = window.prompt(`What would you like to ask ${product.supplier?.businessName || product.supplier?.name || "the supplier"}?`);
    if (!details?.trim()) return;
    const requestedQuantity = window.prompt("Required quantity (optional):");
    try {
      await request("/sourcing/inquiries", { method: "POST", body: JSON.stringify({ productId: product._id, details, ...(requestedQuantity && { quantity: Number(requestedQuantity) }) }) });
      const data = await request("/sourcing/inquiries/mine");
      setInquiries(data.inquiries || []);
      setMessage("Inquiry sent to supplier.");
    } catch (error) { setMessage(error.message); }
  };

  const submitReview = async (product) => {
    const rating = Number(window.prompt("Give a rating from 1 to 5:"));
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return;
    const comment = window.prompt("Write a short review (optional):") || "";
    try {
      await request("/sourcing/reviews", { method: "POST", body: JSON.stringify({ productId: product._id, rating, comment }) });
      setMessage("Review sent for admin moderation.");
    } catch (error) { setMessage(error.message); }
  };

  const showReviews = async (productId) => {
    try {
      const response = await fetch(`${API}/sourcing/reviews/product/${productId}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not load reviews.");
      setReviewsByProduct((previous) => ({ ...previous, [productId]: data.reviews || [] }));
    } catch (error) { setMessage(error.message); }
  };

  const toggleCompare = (productId) => setCompareIds((previous) => previous.includes(productId) ? previous.filter((id) => id !== productId) : [...previous, productId].slice(-4));

  const searchListings = async () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (category) params.set("category", category);
    if (location.trim()) params.set("location", location.trim());
    try {
      const response = await fetch(`${API}/products?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Search failed.");
      setProducts(data.products || []);
    } catch (error) { setMessage(error.message); }
  };

  if (loading) {
    return (
      <main className="dashboard-page">
        <p className="dashboard-loading">Loading Buyer Dashboard...</p>
      </main>
    );
  }

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <h1 className="dashboard-header-brand">{logoData && <img src={logoData} alt="SourceBD logo" />}<span>SourceBD</span></h1>
          <p>Buyer Dashboard</p>
        </div>

        <button className="dashboard-logout" onClick={onLogout}>
          Logout
        </button>
      </header>

      <section className="dashboard-welcome">
        <h2>
          Welcome, {profile?.name || user?.name || "Buyer"}!
          {profile?.isVerified && <span className="buyer-verified-badge">✓ Verified buyer</span>}
        </h2>
        <p>Discover products and manage your orders in one place.</p>
      </section>

      {message && (
        <div className="dashboard-message" role="status">
          {message}
        </div>
      )}

      <section className="dashboard-stats">
        <article className="dashboard-stat">
          <span>Total Products</span>
          <strong>{products.length}</strong>
        </article>

        <article className="dashboard-stat">
          <span>My Orders</span>
          <strong>{orders.length}</strong>
        </article>

        <article className="dashboard-stat">
          <span>Pending Orders</span>
          <strong>
            {orders.filter((order) => order.status === "pending").length}
          </strong>
        </article>
      </section>

      <nav className="dashboard-tabs">
        <button
          className={activeTab === "products" ? "active" : ""}
          onClick={() => setActiveTab("products")}
        >
          Products
        </button>

        <button className={activeTab === "favorites" ? "active" : ""} onClick={() => setActiveTab("favorites")}>Favorites</button>
        <button className={activeTab === "compare" ? "active" : ""} onClick={() => setActiveTab("compare")}>Compare ({compareIds.length})</button>
        <button className={activeTab === "inquiries" ? "active" : ""} onClick={() => setActiveTab("inquiries")}>My Inquiries</button>

        <button
          className={activeTab === "orders" ? "active" : ""}
          onClick={() => setActiveTab("orders")}
        >
          My Orders
        </button>

        <button
          className={activeTab === "profile" ? "active" : ""}
          onClick={() => setActiveTab("profile")}
        >
          My Profile
        </button>
      </nav>

      {activeTab === "products" && (
        <section className="dashboard-section">
          <div className="dashboard-section-heading">
            <h2>Explore Products</h2>

            <input
              type="search"
              placeholder="Search products..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by category">
              <option value="">All categories</option>
              {categories.map((item) => <option key={item._id || item.name} value={item.name}>{item.name}</option>)}
            </select>
            <input type="search" placeholder="Filter by city or area..." value={location} onChange={(event) => setLocation(event.target.value)} />
            <button className="dashboard-primary-button" onClick={searchListings}>Search Listings</button>
          </div>

          {filteredProducts.length === 0 ? (
            <p className="dashboard-empty">No products found.</p>
          ) : (
            <div className="dashboard-product-grid">
              {filteredProducts.map((product) => (
                <article className="dashboard-product" key={product._id}>
                  {product.images?.[0] ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="dashboard-product-image"
                    />
                  ) : (
                    <div className="dashboard-product-placeholder">
                      Product
                    </div>
                  )}

                  <div className="dashboard-product-content">
                    <span className="dashboard-category">
                      {product.category || "General"}
                    </span>

                    <h3>{product.name}</h3>

                    <p>
                      {product.description || "No description available."}
                    </p>

                    <strong className="dashboard-price">
                      {product.currency || "BDT"}{" "}
                      {Number(product.price || 0).toLocaleString()}
                    </strong>

                    <p>
                      Available: {product.quantity ?? "N/A"}{" "}
                      {product.unit || ""}
                    </p>
                    <p>Supplier: {product.supplier?.businessName || product.supplier?.name || "SourceBD supplier"} {product.supplier?.isVerified ? "✓ Verified" : ""}</p>
                    <p>Location: {[product.supplier?.city, product.supplier?.address].filter(Boolean).join(", ") || "Not provided"}</p>
                    <p>Rating: {product.averageRating || "No ratings"} ({product.reviewCount || 0} reviews)</p>

                    <div className="sourcing-actions">
                      <button className={`buyer-save-button ${isFavorite(product._id) ? "saved" : ""}`} onClick={() => toggleFavorite(product)}>{isFavorite(product._id) ? "♥ Saved" : "♡ Save"}</button>
                      <button className="dashboard-secondary-button" onClick={() => toggleCompare(product._id)}>{compareIds.includes(product._id) ? "Remove Compare" : "Compare"}</button>
                      <button className="dashboard-secondary-button" onClick={() => sendInquiry(product)}>Ask Supplier / RFQ</button>
                      <button className="dashboard-secondary-button" onClick={() => showReviews(product._id)}>View Reviews</button>
                      {orders.some((order) => String(order.product?._id || order.product) === String(product._id) && order.status === "delivered") && <button className="dashboard-secondary-button" onClick={() => submitReview(product)}>Review</button>}
                    </div>
                    {reviewsByProduct[product._id] && <div className="dashboard-reviews">{reviewsByProduct[product._id].length ? reviewsByProduct[product._id].map((review) => <p key={review._id}><strong>{review.rating}/5 · {review.buyer?.name || "Buyer"}:</strong> {review.comment || "No written comment."}</p>) : <p>No approved reviews yet.</p>}</div>}

                    <button
                      className="dashboard-primary-button"
                      onClick={() => placeOrder(product)}
                      disabled={Number(product.quantity) <= 0}
                    >
                      {Number(product.quantity) <= 0
                        ? "Out of Stock"
                        : "Place Order"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === "favorites" && <section className="dashboard-section buyer-favorites-section"><div className="buyer-section-heading"><div><span className="buyer-section-eyebrow">YOUR SHORTLIST</span><h2>Favorite products</h2><p>Keep the supplier listings you want to come back to.</p></div><span className="buyer-favorite-count">♥ {favorites.length} saved</span></div>{favorites.length ? <div className="buyer-favorite-grid">{favorites.map((row) => row.product && <article className="buyer-favorite-card" key={row._id}><div className="buyer-favorite-image">{row.product.images?.[0] ? <img src={row.product.images[0]} alt={row.product.name} /> : <span>{row.product.name?.slice(0, 1)?.toUpperCase() || "P"}</span>}<button aria-label={`Remove ${row.product.name} from favorites`} onClick={() => toggleFavorite(row.product)}>♥</button></div><div className="buyer-favorite-content"><span className="buyer-favorite-category">{row.product.category || "Product"}</span><h3>{row.product.name}</h3><p className="buyer-favorite-supplier">{row.product.supplier?.businessName || row.product.supplier?.name || "SourceBD supplier"} {row.product.supplier?.isVerified && <span className="buyer-verified-mini">✓ Verified</span>}</p><p className="buyer-favorite-location">⌖ {row.product.supplier?.city || "Location not provided"}</p><div className="buyer-favorite-price"><strong>{row.product.currency || "BDT"} {Number(row.product.price || 0).toLocaleString()}</strong><span>/ {row.product.unit || "unit"}</span></div><div className="buyer-favorite-actions"><button className="dashboard-primary-button" onClick={() => placeOrder(row.product)} disabled={Number(row.product.quantity) <= 0}>{Number(row.product.quantity) > 0 ? "Order this product" : "Out of stock"}</button><button className="buyer-remove-favorite" onClick={() => toggleFavorite(row.product)}>Remove from favorites</button></div></div></article>)}</div> : <div className="buyer-favorites-empty"><span>♡</span><h3>Your favorites will appear here</h3><p>Save a product from the Products tab to keep it handy.</p><button onClick={() => setActiveTab("products")}>Explore products</button></div>}</section>}

      {activeTab === "compare" && <section className="dashboard-section"><h2>Compare Suppliers</h2>{compareIds.length < 2 ? <p className="dashboard-empty">Select at least two products from Products to compare.</p> : <div className="dashboard-table-wrapper"><table className="dashboard-table"><thead><tr><th>Product</th><th>Supplier</th><th>Location</th><th>Price</th><th>MOQ</th><th>Rating</th><th>Verified</th></tr></thead><tbody>{products.filter((item) => compareIds.includes(item._id)).map((item) => <tr key={item._id}><td>{item.name}</td><td>{item.supplier?.businessName || item.supplier?.name || "—"}</td><td>{item.supplier?.city || "—"}</td><td>{item.currency} {item.price} / {item.unit}</td><td>{item.minimumOrderQuantity}</td><td>{item.averageRating || "—"} ({item.reviewCount || 0})</td><td>{item.supplier?.isVerified ? "Verified" : "No"}</td></tr>)}</tbody></table></div>}</section>}

      {activeTab === "inquiries" && <section className="dashboard-section"><h2>My Supplier Inquiries</h2>{inquiries.length ? inquiries.map((item) => <article className="dashboard-panel" key={item._id}><h3>{item.productName}</h3><p><strong>Supplier:</strong> {item.supplier?.businessName || item.supplier?.name || "—"}</p><p>{item.details}</p><p>Status: {item.status}</p>{item.supplierResponse && <p><strong>Supplier response:</strong> {item.supplierResponse}</p>}</article>) : <p className="dashboard-empty">No inquiries sent yet.</p>}</section>}

      {activeTab === "orders" && (
        <section className="dashboard-section buyer-orders-section">
          <div className="buyer-section-heading"><div><span className="buyer-section-eyebrow">ORDER TRACKING</span><h2>My Orders</h2><p>Review your items, suppliers, totals and delivery addresses.</p></div><span className="buyer-order-count">{orders.length} {orders.length === 1 ? "order" : "orders"}</span></div>
          {orders.length === 0 ? <div className="buyer-orders-empty"><span>▤</span><h3>No orders yet</h3><p>When you place an order, its supplier and delivery details will appear here.</p><button onClick={() => setActiveTab("products")}>Browse products</button></div> : <div className="buyer-order-list">{orders.map((order) => {
            const supplier = order.supplier || {};
            const product = order.product || {};
            const total = Number(order.totalPrice ?? order.totalAmount ?? order.total ?? 0);
            const isExpanded = expandedOrderId === order._id;
            return <article className={`buyer-order-card ${isExpanded ? "expanded" : ""}`} key={order._id}>
              <div className="buyer-order-card-head"><div><span>ORDER #{String(order._id).slice(-8).toUpperCase()}</span><small>Placed {new Date(order.createdAt).toLocaleDateString("en-BD", { year: "numeric", month: "short", day: "numeric" })}</small></div><span className={`buyer-order-status status-${order.status}`}>{order.status}</span></div>
              <div className="buyer-order-summary"><div className="buyer-order-product-image">{product.images?.[0] ? <img src={product.images[0]} alt={order.productName || product.name || "Ordered product"} /> : <span>{(order.productName || product.name || "P").slice(0, 1).toUpperCase()}</span>}</div><div className="buyer-order-product-info"><span>{product.category || "Product"}</span><h3>{order.productName || product.name || "Product listing"}</h3><p>Quantity: <strong>{Number(order.quantity || 0).toLocaleString()} {product.unit || "unit(s)"}</strong></p><p>Supplier: <strong>{supplier.businessName || supplier.name || "Supplier"}</strong> {supplier.isVerified && <span className="buyer-verified-mini">✓ Verified</span>}</p></div><div className="buyer-order-total"><small>Order total</small><strong>{order.currency || "BDT"} {total.toLocaleString("en-BD", { maximumFractionDigits: 2 })}</strong><small>{order.currency || "BDT"} {Number(order.unitPrice || 0).toLocaleString("en-BD", { maximumFractionDigits: 2 })} × {Number(order.quantity || 0).toLocaleString()}</small></div></div>
              <div className="buyer-order-card-actions"><button className="buyer-order-details-button" aria-expanded={isExpanded} onClick={() => setExpandedOrderId(isExpanded ? null : order._id)}>{isExpanded ? "Hide order details" : "View order details"}<span>{isExpanded ? "⌃" : "⌄"}</span></button>{order.status === "pending" && <button className="buyer-order-cancel" onClick={() => cancelOrder(order._id)}>Cancel order</button>}</div>
              {isExpanded && <div className="buyer-order-detail-grid"><section className="buyer-order-detail-panel"><span>ITEM DETAILS</span><h4>{order.productName || product.name || "Product listing"}</h4><p>{product.description || "Product description unavailable."}</p><dl><div><dt>Category</dt><dd>{product.category || "—"}</dd></div><div><dt>Quantity</dt><dd>{Number(order.quantity || 0).toLocaleString()} {product.unit || "unit(s)"}</dd></div><div><dt>Price per unit</dt><dd>{order.currency || "BDT"} {Number(order.unitPrice || 0).toLocaleString()}</dd></div><div><dt>Order total</dt><dd>{order.currency || "BDT"} {total.toLocaleString()}</dd></div></dl>{order.note && <p><strong>Your note:</strong> {order.note}</p>}</section><section className="buyer-order-detail-panel"><span>SUPPLIER & DELIVERY</span><h4>{supplier.businessName || supplier.name || "Supplier"} {supplier.isVerified && <span className="buyer-verified-mini">✓ Verified</span>}</h4>{supplier.businessName && <p>Contact: {supplier.name || "—"}</p>}<p><strong>Phone:</strong> {supplier.phone ? <a href={`tel:${supplier.phone}`}>{supplier.phone}</a> : "Not provided"}</p><p><strong>Email:</strong> {supplier.email ? <a href={`mailto:${supplier.email}`}>{supplier.email}</a> : "Not provided"}</p><p><strong>Supplier location:</strong> {[supplier.address, supplier.city].filter(Boolean).join(", ") || "Not provided"}</p><div className="buyer-delivery-address"><small>DELIVERY ADDRESS</small><p>{order.shippingAddress || "No delivery address was saved for this order."}</p></div></section></div>}
            </article>;
          })}</div>}
        </section>
      )}

      {activeTab === "profile" && (
        <section className="dashboard-section buyer-profile-section"><div className="buyer-section-heading"><div><span className="buyer-section-eyebrow">ACCOUNT & IDENTITY</span><h2>My Profile</h2><p>Manage your contact details and submit your buyer identity for review.</p></div><span className={`buyer-verification-status ${profile?.verificationStatus || "not_submitted"}`}>{profile?.isVerified ? "✓ Verified buyer" : profile?.verificationStatus === "pending" ? "Under review" : profile?.verificationStatus === "rejected" ? "Update requested" : "Not verified"}</span></div><div className="buyer-profile-summary"><div className="buyer-profile-avatar">{(profile?.name || user?.name || "B").slice(0, 1).toUpperCase()}</div><div><h3>{profile?.name || user?.name || "Buyer"}{profile?.isVerified && <span className="buyer-verified-badge">✓ Verified buyer</span>}</h3><p>{profile?.email || user?.email || ""}</p><small>Buyer account · SourceBD</small></div></div>{profile?.verificationNote && <div className="buyer-admin-note"><strong>Admin feedback:</strong> {profile.verificationNote}</div>}{profile?.verificationStatus === "verified" ? <div className="buyer-verification-callout success"><span>✓</span><div><strong>Your buyer profile is verified</strong><p>Suppliers can see your verified status when reviewing your orders.</p></div></div> : profile?.verificationStatus === "pending" ? <div className="buyer-verification-callout pending"><span>◷</span><div><strong>Your request is under admin review</strong><p>We will review the contact information and identity documents you submitted.</p></div></div> : <form className="buyer-verification-form" onSubmit={submitBuyerVerification}><div className="buyer-form-section-title"><span>01</span><div><h3>Contact and delivery details</h3><p>Use the details suppliers need to confirm and deliver your orders.</p></div></div><div className="buyer-verification-grid"><label>Full name *<input name="name" value={verificationForm.name} onChange={handleVerificationChange} maxLength="150" required /></label><label>Account email<input value={profile?.email || user?.email || ""} readOnly /></label><label>Phone number *<input name="phone" type="tel" value={verificationForm.phone} onChange={handleVerificationChange} maxLength="40" required /></label><label>Buyer profile type *<select name="buyerType" value={verificationForm.buyerType} onChange={handleVerificationChange}><option value="individual">Individual buyer</option><option value="business">Business buyer</option></select></label>{verificationForm.buyerType === "business" && <><label>Business / organization name *<input name="organizationName" value={verificationForm.organizationName} onChange={handleVerificationChange} maxLength="180" required /></label><label>Job title / designation<input name="buyerDesignation" value={verificationForm.buyerDesignation} onChange={handleVerificationChange} maxLength="120" placeholder="e.g. Procurement Manager" /></label></>}<label>City / district *<input name="city" value={verificationForm.city} onChange={handleVerificationChange} maxLength="100" required /></label><label>Postal code<input name="postalCode" value={verificationForm.postalCode} onChange={handleVerificationChange} maxLength="30" /></label><label className="buyer-address-field">Full address *<textarea name="address" value={verificationForm.address} onChange={handleVerificationChange} rows="3" maxLength="400" required /></label><label>Country *<input name="country" value={verificationForm.country} onChange={handleVerificationChange} maxLength="100" required /></label></div><div className="buyer-form-section-title"><span>02</span><div><h3>Identity verification</h3><p>Your documents are available only to authorized admins reviewing this request.</p></div></div><div className="buyer-verification-grid"><label>ID document type *<select name="governmentIdType" value={verificationForm.governmentIdType} onChange={handleVerificationChange}><option>National ID</option><option>Passport</option><option>Driving License</option></select></label><label>ID / passport number *<input name="governmentIdNumber" value={verificationForm.governmentIdNumber} onChange={handleVerificationChange} maxLength="100" required /></label><label className="buyer-document-upload">Upload identity document *<input type="file" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" onChange={(event) => handleVerificationFile(event, "governmentIdDocument")} required={!verificationForm.governmentIdDocument} /><small>{verificationForm.governmentIdDocument ? "Identity document attached" : "PDF, JPG or PNG · up to 900 KB"}</small></label>{verificationForm.buyerType === "business" && <><label>Business registration number *<input name="businessRegistrationNumber" value={verificationForm.businessRegistrationNumber} onChange={handleVerificationChange} maxLength="120" required /></label><label className="buyer-document-upload">Upload trade license *<input type="file" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" onChange={(event) => handleVerificationFile(event, "buyerBusinessDocument")} required={!verificationForm.buyerBusinessDocument} /><small>{verificationForm.buyerBusinessDocument ? "Business license attached" : "PDF, JPG or PNG · up to 900 KB"}</small></label></>}</div><div className="buyer-verification-footer"><p>Submitting sends your information and document(s) to the admin team for review.</p><button className="dashboard-primary-button" type="submit">Submit for verification</button></div></form>}
        </section>
      )}
      {showVerificationSuccess && <div className="buyer-verification-overlay" role="presentation"><section className="buyer-verification-modal" role="dialog" aria-modal="true" aria-labelledby="buyer-verification-title"><span>✓</span><h2 id="buyer-verification-title">Request submitted</h2><p>Your buyer verification request is now with the admin team. We’ll update your profile when it has been reviewed.</p><button className="dashboard-primary-button" onClick={() => setShowVerificationSuccess(false)}>Okay</button></section></div>}
    </main>
  );
}

export default BuyerDashboard;
