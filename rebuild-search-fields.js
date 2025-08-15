require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("./models/product.model"); // наша модель с полями image и description
const normalizeRu = require("./utils/normalizeRu"); // Ensure this utility is available

(async () => {
  await mongoose.connect(process.env.MONGO_URI, {});
  console.log("[DB]", mongoose.connection.name);

  const cursor = Product.find({}, "name fullName name_search fullName_search")
    .lean()
    .cursor();

  const batch = [];
  let matched = 0,
    modified = 0,
    seen = 0;
  const FLUSH_SIZE = 1000;

  for await (const doc of cursor) {
    seen++;
    const nameNew = normalizeRu(doc.name || "");
    const fullNew = normalizeRu(doc.fullName || "");

    if (doc.name_search !== nameNew || doc.fullName_search !== fullNew) {
      batch.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { name_search: nameNew, fullName_search: fullNew } },
        },
      });
    }

    if (batch.length >= FLUSH_SIZE) {
      const res = await Product.bulkWrite(batch, { ordered: false });
      matched += res.matchedCount || 0;
      modified += res.modifiedCount || 0;
      batch.length = 0;
      console.log(`[PROGRESS] seen=${seen} modified=${modified}`);
    }
  }

  if (batch.length) {
    const res = await Product.bulkWrite(batch, { ordered: false });
    matched += res.matchedCount || 0;
    modified += res.modifiedCount || 0;
  }

  console.log("[DONE]", { seen, matched, modified });
  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
