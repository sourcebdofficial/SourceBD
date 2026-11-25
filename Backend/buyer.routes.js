
const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const User = require("./user.model");
const authMiddleware = require("./auth.middleware");

// Middleware: Only Buyers can access these routes
function buyerMiddleware(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      message: "Authentication required.",
    });
  }

  if (req.user.role !== "buyer") {
    return res.status(403).json({
      message: "Buyer access only.",
    });
  }

  next();
}

// GET /api/buyer/profile
// Get the logged-in Buyer's profile
router.get("/profile", authMiddleware, buyerMiddleware, async (req, res) => {
  try {
    const buyer = await User.findById(req.user.userId).select("-password");

    if (!buyer) {
      return res.status(404).json({
        message: "Buyer not found.",
      });
    }

    return res.status(200).json({
      message: "Buyer profile retrieved successfully.",
      buyer: {
        id: buyer._id,
        name: buyer.name,
        email: buyer.email,
        phone: buyer.phone,
        role: buyer.role,
        isVerified: buyer.isVerified,
        verificationStatus: buyer.verificationStatus,
        verificationNote: buyer.verificationNote,
        address: buyer.address,
        city: buyer.city,
        postalCode: buyer.postalCode,
        country: buyer.country,
        buyerType: buyer.buyerType,
        organizationName: buyer.organizationName,
        buyerDesignation: buyer.buyerDesignation,
        businessRegistrationNumber: buyer.businessRegistrationNumber,
        governmentIdType: buyer.governmentIdType,
        governmentIdNumber: buyer.governmentIdNumber,
        createdAt: buyer.createdAt,
      },
    });
  } catch (error) {
    console.error("Buyer profile error:", error.message);

    return res.status(500).json({
      message: "Failed to retrieve Buyer profile.",
    });
  }
});

// PATCH /api/buyer/profile
// Update the logged-in Buyer's own profile
router.patch("/profile", authMiddleware, buyerMiddleware, async (req, res) => {
  try {
    const { name, phone, address, city, postalCode, country } = req.body;

    if (name === undefined && phone === undefined && address === undefined && city === undefined && postalCode === undefined && country === undefined) {
      return res.status(400).json({
        message: "Provide name or phone to update.",
      });
    }

    const updates = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
          message: "Name must be a non-empty string.",
        });
      }

      updates.name = name.trim();
    }

    if (phone !== undefined) {
      if (typeof phone !== "string") {
        return res.status(400).json({
          message: "Phone must be a string.",
        });
      }

      updates.phone = phone.trim();
    }

    for (const [field, value] of Object.entries({ address, city, postalCode, country })) {
      if (value !== undefined) {
        if (typeof value !== "string" || value.length > 500) return res.status(400).json({ message: `${field} must be text up to 500 characters.` });
        updates[field] = value.trim();
      }
    }

    const buyer = await User.findOneAndUpdate(
      { _id: req.user.userId, role: "buyer", isActive: true },
      { $set: updates },
      {
        new: true,
        runValidators: true,
      }
    ).select("-password");

    if (!buyer) {
      return res.status(404).json({
        message: "Active Buyer account not found.",
      });
    }

    return res.status(200).json({
      message: "Buyer profile updated successfully.",
      buyer: {
        id: buyer._id,
        name: buyer.name,
        email: buyer.email,
        phone: buyer.phone,
        role: buyer.role,
        isVerified: buyer.isVerified,
        createdAt: buyer.createdAt,
      },
    });
  } catch (error) {
    console.error("Buyer profile update error:", error.message);

    return res.status(500).json({
      message: "Failed to update Buyer profile.",
    });
  }
});

module.exports = router;
