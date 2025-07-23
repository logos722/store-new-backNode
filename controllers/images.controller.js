const path = require("path");
const fs = require("fs");
const { host } = require("../constants/url");

exports.getImageUrl = (req, res) => {
  const imgPath = req.query.path;
  if (!imgPath) {
    return res.status(400).json({ error: "Missing path parameter" });
  }
  // надёжно собираем путь, чтобы избежать path traversal
  const full = path.join(__dirname, "..", "public", "images", imgPath);
  if (!full.startsWith(path.join(__dirname, "..", "public", "images"))) {
    return res.status(400).json({ error: "Bad path" });
  }
  if (!fs.existsSync(full)) {
    return res.status(404).json({ error: "File not found" });
  }
  // отдадим фронту URL, по которому Express будет отдавать файл
  res.json({ imageUrl: `${host}/images/${imgPath}` });
};
