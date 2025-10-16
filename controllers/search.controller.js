const Product = require("../models/product.model");
const normalizeRu = require("../utils/normalizeRu"); // Ensure this utility is available
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const MAX_Q_LEN = 60;
const MIN_Q_LEN = 2;

exports.search = async (req, res) => {
  const qNorm = normalizeRu(req.query.q || req.query.query || "");

  if (qNorm.length === 0) {
    return res
      .status(400)
      .json({ code: "EMPTY_QUERY", message: "Empty query" });
  }

  if (qNorm.length < MIN_Q_LEN) {
    return res
      .status(400)
      .json({ code: "QUERY_TOO_SHORT", message: `Min ${MIN_Q_LEN} chars` });
  }

  if (qNorm.length > MAX_Q_LEN) {
    return res
      .status(400)
      .json({ code: "QUERY_TOO_LONG", message: `Max ${MAX_Q_LEN} chars` });
  }

  if (!/[\p{L}\p{N}]/u.test(qNorm)) {
    return res
      .status(400)
      .json({ code: "INVALID_QUERY", message: "Use letters or digits" });
  }

  const esc = escapeRegex(qNorm);
  const prefix = new RegExp("^" + esc);

  const page = Math.max(parseInt(req.query.page || "1", 10), 1);
  const limit = Math.min(
    Math.max(parseInt(req.query.limit || "20", 10), 1),
    50
  );

  try {
    const prods = await Product.find({
      $or: [{ name_search: prefix }, { fullName_search: prefix }],
    })
      .select("externalId name fullName description price image")
      .lean()
      .skip((page - 1) * limit)
      .limit(limit);

    const results = prods.map((p) => ({
      id: p.externalId ?? String(p._id),
      name: p.name,
      slug: p.slug,
      fullName: p.fullName ?? null,
      description: p.description ?? null,
      price: p.price ?? null,
      image: p.image ?? null,
    }));

    return res.json({ query: qNorm, page, limit, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
