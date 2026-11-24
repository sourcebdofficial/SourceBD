
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },

    role: {
      type: String,
      enum: ["buyer", "supplier", "admin", "co-admin"],
      default: "buyer",
      required: true,
    },

    // Co-Admin-এর নির্দিষ্ট permissions
    permissions: {
      type: [String],
      default: [],
      enum: [
        "view_users",
        "manage_users",
        "view_suppliers",
        "manage_suppliers",
        "view_listings",
        "manage_listings",
        "view_orders",
        "manage_orders",
        "view_reports",
      ],
    },

    phone: {
      type: String,
      trim: true,
      default: "",
    },

    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },

    businessName: { type: String, trim: true, default: "" },
    businessType: { type: String, trim: true, default: "" },
    businessDescription: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    verificationStatus: {
      type: String,
      enum: ["not_submitted", "pending", "verified", "rejected"],
      default: "not_submitted",
    },
    verificationNote: { type: String, trim: true, default: "" },

    isVerified: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);
