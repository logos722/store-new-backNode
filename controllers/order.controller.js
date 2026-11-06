const Order = require("../models/order.model");
const nodemailer = require("nodemailer");
const { normalizeItemsImages } = require("../utils/normalizeImageUrl");
const ExcelJS = require("exceljs");

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
 * Генерация Excel (xlsx) файла с заказом
 * @param {Object} order - Объект заказа из БД
 * @param {Array} items - Массив товаров (оригинальный из payload)
 * @param {Number} totalPrice - Итоговая сумма
 * @param {Object} customerInfo - Информация о клиенте
 * @returns {Promise<Buffer>} - Buffer с xlsx файлом
 */
const generateOrderExcelFile = async (
  order,
  items,
  totalPrice,
  customerInfo
) => {
  try {
    // Создаем новую рабочую книгу Excel
    const workbook = new ExcelJS.Workbook();

    // Устанавливаем метаданные документа для лучшей идентификации
    workbook.creator = "Интернет-магазин";
    workbook.created = new Date();
    workbook.modified = new Date();

    // Добавляем лист с заказом
    const worksheet = workbook.addWorksheet(`Заказ №${order._id}`, {
      properties: {
        defaultRowHeight: 20,
      },
      pageSetup: {
        paperSize: 9, // A4
        orientation: "portrait",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
    });

    // Определяем колонки с заголовками и шириной
    // Структура соответствует приложенному скриншоту
    worksheet.columns = [
      { header: "№", key: "number", width: 5 },
      { header: "Артикул", key: "article", width: 15 },
      { header: "Товар", key: "name", width: 40 },
      { header: "Кол.", key: "quantity", width: 8 },
      { header: "Ед.", key: "unit", width: 8 },
      { header: "Цена", key: "price", width: 12 },
      { header: "Сумма", key: "sum", width: 15 },
    ];

    // Стилизация заголовков таблицы
    const headerRow = worksheet.getRow(1);
    headerRow.font = {
      name: "Arial",
      size: 11,
      bold: true,
    };
    headerRow.alignment = {
      vertical: "middle",
      horizontal: "center",
    };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" }, // Светло-серый фон
    };
    headerRow.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };

    // Заполняем строки с товарами
    items.forEach((item, index) => {
      const itemTotal = item.quantity * item.price;

      const row = worksheet.addRow({
        number: index + 1,
        article: "", // Артикул = ID товара
        name: item.name,
        quantity: item.quantity,
        unit: "шт", // Единица измерения - штуки
        price: item.price.toFixed(2),
        sum: itemTotal.toFixed(2),
      });

      // Стилизация строк с данными
      row.font = {
        name: "Arial",
        size: 10,
      };
      row.alignment = {
        vertical: "middle",
        horizontal: "left",
      };

      // Выравнивание для числовых колонок
      row.getCell("quantity").alignment = { horizontal: "center" };
      row.getCell("unit").alignment = { horizontal: "center" };
      row.getCell("price").alignment = { horizontal: "right" };
      row.getCell("sum").alignment = { horizontal: "right" };

      // Добавляем границы для всех ячеек
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    });

    // Добавляем строку с итоговой суммой
    const lastRowNumber = worksheet.rowCount + 1;
    const totalRow = worksheet.getRow(lastRowNumber);

    // Объединяем ячейки для текста "Итого:"
    worksheet.mergeCells(`A${lastRowNumber}:F${lastRowNumber}`);

    totalRow.getCell(1).value = "Итого:";
    totalRow.getCell(1).alignment = {
      vertical: "middle",
      horizontal: "right",
    };
    totalRow.getCell(1).font = {
      name: "Arial",
      size: 12,
      bold: true,
    };

    // Итоговая сумма в последней колонке
    totalRow.getCell(7).value = totalPrice.toFixed(2);
    totalRow.getCell(7).alignment = {
      vertical: "middle",
      horizontal: "right",
    };
    totalRow.getCell(7).font = {
      name: "Arial",
      size: 12,
      bold: true,
      color: { argb: "FF008000" }, // Зеленый цвет
    };

    // Применяем границы к строке "Итого:"
    totalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (colNumber <= 7) {
        cell.border = {
          top: { style: "medium" },
          left: { style: "thin" },
          bottom: { style: "medium" },
          right: { style: "thin" },
        };
      }
    });

    // Добавляем информацию о клиенте в конец таблицы (после пустой строки)
    const infoStartRow = lastRowNumber + 2;

    worksheet.mergeCells(`A${infoStartRow}:G${infoStartRow}`);
    worksheet.getCell(`A${infoStartRow}`).value = "Информация о клиенте:";
    worksheet.getCell(`A${infoStartRow}`).font = {
      name: "Arial",
      size: 11,
      bold: true,
    };

    // Данные клиента
    const customerData = [
      { label: "Имя:", value: customerInfo.name },
      { label: "Телефон:", value: customerInfo.phone },
      { label: "Email:", value: customerInfo.email },
      { label: "Город:", value: customerInfo.city },
    ];

    // Добавляем комментарий, если он есть
    if (customerInfo.comment) {
      customerData.push({ label: "Комментарий:", value: customerInfo.comment });
    }

    // Добавляем время заказа
    customerData.push({
      label: "Время заказа:",
      value: new Date(order.createdAt).toLocaleString("ru-RU", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    });

    // Заполняем информацию о клиенте
    customerData.forEach((data, index) => {
      const rowNum = infoStartRow + 1 + index;
      worksheet.mergeCells(`A${rowNum}:B${rowNum}`);
      worksheet.mergeCells(`C${rowNum}:G${rowNum}`);

      worksheet.getCell(`A${rowNum}`).value = data.label;
      worksheet.getCell(`A${rowNum}`).font = {
        name: "Arial",
        size: 10,
        bold: true,
      };

      worksheet.getCell(`C${rowNum}`).value = data.value;
      worksheet.getCell(`C${rowNum}`).font = {
        name: "Arial",
        size: 10,
      };
    });

    // Генерируем буфер с xlsx файлом
    // writeBuffer() возвращает Promise<Buffer>
    const buffer = await workbook.xlsx.writeBuffer();

    return buffer;
  } catch (error) {
    // Логируем ошибку и пробрасываем дальше для обработки в вызывающем коде
    console.error("Order notification operation failed");
    throw new Error(`Failed to generate Excel file: ${error.message}`);
  }
};

exports.createOrder = async (req, res) => {
  let transporter;

  try {
    const { items, customerInfo } = req.body;
    const totalPrice = req.body.total;

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
      total: totalPrice,
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
      console.error("Order notification operation failed");
      // Заказ сохранен, но email не отправлен - это не критичная ошибка
      return res.status(201).json({
        message: "Order created but email notification failed",
        orderId: order._id,
        warning: "Email configuration error",
      });
    }

    // 6) Генерируем Excel файл с заказом
    // Используем нормализованные items с публичными URL изображений
    let excelBuffer;
    try {
      excelBuffer = await generateOrderExcelFile(
        order,
        normalizedItems,
        totalPrice,
        customerInfo
      );
      console.log(
        `✅ Excel file generated successfully (${excelBuffer.length} bytes)`
      );
    } catch (excelError) {
      console.error("Order notification operation failed");
      // Заказ сохранен, но Excel файл не создан - это не критичная ошибка
      return res.status(201).json({
        message: "Order created but Excel file generation failed",
        orderId: order._id,
        warning: "Failed to generate Excel attachment",
      });
    }

    // 7) Отправляем письмо владельцу с прикрепленным Excel файлом
    try {
      const emailInfo = await transporter.sendMail({
        from: `"Интернет-магазин" <${process.env.EMAIL_FROM}>`,
        to: process.env.EMAIL_TO,
        subject: `🛒 Новый заказ №${order._id} от ${customerInfo.name}`,
        // HTML тело письма с краткой информацией
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c3e50;">🛒 Новый заказ №${order._id}</h2>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <p><strong>Клиент:</strong> ${customerInfo.name}</p>
              <p><strong>Телефон:</strong> ${customerInfo.phone}</p>
              <p><strong>Email:</strong> ${customerInfo.email}</p>
              <p><strong>Город:</strong> ${customerInfo.city}</p>
              ${
                customerInfo.comment
                  ? `<p><strong>Комментарий:</strong> ${customerInfo.comment}</p>`
                  : ""
              }
            </div>
            <div style="background: #e8f5e9; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <p style="font-size: 1.2em; color: #27ae60; font-weight: bold;">
                💰 Итоговая сумма: ${totalPrice} ₽
              </p>
              <p><strong>Количество товаров:</strong> ${
                normalizedItems.length
              }</p>
              <p><strong>Время заказа:</strong> ${new Date(
                order.createdAt
              ).toLocaleString("ru-RU", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}</p>
            </div>
            <p style="color: #7f8c8d; font-size: 0.9em; border-top: 1px solid #ddd; padding-top: 15px; margin-top: 20px;">
              📎 Подробная информация о заказе находится во вложенном Excel файле.
            </p>
          </div>
        `,
        // Текстовая версия для клиентов без HTML
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

Подробная информация о заказе находится во вложенном Excel файле.
        `,
        // Прикрепляем Excel файл к письму
        attachments: [
          {
            filename: `Заказ_${order._id}_${
              new Date().toISOString().split("T")[0]
            }.xlsx`,
            content: excelBuffer,
            contentType:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          },
        ],
      });

      console.log(`✅ Email sent successfully: ${emailInfo.messageId}`);
    } catch (emailError) {
      console.error("Order notification operation failed");
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
