const mongoose = require("mongoose");
const normalizeRu = require("../utils/normalizeRu"); // Ensure this utility is available

const ProductSchema = new mongoose.Schema({
  externalId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  fullName: { type: String },
  price: { type: Number, default: 0 },
  currency: { type: String },
  unit: { type: String },
  unitCode: { type: String },
  groupId: { type: String },
  slug: { type: String, index: true },
  weight: { type: Number, default: 0 },
  quantity: { type: Number },
  description: { type: String },
  inStock: { type: Boolean, default: true },
  image: { type: String },
  createdAt: { type: Date, default: Date.now },
  category: { type: String },
  name_search: { type: String, index: true },
  fullName_search: { type: String, index: true },
});

ProductSchema.pre("save", function (next) {
  this.name_search = normalizeRu(this.name);
  this.fullName_search = normalizeRu(this.fullName);
  next();
});

ProductSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};
  const set = (update.$set ??= {});
  if (set.name != null) set.name_search = normalizeRu(set.name);
  if (set.fullName != null) set.fullName_search = normalizeRu(set.fullName);
  next();
});

ProductSchema.index({ category: 1, inStock: 1, price: 1 });

module.exports = mongoose.model("Product", ProductSchema);
