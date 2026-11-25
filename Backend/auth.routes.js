
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");

const router = express.Router();
const User = require("./user.model");
const authMiddleware = require("./auth.middleware");
const adminMiddleware = require("./admin.middleware");
const requirePermission = adminMiddleware.requirePermission;
const VerificationCode = require("./verification-code.model");
const sendVerificationCode = require("./verification-delivery");

const normalizePhone = (value) => {
  let phone = String(value || "").trim().replace(/[\s()-]/g, "");
  if (/^01[3-9]\d{8}$/.test(phone)) phone = `+880${phone.slice(1)}`;
  else if (/^8801[3-9]\d{8}$/.test(phone)) phone = `+${phone}`;
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
};
const normalizeBangladeshPhone = (value) => {
  let phone = String(value || "").trim().replace(/[\s()-]/g, "");
  if (/^01[3-9]\d{8}$/.test(phone)) return `+880${phone.slice(1)}`;
  if (/^\+?8801[3-9]\d{8}$/.test(phone)) return phone.startsWith("+") ? phone : `+${phone}`;
  return null;
};

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const hashVerificationCode = (channel, destination, code) => crypto
  .createHmac("sha256", process.env.OTP_SECRET || process.env.JWT_SECRET || "")
  .update(`${channel}:${destination}:${code}`)
  .digest("hex");
const maskDestination = (channel, destination) => channel === "email"
  ? `${destination.split("@")[0].slice(0, 1)}***@${destination.split("@").slice(1).join("@")}`
  : `${destination.slice(0, -4).replace(/\d/g, "*")}${destination.slice(-4)}`;

const verificationRequestsByIp = new Map();
function limitVerificationRequests(req, res, next) {
  const now = Date.now();
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const windowMs = 15 * 60_000;
  const current = verificationRequestsByIp.get(ip);
  if (!current || now - current.startedAt >= windowMs) {
    verificationRequestsByIp.set(ip, { startedAt: now, count: 1 });
    return next();
  }
  if (current.count >= 10) {
    return res.status(429).json({ message: "Too many verification requests. Try again in a few minutes." });
  }
  current.count += 1;
  return next();
}

const ALLOWED_PERMISSIONS = [
  "view_users",
  "manage_users",
  "view_suppliers",
  "manage_suppliers",
  "view_listings",
  "manage_listings",
  "view_orders",
  "manage_orders",
  "view_reports",
];

// Send a one-time verification code before creating a public account.
router.post("/register/send-code", limitVerificationRequests, async (req, res) => {
  try {
    const { name, email, phone, password, role, verificationMethod } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizeBangladeshPhone(phone);

    if (!name?.trim() || !isValidEmail(normalizedEmail) || !normalizedPhone || typeof password !== "string" || !password) {
      return res.status(400).json({
        message: "Name, valid email, phone number and password are required.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters long.",
      });
    }

    if (role && !["buyer", "supplier"].includes(role)) {
      return res.status(403).json({
        message: "Public registration cannot create admin accounts.",
      });
    }

    if (verificationMethod !== "email") {
      return res.status(400).json({ message: "Account verification is available by email only." });
    }

    const existingUser = await User.findOne({ $or: [{ email: normalizedEmail }, { phone: normalizedPhone }] }).select("email phone");

    if (existingUser) {
      return res.status(409).json({
        message: existingUser.email === normalizedEmail ? "Email already registered." : "Phone number already registered.",
      });
    }

    if (!process.env.JWT_SECRET && !process.env.OTP_SECRET) {
      return res.status(500).json({ message: "Server verification secret is not configured." });
    }

    const destination = normalizedEmail;
    const existingCode = await VerificationCode.findOne({ channel: verificationMethod, destination });
    const now = new Date();
    if (existingCode && now.getTime() - existingCode.sentAt.getTime() < 60_000) {
      const retryAfterSeconds = Math.ceil((60_000 - (now.getTime() - existingCode.sentAt.getTime())) / 1000);
      return res.status(429).json({ message: `Wait ${retryAfterSeconds} seconds before requesting another code.`, retryAfterSeconds });
    }

    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
    const codeHash = hashVerificationCode(verificationMethod, destination, code);
    const challenge = await VerificationCode.findOneAndUpdate(
      { channel: verificationMethod, destination },
      { $set: { codeHash, attempts: 0, sentAt: now, expiresAt: new Date(now.getTime() + 10 * 60_000) } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );

    try {
      await sendVerificationCode(verificationMethod, destination, code);
    } catch (deliveryError) {
      await VerificationCode.deleteOne({ _id: challenge._id, codeHash });
      return res.status(deliveryError.status || 502).json({ message: deliveryError.message || "Could not send verification code." });
    }

    return res.status(200).json({
      message: `Verification code sent to ${maskDestination(verificationMethod, destination)}.`,
      verificationMethod,
      maskedDestination: maskDestination(verificationMethod, destination),
    });
  } catch (error) {
    console.error("Verification code request error:", error.message);
    return res.status(500).json({ message: "Could not send verification code." });
  }
});

// Public registration requires a valid one-time code for the selected contact method.
router.post("/register", async (req, res) => {
  try {
    const { name, email, phone, password, role, verificationMethod, verificationCode } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizeBangladeshPhone(phone);

    if (!name?.trim() || !isValidEmail(normalizedEmail) || !normalizedPhone || typeof password !== "string" || !password) {
      return res.status(400).json({ message: "Name, valid email, phone number and password are required." });
    }
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters long." });
    if (role && !["buyer", "supplier"].includes(role)) return res.status(403).json({ message: "Public registration cannot create admin accounts." });
    if (verificationMethod !== "email" || !/^\d{6}$/.test(String(verificationCode || ""))) {
      return res.status(400).json({ message: "Enter the six-digit verification code." });
    }

    const destination = normalizedEmail;
    const challenge = await VerificationCode.findOne({ channel: verificationMethod, destination, expiresAt: { $gt: new Date() } });
    if (!challenge) return res.status(400).json({ message: "Verification code is missing or expired. Request a new code." });
    if (challenge.attempts >= 5) return res.status(429).json({ message: "Too many incorrect codes. Request a new code." });

    const submittedHash = hashVerificationCode(verificationMethod, destination, String(verificationCode));
    const isCodeValid = crypto.timingSafeEqual(Buffer.from(challenge.codeHash, "hex"), Buffer.from(submittedHash, "hex"));
    if (!isCodeValid) {
      await VerificationCode.updateOne({ _id: challenge._id, attempts: { $lt: 5 } }, { $inc: { attempts: 1 } });
      return res.status(400).json({ message: "Incorrect verification code." });
    }

    const consumedChallenge = await VerificationCode.findOneAndDelete({ _id: challenge._id, codeHash: submittedHash, attempts: { $lt: 5 }, expiresAt: { $gt: new Date() } });
    if (!consumedChallenge) return res.status(400).json({ message: "Verification code was already used or expired. Request a new code." });

    const existingUser = await User.findOne({ $or: [{ email: normalizedEmail }, { phone: normalizedPhone }] }).select("email phone");
    if (existingUser) return res.status(409).json({ message: existingUser.email === normalizedEmail ? "Email already registered." : "Phone number already registered." });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(), email: normalizedEmail, phone: normalizedPhone,
      password: hashedPassword, role: role || "buyer",
      isEmailVerified: verificationMethod === "email",
      isPhoneVerified: false,
    });

    return res.status(201).json({
      message: "User registered and contact verified successfully.",
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role },
    });
  } catch (error) {
    console.error("Registration error:", error.message);
    if (error.code === 11000) return res.status(409).json({ message: "Email or phone number already registered." });
    return res.status(500).json({ message: "Registration failed." });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { identifier, email, phone, password } = req.body;
    const loginIdentifier = String(identifier || email || phone || "").trim();

    if (!loginIdentifier || !password) {
      return res.status(400).json({
        message: "Email or phone number and password are required.",
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing.");
      return res.status(500).json({
        message: "Server configuration error.",
      });
    }

    const isEmailLogin = loginIdentifier.includes("@");
    const normalizedIdentifier = isEmailLogin ? normalizeEmail(loginIdentifier) : normalizePhone(loginIdentifier);
    if (!normalizedIdentifier) return res.status(400).json({ message: "Enter a valid email address or phone number." });

    const user = await User.findOne(isEmailLogin
      ? { email: normalizedIdentifier }
      : { phone: normalizedIdentifier, isPhoneVerified: true }).select("+password");

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: "Your account has been deactivated.",
      });
    }

    if (user.deletedAt) {
      return res.status(403).json({ message: "This account was deleted and is in Trash. Contact an administrator to restore it." });
    }

    const token = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    return res.status(200).json({
      message: "Login successful.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions || [],
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      message: "Login failed.",
    });
  }
});

// Current user's profile
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    return res.status(200).json({
      message: "Profile retrieved successfully.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions || [],
        phone: user.phone,
        isVerified: user.isVerified,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Profile error:", error.message);

    return res.status(500).json({
      message: "Failed to retrieve profile.",
    });
  }
});

// Admin dashboard
router.get(
  "/admin/dashboard",
  authMiddleware,
  adminMiddleware,
  (req, res) => {
    return res.status(200).json({
      message: "Welcome to SourceBD Admin Dashboard.",
      admin: {
        userId: req.user.userId,
        role: req.user.role,
        permissions: req.user.permissions,
      },
    });
  }
);

// Create Co-Admin: Super Admin only
router.post(
  "/admin/co-admins",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        message: "Only the Super Admin can create Co-Admins.",
      });
    }

    try {
      const { name, email, password, permissions = [] } = req.body;

      if (!name?.trim() || !email?.trim() || !password) {
        return res.status(400).json({
          message: "Name, email and password are required.",
        });
      }

      if (!isValidEmail(email.trim())) {
        return res.status(400).json({
          message: "Enter a valid email address.",
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          message: "Password must be at least 8 characters long.",
        });
      }

      if (!Array.isArray(permissions)) {
        return res.status(400).json({
          message: "Permissions must be an array.",
        });
      }

      const invalidPermissions = permissions.filter(
        (permission) => !ALLOWED_PERMISSIONS.includes(permission)
      );

      if (invalidPermissions.length > 0) {
        return res.status(400).json({
          message: "One or more permissions are invalid.",
          invalidPermissions,
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      if (await User.findOne({ email: normalizedEmail })) {
        return res.status(409).json({
          message: "Email already registered.",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const coAdmin = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role: "co-admin",
        permissions: [...new Set(permissions)],
        isActive: true,
      });

      return res.status(201).json({
        message: "Co-Admin created successfully.",
        coAdmin: {
          id: coAdmin._id,
          name: coAdmin.name,
          email: coAdmin.email,
          role: coAdmin.role,
          permissions: coAdmin.permissions,
        },
      });
    } catch (error) {
      console.error("Co-Admin creation error:", error.message);

      if (error.code === 11000) {
        return res.status(409).json({
          message: "Email already registered.",
        });
      }

      return res.status(500).json({
        message: "Failed to create Co-Admin.",
      });
    }
  }
);

// List Co-Admins: Super Admin only
router.get(
  "/admin/co-admins",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        message: "Only the Super Admin can view Co-Admins.",
      });
    }

    try {
      const coAdmins = await User.find({ role: "co-admin", deletedAt: null })
        .select("-password")
        .sort({ createdAt: -1 });

      return res.status(200).json({
        total: coAdmins.length,
        coAdmins,
      });
    } catch (error) {
      console.error("Co-Admin list error:", error.message);

      return res.status(500).json({
        message: "Failed to retrieve Co-Admins.",
      });
    }
  }
);

// Update Co-Admin permissions: Super Admin only
router.patch(
  "/admin/co-admins/:id/permissions",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        message: "Only the Super Admin can change permissions.",
      });
    }

    try {
      const { id } = req.params;
      const { permissions } = req.body;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          message: "Invalid Co-Admin ID.",
        });
      }

      if (!Array.isArray(permissions)) {
        return res.status(400).json({
          message: "Permissions must be an array.",
        });
      }

      const invalidPermissions = permissions.filter(
        (permission) => !ALLOWED_PERMISSIONS.includes(permission)
      );

      if (invalidPermissions.length > 0) {
        return res.status(400).json({
          message: "One or more permissions are invalid.",
          invalidPermissions,
        });
      }

      const coAdmin = await User.findOneAndUpdate(
        { _id: id, role: "co-admin" },
        { $set: { permissions: [...new Set(permissions)] } },
        { new: true, runValidators: true }
      ).select("-password");

      if (!coAdmin) {
        return res.status(404).json({
          message: "Co-Admin not found.",
        });
      }

      return res.status(200).json({
        message: "Co-Admin permissions updated successfully.",
        coAdmin,
      });
    } catch (error) {
      console.error("Permission update error:", error.message);

      return res.status(500).json({
        message: "Failed to update permissions.",
      });
    }
  }
);

// List users
router.get(
  "/admin/users",
  authMiddleware,
  adminMiddleware,
  requirePermission("view_users"),
  async (req, res) => {
    try {
      let filter = { deletedAt: null };

      // Co-Admin can only see buyers and suppliers
      if (req.user.role === "co-admin") {
        filter = {
          deletedAt: null,
          role: { $in: ["buyer", "supplier"] },
        };
      }

      const users = await User.find(filter)
        .select("-password")
        .sort({ createdAt: -1 });

      return res.status(200).json({
        message: "Users fetched successfully.",
        totalUsers: users.length,
        users,
      });
    } catch (error) {
      console.error("User list error:", error.message);

      return res.status(500).json({
        message: "Failed to fetch users.",
      });
    }
  }
);

// List soft-deleted accounts for the Trash view.
router.get(
  "/admin/users/trash",
  authMiddleware,
  adminMiddleware,
  requirePermission("view_users"),
  async (req, res) => {
    try {
      const filter = { deletedAt: { $ne: null } };
      if (req.user.role === "co-admin") filter.role = { $in: ["buyer", "supplier"] };
      const users = await User.find(filter).select("-password").sort({ deletedAt: -1 });
      return res.status(200).json({ users, totalUsers: users.length });
    } catch (error) {
      console.error("Trash list error:", error.message);
      return res.status(500).json({ message: "Failed to fetch Trash." });
    }
  }
);

// Full account details are restricted to the Super Admin and permitted Co-Admins.
router.get(
  "/admin/users/:id",
  authMiddleware,
  adminMiddleware,
  requirePermission("view_users"),
  async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid user ID." });
      const target = await User.findById(id).select("+tradeLicenseDocument +governmentIdDocument +buyerBusinessDocument -password");
      if (!target) return res.status(404).json({ message: "User not found." });
      if (req.user.role === "co-admin" && !["buyer", "supplier"].includes(target.role)) {
        return res.status(403).json({ message: "Co-Admins can only view buyer and supplier details." });
      }
      return res.status(200).json({ user: target });
    } catch (error) {
      console.error("User details error:", error.message);
      return res.status(500).json({ message: "Failed to fetch user details." });
    }
  }
);

// Suspend or reactivate an account. Co-Admins can manage buyers and suppliers only.
router.patch(
  "/admin/users/:id/status",
  authMiddleware,
  adminMiddleware,
  requirePermission("manage_users"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid user ID." });
      if (typeof isActive !== "boolean") return res.status(400).json({ message: "isActive must be true or false." });
      if (id === req.user.userId) return res.status(400).json({ message: "You cannot change your own account status." });
      const target = await User.findById(id);
      if (!target) return res.status(404).json({ message: "User not found." });
      if (target.deletedAt) return res.status(409).json({ message: "Restore this account from Trash before changing its status." });
      if (req.user.role === "co-admin" && !["buyer", "supplier"].includes(target.role)) {
        return res.status(403).json({ message: "Co-Admins can only suspend or reactivate buyers and suppliers." });
      }
      target.isActive = isActive;
      await target.save();
      return res.status(200).json({ message: isActive ? "Account reactivated." : "Account suspended.", user: { _id: target._id, isActive: target.isActive } });
    } catch (error) {
      console.error("Account status update error:", error.message);
      return res.status(500).json({ message: "Failed to update account status." });
    }
  }
);

// Move an account to Trash without permanently deleting its data.
router.patch(
  "/admin/users/:id/trash",
  authMiddleware,
  adminMiddleware,
  requirePermission("manage_users"),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          message: "Invalid user ID.",
        });
      }

      if (id === req.user.userId) {
        return res.status(400).json({
          message: "You cannot delete your own account.",
        });
      }

      const targetUser = await User.findById(id);

      if (!targetUser) {
        return res.status(404).json({
          message: "User not found.",
        });
      }

      if (req.user.role === "co-admin" && !["buyer", "supplier"].includes(targetUser.role)) {
        return res.status(403).json({ message: "Co-Admins can only delete buyer and supplier accounts." });
      }

      if (targetUser.deletedAt) return res.status(409).json({ message: "This account is already in Trash." });

      targetUser.isActive = false;
      targetUser.deletedAt = new Date();
      targetUser.deletedBy = req.user.userId;
      await targetUser.save();

      return res.status(200).json({
        message: "Account moved to Trash. Restore it any time before permanent deletion.",
        deletedUser: {
          id: targetUser._id,
          name: targetUser.name,
          email: targetUser.email,
          role: targetUser.role,
          deletedAt: targetUser.deletedAt,
        },
      });
    } catch (error) {
      console.error("User deletion error:", error.message);

      return res.status(500).json({
        message: "Failed to delete user.",
      });
    }
  }
);

// Restore an account from Trash and make it usable again.
router.patch(
  "/admin/users/:id/restore",
  authMiddleware,
  adminMiddleware,
  requirePermission("manage_users"),
  async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid user ID." });
      const target = await User.findById(id);
      if (!target || !target.deletedAt) return res.status(404).json({ message: "Deleted account not found in Trash." });
      if (req.user.role === "co-admin" && !["buyer", "supplier"].includes(target.role)) {
        return res.status(403).json({ message: "Co-Admins can only restore buyer and supplier accounts." });
      }
      target.deletedAt = null;
      target.deletedBy = null;
      target.isActive = true;
      await target.save();
      return res.status(200).json({ message: "Account restored and ready to use again.", user: { _id: target._id, isActive: true, deletedAt: null } });
    } catch (error) {
      console.error("Account restore error:", error.message);
      return res.status(500).json({ message: "Failed to restore account." });
    }
  }
);

// Irreversible deletion is restricted to the Super Admin and to accounts already in Trash.
router.delete(
  "/admin/users/:id/permanent",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      if (req.user.role !== "admin") return res.status(403).json({ message: "Only the Super Admin can permanently delete accounts." });
      const { id } = req.params;
      if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid user ID." });
      if (id === req.user.userId) return res.status(400).json({ message: "You cannot permanently delete your own account." });
      const target = await User.findById(id);
      if (!target || !target.deletedAt) return res.status(404).json({ message: "Move this account to Trash before permanent deletion." });
      await User.findByIdAndDelete(id);
      return res.status(200).json({ message: "Account permanently deleted." });
    } catch (error) {
      console.error("Permanent account deletion error:", error.message);
      return res.status(500).json({ message: "Failed to permanently delete account." });
    }
  }
);

// Super Admin can update their own login ID (email) and password, after confirming the current password.
router.patch("/admin/account/credentials", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Only the Super Admin can change these credentials." });
    const { currentPassword, newEmail, newPassword } = req.body;
    if (typeof currentPassword !== "string" || !currentPassword || typeof newEmail !== "string" || !newEmail.trim() || typeof newPassword !== "string" || !newPassword) {
      return res.status(400).json({ message: "Current password, new login email, and new password are required." });
    }
    const normalizedEmail = normalizeEmail(newEmail);
    if (!isValidEmail(normalizedEmail)) return res.status(400).json({ message: "Enter a valid email address." });
    if (newPassword.length < 8) return res.status(400).json({ message: "New password must be at least 8 characters long." });

    const admin = await User.findById(req.user.userId).select("+password email");
    if (!admin || !(await bcrypt.compare(currentPassword, admin.password))) {
      return res.status(403).json({ message: "Current password is incorrect." });
    }
    const emailOwner = await User.findOne({ email: normalizedEmail }).select("_id");
    if (emailOwner && emailOwner._id.toString() !== admin._id.toString()) {
      return res.status(409).json({ message: "That email address is already in use." });
    }

    admin.email = normalizedEmail;
    admin.password = await bcrypt.hash(newPassword, 10);
    await admin.save();
    return res.status(200).json({ message: "Super Admin login email and password updated.", user: { _id: admin._id, email: admin.email } });
  } catch (error) {
    console.error("Super Admin credential update error:", error.message);
    return res.status(500).json({ message: "Failed to update Super Admin credentials." });
  }
});

module.exports = router;
