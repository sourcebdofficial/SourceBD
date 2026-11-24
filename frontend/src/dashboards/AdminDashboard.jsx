
import { useEffect, useState } from "react";
import "./Dashboard.css";

const API_BASE = "http://localhost:5000/api";

function AdminDashboard({ user, onLogout, logoData, onLogoChange }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [users, setUsers] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [coAdminForm, setCoAdminForm] = useState({ name: "", email: "", password: "", permissions: ["view_users"] });
  const [creatingCoAdmin, setCreatingCoAdmin] = useState(false);
  const [editingCoAdmin, setEditingCoAdmin] = useState(null);
  const [editedPermissions, setEditedPermissions] = useState([]);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [logoSaving, setLogoSaving] = useState(false);
  const [verificationQueue, setVerificationQueue] = useState([]);
  const [reviewQueue, setReviewQueue] = useState([]);
  const [categories, setCategories] = useState([]);

  const token = localStorage.getItem("token");

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const getErrorMessage = (data, fallback) =>
    data?.message || data?.error || fallback;

  const fetchDashboard = async () => {
    try {
      setLoading(true);

      const response = await fetch(
        `${API_BASE}/auth/admin/dashboard`,
        { headers: authHeaders }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Could not load dashboard.")
        );
      }

      setDashboard(data);
    } catch (error) {
      setMessage(error.message || "Could not load dashboard.");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      setMessage("");

      const response = await fetch(
        `${API_BASE}/auth/admin/users`,
        { headers: authHeaders }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Could not load users.")
        );
      }

      const userList = Array.isArray(data)
        ? data
        : data.users || data.data || [];

      setUsers(userList);
    } catch (error) {
      setMessage(error.message || "Could not load users.");
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchSourcingQueues = async () => {
    try {
      const [verificationResponse, reviewResponse, categoryResponse] = await Promise.all([
        fetch(`${API_BASE}/sourcing/admin/verification`, { headers: authHeaders }),
        fetch(`${API_BASE}/sourcing/admin/reviews`, { headers: authHeaders }),
        fetch(`${API_BASE}/sourcing/categories`),
      ]);
      const [verificationData, reviewData, categoryData] = await Promise.all([
        verificationResponse.json(), reviewResponse.json(), categoryResponse.json(),
      ]);
      if (!verificationResponse.ok) throw new Error(getErrorMessage(verificationData, "Could not load supplier requests."));
      if (!reviewResponse.ok) throw new Error(getErrorMessage(reviewData, "Could not load reviews."));
      setVerificationQueue(verificationData.suppliers || []);
      setReviewQueue(reviewData.reviews || []);
      setCategories(categoryData.categories || []);
    } catch (error) { setMessage(error.message); }
  };

  useEffect(() => {
    // Initial admin data load is intentionally one-time.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDashboard();
    fetchUsers();
    fetchSourcingQueues();
    // Initial dashboard data load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reviewSupplier = async (supplier, decision) => {
    const note = decision === "rejected" ? (window.prompt("Reason for rejection (optional):") || "") : "";
    try {
      const response = await fetch(`${API_BASE}/sourcing/admin/verification/${supplier._id}`, {
        method: "PATCH", headers: authHeaders, body: JSON.stringify({ decision, note }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(data, "Could not update verification."));
      setMessage(`Supplier ${decision}.`);
      fetchSourcingQueues();
      fetchUsers();
    } catch (error) { setMessage(error.message); }
  };

  const moderateReview = async (review, status) => {
    try {
      const response = await fetch(`${API_BASE}/sourcing/admin/reviews/${review._id}`, {
        method: "PATCH", headers: authHeaders, body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(data, "Could not moderate review."));
      setMessage(`Review ${status}.`);
      fetchSourcingQueues();
    } catch (error) { setMessage(error.message); }
  };

  const addCategory = async () => {
    const name = window.prompt("New product category name:");
    if (!name?.trim()) return;
    try {
      const response = await fetch(`${API_BASE}/sourcing/admin/categories`, { method: "POST", headers: authHeaders, body: JSON.stringify({ name }) });
      const data = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(data, "Could not add category."));
      setMessage("Category added.");
      fetchSourcingQueues();
    } catch (error) { setMessage(error.message); }
  };

  const archiveCategory = async (category) => {
    if (category.isDefault) { setMessage("Built-in categories cannot be archived."); return; }
    try {
      const response = await fetch(`${API_BASE}/sourcing/admin/categories/${category._id}`, { method: "DELETE", headers: authHeaders });
      const data = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(data, "Could not archive category."));
      setMessage("Category archived.");
      fetchSourcingQueues();
    } catch (error) { setMessage(error.message); }
  };

  const createCoAdmin = async (event) => {
    event.preventDefault();
    setCreatingCoAdmin(true);
    setMessage("");
    try {
      const response = await fetch(`${API_BASE}/auth/admin/co-admins`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(coAdminForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(data, "Could not create Co-Admin."));
      const createdEmail = data.coAdmin?.email || coAdminForm.email;
      setCoAdminForm({ name: "", email: "", password: "", permissions: ["view_users"] });
      fetchUsers();
      setMessage(`Co-Admin account created for ${createdEmail}.`);
    } catch (error) {
      setMessage(error.message || "Could not create Co-Admin.");
    } finally {
      setCreatingCoAdmin(false);
    }
  };

  const toggleCoAdminPermission = (permission) => {
    setCoAdminForm((current) => ({
      ...current,
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter((item) => item !== permission)
        : [...current.permissions, permission],
    }));
  };

  const openPermissionEditor = (coAdmin) => {
    setEditingCoAdmin(coAdmin);
    setEditedPermissions(coAdmin.permissions || []);
    setMessage("");
  };

  const toggleEditedPermission = (permission) => {
    setEditedPermissions((current) => current.includes(permission)
      ? current.filter((item) => item !== permission)
      : [...current, permission]);
  };

  const saveCoAdminPermissions = async () => {
    if (!editingCoAdmin?._id) return;
    setSavingPermissions(true);
    setMessage("");
    try {
      const response = await fetch(`${API_BASE}/auth/admin/co-admins/${editingCoAdmin._id}/permissions`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ permissions: editedPermissions }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(data, "Could not update Co-Admin permissions."));
      setUsers((current) => current.map((item) => item._id === editingCoAdmin._id
        ? { ...item, permissions: data.coAdmin?.permissions || editedPermissions }
        : item));
      setEditingCoAdmin(null);
      setMessage(`Permissions updated for ${editingCoAdmin.name || editingCoAdmin.email}.`);
    } catch (error) {
      setMessage(error.message || "Could not update Co-Admin permissions.");
    } finally {
      setSavingPermissions(false);
    }
  };

  const uploadSiteLogo = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setMessage("Choose a PNG, JPG, or WebP image.");
      return;
    }
    if (file.size > 1.5 * 1024 * 1024) {
      setMessage("Logo image must be smaller than 1.5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => setMessage("Could not read this image file.");
    reader.onload = async () => {
      setLogoSaving(true);
      setMessage("");
      try {
        const response = await fetch(`${API_BASE}/settings/logo`, {
          method: "PUT",
          headers: authHeaders,
          body: JSON.stringify({ logoData: reader.result }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(getErrorMessage(data, "Could not update the site logo."));
        onLogoChange?.(data.logoData || "");
        setMessage("Site logo updated successfully.");
      } catch (error) {
        setMessage(error.message || "Could not update the site logo.");
      } finally {
        setLogoSaving(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const restoreDefaultLogo = async () => {
    setLogoSaving(true);
    setMessage("");
    try {
      const response = await fetch(`${API_BASE}/settings/logo`, { method: "DELETE", headers: authHeaders });
      const data = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(data, "Could not restore the default logo."));
      onLogoChange?.("");
      setMessage("Default SourceBD logo restored.");
    } catch (error) {
      setMessage(error.message || "Could not restore the default logo.");
    } finally {
      setLogoSaving(false);
    }
  };

  const handleDeleteUser = async (selectedUser) => {
    if (!selectedUser?._id) {
      setMessage("This user has no valid ID.");
      return;
    }

    if (selectedUser._id === user?._id) {
      setMessage("You cannot delete your own account here.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete ${
        selectedUser.name || selectedUser.email
      }?`
    );

    if (!confirmed) return;

    try {
      setMessage("");

      const response = await fetch(
        `${API_BASE}/auth/admin/users/${selectedUser._id}`,
        {
          method: "DELETE",
          headers: authHeaders,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Could not delete user.")
        );
      }

      setUsers((previousUsers) =>
        previousUsers.filter(
          (item) => item._id !== selectedUser._id
        )
      );

      setMessage("User deleted successfully.");
      fetchDashboard();
    } catch (error) {
      setMessage(error.message || "Could not delete user.");
    }
  };

  const filteredUsers = users.filter((item) => {
    const searchText = search.toLowerCase();

    return (
      (item.name || "").toLowerCase().includes(searchText) ||
      (item.email || "").toLowerCase().includes(searchText) ||
      (item.phone || "").toLowerCase().includes(searchText) ||
      (item.role || "").toLowerCase().includes(searchText)
    );
  });

  const roleFilters = [
    { id: "all", label: "All users" },
    { id: "buyer", label: "Buyers" },
    { id: "supplier", label: "Suppliers" },
    ...(user?.role === "admin" ? [
      { id: "admin", label: "Admins" },
      { id: "co-admin", label: "Co-Admins" },
    ] : []),
  ];
  const roleFilteredUsers = filteredUsers.filter((item) => userRoleFilter === "all" || item.role === userRoleFilter);

  const totalUsers =
    dashboard?.totalUsers ??
    dashboard?.stats?.totalUsers ??
    users.length;

  const totalBuyers =
    dashboard?.totalBuyers ??
    dashboard?.stats?.totalBuyers ??
    users.filter((item) => item.role === "buyer").length;

  const totalSuppliers =
    dashboard?.totalSuppliers ??
    dashboard?.stats?.totalSuppliers ??
    users.filter((item) => item.role === "supplier").length;

  const totalAdmins =
    dashboard?.totalAdmins ??
    dashboard?.stats?.totalAdmins ??
    users.filter(
      (item) =>
        item.role === "admin" || item.role === "co-admin"
    ).length;

  return (
    <div className="dashboard-page admin-dashboard">
      <aside className="dashboard-sidebar admin-sidebar">
        <div className="dashboard-brand admin-brand">
          {logoData ? <img className="admin-brand-mark admin-brand-image" src={logoData} alt="SourceBD logo" /> : <span className="admin-brand-mark">S</span>}
          <div><h2>SourceBD</h2><p>Control Center</p></div>
        </div>

        <nav className="dashboard-nav admin-nav" aria-label="Admin dashboard">
          <button
            className={
              activeTab === "overview" ? "active" : ""
            }
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>

          <button className={activeTab === "verification" ? "active" : ""} onClick={() => { setActiveTab("verification"); fetchSourcingQueues(); }}>Supplier Verification</button>
          <button className={activeTab === "reviews" ? "active" : ""} onClick={() => { setActiveTab("reviews"); fetchSourcingQueues(); }}>Review Moderation</button>
          <button className={activeTab === "categories" ? "active" : ""} onClick={() => { setActiveTab("categories"); fetchSourcingQueues(); }}>Categories</button>

          <button
            className={
              activeTab === "users" ? "active" : ""
            }
            onClick={() => setActiveTab("users")}
          >
            Users Management
          </button>

          {user?.role === "admin" && (
            <button className={activeTab === "create-co-admin" ? "active" : ""} onClick={() => setActiveTab("create-co-admin")}>
              Create Co-Admin
            </button>
          )}

          {user?.role === "admin" && (
            <button className={activeTab === "site-logo" ? "active" : ""} onClick={() => setActiveTab("site-logo")}>
              Change Site Logo
            </button>
          )}

          <button
            className={
              activeTab === "profile" ? "active" : ""
            }
            onClick={() => setActiveTab("profile")}
          >
            My Account
          </button>
        </nav>

        <button
          className="dashboard-logout"
          onClick={onLogout}
        >
          Logout
        </button>
      </aside>

      <main className="dashboard-main admin-main">
        <header className="dashboard-header admin-header">
          <div>
            <h1>{{ overview: "Admin Overview", users: "Users Management", "create-co-admin": "Create Co-Admin", "site-logo": "Change Site Logo", profile: "My Account", verification: "Supplier Verification", reviews: "Review Moderation", categories: "Category Management" }[activeTab] || "Admin Panel"}</h1>

            <p>Welcome back, {user?.name || user?.email || "Admin"}. Here’s what’s happening on SourceBD.</p>
          </div>

          <span className="dashboard-role admin-role">
            <span className="admin-role-dot" />{user?.role === "admin" ? "Super Admin" : "Co-Admin"}
          </span>
        </header>

        {message && (
          <div className="dashboard-message" role="status">
            {message}
          </div>
        )}

        {activeTab === "overview" && (
          <section className="dashboard-content admin-content">
            <div className="admin-section-intro"><div><span className="admin-eyebrow">AT A GLANCE</span><h2>Platform Summary</h2><p>Quick view of your SourceBD community.</p></div></div>

            {loading ? (
              <p>Loading dashboard...</p>
            ) : (
              <div className="dashboard-stats admin-stats">
                <div className="dashboard-stat-card admin-stat-card admin-stat-total">
                  <span className="admin-stat-icon">◎</span><span>Total Users</span>
                  <strong>{totalUsers}</strong><small>Registered accounts</small>
                </div>

                <div className="dashboard-stat-card admin-stat-card admin-stat-buyers">
                  <span className="admin-stat-icon">↗</span><span>Buyers</span>
                  <strong>{totalBuyers}</strong><small>People sourcing products</small>
                </div>

                <div className="dashboard-stat-card admin-stat-card admin-stat-suppliers">
                  <span className="admin-stat-icon">▦</span><span>Suppliers</span>
                  <strong>{totalSuppliers}</strong><small>Businesses on the platform</small>
                </div>

                <div className="dashboard-stat-card admin-stat-card admin-stat-admins">
                  <span className="admin-stat-icon">◇</span><span>Admins</span>
                  <strong>{totalAdmins}</strong><small>Platform administrators</small>
                </div>
              </div>
            )}

            <div className="dashboard-panel admin-quick-panel">
              <div><span className="admin-eyebrow">GET STARTED</span><h3>Quick Actions</h3><p>Jump to common admin tasks.</p></div>

              <button
                className="dashboard-primary-button"
                onClick={() => {
                  setActiveTab("users");
                  fetchUsers();
                }}
              >
                Manage Users
              </button>

              <button
                className="dashboard-secondary-button"
                onClick={() => {
                  fetchDashboard();
                  fetchUsers();
                }}
              >
                Refresh Data
              </button>
            </div>
          </section>
        )}

        {activeTab === "users" && (
          <section className="dashboard-content admin-content">
            <div className="dashboard-section-heading">
              <div>
                <h2>{userRoleFilter === "all" ? "All Users" : `${roleFilters.find((filter) => filter.id === userRoleFilter)?.label || "Users"}`}</h2>
                <p>Browse registered accounts by account type.</p>
              </div>

              <button
                className="dashboard-secondary-button"
                onClick={fetchUsers}
                disabled={usersLoading}
              >
                {usersLoading ? "Loading..." : "Refresh"}
              </button>
            </div>

            <div className="admin-role-filters" role="tablist" aria-label="Filter users by account type">
              {roleFilters.map((filter) => {
                const count = filter.id === "all" ? users.length : users.filter((item) => item.role === filter.id).length;
                return <button key={filter.id} type="button" role="tab" aria-selected={userRoleFilter === filter.id} className={userRoleFilter === filter.id ? "active" : ""} onClick={() => setUserRoleFilter(filter.id)}>{filter.label}<span>{count}</span></button>;
              })}
            </div>

            <input
              className="dashboard-search"
              type="search"
              placeholder="Search by name, email, phone or role..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            {usersLoading ? (
              <p>Loading users...</p>
            ) : (
              <div className="dashboard-table-wrapper">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {roleFilteredUsers.map((item) => (
                      <tr key={item._id}>
                        <td>{item.name || "—"}</td>
                        <td>{item.email || "—"}</td>
                        <td><span className={`admin-user-role role-${item.role || "unknown"}`}>{item.role || "—"}</span></td>
                        <td>
                          <span className={`admin-user-status ${item.isActive === false ? "is-inactive" : "is-active"}`}>{item.isActive === undefined
                            ? item.status || "—"
                            : item.isActive
                            ? "Active"
                            : "Inactive"}</span>
                        </td>
                        <td>
                          {item._id === user?._id ? (
                            <span>Current account</span>
                          ) : user?.role !== "admin" ? (
                            <span className="admin-protected-label">Super Admin only</span>
                          ) : (
                            <div className="admin-user-actions">
                              {item.role === "co-admin" && <button className="admin-edit-permissions-button" onClick={() => openPermissionEditor(item)}>Edit permissions</button>}
                              <button className="dashboard-danger-button" onClick={() => handleDeleteUser(item)}>Delete</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}

                    {roleFilteredUsers.length === 0 && (
                      <tr>
                        <td colSpan="5">
                          No users found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {editingCoAdmin && (
              <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !savingPermissions) setEditingCoAdmin(null); }}>
                <section className="admin-permission-modal" role="dialog" aria-modal="true" aria-labelledby="permission-modal-title">
                  <div className="admin-modal-heading"><div><span className="admin-eyebrow">CO-ADMIN ACCESS</span><h3 id="permission-modal-title">Edit permissions</h3><p>{editingCoAdmin.name} · {editingCoAdmin.email}</p></div><button type="button" aria-label="Close" disabled={savingPermissions} onClick={() => setEditingCoAdmin(null)}>×</button></div>
                  <div className="admin-permission-options">
                    {[
                      ["view_users", "View users"], ["manage_users", "Manage users"],
                      ["view_suppliers", "View suppliers"], ["manage_suppliers", "Manage suppliers"],
                      ["view_listings", "View listings"], ["manage_listings", "Manage listings"],
                      ["view_orders", "View orders"], ["manage_orders", "Manage orders"],
                      ["view_reports", "View reports"],
                    ].map(([permission, label]) => <label key={permission}><input type="checkbox" checked={editedPermissions.includes(permission)} onChange={() => toggleEditedPermission(permission)} />{label}</label>)}
                  </div>
                  <div className="admin-modal-actions"><button className="dashboard-secondary-button" disabled={savingPermissions} onClick={() => setEditingCoAdmin(null)}>Cancel</button><button className="dashboard-primary-button" disabled={savingPermissions} onClick={saveCoAdminPermissions}>{savingPermissions ? "Saving..." : "Save permissions"}</button></div>
                </section>
              </div>
            )}
          </section>
        )}

        {activeTab === "create-co-admin" && user?.role === "admin" && (
          <section className="dashboard-content admin-content">
            <div className="dashboard-section-heading">
              <div><h2>Create a Co-Admin account</h2><p>Set login details and choose what this account can manage.</p></div>
            </div>
            <form className="admin-create-form" onSubmit={createCoAdmin}>
              <div className="admin-create-fields">
                <label>Full name<input required minLength="2" value={coAdminForm.name} onChange={(event) => setCoAdminForm({ ...coAdminForm, name: event.target.value })} placeholder="Co-Admin name" /></label>
                <label>Email address<input required type="email" value={coAdminForm.email} onChange={(event) => setCoAdminForm({ ...coAdminForm, email: event.target.value })} placeholder="name@example.com" /></label>
                <label>Password<input required type="password" minLength="8" autoComplete="new-password" value={coAdminForm.password} onChange={(event) => setCoAdminForm({ ...coAdminForm, password: event.target.value })} placeholder="At least 8 characters" /></label>
              </div>
              <fieldset className="admin-permissions-fieldset">
                <legend>Permissions</legend>
                <p>Choose what this Co-Admin can access. User view is enabled by default.</p>
                <div className="admin-permission-options">
                  {[
                    ["view_users", "View users"], ["manage_users", "Manage users"],
                    ["view_suppliers", "View suppliers"], ["manage_suppliers", "Manage suppliers"],
                    ["view_listings", "View listings"], ["manage_listings", "Manage listings"],
                    ["view_orders", "View orders"], ["manage_orders", "Manage orders"],
                    ["view_reports", "View reports"],
                  ].map(([permission, label]) => <label key={permission}><input type="checkbox" checked={coAdminForm.permissions.includes(permission)} onChange={() => toggleCoAdminPermission(permission)} />{label}</label>)}
                </div>
              </fieldset>
              <button className="dashboard-primary-button admin-create-submit" type="submit" disabled={creatingCoAdmin}>{creatingCoAdmin ? "Creating account..." : "Create Co-Admin"}</button>
            </form>
          </section>
        )}

        {activeTab === "site-logo" && user?.role === "admin" && (
          <section className="dashboard-content admin-content">
            <div className="dashboard-section-heading"><div><h2>Site logo</h2><p>Upload a logo for the public site and dashboards.</p></div></div>
            <div className="admin-logo-settings">
              <div className="admin-logo-preview" aria-label="Current site logo preview">
                {logoData ? <img src={logoData} alt="Current SourceBD logo" /> : <span className="brand-icon">S</span>}
              </div>
              <div className="admin-logo-controls">
                <label className="admin-logo-upload">{logoSaving ? "Saving logo..." : "Choose logo image"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={logoSaving} onChange={uploadSiteLogo} /></label>
                <p>PNG, JPG, or WebP · Maximum 1.5 MB. The logo appears across the public site and dashboards.</p>
                {logoData && <button className="dashboard-secondary-button" disabled={logoSaving} onClick={restoreDefaultLogo}>Restore default logo</button>}
              </div>
            </div>
          </section>
        )}

        {activeTab === "profile" && (
          <section className="dashboard-content admin-content">
            <h2>My Account</h2>

            <div className="dashboard-panel">
              <p>
                <strong>Name:</strong> {user?.name || "—"}
              </p>
              <p>
                <strong>Email:</strong> {user?.email || "—"}
              </p>
              <p>
                <strong>Role:</strong> {user?.role || "—"}
              </p>
            </div>
          </section>
        )}

        {activeTab === "verification" && <section className="dashboard-content"><h2>Pending Supplier Verification</h2>{verificationQueue.length ? verificationQueue.map((supplier) => <article className="dashboard-panel" key={supplier._id}><h3>{supplier.businessName} · {supplier.name}</h3><p>{supplier.businessType}</p><p>{supplier.businessDescription}</p><p>{supplier.address}, {supplier.city}</p><p>{supplier.email} · {supplier.phone || "No phone"}</p><button className="dashboard-primary-button" onClick={() => reviewSupplier(supplier, "verified")}>Verify Supplier</button> <button className="dashboard-danger-button" onClick={() => reviewSupplier(supplier, "rejected")}>Reject</button></article>) : <p className="dashboard-empty">No supplier requests pending.</p>}</section>}

        {activeTab === "reviews" && <section className="dashboard-content"><h2>Pending Reviews</h2>{reviewQueue.length ? reviewQueue.map((review) => <article className="dashboard-panel" key={review._id}><h3>{review.product?.name || "Product"} · {review.rating}/5</h3><p><strong>Buyer:</strong> {review.buyer?.name || review.buyer?.email || "—"}</p><p><strong>Supplier:</strong> {review.supplier?.name || "—"}</p><p>{review.comment || "No written comment."}</p><button className="dashboard-primary-button" onClick={() => moderateReview(review, "approved")}>Approve</button> <button className="dashboard-danger-button" onClick={() => moderateReview(review, "rejected")}>Reject</button></article>) : <p className="dashboard-empty">No reviews waiting for moderation.</p>}</section>}

        {activeTab === "categories" && <section className="dashboard-content"><div className="dashboard-section-heading"><div><h2>Product Categories</h2><p>Changes apply to category filters and future listings.</p></div><button className="dashboard-primary-button" onClick={addCategory}>Add Category</button></div>{categories.map((category) => <div className="dashboard-panel" key={category._id || category.name}><strong>{category.name}</strong>{category.isDefault ? <span> · Built in</span> : <button className="dashboard-danger-button" onClick={() => archiveCategory(category)}>Archive</button>}</div>)}</section>}
      </main>
    </div>
  );
}

export default AdminDashboard;
