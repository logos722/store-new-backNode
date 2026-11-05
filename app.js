require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const connectDB = require("./config/db");
const mongoose = require("mongoose");
const { rateLimit } = require("express-rate-limit");

const app = express();
app.disable("x-powered-by");
// Only the host gateway running Nginx and local development connections.
app.set("trust proxy", ["loopback", "172.30.55.1"]);
// Middleware
app.use(cors({ origin: process.env.PUBLIC_URL || "https://gelionaqua.ru" }));
app.use(express.json({ limit: "256kb" }));
app.get("/health/live", (_req, res) => res.json({ status: "ok" }));
app.get("/health/ready", async (_req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) throw new Error("not ready");
    await mongoose.connection.db.admin().ping();
    res.json({ status: "ready" });
  } catch { res.status(503).json({ status: "unavailable" }); }
});
app.use("/api/auth", rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: "draft-7", legacyHeaders: false }));
app.use("/api/orders", rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false }));

app.use("/images", express.static(path.join(__dirname, "public", "images")));

// Подключаем БД
if (require.main === module) connectDB();

// Импорт роутов

// в app.js
const categoryRoutes = require("./routes/category.routes");
const catalogRoutes = require("./routes/catalog.routes");
const productRoutes = require("./routes/product.routes");
const searchRoutes = require("./routes/search.routes");
const imagesRoutes = require("./routes/images.routes");
const orderRoutes = require("./routes/order.routes");
const authRoutes = require("./routes/auth.routes");

app.use("/api/categories", categoryRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/catalog", catalogRoutes);
app.use("/api/product", productRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/images", imagesRoutes);
app.use("/api/orders", orderRoutes);

// Запуск
const PORT = process.env.PORT || 5000;
if (require.main === module) {
  const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => {
    server.close(() => mongoose.disconnect().finally(() => process.exit(0)));
    setTimeout(() => process.exit(1), 15000).unref();
  });
}
module.exports = app;
