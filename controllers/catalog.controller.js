const Product = require("../models/product.model");

exports.getByCategory = async (req, res) => {
  try {
    console.log("req", req.params, req.query);
    const { category } = req.params;
    // Парсим page и limit из query-параметров
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);
    const skip = (page - 1) * limit;

    // Общее число товаров
    const total = await Product.countDocuments({ groupId: category });

    const prods = await Product.find({ groupId: category })
      .skip(skip)
      .limit(limit);

    if (!prods.length) {
      return res.status(404).json({ error: "Category not found" });
    }
    const products = prods.map((p) => ({
      id: p.externalId,
      name: p.name,
      description: p.description,
      price: p.price,
      image: p.image || null,
      stock: p.quantity || null,
      inStock: p.inStock || null,
    }));

    const totalPages = Math.ceil(total / limit);

    res.json({ category, products, page, totalPages, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
