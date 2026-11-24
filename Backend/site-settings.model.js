const mongoose = require("mongoose");

const siteSettingsSchema = new mongoose.Schema({
  _id: { type: String, default: "sourcebd-site" },
  logoData: { type: String, default: "" },
}, { versionKey: false });

module.exports = mongoose.model("SiteSettings", siteSettingsSchema);
