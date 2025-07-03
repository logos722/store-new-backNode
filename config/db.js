const mongoose = require("mongoose");
const uri = process.env.MONGO_URI;

const connectDB = async () => {
  try {
    await mongoose.connect(uri, {
      useNewUrlParser: true, // современный парсер URI
      useUnifiedTopology: true, // unified topology, авто-переподключения
      serverSelectionTimeoutMS: 5000, // ждать до 5 сек. при старте
      socketTimeoutMS: 45000, // разъединять мёртвые сокеты через 45 сек.
    });
    console.log("MongoDB connected");
  } catch (err) {
    console.error("DB connection error:", err);
    // при неудаче — пробуем снова через 5 секунд
    setTimeout(connectDB, 5000);
  }
};

module.exports = connectDB;
