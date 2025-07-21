const Product = require("../models/product.model");

exports.getByCategory = async (req, res) => {
  try {
    console.log("req", req.params, req.query);
    const groupId = req.params.category; // на самом деле это UUID группы

    const {
      page = 1,
      limit = 10,
      minPrice,
      maxPrice,
      inStock,
      categories: categoryFilters,
      sort,
    } = req.query;

    console.log("req.query", req.query);
    // Парсим page и limit из query-параметров
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, parseInt(limit, 10));
    const skip = (pageNum - 1) * limitNum;

    const filter = { groupId };

    // Опционально: текстовая категория из query ?category=...
    if (req.query.category) {
      filter.category = req.query.category;
    }

    // Фильтрация по цене
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    // Фильтр по наличию
    if (inStock === "true") {
      filter.quantity = { $gt: 0 };
    }

    // Фильтр по списку дополнительных категорий
    if (req.query.categories) {
      let cats = req.query.categories;
      if (!Array.isArray(cats)) cats = [cats];
      filter.category = { $in: cats };
    }

    if (categoryFilters) {
      const arr = Array.isArray(categoryFilters)
        ? categoryFilters
        : [categoryFilters];
      filter.category = { $in: arr };
    }

    console.log("filter", filter);

    // Построение параметров сортировки
    let sortObj = {};
    switch (sort) {
      case "price-asc":
        sortObj.price = 1;
        break;
      case "price-desc":
        sortObj.price = -1;
        break;
      case "name-asc":
        sortObj.name = 1;
        break;
      case "name-desc":
        sortObj.name = -1;
        break;
      default:
        // оставляем без сортировки
        break;
    }

    // Общее число товаров
    const total = await Product.countDocuments(filter);

    // const prods = await Product.find(filter).skip(skip).limit(limit);
    // Запрос с учётом сортировки, пропуска и лимита
    let query = Product.find(filter);
    if (Object.keys(sortObj).length) {
      query = query.sort(sortObj);
    }
    const prods = await query.skip(skip).limit(limitNum);

    if (!prods.length) {
      return res.status(404).json({ error: "Category not found" });
    }
    const products = prods.map((p) => ({
      id: p.externalId,
      name: p.name,
      description: p.description,
      price: p.price,
      image: p.image ? `/images/${p.image.replace(/^\//, "")}` : null,
      stock: p.quantity,
      inStock: p.inStock,
    }));

    const totalPages = Math.ceil(total / limit);

    res.json({ category: groupId, products, page: pageNum, totalPages, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
