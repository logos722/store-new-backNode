const normalizeRu = (s = "") =>
  s.trim().toLocaleLowerCase("ru").replace(/ё/g, "е");

module.exports = normalizeRu;
