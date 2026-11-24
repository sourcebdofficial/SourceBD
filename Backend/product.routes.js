
const express = require("express");
const router = express.Router();

const Product = require("./product.model");
const Review = require("./review.model");

// ========================================
// GET ALL PUBLISHED PRODUCTS
// GET /api/products
// ========================================
router.get("/", async (req, res) => {
  try {
    const { search, category, location, page = "1", limit = "20" } = req.query;

    // Validate pagination
    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    if (
      !Number.isInteger(pageNumber) ||
      pageNumber < 1 ||
      !Number.isInteger(limitNumber) ||
      limitNumber < 1 ||
      limitNumber > 100
    ) {
      return res.status(400).json({
        message: "Page must be positive and limit must be between 1 and 100.",
      });
    }

    // Public buyers can see published products only
    const filter = {
      status: "published",
    };

    // Filter by category
    if (category !== undefined) {
      if (typeof category !== "string" || !category.trim()) {
        return res.status(400).json({
          message: "Category must be a non-empty string.",
        });
      }

      filter.category = {
        $regex: `^${category.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        $options: "i",
      };
    }

    // Search by product name, description, or category
    if (search !== undefined) {
      if (typeof search !== "string" || !search.trim()) {
        return res.status(400).json({
          message: "Search must be a non-empty string.",
        });
      }

      const escapedSearch = search.trim().replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      filter.$or = [
        { name: { $regex: escapedSearch, $options: "i" } },
        { description: { $regex: escapedSearch, $options: "i" } },
        { category: { $regex: escapedSearch, $options: "i" } },
      ];
    }

    if (location !== undefined) {
      if (typeof location !== "string" || !location.trim()) {
        return res.status(400).json({ message: "Location must be a non-empty string." });
      }
      const escapedLocation = location.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const supplierIds = await require("./user.model").find({
        role: "supplier",
        $or: [
          { city: { $regex: escapedLocation, $options: "i" } },
          { address: { $regex: escapedLocation, $options: "i" } },
        ],
      }).distinct("_id");
      filter.supplier = { $in: supplierIds };
    }

    const skip = (pageNumber - 1) * limitNumber;

    const [products, totalProducts] = await Promise.all([
      Product.find(filter)
        .select(
          "name description category price currency quantity unit minimumOrderQuantity supplier images createdAt"
        )
        .populate("supplier", "name isVerified businessName city address verificationStatus")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber)
        .lean(),

      Product.countDocuments(filter),
    ]);

    const reviewStats = await Review.aggregate([
      { $match: { status: "approved", product: { $in: products.map((product) => product._id) } } },
      { $group: { _id: "$product", averageRating: { $avg: "$rating" }, reviewCount: { $sum: 1 } } },
    ]);
    const statsByProduct = new Map(reviewStats.map((item) => [String(item._id), item]));
    const productsWithReviews = products.map((product) => {
      const stats = statsByProduct.get(String(product._id));
      return { ...product, averageRating: stats ? Number(stats.averageRating.toFixed(1)) : 0, reviewCount: stats?.reviewCount || 0 };
    });

    return res.status(200).json({
      message: "Published products fetched successfully.",
      pagination: {
        currentPage: pageNumber,
        pageSize: limitNumber,
        totalProducts,
        totalPages: Math.ceil(totalProducts / limitNumber),
      },
      products: productsWithReviews,
    });
  } catch (error) {
    console.error("Get public products error:", error);

    return res.status(500).json({
      message: "Failed to fetch products.",
    });
  }
});

// ========================================
// GET SINGLE PUBLISHED PRODUCT
// GET /api/products/:id
// ========================================
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!/^[a-fA-F0-9]{24}$/.test(id)) {
      return res.status(400).json({
        message: "Invalid product ID.",
      });
    }

    const product = await Product.findOne({
      _id: id,
      status: "published",
    })
      .select(
        "name description category price currency quantity unit minimumOrderQuantity supplier images createdAt"
      )
      .populate("supplier", "name isVerified businessName city address verificationStatus")
      .lean();

    if (!product) {
      return res.status(404).json({
        message: "Published product not found.",
      });
    }

    const [stats] = await Review.aggregate([
      { $match: { product: product._id, status: "approved" } },
      { $group: { _id: "$product", averageRating: { $avg: "$rating" }, reviewCount: { $sum: 1 } } },
    ]);

    return res.status(200).json({
      message: "Product fetched successfully.",
      product: { ...product, averageRating: stats ? Number(stats.averageRating.toFixed(1)) : 0, reviewCount: stats?.reviewCount || 0 },
    });
  } catch (error) {
    console.error("Get public product error:", error);

    return res.status(500).json({
      message: "Failed to fetch product.",
    });
  }
});

module.exports = router;
