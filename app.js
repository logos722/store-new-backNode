require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const connectDB = require("./config/db");

const app = express();
// Middleware
app.use(cors());
app.use(express.json());

app.use("/images", express.static(path.join(__dirname, "public", "images")));

// Подключаем БД
connectDB();

// Импорт роутов

const catalogRoutes = require("./routes/catalog.routes");
const productRoutes = require("./routes/product.routes");
const searchRoutes = require("./routes/search.routes");
const imagesRoutes = require("./routes/images.routes");
const orderRoutes = require("./routes/order.routes");
const authRoutes = require("./routes/auth.routes");

app.use("/api/auth", authRoutes);
app.use("/api/catalog", catalogRoutes);
app.use("/api/product", productRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/images", imagesRoutes);
app.use("/api/orders", orderRoutes);

// Запуск
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
