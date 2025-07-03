const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema({
  externalId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  fullName: { type: String },
  price: { type: Number, default: 0 },
  currency: { type: String },
  unit: { type: String },
  unitCode: { type: String },
  groupId: { type: String },
  weight: { type: Number, default: 0 },
  quantity: { type: Number },
  description: { type: String },
  inStock: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Product", ProductSchema);
