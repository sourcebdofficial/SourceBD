
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();
const authRoutes = require("./auth.routes");
const buyerRoutes = require("./buyer.routes");
const supplierRoutes = require("./supplier.routes");
const productRoutes = require("./product.routes");
const orderRoutes = require("./order.routes");
const sourcingRoutes = require("./sourcing.routes");
const settingsRoutes = require("./settings.routes");
const PORT = 5000;
const userStatusRouteLoaded = authRoutes.stack.some((layer) =>
  layer.route?.path === "/admin/users/:id/status" && layer.route.methods.patch
);
const userTrashRoutesLoaded = [
  ["/admin/users/:id/trash", "patch"],
  ["/admin/users/trash", "get"],
  ["/admin/users/:id/restore", "patch"],
  ["/admin/users/:id/permanent", "delete"],
].every(([routePath, method]) => authRoutes.stack.some((layer) =>
  layer.route?.path === routePath && layer.route.methods[method]
));

app.get("/api/health", (req, res) => {
  res.status(200).json({
    service: "sourcebd-api",
    userStatusRouteLoaded,
    userTrashRoutesLoaded,
  });
});

app.use(cors());
app.use(express.json({ limit: "3mb" }));
app.use("/uploads/products", express.static(path.join(__dirname, "uploads", "products"), { fallthrough: false, maxAge: "7d" }));
app.get("/debug-route-check", (req, res) => {
  res.json({
    message: "Server.js route is working",
  });
});
app.use("/api/auth", authRoutes);
app.use("/api/buyer", buyerRoutes);
app.use("/api/supplier", supplierRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/sourcing", sourcingRoutes);
app.use("/api/settings", settingsRoutes);
app.get("/api/auth/test", (req, res) => {
  res.send("Auth route is working!");
});
console.log("Auth routes loaded:", typeof authRoutes);
console.log("User suspend route loaded:", userStatusRouteLoaded);
console.log("User Trash routes loaded:", userTrashRoutesLoaded);
console.log(
  "Auth routes file:",
  require.resolve("./auth.routes")
);

console.log(
  "Co-Admin route exists:",
  require("fs")
    .readFileSync(require.resolve("./auth.routes"), "utf8")
    .includes('"/admin/co-admins"')
);
app.get("/", (req, res) => {
  res.send("SourceBD Backend is running successfully!");
});

// Keep API failures machine-readable so the frontend never receives Express's HTML 404 page.
app.use("/api", (req, res) => {
  res.status(404).json({ message: `API route not found: ${req.method} ${req.originalUrl}` });
});
app.use((error, req, res, next) => {
  console.error("Request error:", error.message);
  if (res.headersSent) return next(error);
  return res.status(error.status || 500).json({ message: error.status === 400 ? "Invalid request body." : "Server request failed." });
});

async function startServer() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected successfully!");

    app.listen(PORT, () => {
      console.log(`SourceBD server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
  }
}

startServer();
