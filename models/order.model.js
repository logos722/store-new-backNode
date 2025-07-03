const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({
  items: [
    {
      product: {
        id: String,
        name: String,
        price: Number,
        image: String,
      },
      quantity: { type: Number, required: true },
    },
  ],
  total: Number,
  customerInfo: {
    email: String,
    name: String,
    phone: String,
    city: String,
    comment: String,
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Order", OrderSchema);
