
import { Fragment, useEffect, useState } from "react";
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
  imageData: "",
};

const resizeProductImage = (file) => new Promise((resolve, reject) => {
  if (!file || !["image/jpeg", "image/png"].includes(file.type)) return reject(new Error("Choose a JPG or PNG image."));
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    const scale = Math.min(1, 1400 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(objectUrl);
    canvas.toBlob((blob) => {
      if (!blob || blob.size > 1_500_000) return reject(new Error("Image is still too large. Choose a smaller image."));
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Could not read the selected image."));
      reader.readAsDataURL(blob);
    }, "image/jpeg", 0.82);
  };
  image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Could not open this image.")); };
  image.src = objectUrl;
});

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error("Could not read the selected file."));
  reader.readAsDataURL(file);
});

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
  const [profileForm, setProfileForm] = useState({ businessName: "", businessType: "", businessDescription: "", phone: "", contactPerson: "", designation: "", businessRegistrationType: "", tradeLicenseNumber: "", taxIdentificationNumber: "", vatBinNumber: "", website: "", address: "", city: "", tradeLicenseDocument: "" });
  const [showVerificationSuccess, setShowVerificationSuccess] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState(null);

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
      const supplier = data.supplier || data.user || data.profile || data;
      setProfile(supplier);
      setProfileForm((previous) => ({ ...previous, ...Object.fromEntries(Object.keys(previous).filter((key) => key !== "tradeLicenseDocument").map((key) => [key, supplier[key] || (key === "contactPerson" ? supplier.name : "") || ""])) }));
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

  const handleProductImageChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imageData = await resizeProductImage(file);
      setForm((previous) => ({ ...previous, imageData }));
      setMessage("Product photo ready to upload.");
    } catch (error) { setMessage(error.message); }
    event.target.value = "";
  };

  const handleProfileChange = (event) => setProfileForm((previous) => ({ ...previous, [event.target.name]: event.target.value }));

  const handleTradeLicenseChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) { setMessage("Trade license must be a PDF, JPG or PNG file."); event.target.value = ""; return; }
    if (file.size > 1_500_000) { setMessage("Trade license file must be smaller than 1.5 MB."); event.target.value = ""; return; }
    try { const tradeLicenseDocument = await readFileAsDataUrl(file); setProfileForm((previous) => ({ ...previous, tradeLicenseDocument })); setMessage(""); }
    catch (error) { setMessage(error.message); }
    event.target.value = "";
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

      if (payload.imageData?.startsWith("data:image/")) {
        const uploaded = await request("/supplier/products/image", { method: "POST", body: JSON.stringify({ imageData: payload.imageData }) });
        payload.images = [uploaded.imageUrl];
      } else {
        payload.images = payload.imageData ? [payload.imageData] : [];
      }
      delete payload.imageData;

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
      imageData: product.images?.[0] || "",
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

  const submitVerification = async (event) => {
    event.preventDefault();
    if (!profileForm.tradeLicenseDocument) { setMessage("Upload your trade license before submitting for review."); return; }
    try {
      await request("/sourcing/supplier/verification", { method: "POST", body: JSON.stringify(profileForm) });
      setMessage("");
      setShowVerificationSuccess(true);
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

            <div className="supplier-image-field">
              <div><strong>Product photo</strong><p>Use one clear JPG or PNG image (automatically resized before upload).</p></div>
              <label className="supplier-image-picker">{form.imageData ? "Replace photo" : "Choose product photo"}<input type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" onChange={handleProductImageChange} /></label>
              {form.imageData && <div className="supplier-image-preview"><img src={form.imageData} alt="Product preview" /><div><strong>Photo preview</strong><span>Shown on the product listing</span><button type="button" onClick={() => setForm((previous) => ({ ...previous, imageData: "" }))}>Remove photo</button></div></div>}
            </div>

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
                  <tr><th>Order</th><th>Buyer</th><th>Status</th><th>Total</th><th>Actions</th></tr>
                </thead>

                <tbody>
                  {orders.map((order) => <Fragment key={order._id}>
                    <tr>
                      <td><strong>#{String(order._id).slice(-8).toUpperCase()}</strong><small className="supplier-order-date">{new Date(order.createdAt).toLocaleDateString()}</small></td>
                      <td><strong>{order.buyer?.name || "Buyer"} {order.buyer?.isVerified && <span className="dashboard-verified-badge">✓ Verified</span>}</strong><small className="supplier-order-date">{order.buyer?.email || "Email unavailable"}</small></td>
                      <td><span className="dashboard-status">{order.status}</span></td>
                      <td>{order.currency || "BDT"} {Number(order.totalPrice ?? order.totalAmount ?? order.total ?? 0).toLocaleString()}</td>
                      <td><div className="supplier-order-actions"><button className="dashboard-secondary-button" onClick={() => setExpandedOrderId(expandedOrderId === order._id ? null : order._id)}>{expandedOrderId === order._id ? "Hide details" : "Details"}</button>
                        {order.status === "pending" && <button className="dashboard-primary-button" onClick={() => updateOrderStatus(order._id, "confirmed")}>Confirm order</button>}
                        {order.status === "confirmed" && <button className="dashboard-primary-button" onClick={() => updateOrderStatus(order._id, "processing")}>Start processing</button>}
                        {order.status === "processing" && <button className="dashboard-primary-button" onClick={() => updateOrderStatus(order._id, "shipped")}>Mark shipped</button>}
                        {order.status === "shipped" && <button className="dashboard-primary-button" onClick={() => updateOrderStatus(order._id, "delivered")}>Mark delivered</button>}
                        {["delivered", "cancelled"].includes(order.status) && <span>Completed</span>}
                      </div></td>
                    </tr>
                    {expandedOrderId === order._id && <tr className="supplier-order-detail-row"><td colSpan="5"><div className="supplier-order-details">
                      <section><h3>Buyer information {order.buyer?.isVerified && <span className="dashboard-verified-badge">✓ Verified buyer</span>}</h3><p><strong>Name</strong>{order.buyer?.name || "Not provided"}</p><p><strong>Email</strong>{order.buyer?.email ? <a href={`mailto:${order.buyer.email}`}>{order.buyer.email}</a> : "Not provided"}</p><p><strong>Phone</strong>{order.buyer?.phone ? <a href={`tel:${order.buyer.phone}`}>{order.buyer.phone}</a> : "Not provided"}</p><p><strong>Delivery address</strong>{order.shippingAddress || [order.buyer?.address, order.buyer?.city].filter(Boolean).join(", ") || "Buyer did not provide an address"}</p></section>
                      <section><h3>Ordered product</h3><p><strong>Product</strong>{order.productName || order.product?.name || "Product listing"}</p><p><strong>Category</strong>{order.product?.category || "—"}</p><p><strong>Quantity</strong>{Number(order.quantity || 0).toLocaleString()} {order.product?.unit || "unit(s)"}</p><p><strong>Unit price</strong>{order.currency || "BDT"} {Number(order.unitPrice || 0).toLocaleString()}</p><p><strong>Order total</strong>{order.currency || "BDT"} {Number(order.totalPrice || 0).toLocaleString()}</p>{order.note && <p><strong>Buyer note</strong>{order.note}</p>}{order.product?.description && <p><strong>Product details</strong>{order.product.description}</p>}</section>
                    </div></td></tr>}
                  </Fragment>)}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {activeTab === "inquiries" && <section className="dashboard-section"><h2>Buyer Inquiries / RFQs</h2>{inquiries.length ? inquiries.map((item) => <article className="dashboard-panel" key={item._id}><h3>{item.productName}</h3><p><strong>Buyer:</strong> {item.buyer?.name || item.buyer?.email || "—"}</p><p>{item.details}</p>{item.quantity && <p>Quantity: {item.quantity}</p>}{item.targetPrice !== null && item.targetPrice !== undefined && <p>Target price: {item.targetPrice}</p>}<p>Status: {item.status}</p>{item.supplierResponse && <p><strong>Your reply:</strong> {item.supplierResponse}</p>}{item.status === "new" && <button className="dashboard-primary-button" onClick={() => respondToInquiry(item)}>Respond</button>}</article>) : <p className="dashboard-empty">No buyer inquiries yet.</p>}</section>}

      {activeTab === "profile" && (
        <section className="dashboard-section">
          <div className="supplier-profile-intro"><div><span className="supplier-form-kicker">BUSINESS PROFILE</span><h2>My Profile & Verification</h2><p>Complete your business details and submit documents for admin review.</p></div><span className={`supplier-verification-status ${profile?.verificationStatus || "not_submitted"}`}>{profile?.isVerified ? "✓ Verified supplier" : profile?.verificationStatus === "pending" ? "Under review" : profile?.verificationStatus === "rejected" ? "Changes requested" : "Not verified"}</span></div>
          {profile?.verificationNote && <div className="supplier-review-note"><strong>Admin feedback:</strong> {profile.verificationNote}</div>}
          {profile?.verificationStatus === "verified" ? <div className="supplier-verified-panel"><span>✓</span><div><strong>Your supplier profile is verified</strong><p>Your verified badge appears beside your business on published listings.</p></div></div> : profile?.verificationStatus === "pending" ? <div className="supplier-verified-panel pending"><span>◷</span><div><strong>Your application is with the admin team</strong><p>We will review your submitted business information and trade license.</p></div></div> : <form className="supplier-verification-form" onSubmit={submitVerification}>
            <div className="supplier-form-section-title"><span>01</span><div><h3>Business & contact details</h3><p>Required information is marked with an asterisk.</p></div></div>
            <div className="supplier-verification-grid">
              <label>Business / legal name *<input name="businessName" value={profileForm.businessName} onChange={handleProfileChange} maxLength="150" required /></label>
              <label>Business type *<select name="businessType" value={profileForm.businessType} onChange={handleProfileChange} required><option value="">Choose business type</option><option>Manufacturer</option><option>Wholesaler</option><option>Importer</option><option>Exporter</option><option>Distributor</option><option>Other</option></select></label>
              <label>Registration type *<select name="businessRegistrationType" value={profileForm.businessRegistrationType} onChange={handleProfileChange} required><option value="">Choose registration type</option><option>Sole Proprietorship</option><option>Partnership</option><option>Private Limited Company</option><option>Public Limited Company</option><option>Cooperative</option><option>Other</option></select></label>
              <label>Contact person *<input name="contactPerson" value={profileForm.contactPerson} onChange={handleProfileChange} maxLength="150" required /></label>
              <label>Job title / designation<input name="designation" value={profileForm.designation} onChange={handleProfileChange} maxLength="100" placeholder="e.g. Owner, Sales Manager" /></label>
              <label>Business email<input value={profile?.email || user?.email || ""} readOnly /></label>
              <label>Business phone number *<input name="phone" type="tel" value={profileForm.phone} onChange={handleProfileChange} maxLength="40" required /></label>
              <label>Website (optional)<input name="website" type="url" value={profileForm.website} onChange={handleProfileChange} placeholder="https://" maxLength="200" /></label>
              <label>City / district *<input name="city" value={profileForm.city} onChange={handleProfileChange} maxLength="100" required /></label>
              <label className="supplier-address-field">Full business address *<textarea name="address" value={profileForm.address} onChange={handleProfileChange} rows="2" maxLength="300" required /></label>
              <label className="supplier-address-field">About the business *<textarea name="businessDescription" value={profileForm.businessDescription} onChange={handleProfileChange} rows="3" maxLength="1000" placeholder="What you make or supply, industries served, and service areas" required /></label>
            </div>
            <div className="supplier-form-section-title supplier-legal-title"><span>02</span><div><h3>Business registration</h3><p>Your trade license is required. Tax and VAT identifiers are optional.</p></div></div>
            <div className="supplier-verification-grid">
              <label>Trade license number *<input name="tradeLicenseNumber" value={profileForm.tradeLicenseNumber} onChange={handleProfileChange} maxLength="100" required /></label>
              <label>TIN (optional)<input name="taxIdentificationNumber" value={profileForm.taxIdentificationNumber} onChange={handleProfileChange} maxLength="100" /></label>
              <label>VAT / BIN (optional)<input name="vatBinNumber" value={profileForm.vatBinNumber} onChange={handleProfileChange} maxLength="100" /></label>
              <label className="supplier-license-upload">Trade license file *<input type="file" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" onChange={handleTradeLicenseChange} required={!profileForm.tradeLicenseDocument} /><small>{profileForm.tradeLicenseDocument ? "License file attached and ready" : "PDF, JPG or PNG · maximum 1.5 MB"}</small></label>
            </div>
            <div className="supplier-verification-footer"><p>Your trade license is shared with SourceBD admins for verification review.</p><button className="dashboard-primary-button" type="submit">Submit for admin review</button></div>
          </form>}
        </section>
      )}
      {showVerificationSuccess && <div className="supplier-success-overlay" role="presentation"><section className="supplier-success-modal" role="dialog" aria-modal="true" aria-labelledby="verification-success-title"><span className="supplier-success-icon">✓</span><h2 id="verification-success-title">Request submitted</h2><p>Your verification request has been submitted for admin review. You can follow its status from My Profile.</p><button className="dashboard-primary-button" onClick={() => { setShowVerificationSuccess(false); setMessage(""); }}>Okay</button></section></div>}
    </main>
  );
}

export default SupplierDashboard;
