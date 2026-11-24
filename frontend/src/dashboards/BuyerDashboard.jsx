
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
        setProfile(data.buyer || data.user || data.profile || data);
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

    try {
      setMessage("");

      
await request("/orders", {
  method: "POST",
  body: JSON.stringify({
    productId: product._id,
    quantity,
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
                      <button className="dashboard-secondary-button" onClick={() => toggleFavorite(product)}>{isFavorite(product._id) ? "♥ Saved" : "♡ Save"}</button>
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

      {activeTab === "favorites" && <section className="dashboard-section"><h2>Saved Products</h2>{favorites.length ? <div className="dashboard-product-grid">{favorites.map((row) => row.product && <article className="dashboard-product" key={row._id}><div className="dashboard-product-content"><h3>{row.product.name}</h3><p>{row.product.category} · {row.product.supplier?.city || "Location not provided"}</p><strong>{row.product.currency} {Number(row.product.price).toLocaleString()} / {row.product.unit}</strong><button className="dashboard-cancel-button" onClick={() => toggleFavorite(row.product)}>Remove</button></div></article>)}</div> : <p className="dashboard-empty">No saved products yet.</p>}</section>}

      {activeTab === "compare" && <section className="dashboard-section"><h2>Compare Suppliers</h2>{compareIds.length < 2 ? <p className="dashboard-empty">Select at least two products from Products to compare.</p> : <div className="dashboard-table-wrapper"><table className="dashboard-table"><thead><tr><th>Product</th><th>Supplier</th><th>Location</th><th>Price</th><th>MOQ</th><th>Rating</th><th>Verified</th></tr></thead><tbody>{products.filter((item) => compareIds.includes(item._id)).map((item) => <tr key={item._id}><td>{item.name}</td><td>{item.supplier?.businessName || item.supplier?.name || "—"}</td><td>{item.supplier?.city || "—"}</td><td>{item.currency} {item.price} / {item.unit}</td><td>{item.minimumOrderQuantity}</td><td>{item.averageRating || "—"} ({item.reviewCount || 0})</td><td>{item.supplier?.isVerified ? "Verified" : "No"}</td></tr>)}</tbody></table></div>}</section>}

      {activeTab === "inquiries" && <section className="dashboard-section"><h2>My Supplier Inquiries</h2>{inquiries.length ? inquiries.map((item) => <article className="dashboard-panel" key={item._id}><h3>{item.productName}</h3><p><strong>Supplier:</strong> {item.supplier?.businessName || item.supplier?.name || "—"}</p><p>{item.details}</p><p>Status: {item.status}</p>{item.supplierResponse && <p><strong>Supplier response:</strong> {item.supplierResponse}</p>}</article>) : <p className="dashboard-empty">No inquiries sent yet.</p>}</section>}

      {activeTab === "orders" && (
        <section className="dashboard-section">
          <h2>My Orders</h2>

          {orders.length === 0 ? (
            <p className="dashboard-empty">You have not placed any orders yet.</p>
          ) : (
            <div className="dashboard-table-wrapper">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Status</th>
                    <th>Total</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {orders.map((order) => (
                    <tr key={order._id}>
                      <td>{order._id}</td>
                      <td>
                        <span className="dashboard-status">
                          {order.status}
                        </span>
                      </td>
                      <td>
                        {order.currency || "BDT"}{" "}
                        {Number(order.totalAmount || order.total || 0).toLocaleString()}
                      </td>
                      <td>
                        {order.status === "pending" && (
                          <button
                            className="dashboard-cancel-button"
                            onClick={() => cancelOrder(order._id)}
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {activeTab === "profile" && (
        <section className="dashboard-section">
          <h2>My Profile</h2>

          <div className="dashboard-profile">
            <p>
              <strong>Name:</strong>{" "}
              {profile?.name || user?.name || "Not available"}
            </p>
            <p>
              <strong>Email:</strong>{" "}
              {profile?.email || user?.email || "Not available"}
            </p>
            <p>
              <strong>Phone:</strong> {profile?.phone || "Not provided"}
            </p>
            <p>
              <strong>Role:</strong> {profile?.role || user?.role || "buyer"}
            </p>
          </div>
        </section>
      )}
    </main>
  );
}

export default BuyerDashboard;
