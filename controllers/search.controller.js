const Product = require("../models/product.model");

exports.search = async (req, res) => {
  console.log("🔥 /api/search called, query =", req.query.query);

  try {
    const { query } = req.query;
    if (!query || !query.trim()) {
      return res.status(400).json({ error: "Missing or empty query" });
    }
    const regex = new RegExp(query, "i");
    const prods = await Product.find({
      $or: [
        { name: regex },
        { description: regex },
        { fullName: regex }, // новая строка
        // например, по группе
        { groupId: regex },
      ],
    });
    const results = prods.map((p) => ({
      id: p.externalId,
      name: p.name,
      description: p.description,
      price: p.price,
      image: p.image || null,
    }));
    res.json({ query, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
