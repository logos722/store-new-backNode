/**
 * Утилита для нормализации URL изображений
 * Преобразует внутренние URL (localhost, backend:5000) в публичные URL
 *
 * @param {string|null|undefined} imageUrl - URL изображения для нормализации
 * @param {Object} options - Опции нормализации
 * @param {string} options.publicUrl - Публичный URL сайта (по умолчанию из ENV)
 * @param {string} options.fallbackImage - URL изображения по умолчанию
 * @returns {string} - Нормализованный URL изображения
 */
const normalizeImageUrl = (imageUrl, options = {}) => {
  // Получаем публичный URL из ENV или используем переданный
  const publicUrl =
    options.publicUrl || process.env.PUBLIC_URL || "https://gelionaqua.ru";

  // URL изображения по умолчанию
  const fallbackImage =
    options.fallbackImage || `${publicUrl}/images/default-product.jpg`;

  // 1) Если URL не указан, возвращаем изображение по умолчанию
  if (!imageUrl || typeof imageUrl !== "string" || imageUrl.trim() === "") {
    return fallbackImage;
  }

  const trimmedUrl = imageUrl.trim();

  // 2) Заменяем внутренние URL на публичные
  // Варианты внутренних URL, которые нужно заменить:
  const internalPatterns = [
    { pattern: /^http:\/\/backend:5000/gi, replacement: publicUrl },
    { pattern: /^http:\/\/localhost:5000/gi, replacement: publicUrl },
    { pattern: /^http:\/\/127\.0\.0\.1:5000/gi, replacement: publicUrl },
    { pattern: /^http:\/\/0\.0\.0\.0:5000/gi, replacement: publicUrl },
    // На случай если порт другой (из ENV)
    {
      pattern: new RegExp(`^http://backend:${process.env.PORT || 3000}`, "gi"),
      replacement: publicUrl,
    },
  ];

  let normalizedUrl = trimmedUrl;

  // Применяем все паттерны замены
  for (const { pattern, replacement } of internalPatterns) {
    if (pattern.test(normalizedUrl)) {
      normalizedUrl = normalizedUrl.replace(pattern, replacement);
      break; // Нашли и заменили, выходим из цикла
    }
  }

  // 3) Если URL уже абсолютный и правильный (начинается с http/https), используем как есть
  if (
    normalizedUrl.startsWith("http://") ||
    normalizedUrl.startsWith("https://")
  ) {
    return normalizedUrl;
  }

  // 4) Для относительных путей добавляем publicUrl
  if (normalizedUrl.startsWith("/")) {
    return `${publicUrl}${normalizedUrl}`;
  }

  // 5) Для путей без слэша в начале
  return `${publicUrl}/${normalizedUrl}`;
};

/**
 * Нормализует массив товаров, преобразуя их URL изображений
 *
 * @param {Array} items - Массив товаров с изображениями
 * @param {Object} options - Опции нормализации (передаются в normalizeImageUrl)
 * @returns {Array} - Массив товаров с нормализованными URL
 */
const normalizeItemsImages = (items, options = {}) => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => {
    // Создаем копию товара, чтобы не мутировать оригинал
    const normalizedItem = { ...item };

    // Нормализуем URL изображения, если оно есть
    if (item.image) {
      normalizedItem.image = normalizeImageUrl(item.image, options);
    }

    return normalizedItem;
  });
};

/**
 * Получает публичный URL из переменных окружения
 * Использует NODE_ENV для определения окружения
 *
 * @returns {string} - Публичный URL сайта
 */
const getPublicUrl = () => {
  // Если явно указан PUBLIC_URL в ENV, используем его
  if (process.env.PUBLIC_URL) {
    return process.env.PUBLIC_URL;
  }

  // Определяем URL на основе окружения
  const nodeEnv = process.env.NODE_ENV || "development";

  switch (nodeEnv) {
    case "production":
      // В продакшене используем домен
      return process.env.PRODUCTION_URL || "https://gelionaqua.ru";

    case "staging":
      // Для staging окружения (если есть)
      return process.env.STAGING_URL || "https://staging.gelionaqua.ru";

    case "development":
    default:
      // В разработке используем localhost с портом из ENV
      const port = process.env.PORT || 5000;
      return `http://localhost:${port}`;
  }
};

/**
 * Удаляет query параметры из URL (например, ?w=96&q=75)
 * Полезно для получения оригинального пути к файлу
 *
 * @param {string} imageUrl - URL изображения
 * @returns {string} - URL без query параметров
 */
const stripQueryParams = (imageUrl) => {
  if (!imageUrl || typeof imageUrl !== "string") {
    return "";
  }

  try {
    const url = new URL(imageUrl);
    return `${url.origin}${url.pathname}`;
  } catch (error) {
    // Если не удалось распарсить как URL, просто удаляем всё после ?
    return imageUrl.split("?")[0];
  }
};

module.exports = {
  normalizeImageUrl,
  normalizeItemsImages,
  getPublicUrl,
  stripQueryParams,
};
