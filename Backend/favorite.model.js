const mongoose = require("mongoose");

const favoriteSchema = new mongoose.Schema({
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
}, { timestamps: true });

favoriteSchema.index({ buyer: 1, product: 1 }, { unique: true });
module.exports = mongoose.model("Favorite", favoriteSchema);
