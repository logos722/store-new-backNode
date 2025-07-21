const Product = require("../models/product.model");

// GET /api/categories
exports.list = async (req, res) => {
  try {
    // distinct вернёт только непустые значения
    const categories = await Product.distinct("category", {
      category: { $ne: null },
    });
    res.json({ categories });
  } catch (err) {
    console.error("Categories fetch error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
