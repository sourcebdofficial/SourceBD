const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const User = require("./user.model");
const Product = require("./product.model");
const Order = require("./order.model");
const Category = require("./category.model");
const Review = require("./review.model");
const Favorite = require("./favorite.model");
const Inquiry = require("./inquiry.model");
const authMiddleware = require("./auth.middleware");
const adminMiddleware = require("./admin.middleware");
const requirePermission = adminMiddleware.requirePermission;

const defaultCategories = [
  "Garments & Textile", "Food & Beverage", "Cosmetics", "Electronics",
  "Packaging", "Leather", "Furniture", "Construction Materials",
  "Agriculture", "Printing Materials", "Stationery", "Handicrafts",
];

const requireRole = (role) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Authentication required." });
  if (req.user.role !== role) return res.status(403).json({ message: `${role} access only.` });
  next();
};

const validId = (id) => mongoose.isValidObjectId(id);

// Categories are public for filters and managed by admins.
router.get("/categories", async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ name: 1 }).lean();
    const savedNames = new Set(categories.map((category) => category.name.toLowerCase()));
    const defaults = defaultCategories.filter((name) => !savedNames.has(name.toLowerCase())).map((name) => ({ name, isDefault: true }));
    return res.json({ categories: [...categories, ...defaults].sort((a, b) => a.name.localeCompare(b.name)) });
  } catch (error) {
    console.error("Category fetch error:", error.message);
    return res.status(500).json({ message: "Failed to fetch categories." });
  }
});

router.post("/admin/categories", authMiddleware, adminMiddleware, requirePermission("manage_listings"), async (req, res) => {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    if (!name) return res.status(400).json({ message: "Category name is required." });
    const category = await Category.create({ name, description: req.body.description || "" });
    return res.status(201).json({ message: "Category created.", category });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "Category already exists." });
    if (error.name === "ValidationError") return res.status(400).json({ message: error.message });
    console.error("Category create error:", error.message);
    return res.status(500).json({ message: "Failed to create category." });
  }
});

router.patch("/admin/categories/:id", authMiddleware, adminMiddleware, requirePermission("manage_listings"), async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid category ID." });
  const updates = {};
  if (req.body.name !== undefined) {
    if (typeof req.body.name !== "string" || !req.body.name.trim()) return res.status(400).json({ message: "Category name is required." });
    updates.name = req.body.name.trim();
  }
  if (req.body.description !== undefined) updates.description = req.body.description;
  if (req.body.isActive !== undefined) updates.isActive = Boolean(req.body.isActive);
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true });
    if (!category) return res.status(404).json({ message: "Category not found." });
    return res.json({ message: "Category updated.", category });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "Category already exists." });
    return res.status(error.name === "ValidationError" ? 400 : 500).json({ message: error.name === "ValidationError" ? error.message : "Failed to update category." });
  }
});

router.delete("/admin/categories/:id", authMiddleware, adminMiddleware, requirePermission("manage_listings"), async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid category ID." });
  const category = await Category.findByIdAndUpdate(req.params.id, { $set: { isActive: false } }, { new: true });
  if (!category) return res.status(404).json({ message: "Category not found." });
  return res.json({ message: "Category archived.", category });
});

// Buyers may review a product only after a delivered order; reviews need moderation.
router.get("/reviews/product/:productId", async (req, res) => {
  if (!validId(req.params.productId)) return res.status(400).json({ message: "Invalid product ID." });
  const reviews = await Review.find({ product: req.params.productId, status: "approved" })
    .populate("buyer", "name").sort({ createdAt: -1 }).lean();
  const averageRating = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;
  return res.json({ reviews, count: reviews.length, averageRating: Number(averageRating.toFixed(1)) });
});

router.post("/reviews", authMiddleware, requireRole("buyer"), async (req, res) => {
  const { productId, rating, comment = "" } = req.body;
  if (!validId(productId)) return res.status(400).json({ message: "Valid productId is required." });
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ message: "Rating must be a whole number from 1 to 5." });
  if (typeof comment !== "string" || comment.length > 1000) return res.status(400).json({ message: "Comment must be up to 1000 characters." });
  try {
    const product = await Product.findOne({ _id: productId, status: "published" }).select("supplier name");
    if (!product) return res.status(404).json({ message: "Published product not found." });
    const deliveredOrder = await Order.exists({ buyer: req.user.userId, product: productId, status: "delivered" });
    if (!deliveredOrder) return res.status(403).json({ message: "A delivered order is required before reviewing this product." });
    const review = await Review.create({ buyer: req.user.userId, product: productId, supplier: product.supplier, rating, comment: comment.trim() });
    return res.status(201).json({ message: "Review submitted for moderation.", review });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "You have already reviewed this product." });
    console.error("Review submit error:", error.message);
    return res.status(500).json({ message: "Failed to submit review." });
  }
});

router.get("/reviews/mine", authMiddleware, requireRole("buyer"), async (req, res) => {
  const reviews = await Review.find({ buyer: req.user.userId }).populate("product", "name").sort({ createdAt: -1 });
  return res.json({ reviews });
});

router.get("/admin/reviews", authMiddleware, adminMiddleware, requirePermission("view_listings"), async (req, res) => {
  const reviews = await Review.find({ status: req.query.status || "pending" })
    .populate("buyer", "name email").populate("product", "name").populate("supplier", "name").sort({ createdAt: -1 });
  return res.json({ reviews });
});

router.patch("/admin/reviews/:id", authMiddleware, adminMiddleware, requirePermission("manage_listings"), async (req, res) => {
  const { status } = req.body;
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid review ID." });
  if (!["approved", "rejected"].includes(status)) return res.status(400).json({ message: "Status must be approved or rejected." });
  const review = await Review.findByIdAndUpdate(req.params.id, { $set: { status } }, { new: true, runValidators: true });
  if (!review) return res.status(404).json({ message: "Review not found." });
  return res.json({ message: `Review ${status} successfully.`, review });
});

// Buyer favorites are private to the owner and only include published listings.
router.get("/favorites", authMiddleware, requireRole("buyer"), async (req, res) => {
  const rows = await Favorite.find({ buyer: req.user.userId }).populate({ path: "product", match: { status: "published" }, populate: { path: "supplier", select: "name businessName city isVerified" } }).sort({ createdAt: -1 });
  return res.json({ favorites: rows.filter((row) => row.product) });
});

router.post("/favorites", authMiddleware, requireRole("buyer"), async (req, res) => {
  const { productId } = req.body;
  if (!validId(productId)) return res.status(400).json({ message: "Valid productId is required." });
  if (!(await Product.exists({ _id: productId, status: "published" }))) return res.status(404).json({ message: "Published product not found." });
  try {
    const favorite = await Favorite.create({ buyer: req.user.userId, product: productId });
    return res.status(201).json({ message: "Product saved to favorites.", favorite });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "Product is already in favorites." });
    console.error("Favorite create error:", error.message);
    return res.status(500).json({ message: "Failed to save favorite." });
  }
});

router.delete("/favorites/:productId", authMiddleware, requireRole("buyer"), async (req, res) => {
  if (!validId(req.params.productId)) return res.status(400).json({ message: "Invalid product ID." });
  const result = await Favorite.findOneAndDelete({ buyer: req.user.userId, product: req.params.productId });
  if (!result) return res.status(404).json({ message: "Favorite not found." });
  return res.json({ message: "Product removed from favorites." });
});

// A buyer can send a product inquiry/RFQ to its supplier, or a general RFQ to a supplier.
router.post("/inquiries", authMiddleware, requireRole("buyer"), async (req, res) => {
  const { productId, supplierId, productName, details, quantity, targetPrice } = req.body;
  if (typeof details !== "string" || !details.trim() || details.length > 2000) return res.status(400).json({ message: "Inquiry details are required (up to 2000 characters)." });
  if (quantity !== undefined && quantity !== null && (!Number.isInteger(quantity) || quantity < 1)) return res.status(400).json({ message: "Quantity must be a positive whole number." });
  if (targetPrice !== undefined && targetPrice !== null && (!Number.isFinite(targetPrice) || targetPrice < 0)) return res.status(400).json({ message: "Target price must be a non-negative number." });
  let supplier;
  let product = null;
  if (productId) {
    if (!validId(productId)) return res.status(400).json({ message: "Invalid product ID." });
    product = await Product.findOne({ _id: productId, status: "published" }).select("supplier name");
    if (!product) return res.status(404).json({ message: "Published product not found." });
    supplier = product.supplier;
  } else if (validId(supplierId)) {
    supplier = await User.findOne({ _id: supplierId, role: "supplier", isActive: true }).select("_id");
    if (!supplier) return res.status(404).json({ message: "Supplier not found." });
  } else {
    return res.status(400).json({ message: "Select a product or provide a valid supplierId." });
  }
  if (String(supplier._id || supplier) === req.user.userId) return res.status(400).json({ message: "You cannot send an inquiry to yourself." });
  try {
    const inquiry = await Inquiry.create({ buyer: req.user.userId, supplier: supplier._id || supplier, product: product?._id || null, productName: product?.name || String(productName || "Wholesale requirement").trim().slice(0, 150), details: details.trim(), quantity: quantity ?? null, targetPrice: targetPrice ?? null });
    return res.status(201).json({ message: "Inquiry sent to supplier.", inquiry });
  } catch (error) {
    console.error("Inquiry create error:", error.message);
    return res.status(500).json({ message: "Failed to send inquiry." });
  }
});

router.get("/inquiries/mine", authMiddleware, requireRole("buyer"), async (req, res) => {
  const inquiries = await Inquiry.find({ buyer: req.user.userId }).populate("supplier", "name businessName phone").populate("product", "name").sort({ createdAt: -1 });
  return res.json({ inquiries });
});

router.get("/inquiries/supplier", authMiddleware, requireRole("supplier"), async (req, res) => {
  const inquiries = await Inquiry.find({ supplier: req.user.userId }).populate("buyer", "name email phone").populate("product", "name").sort({ createdAt: -1 });
  return res.json({ inquiries });
});

router.patch("/inquiries/:id/respond", authMiddleware, requireRole("supplier"), async (req, res) => {
  const { response, status = "responded" } = req.body;
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid inquiry ID." });
  if (typeof response !== "string" || !response.trim() || response.length > 2000) return res.status(400).json({ message: "A response is required (up to 2000 characters)." });
  if (!["responded", "closed"].includes(status)) return res.status(400).json({ message: "Invalid inquiry status." });
  const inquiry = await Inquiry.findOneAndUpdate({ _id: req.params.id, supplier: req.user.userId }, { $set: { supplierResponse: response.trim(), status } }, { new: true, runValidators: true });
  if (!inquiry) return res.status(404).json({ message: "Inquiry not found." });
  return res.json({ message: "Inquiry response saved.", inquiry });
});

// Supplier verification requests are reviewed by admins; legacy isVerified remains intact.
router.post("/supplier/verification", authMiddleware, requireRole("supplier"), async (req, res) => {
  const fields = ["businessName", "businessType", "businessDescription", "address", "city"];
  const updates = {};
  for (const field of fields) {
    if (typeof req.body[field] !== "string" || !req.body[field].trim()) return res.status(400).json({ message: `${field} is required.` });
    updates[field] = req.body[field].trim();
  }
  if (updates.businessName.length > 150 || updates.businessDescription.length > 1000 || updates.address.length > 300) return res.status(400).json({ message: "Business details exceed the allowed length." });
  const supplier = await User.findOneAndUpdate({ _id: req.user.userId, role: "supplier", isActive: true, verificationStatus: { $nin: ["pending", "verified"] } }, { $set: { ...updates, verificationStatus: "pending", verificationNote: "", isVerified: false } }, { new: true, runValidators: true }).select("name businessName businessType businessDescription address city verificationStatus isVerified");
  if (!supplier) return res.status(409).json({ message: "A verification request is already pending, the supplier is already verified, or the account is unavailable." });
  return res.json({ message: "Verification request submitted.", supplier });
});

router.get("/admin/verification", authMiddleware, adminMiddleware, requirePermission("view_suppliers"), async (req, res) => {
  const suppliers = await User.find({ role: "supplier", verificationStatus: "pending" }).select("name email phone businessName businessType businessDescription address city verificationStatus createdAt").sort({ updatedAt: -1 });
  return res.json({ suppliers });
});

router.patch("/admin/verification/:id", authMiddleware, adminMiddleware, requirePermission("manage_suppliers"), async (req, res) => {
  const { decision, note = "" } = req.body;
  if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid supplier ID." });
  if (!["verified", "rejected"].includes(decision)) return res.status(400).json({ message: "Decision must be verified or rejected." });
  if (typeof note !== "string" || note.length > 500) return res.status(400).json({ message: "Note must be text up to 500 characters." });
  const supplier = await User.findOneAndUpdate({ _id: req.params.id, role: "supplier", verificationStatus: "pending" }, { $set: { verificationStatus: decision, isVerified: decision === "verified", verificationNote: note.trim() } }, { new: true }).select("name email businessName city verificationStatus verificationNote isVerified");
  if (!supplier) return res.status(404).json({ message: "Pending supplier request not found." });
  return res.json({ message: `Supplier ${decision} successfully.`, supplier });
});

module.exports = router;
