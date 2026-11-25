
import { useEffect, useState } from "react";
import "./Dashboard.css";

const API_BASE = "http://localhost:5000/api";
const readApiResponse = async (response) => {
  const body = await response.text();
  try {
    return body ? JSON.parse(body) : {};
  } catch {
    const preview = body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 140);
    throw new Error(`Backend returned a non-JSON response (HTTP ${response.status}). Restart the Backend server and try again.${preview ? ` Response: ${preview}` : ""}`);
  }
};

function AdminDashboard({ user, onLogout, logoData, onLogoChange }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [users, setUsers] = useState([]);
  const [trashedUsers, setTrashedUsers] = useState([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [coAdminForm, setCoAdminForm] = useState({ name: "", email: "", password: "", permissions: ["view_users"] });
  const [creatingCoAdmin, setCreatingCoAdmin] = useState(false);
  const [editingCoAdmin, setEditingCoAdmin] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [userActionId, setUserActionId] = useState("");
  const [credentialsModal, setCredentialsModal] = useState(false);
  const [credentialsForm, setCredentialsForm] = useState({ currentPassword: "", newEmail: user?.email || "", newPassword: "", confirmPassword: "" });
  const [credentialsSaving, setCredentialsSaving] = useState(false);
  const [editedPermissions, setEditedPermissions] = useState([]);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [logoSaving, setLogoSaving] = useState(false);
  const [verificationQueue, setVerificationQueue] = useState([]);
  const [buyerVerificationQueue, setBuyerVerificationQueue] = useState([]);
  const [reviewQueue, setReviewQueue] = useState([]);
  const [categories, setCategories] = useState([]);
  const currentUserId = user?._id || user?.id;

  const token = localStorage.getItem("token");

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const ensureCurrentBackend = async () => {
    let health;
    try {
      const response = await fetch(`${API_BASE}/health`);
      health = await readApiResponse(response);
    } catch {
      throw new Error("The server on port 5000 is an older or different backend. Stop it, then run npm start from this project's Backend folder.");
    }
    if (!health?.userStatusRouteLoaded || !health?.userTrashRoutesLoaded) {
      throw new Error("The server on port 5000 has not loaded the latest user-management routes. Stop it, then run npm start from this project's Backend folder.");
    }
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

      const data = await readApiResponse(response);

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

  const fetchTrash = async () => {
    setTrashLoading(true);
    setMessage("");
    try {
      const response = await fetch(`${API_BASE}/auth/admin/users/trash`, { headers: authHeaders });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(getErrorMessage(data, "Could not load Trash."));
      setTrashedUsers(data.users || []);
    } catch (error) {
      setMessage(error.message || "Could not load Trash.");
    } finally {
      setTrashLoading(false);
    }
  };

  const fetchSourcingQueues = async () => {
    try {
      const [verificationResponse, reviewResponse, categoryResponse, buyerVerificationResponse] = await Promise.all([
        fetch(`${API_BASE}/sourcing/admin/verification`, { headers: authHeaders }),
        fetch(`${API_BASE}/sourcing/admin/reviews`, { headers: authHeaders }),
        fetch(`${API_BASE}/sourcing/categories`),
        fetch(`${API_BASE}/sourcing/admin/buyer-verification`, { headers: authHeaders }),
      ]);
      const [verificationData, reviewData, categoryData, buyerVerificationData] = await Promise.all([
        verificationResponse.ok ? verificationResponse.json() : Promise.resolve({}),
        reviewResponse.ok ? reviewResponse.json() : Promise.resolve({}),
        categoryResponse.ok ? categoryResponse.json() : Promise.resolve({}),
        buyerVerificationResponse.ok ? buyerVerificationResponse.json() : Promise.resolve({}),
      ]);
      if (verificationResponse.ok) setVerificationQueue(verificationData.suppliers || []);
      if (buyerVerificationResponse.ok) setBuyerVerificationQueue(buyerVerificationData.buyers || []);
      if (reviewResponse.ok) setReviewQueue(reviewData.reviews || []);
      if (categoryResponse.ok) setCategories(categoryData.categories || []);
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

  const reviewBuyer = async (buyer, decision) => {
    const note = decision === "rejected" ? (window.prompt("Reason for rejection (optional):") || "") : "";
    try {
      const response = await fetch(`${API_BASE}/sourcing/admin/buyer-verification/${buyer._id}`, { method: "PATCH", headers: authHeaders, body: JSON.stringify({ decision, note }) });
      const data = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(data, "Could not update buyer verification."));
      setMessage(`Buyer ${decision}.`);
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

    if (selectedUser._id === currentUserId) {
      setMessage("You cannot delete your own account here.");
      return;
    }

    const confirmed = window.confirm(
      `Move ${
        selectedUser.name || selectedUser.email
      } to Trash? They will be unable to sign in until you restore the account.`
    );

    if (!confirmed) return;

    try {
      setMessage("");

      const response = await fetch(
        `${API_BASE}/auth/admin/users/${selectedUser._id}/trash`,
        {
          method: "PATCH",
          headers: authHeaders,
        }
      );

      const data = await readApiResponse(response);

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

      setMessage(data.message || "Account moved to Trash.");
      fetchTrash();
      fetchDashboard();
    } catch (error) {
      setMessage(error.message || "Could not delete user.");
    }
  };

  const restoreUser = async (selectedUser) => {
    if (!window.confirm(`Restore ${selectedUser.name || selectedUser.email}? They will be able to use the account again.`)) return;
    setUserActionId(selectedUser._id);
    setMessage("");
    try {
      const response = await fetch(`${API_BASE}/auth/admin/users/${selectedUser._id}/restore`, { method: "PATCH", headers: authHeaders });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(getErrorMessage(data, "Could not restore this account."));
      setTrashedUsers((current) => current.filter((item) => item._id !== selectedUser._id));
      setMessage(data.message || "Account restored and ready to use again.");
      fetchUsers();
      fetchDashboard();
    } catch (error) {
      setMessage(error.message || "Could not restore this account.");
    } finally {
      setUserActionId("");
    }
  };

  const permanentlyDeleteUser = async (selectedUser) => {
    if (user?.role !== "admin") return;
    const confirmation = window.prompt(`Permanently delete ${selectedUser.name || selectedUser.email}? This cannot be undone. Type DELETE to continue.`);
    if (confirmation !== "DELETE") return;
    setUserActionId(selectedUser._id);
    setMessage("");
    try {
      const response = await fetch(`${API_BASE}/auth/admin/users/${selectedUser._id}/permanent`, { method: "DELETE", headers: authHeaders });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(getErrorMessage(data, "Could not permanently delete this account."));
      setTrashedUsers((current) => current.filter((item) => item._id !== selectedUser._id));
      setMessage(data.message || "Account permanently deleted.");
      fetchDashboard();
    } catch (error) {
      setMessage(error.message || "Could not permanently delete this account.");
    } finally {
      setUserActionId("");
    }
  };

  const openUserDetails = async (selectedUser) => {
    setUserDetails({ loading: true, name: selectedUser.name, email: selectedUser.email });
    setDetailsLoading(true);
    try {
      await ensureCurrentBackend();
      const response = await fetch(`${API_BASE}/auth/admin/users/${selectedUser._id}`, { headers: authHeaders });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(getErrorMessage(data, "Could not load user details."));
      setUserDetails(data.user);
    } catch (error) {
      setUserDetails({ error: error.message || "Could not load user details." });
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleUserStatus = async (selectedUser) => {
    const nextActive = selectedUser.isActive === false;
    const verb = nextActive ? "reactivate" : "suspend";
    if (!window.confirm(`Are you sure you want to ${verb} ${selectedUser.name || selectedUser.email}?`)) return;
    setUserActionId(selectedUser._id);
    setMessage("");
    try {
      await ensureCurrentBackend();
      const response = await fetch(`${API_BASE}/auth/admin/users/${selectedUser._id}/status`, {
        method: "PATCH", headers: authHeaders, body: JSON.stringify({ isActive: nextActive }),
      });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(getErrorMessage(data, `Could not ${verb} this account.`));
      setUsers((current) => current.map((item) => item._id === selectedUser._id ? { ...item, isActive: nextActive } : item));
      setUserDetails((current) => current?._id === selectedUser._id ? { ...current, isActive: nextActive } : current);
      setMessage(data.message || `Account ${nextActive ? "reactivated" : "suspended"}.`);
    } catch (error) {
      setMessage(error.message || `Could not ${verb} this account.`);
    } finally {
      setUserActionId("");
    }
  };

  const saveOwnCredentials = async (event) => {
    event.preventDefault();
    setMessage("");
    if (credentialsForm.newPassword !== credentialsForm.confirmPassword) {
      setMessage("New password and confirmation do not match.");
      return;
    }
    setCredentialsSaving(true);
    try {
      const response = await fetch(`${API_BASE}/auth/admin/account/credentials`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ currentPassword: credentialsForm.currentPassword, newEmail: credentialsForm.newEmail, newPassword: credentialsForm.newPassword }),
      });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(getErrorMessage(data, "Could not update login credentials."));
      const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem("user", JSON.stringify({ ...storedUser, email: data.user.email }));
      setUsers((current) => current.map((item) => item._id === currentUserId ? { ...item, email: data.user.email } : item));
      setCredentialsModal(false);
      setCredentialsForm({ currentPassword: "", newEmail: data.user.email, newPassword: "", confirmPassword: "" });
      setMessage(`${data.message} Refresh the page to show the new login email everywhere.`);
    } catch (error) {
      setMessage(error.message || "Could not update login credentials.");
    } finally {
      setCredentialsSaving(false);
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
  const canReviewBuyers = user?.role === "admin" || user?.permissions?.includes("view_users");
  const canManageBuyerVerifications = user?.role === "admin" || user?.permissions?.includes("manage_users");
  const canManageUsers = user?.role === "admin" || user?.permissions?.includes("manage_users");
  const detailSections = userDetails && !userDetails.loading && !userDetails.error ? [
    ["Contact", [["Full name", userDetails.name], ["Email", userDetails.email], ["Phone", userDetails.phone], ["Email verified", userDetails.isEmailVerified ? "Yes" : "No"], ["Phone verified", userDetails.isPhoneVerified ? "Yes" : "No"]]],
    ["Business & address", [["Business name", userDetails.businessName || userDetails.organizationName], ["Business type", userDetails.businessType || userDetails.buyerType], ["Contact person", userDetails.contactPerson], ["Designation", userDetails.designation || userDetails.buyerDesignation], ["Address", [userDetails.address, userDetails.city, userDetails.postalCode, userDetails.country].filter(Boolean).join(", ")], ["Website", userDetails.website], ["Description", userDetails.businessDescription]]],
    ["Registration & verification", [["Registration type", userDetails.businessRegistrationType], ["Trade license number", userDetails.tradeLicenseNumber], ["Business registration number", userDetails.businessRegistrationNumber], ["TIN", userDetails.taxIdentificationNumber], ["VAT / BIN", userDetails.vatBinNumber], ["Government ID type", userDetails.governmentIdType], ["Government ID number", userDetails.governmentIdNumber], ["Verification status", userDetails.verificationStatus], ["Joined", userDetails.createdAt ? new Date(userDetails.createdAt).toLocaleString() : ""]]],
  ] : [];

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
          {canReviewBuyers && <button className={activeTab === "buyer-verification" ? "active" : ""} onClick={() => { setActiveTab("buyer-verification"); fetchSourcingQueues(); }}>Buyer Verification {buyerVerificationQueue.length > 0 && <span className="admin-nav-count">{buyerVerificationQueue.length}</span>}</button>}
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
          {canReviewBuyers && <button className={activeTab === "trash" ? "active" : ""} onClick={() => { setActiveTab("trash"); fetchTrash(); }}>Trash {trashedUsers.length > 0 && <span className="admin-nav-count">{trashedUsers.length}</span>}</button>}

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
            <h1>{{ overview: "Admin Overview", users: "Users Management", trash: "Deleted Accounts", "create-co-admin": "Create Co-Admin", "site-logo": "Change Site Logo", profile: "My Account", verification: "Supplier Verification", "buyer-verification": "Buyer Verification", reviews: "Review Moderation", categories: "Category Management" }[activeTab] || "Admin Panel"}</h1>

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

              <div className="admin-table-toolbar-actions">
                <button className="dashboard-secondary-button" onClick={fetchUsers} disabled={usersLoading}>{usersLoading ? "Loading..." : "Refresh"}</button>
                {canReviewBuyers && <button className="dashboard-secondary-button" onClick={() => { setActiveTab("trash"); fetchTrash(); }}>Open Trash{trashedUsers.length > 0 ? ` (${trashedUsers.length})` : ""}</button>}
              </div>
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
                          <div className="admin-user-actions">
                            <button className="admin-details-button" type="button" onClick={() => openUserDetails(item)}>Details</button>
                            {item._id === currentUserId ? (user?.role === "admin" ? <button className="admin-edit-permissions-button" type="button" onClick={() => { setCredentialsForm({ currentPassword: "", newEmail: item.email || user.email || "", newPassword: "", confirmPassword: "" }); setCredentialsModal(true); }}>Change login ID &amp; password</button> : <span className="admin-protected-label">Current account</span>) : canManageUsers && (
                              <>
                                {user?.role === "admin" && item.role === "co-admin" && <button className="admin-edit-permissions-button" onClick={() => openPermissionEditor(item)}>Edit permissions</button>}
                                <button className={item.isActive === false ? "admin-reactivate-button" : "admin-suspend-button"} disabled={userActionId === item._id} onClick={() => handleUserStatus(item)}>{userActionId === item._id ? "Saving..." : item.isActive === false ? "Reactivate" : "Suspend"}</button>
                                <button className="dashboard-danger-button" disabled={userActionId === item._id} onClick={() => handleDeleteUser(item)}>Move to Trash</button>
                              </>
                            )}
                          </div>
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
            {userDetails && (
              <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !detailsLoading) setUserDetails(null); }}>
                <section className="admin-user-details-modal" role="dialog" aria-modal="true" aria-labelledby="user-details-title">
                  <div className="admin-modal-heading"><div><span className="admin-eyebrow">ACCOUNT PROFILE</span><h3 id="user-details-title">{userDetails.name || "User details"}</h3><p>{userDetails.email || ""}</p></div><button type="button" aria-label="Close" onClick={() => setUserDetails(null)}>×</button></div>
                  {detailsLoading || userDetails.loading ? <p className="admin-details-loading">Loading complete profile…</p> : userDetails.error ? <p className="admin-details-error">{userDetails.error}</p> : <>
                    <div className="admin-details-badges"><span className={`admin-user-role role-${userDetails.role}`}>{userDetails.role}</span><span className={`admin-user-status ${userDetails.isActive === false ? "is-inactive" : "is-active"}`}>{userDetails.isActive === false ? "Suspended" : "Active"}</span><span className={`admin-user-status ${userDetails.isVerified ? "is-active" : ""}`}>{userDetails.isVerified ? "Verified" : "Not verified"}</span></div>
                    <div className="admin-details-grid">
                      {detailSections.map(([title, fields]) => <section className="admin-details-group" key={title}><h4>{title}</h4>{fields.filter(([, value]) => value !== undefined && value !== null && value !== "").map(([label, value]) => <p key={label}><strong>{label}</strong><span>{value}</span></p>)}</section>)}
                    </div>
                    <div className="admin-details-documents"><h4>Submitted documents</h4>{[["Trade license", userDetails.tradeLicenseDocument], ["Business registration", userDetails.buyerBusinessDocument], ["Government ID", userDetails.governmentIdDocument]].filter(([, value]) => value).length ? [["Trade license", userDetails.tradeLicenseDocument], ["Business registration", userDetails.buyerBusinessDocument], ["Government ID", userDetails.governmentIdDocument]].filter(([, value]) => value).map(([label, value]) => <a key={label} href={value} target="_blank" rel="noreferrer">↗ View {label}</a>) : <p>No documents were submitted.</p>}</div>
                  </>}
                  <div className="admin-modal-actions"><button className="dashboard-secondary-button" onClick={() => setUserDetails(null)}>Close</button></div>
                </section>
              </div>
            )}
            {credentialsModal && (
              <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !credentialsSaving) setCredentialsModal(false); }}>
                <form className="admin-credentials-modal" onSubmit={saveOwnCredentials} role="dialog" aria-modal="true" aria-labelledby="credentials-modal-title">
                  <div className="admin-modal-heading"><div><span className="admin-eyebrow">SUPER ADMIN ACCOUNT</span><h3 id="credentials-modal-title">Change login details</h3><p>Confirm your current password before saving the new email and password.</p></div><button type="button" aria-label="Close" disabled={credentialsSaving} onClick={() => setCredentialsModal(false)}>×</button></div>
                  <label>Current password<input type="password" autoComplete="current-password" value={credentialsForm.currentPassword} onChange={(event) => setCredentialsForm((current) => ({ ...current, currentPassword: event.target.value }))} required /></label>
                  <label>New login ID (email)<input type="email" autoComplete="email" value={credentialsForm.newEmail} onChange={(event) => setCredentialsForm((current) => ({ ...current, newEmail: event.target.value }))} required /></label>
                  <label>New password<input type="password" minLength="8" autoComplete="new-password" value={credentialsForm.newPassword} onChange={(event) => setCredentialsForm((current) => ({ ...current, newPassword: event.target.value }))} required /></label>
                  <label>Confirm new password<input type="password" minLength="8" autoComplete="new-password" value={credentialsForm.confirmPassword} onChange={(event) => setCredentialsForm((current) => ({ ...current, confirmPassword: event.target.value }))} required /></label>
                  <div className="admin-modal-actions"><button className="dashboard-secondary-button" type="button" disabled={credentialsSaving} onClick={() => setCredentialsModal(false)}>Cancel</button><button className="dashboard-primary-button" type="submit" disabled={credentialsSaving}>{credentialsSaving ? "Saving…" : "Save login details"}</button></div>
                </form>
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

        {activeTab === "trash" && canReviewBuyers && (
          <section className="dashboard-content admin-content">
            <div className="dashboard-section-heading">
              <div><h2>Deleted accounts</h2><p>Accounts here cannot sign in. Restore one to make it usable again, or permanently delete it.</p></div>
              <button className="dashboard-secondary-button" onClick={fetchTrash} disabled={trashLoading}>{trashLoading ? "Loading..." : "Refresh Trash"}</button>
            </div>
            {trashLoading ? <p>Loading deleted accounts...</p> : <div className="dashboard-table-wrapper"><table className="dashboard-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Moved to Trash</th><th>Actions</th></tr></thead><tbody>
              {trashedUsers.map((item) => <tr key={item._id}><td>{item.name || "—"}</td><td>{item.email || "—"}</td><td><span className={`admin-user-role role-${item.role || "unknown"}`}>{item.role || "—"}</span></td><td>{item.deletedAt ? new Date(item.deletedAt).toLocaleString() : "—"}</td><td><div className="admin-user-actions">{canManageUsers && <button className="admin-reactivate-button" disabled={userActionId === item._id} onClick={() => restoreUser(item)}>{userActionId === item._id ? "Working..." : "Undo / Restore"}</button>}{user?.role === "admin" && <button className="dashboard-danger-button" disabled={userActionId === item._id} onClick={() => permanentlyDeleteUser(item)}>Permanent delete</button>}</div></td></tr>)}
              {trashedUsers.length === 0 && <tr><td colSpan="5" className="admin-trash-empty">Trash is empty. Deleted accounts will appear here.</td></tr>}
            </tbody></table></div>}
            {user?.role !== "admin" && <p className="admin-readonly-note">Only the Super Admin can permanently delete an account.</p>}
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

        {activeTab === "verification" && <section className="dashboard-content"><h2>Pending Supplier Verification</h2>{verificationQueue.length ? verificationQueue.map((supplier) => <article className="dashboard-panel admin-verification-card" key={supplier._id}><div className="admin-verification-heading"><div><span className="admin-eyebrow">SUPPLIER APPLICATION</span><h3>{supplier.businessName} · {supplier.name}</h3></div><span className="admin-verification-pending">Pending review</span></div><div className="admin-verification-details"><p><strong>Business type</strong>{supplier.businessType || "—"}</p><p><strong>Registration type</strong>{supplier.businessRegistrationType || "—"}</p><p><strong>Contact person</strong>{supplier.contactPerson || supplier.name || "—"}{supplier.designation && ` · ${supplier.designation}`}</p><p><strong>Email</strong>{supplier.email || "—"}</p><p><strong>Phone</strong>{supplier.phone || "—"}</p><p><strong>Trade license number</strong>{supplier.tradeLicenseNumber || "—"}</p><p><strong>TIN</strong>{supplier.taxIdentificationNumber || "Not provided"}</p><p><strong>VAT / BIN</strong>{supplier.vatBinNumber || "Not provided"}</p><p><strong>Website</strong>{supplier.website || "Not provided"}</p><p><strong>Business address</strong>{[supplier.address, supplier.city].filter(Boolean).join(", ") || "—"}</p></div><div className="admin-verification-description"><strong>Business description</strong><p>{supplier.businessDescription || "Not provided"}</p></div>{supplier.tradeLicenseDocument && <a className="admin-verification-document" href={supplier.tradeLicenseDocument} target="_blank" rel="noreferrer">↗ View submitted trade license document</a>}<div className="admin-verification-actions"><button className="dashboard-primary-button" onClick={() => reviewSupplier(supplier, "verified")}>Verify supplier</button><button className="dashboard-danger-button" onClick={() => reviewSupplier(supplier, "rejected")}>Reject application</button></div></article>) : <p className="dashboard-empty">No supplier requests pending.</p>}</section>}

        {activeTab === "buyer-verification" && canReviewBuyers && <section className="dashboard-content"><h2>Pending Buyer Verification</h2>{buyerVerificationQueue.length ? buyerVerificationQueue.map((buyer) => <article className="dashboard-panel admin-verification-card" key={buyer._id}><div className="admin-verification-heading"><div><span className="admin-eyebrow">BUYER APPLICATION</span><h3>{buyer.name} {buyer.buyerType === "business" && `· ${buyer.organizationName}`}</h3></div><span className="admin-verification-pending">Pending review</span></div><div className="admin-verification-details"><p><strong>Buyer type</strong>{buyer.buyerType === "business" ? "Business" : "Individual"}</p><p><strong>Email</strong>{buyer.email || "—"}</p><p><strong>Phone</strong>{buyer.phone || "—"}</p><p><strong>Delivery / contact address</strong>{[buyer.address, buyer.city, buyer.postalCode, buyer.country].filter(Boolean).join(", ") || "—"}</p><p><strong>ID document type</strong>{buyer.governmentIdType || "—"}</p><p><strong>ID number</strong>{buyer.governmentIdNumber || "—"}</p>{buyer.buyerType === "business" && <><p><strong>Organization</strong>{buyer.organizationName || "—"}</p><p><strong>Role</strong>{buyer.buyerDesignation || "Not provided"}</p><p><strong>Business registration</strong>{buyer.businessRegistrationNumber || "—"}</p></>}</div><div className="admin-verification-actions">{buyer.governmentIdDocument && <a className="admin-verification-document" href={buyer.governmentIdDocument} target="_blank" rel="noreferrer">↗ View identity document</a>}{buyer.buyerBusinessDocument && <a className="admin-verification-document" href={buyer.buyerBusinessDocument} target="_blank" rel="noreferrer">↗ View business license</a>}</div>{canManageBuyerVerifications ? <div className="admin-verification-actions"><button className="dashboard-primary-button" onClick={() => reviewBuyer(buyer, "verified")}>Verify buyer</button><button className="dashboard-danger-button" onClick={() => reviewBuyer(buyer, "rejected")}>Reject application</button></div> : <p className="admin-readonly-note">Your co-admin role can view this request, but does not have permission to approve or reject it.</p>}</article>) : <p className="dashboard-empty">No buyer verification requests are pending.</p>}</section>}

        {activeTab === "reviews" && <section className="dashboard-content"><h2>Pending Reviews</h2>{reviewQueue.length ? reviewQueue.map((review) => <article className="dashboard-panel" key={review._id}><h3>{review.product?.name || "Product"} · {review.rating}/5</h3><p><strong>Buyer:</strong> {review.buyer?.name || review.buyer?.email || "—"}</p><p><strong>Supplier:</strong> {review.supplier?.name || "—"}</p><p>{review.comment || "No written comment."}</p><button className="dashboard-primary-button" onClick={() => moderateReview(review, "approved")}>Approve</button> <button className="dashboard-danger-button" onClick={() => moderateReview(review, "rejected")}>Reject</button></article>) : <p className="dashboard-empty">No reviews waiting for moderation.</p>}</section>}

        {activeTab === "categories" && <section className="dashboard-content"><div className="dashboard-section-heading"><div><h2>Product Categories</h2><p>Changes apply to category filters and future listings.</p></div><button className="dashboard-primary-button" onClick={addCategory}>Add Category</button></div>{categories.map((category) => <div className="dashboard-panel" key={category._id || category.name}><strong>{category.name}</strong>{category.isDefault ? <span> · Built in</span> : <button className="dashboard-danger-button" onClick={() => archiveCategory(category)}>Archive</button>}</div>)}</section>}
      </main>
    </div>
  );
}

export default AdminDashboard;
