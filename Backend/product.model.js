
const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 150,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },

    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      enum: ["BDT", "USD"],
      default: "BDT",
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Quantity must be a whole number.",
      },
    },

    unit: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
      default: "piece",
    },

    minimumOrderQuantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
      validate: {
        validator: Number.isInteger,
        message: "Minimum order quantity must be a whole number.",
      },
    },

    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["draft", "published", "inactive"],
      default: "draft",
      required: true,
      index: true,
    },

    images: {
      type: [
        {
          type: String,
          trim: true,
        },
      ],
      default: [],
      validate: {
        validator: (images) => images.length <= 10,
        message: "A product can have at most 10 images.",
      },
    },
  },
  {
    timestamps: true,
  }
);

// Index to help product searches by status and category
productSchema.index({ status: 1, category: 1, createdAt: -1 });

module.exports = mongoose.model("Product", productSchema);