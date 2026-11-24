
import { useEffect, useState } from "react";
import "./Dashboard.css";

const API = "http://localhost:5000/api";

const initialProduct = {
  name: "",
  description: "",
  category: "Garments & Textile",
  price: "",
  currency: "BDT",
  quantity: "",
  unit: "piece",
  minimumOrderQuantity: "1",
};

function SupplierDashboard({ user, onLogout, logoData }) {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [profile, setProfile] = useState(null);
  const [categories, setCategories] = useState([]);
  const [activeTab, setActiveTab] = useState("products");
  const [form, setForm] = useState(initialProduct);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

    const results = await Promise.allSettled([
      request("/supplier/products"),
      request("/orders/supplier"),
      request("/supplier/profile"),
      request("/sourcing/inquiries/supplier"),
      fetch(`${API}/sourcing/categories`).then((response) => response.json()),
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
      setProfile(data.supplier || data.user || data.profile || data);
    }
    if (results[3].status === "fulfilled") setInquiries(results[3].value.inquiries || []);
    if (results[4].status === "fulfilled") setCategories(results[4].value.categories || []);

    setLoading(false);
  };

  useEffect(() => {
    // Initial dashboard data load is intentionally one-time.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setForm(initialProduct);
    setEditingId(null);
  };

  const handleProductSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const payload = {
        ...form,
        price: Number(form.price),
        quantity: Number(form.quantity),
        minimumOrderQuantity: Number(form.minimumOrderQuantity),
      };

      if (editingId) {
        await request(`/supplier/products/${editingId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          });
      } else {
        await request("/supplier/products", {
            method: "POST",
            body: JSON.stringify(payload),
          });
      }

      setMessage(
        editingId
          ? "Product updated successfully."
          : "Product created successfully."
      );

      resetForm();
      await loadDashboard();
      setActiveTab("products");
    } catch (error) {
      setMessage(error.message || "Could not save product.");
    } finally {
      setSaving(false);
    }
  };

  const editProduct = (product) => {
    setForm({
      name: product.name || "",
      description: product.description || "",
      category: product.category || "Garments & Textile",
      price: String(product.price ?? ""),
      currency: product.currency || "BDT",
      quantity: String(product.quantity ?? ""),
      unit: product.unit || "piece",
      minimumOrderQuantity: String(
        product.minimumOrderQuantity ?? 1
      ),
    });

    setEditingId(product._id);
    setActiveTab("add-product");
    setMessage("");
  };

  const publishProduct = async (productId) => {
    try {
      setMessage("");

      await request(`/supplier/products/${productId}/publish`, {
        method: "PATCH",
      });

      setMessage("Product published successfully.");
      await loadDashboard();
    } catch (error) {
      setMessage(error.message || "Could not publish product.");
    }
  };

  const deleteProduct = async (productId) => {
    if (!window.confirm("Are you sure you want to delete this product?")) {
      return;
    }

    try {
      await request(`/supplier/products/${productId}`, {
        method: "DELETE",
      });

      setMessage("Product deleted successfully.");
      await loadDashboard();
    } catch (error) {
      setMessage(error.message || "Could not delete product.");
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      setMessage("");

      await request(`/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });

      setMessage(`Order status updated to ${status}.`);
      await loadDashboard();
    } catch (error) {
      setMessage(error.message || "Could not update order status.");
    }
  };

  const submitVerification = async () => {
    const current = profile || {};
    const ask = (label, key) => window.prompt(label, current[key] || "")?.trim();
    const businessName = ask("Business name", "businessName");
    const businessType = ask("Business type (manufacturer, wholesaler, etc.)", "businessType");
    const businessDescription = ask("Business description", "businessDescription");
    const address = ask("Business address", "address");
    const city = ask("City / area", "city");
    if (![businessName, businessType, businessDescription, address, city].every(Boolean)) return;
    try {
      await request("/sourcing/supplier/verification", { method: "POST", body: JSON.stringify({ businessName, businessType, businessDescription, address, city }) });
      setMessage("Verification request submitted for admin review.");
      await loadDashboard();
    } catch (error) { setMessage(error.message); }
  };

  const respondToInquiry = async (inquiry) => {
    const response = window.prompt(`Reply to ${inquiry.buyer?.name || "buyer"}:`);
    if (!response?.trim()) return;
    try {
      await request(`/sourcing/inquiries/${inquiry._id}/respond`, { method: "PATCH", body: JSON.stringify({ response }) });
      setMessage("Inquiry response sent.");
      await loadDashboard();
    } catch (error) { setMessage(error.message); }
  };

  if (loading) {
    return (
      <main className="dashboard-page">
        <p className="dashboard-loading">
          Loading Supplier Dashboard...
        </p>
      </main>
    );
  }

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <h1 className="dashboard-header-brand">{logoData && <img src={logoData} alt="SourceBD logo" />}<span>SourceBD</span></h1>
          <p>Supplier Dashboard</p>
        </div>

        <button className="dashboard-logout" onClick={onLogout}>
          Logout
        </button>
      </header>

      <section className="dashboard-welcome">
        <h2>
          Welcome, {profile?.name || user?.name || "Supplier"}!
        </h2>
        <p>Manage your products and fulfill customer orders.</p>
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
          <span>Published Products</span>
          <strong>
            {products.filter((product) => product.status === "published").length}
          </strong>
        </article>

        <article className="dashboard-stat">
          <span>Customer Orders</span>
          <strong>{orders.length}</strong>
        </article>
      </section>

      <nav className="dashboard-tabs">
        <button
          className={activeTab === "products" ? "active" : ""}
          onClick={() => setActiveTab("products")}
        >
          My Products
        </button>

        <button
          className={activeTab === "add-product" ? "active" : ""}
          onClick={() => {
            resetForm();
            setActiveTab("add-product");
          }}
        >
          Add Product
        </button>

        <button
          className={activeTab === "orders" ? "active" : ""}
          onClick={() => setActiveTab("orders")}
        >
          Customer Orders
        </button>

        <button className={activeTab === "inquiries" ? "active" : ""} onClick={() => setActiveTab("inquiries")}>Inquiries ({inquiries.filter((item) => item.status === "new").length})</button>

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
            <h2>My Products</h2>

            <button
              className="dashboard-primary-button"
              style={{ width: "auto", marginTop: 0 }}
              onClick={() => {
                resetForm();
                setActiveTab("add-product");
              }}
            >
              + Add Product
            </button>
          </div>

          {products.length === 0 ? (
            <p className="dashboard-empty">
              You have not added any products yet.
            </p>
          ) : (
            <div className="dashboard-product-grid">
              {products.map((product) => (
                <article className="dashboard-product" key={product._id}>
                  {product.images?.[0] ? (
                    <img
                      className="dashboard-product-image"
                      src={product.images[0]}
                      alt={product.name}
                    />
                  ) : (
                    <div className="dashboard-product-placeholder">
                      Product
                    </div>
                  )}

                  <div className="dashboard-product-content">
                    <span className="dashboard-category">
                      {product.status || "draft"}
                    </span>

                    <h3>{product.name}</h3>

                    <p>{product.description || "No description."}</p>

                    <strong className="dashboard-price">
                      {product.currency || "BDT"}{" "}
                      {Number(product.price || 0).toLocaleString()}
                    </strong>

                    <p>
                      Stock: {product.quantity} {product.unit || ""}
                    </p>

                    <button
                      className="dashboard-primary-button"
                      onClick={() => editProduct(product)}
                    >
                      Edit Product
                    </button>

                    {product.status === "draft" && (
                      <button
                        className="dashboard-primary-button"
                        onClick={() => publishProduct(product._id)}
                      >
                        Publish Product
                      </button>
                    )}

                    <button
                      className="dashboard-cancel-button"
                      style={{ width: "100%", marginTop: 10 }}
                      onClick={() => deleteProduct(product._id)}
                    >
                      Delete Product
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === "add-product" && (
        <section className="dashboard-section">
          <h2>{editingId ? "Edit Product" : "Add New Product"}</h2>

          <form className="supplier-product-form" onSubmit={handleProductSubmit}>
            <label>
              Product Name
              <input
                name="name"
                value={form.name}
                onChange={handleFormChange}
                required
              />
            </label>

            <label>
              Description
              <textarea
                name="description"
                value={form.description}
                onChange={handleFormChange}
                rows="4"
                required
              />
            </label>

            <label>
              Category
              <select
                name="category"
                value={form.category}
                onChange={handleFormChange}
                required
              >
                {(categories.length ? categories : [{ name: "Garments & Textile" }, { name: "Packaging" }, { name: "Cosmetics" }, { name: "Electronics" }, { name: "Furniture" }, { name: "Agriculture" }, { name: "Food & Beverage" }, { name: "Printing" }, { name: "Other" }]).map((category) => <option key={category._id || category.name}>{category.name}</option>)}
              </select>
            </label>

            <div className="supplier-form-grid">
              <label>
                Price
                <input
                  name="price"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.price}
                  onChange={handleFormChange}
                  required
                />
              </label>

              <label>
                Currency
                <select
                  name="currency"
                  value={form.currency}
                  onChange={handleFormChange}
                >
                  <option value="BDT">BDT (৳)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </label>

              <label>
                Stock Quantity
                <input
                  name="quantity"
                  type="number"
                  min="0"
                  step="1"
                  value={form.quantity}
                  onChange={handleFormChange}
                  required
                />
              </label>

              <label>
                Unit
                <select
                  name="unit"
                  value={form.unit}
                  onChange={handleFormChange}
                >
                  <option value="piece">Piece</option>
                  <option value="meter">Meter</option>
                  <option value="kg">Kilogram</option>
                  <option value="box">Box</option>
                  <option value="set">Set</option>
                  <option value="unit">Unit</option>
                </select>
              </label>
            </div>

            <label>
              Minimum Order Quantity
              <input
                name="minimumOrderQuantity"
                type="number"
                min="1"
                step="1"
                value={form.minimumOrderQuantity}
                onChange={handleFormChange}
                required
              />
            </label>

            <div className="supplier-form-actions">
              <button
                className="dashboard-primary-button"
                type="submit"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update Product"
                    : "Save Product as Draft"}
              </button>

              <button
                className="dashboard-cancel-button"
                type="button"
                onClick={() => {
                  resetForm();
                  setActiveTab("products");
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {activeTab === "orders" && (
        <section className="dashboard-section">
          <h2>Customer Orders</h2>

          {orders.length === 0 ? (
            <p className="dashboard-empty">
              No customer orders yet.
            </p>
          ) : (
            <div className="dashboard-table-wrapper">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Status</th>
                    <th>Total</th>
                    <th>Update Status</th>
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
                        {Number(
                          order.totalAmount || order.total || 0
                        ).toLocaleString()}
                      </td>

                      <td>
                        {order.status === "pending" && (
                          <button
                            className="dashboard-primary-button"
                            onClick={() =>
                              updateOrderStatus(order._id, "confirmed")
                            }
                          >
                            Confirm
                          </button>
                        )}

                        {order.status === "confirmed" && (
                          <button
                            className="dashboard-primary-button"
                            onClick={() =>
                              updateOrderStatus(order._id, "processing")
                            }
                          >
                            Start Processing
                          </button>
                        )}

                        {order.status === "processing" && (
                          <button
                            className="dashboard-primary-button"
                            onClick={() =>
                              updateOrderStatus(order._id, "shipped")
                            }
                          >
                            Mark Shipped
                          </button>
                        )}

                        {order.status === "shipped" && (
                          <button
                            className="dashboard-primary-button"
                            onClick={() =>
                              updateOrderStatus(order._id, "delivered")
                            }
                          >
                            Mark Delivered
                          </button>
                        )}

                        {["delivered", "cancelled"].includes(order.status) && (
                          <span>Completed</span>
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

      {activeTab === "inquiries" && <section className="dashboard-section"><h2>Buyer Inquiries / RFQs</h2>{inquiries.length ? inquiries.map((item) => <article className="dashboard-panel" key={item._id}><h3>{item.productName}</h3><p><strong>Buyer:</strong> {item.buyer?.name || item.buyer?.email || "—"}</p><p>{item.details}</p>{item.quantity && <p>Quantity: {item.quantity}</p>}{item.targetPrice !== null && item.targetPrice !== undefined && <p>Target price: {item.targetPrice}</p>}<p>Status: {item.status}</p>{item.supplierResponse && <p><strong>Your reply:</strong> {item.supplierResponse}</p>}{item.status === "new" && <button className="dashboard-primary-button" onClick={() => respondToInquiry(item)}>Respond</button>}</article>) : <p className="dashboard-empty">No buyer inquiries yet.</p>}</section>}

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
              <strong>Phone:</strong>{" "}
              {profile?.phone || "Not provided"}
            </p>

            <p>
              <strong>Role:</strong> supplier
            </p>
            <p><strong>Business:</strong> {profile?.businessName || "Not provided"}</p>
            <p><strong>Location:</strong> {[profile?.city, profile?.address].filter(Boolean).join(", ") || "Not provided"}</p>
            <p><strong>Verification:</strong> {profile?.verificationStatus || (profile?.isVerified ? "verified" : "not submitted")}</p>
            {profile?.verificationNote && <p><strong>Admin note:</strong> {profile.verificationNote}</p>}
            {profile?.verificationStatus !== "verified" && <button className="dashboard-primary-button" onClick={submitVerification} disabled={profile?.verificationStatus === "pending"}>{profile?.verificationStatus === "pending" ? "Verification Pending" : "Request Supplier Verification"}</button>}
          </div>
        </section>
      )}
    </main>
  );
}

export default SupplierDashboard;
