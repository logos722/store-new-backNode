const Product = require("../models/product.model");

// Получить все
exports.getAll = async (req, res) => {
  const products = await Product.find();
  res.json(products);
};

// Получить по ID
exports.getById = async (req, res) => {
  try {
    const prod = await Product.findOne({ externalId: req.params.id });
    if (!prod) {
      return res.status(404).json({ error: "Product not found" });
    }
    const imageUrl = prod.image
      ? `/images/${prod.image.replace(/^\//, "")}`
      : null;

    res.json({
      id: prod.externalId,
      name: prod.name,
      description: prod.description,
      fullName: prod.fullName,
      price: prod.price,
      stock: prod.quantity,
      image: imageUrl,
      characteristics: {
        Вес: String(prod.weight),
        ВидНоменклатуры: prod._doc["ЗначенияРеквизитов"]?.ВидНоменклатуры, // если сохраняли
        ТипНоменклатуры: prod._doc["ЗначенияРеквизитов"]?.ТипНоменклатуры,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Создать
exports.create = async (req, res) => {
  const newProd = new Product(req.body);
  const saved = await newProd.save();
  res.status(201).json(saved);
};
