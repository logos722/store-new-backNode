const Order = require("../models/order.model");
const nodemailer = require("nodemailer");
const { normalizeItemsImages } = require("../utils/normalizeImageUrl");

/**
 * Валидация данных заказа
 * @param {Object} data - Данные заказа
 * @returns {Object} - {isValid: boolean, errors: string[]}
 */
const validateOrderData = (data) => {
  const errors = [];

  // Проверка items
  if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
    errors.push("Items must be a non-empty array");
  } else {
    // Проверка каждого item
    data.items.forEach((item, index) => {
      if (!item.id) errors.push(`Item ${index}: missing id`);
      if (!item.name || typeof item.name !== "string")
        errors.push(`Item ${index}: invalid name`);
      if (typeof item.price !== "number" || item.price < 0)
        errors.push(`Item ${index}: invalid price`);
      if (
        !item.quantity ||
        typeof item.quantity !== "number" ||
        item.quantity < 1
      )
        errors.push(`Item ${index}: invalid quantity`);
    });
  }

  // Проверка total
  if (typeof data.total !== "number" || data.total < 0) {
    errors.push("Invalid total");
  }

  // Проверка customerInfo
  if (!data.customerInfo || typeof data.customerInfo !== "object") {
    errors.push("CustomerInfo is required");
  } else {
    const { email, name, phone, city, privacyConsent } = data.customerInfo;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push("Invalid email");
    }
    if (!name || typeof name !== "string" || name.trim().length < 2) {
      errors.push("Invalid name");
    }
    if (!phone || typeof phone !== "string" || phone.length < 10) {
      errors.push("Invalid phone");
    }
    if (!city || typeof city !== "string" || city.trim().length < 2) {
      errors.push("Invalid city");
    }
    if (!privacyConsent) {
      errors.push("Privacy consent is required");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Создание транспортера nodemailer с обработкой ошибок
 * @returns {Object} - nodemailer transporter
 */
const createMailTransporter = () => {
  // Проверка наличия всех необходимых ENV переменных
  const requiredEnvVars = [
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASS",
    "EMAIL_FROM",
    "EMAIL_TO",
  ];

  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName]
  );

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(", ")}`
    );
  }

  // Определяем secure на основе порта или ENV переменной
  const port = Number(process.env.SMTP_PORT);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: port,
    secure: secure, // true для 465 (SSL), false для 587 (TLS/STARTTLS)
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    // Таймауты для предотвращения зависания
    connectionTimeout: 10000, // 10 секунд
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });
};

/**
 * Преобразование items из payload фронтенда в формат модели Order
 * @param {Array} items - Массив товаров с фронтенда
 * @returns {Array} - Преобразованный массив для модели
 */
const transformItemsForModel = (items) => {
  return items.map((item) => ({
    product: {
      id: item.id,
      name: item.name,
      price: item.price,
      image: item.image || "",
    },
    quantity: item.quantity,
  }));
};

/**
 * Генерация HTML для письма с заказом
 * @param {Object} order - Объект заказа из БД
 * @param {Array} items - Массив товаров (оригинальный из payload)
 * @param {Number} totalPrice - Итоговая сумма
 * @param {Object} customerInfo - Информация о клиенте
 * @returns {String} - HTML письма
 */
const generateOrderEmailHtml = (order, items, totalPrice, customerInfo) => {
  // Генерируем HTML-список товаров
  const itemsHtml = items
    .map((item) => {
      const itemTotal = item.quantity * item.price;
      return `
        <li style="margin-bottom: 10px;">
          <strong>${item.name}</strong><br/>
          Количество: ${item.quantity} × ${
        item.price
      } ₽ = <strong>${itemTotal} ₽</strong>
          ${
            item.image
              ? `<br/><img src="${item.image}" alt="${item.name}" style="max-width: 100px; margin-top: 5px;" />`
              : ""
          }
        </li>
      `;
    })
    .join("");

  // Формируем полный HTML письма с улучшенным стилем
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        h2 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        h3 { color: #34495e; margin-top: 20px; }
        .info-block { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .info-block p { margin: 5px 0; }
        ul { list-style: none; padding: 0; }
        ul li { background: #fff; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 5px; }
        .total { font-size: 1.2em; color: #27ae60; font-weight: bold; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #7f8c8d; font-size: 0.9em; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>🛒 Новый заказ №${order._id}</h2>
        
        <div class="info-block">
          <h3>📋 Информация о клиенте:</h3>
          <p><strong>Имя:</strong> ${customerInfo.name}</p>
          <p><strong>Телефон:</strong> ${customerInfo.phone}</p>
          <p><strong>Email:</strong> ${customerInfo.email}</p>
          <p><strong>Город:</strong> ${customerInfo.city}</p>
          ${
            customerInfo.comment
              ? `<p><strong>Комментарий:</strong> ${customerInfo.comment}</p>`
              : ""
          }
        </div>

        <h3>🛍️ Товары в заказе:</h3>
        <ul>${itemsHtml}</ul>

        <div class="info-block">
          <p class="total">💰 Итоговая сумма: ${totalPrice} ₽</p>
          <p><strong>⏰ Время заказа:</strong> ${new Date(
            order.createdAt
          ).toLocaleString("ru-RU", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}</p>
        </div>

        <div class="footer">
          <p>Это автоматическое уведомление о новом заказе. Пожалуйста, свяжитесь с клиентом в ближайшее время.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

exports.createOrder = async (req, res) => {
  let transporter;

  try {
    const { items, totalPrice, customerInfo } = req.body;

    // 1) Валидация входных данных
    const validation = validateOrderData(req.body);
    if (!validation.isValid) {
      console.error("Validation errors:", validation.errors);
      return res.status(400).json({
        error: "Invalid order data",
        details: validation.errors,
      });
    }

    // 2) Нормализуем URL изображений
    // Преобразуем внутренние URL (localhost:5000, backend:5000) в публичные
    // Это необходимо для корректного отображения изображений в email
    const normalizedItems = normalizeItemsImages(items, {
      publicUrl: process.env.PUBLIC_URL || "https://gelionaqua.ru",
    });

    // 3) Преобразуем items в формат модели Order
    // Фронтенд отправляет плоскую структуру, но модель ожидает вложенную
    // Используем нормализованные items для сохранения в БД
    const transformedItems = transformItemsForModel(normalizedItems);

    // 4) Сохраняем заказ в БД
    const order = new Order({
      items: transformedItems,
      totalPrice,
      customerInfo: {
        email: customerInfo.email,
        name: customerInfo.name,
        phone: customerInfo.phone,
        city: customerInfo.city,
        comment: customerInfo.comment || "",
      },
    });

    await order.save();
    console.log(`✅ Order saved to DB: ${order._id}`);

    // 5) Создаем транспортер для отправки email
    try {
      transporter = createMailTransporter();
    } catch (transporterError) {
      console.error(
        "❌ Failed to create mail transporter:",
        transporterError.message
      );
      // Заказ сохранен, но email не отправлен - это не критичная ошибка
      return res.status(201).json({
        message: "Order created but email notification failed",
        orderId: order._id,
        warning: "Email configuration error",
      });
    }

    // 6) Генерируем HTML письма
    // Используем нормализованные items с публичными URL изображений
    const mailHtml = generateOrderEmailHtml(
      order,
      normalizedItems,
      totalPrice,
      customerInfo
    );

    // 7) Отправляем письмо владельцу
    try {
      const emailInfo = await transporter.sendMail({
        from: `"Интернет-магазин" <${process.env.EMAIL_FROM}>`,
        to: process.env.EMAIL_TO,
        subject: `🛒 Новый заказ №${order._id} от ${customerInfo.name}`,
        html: mailHtml,
        // Опционально: текстовая версия для клиентов без HTML
        text: `
Новый заказ №${order._id}

Клиент: ${customerInfo.name}
Телефон: ${customerInfo.phone}
Email: ${customerInfo.email}
Город: ${customerInfo.city}
${customerInfo.comment ? `Комментарий: ${customerInfo.comment}` : ""}

Товары:
${normalizedItems
  .map(
    (item) =>
      `${item.name} — ${item.quantity} × ${item.price} ₽ = ${
        item.quantity * item.price
      } ₽`
  )
  .join("\n")}

Итого: ${totalPrice} ₽
Время заказа: ${new Date(order.createdAt).toLocaleString("ru-RU")}
        `,
      });
    } catch (emailError) {
      // Заказ сохранен, но email не отправлен
      return res.status(201).json({
        message: "Order created but email notification failed",
        orderId: order._id,
        warning: "Failed to send email notification",
      });
    }

    // 8) Успешный ответ
    return res.status(201).json({
      success: true,
      message: "Order created and email sent successfully",
      orderId: order._id,
      orderNumber: order._id,
    });
  } catch (err) {
    // Обработка неожиданных ошибок
    // Различаем типы ошибок для более информативных ответов
    if (err.name === "ValidationError") {
      return res.status(400).json({
        error: "Database validation error",
        details: Object.values(err.errors).map((e) => e.message),
      });
    }

    if (err.name === "MongoError" || err.name === "MongoServerError") {
      return res.status(503).json({
        error: "Database connection error",
        message: "Please try again later",
      });
    }

    // Общая ошибка сервера
    return res.status(500).json({
      error: "Failed to create order",
      message: "An unexpected error occurred",
    });
  }
};
