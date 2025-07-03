const Order = require("../models/order.model");
const nodemailer = require("nodemailer");

exports.createOrder = async (req, res) => {
  try {
    const { items, total, customerInfo } = req.body;

    // 1) сохраняем заказ в БД (опционально)
    const order = new Order({ items, total, customerInfo });
    await order.save();

    // 2) формируем письмо
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false, // MailHog не использует TLS
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Генерируем HTML-список товаров
    const itemsHtml = items
      .map(
        (i) =>
          `<li>
         ${i.product.name} — ${i.quantity} × ${i.product.price} ₽ = ${
            i.quantity * i.product.price
          } ₽
       </li>`
      )
      .join("");

    const mailHtml = `
      <h2>Новый заказ №${order._id}</h2>
      <p><strong>Клиент:</strong> ${customerInfo.name}, ${
      customerInfo.phone
    }, ${customerInfo.email}</p>
      <p><strong>Город:</strong> ${customerInfo.city}</p>
      ${
        customerInfo.comment
          ? `<p><strong>Комментарий:</strong> ${customerInfo.comment}</p>`
          : ""
      }
      <h3>Товары:</h3>
      <ul>${itemsHtml}</ul>
      <p><strong>Итог:</strong> ${total} ₽</p>
      <p>Время заказа: ${order.createdAt.toLocaleString()}</p>
    `;

    // 3) отправляем письмо владельцу
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: process.env.EMAIL_TO,
      subject: `Новый заказ №${order._id}`,
      html: mailHtml,
    });

    return res
      .status(200)
      .json({ message: "Order received", orderId: order._id });
  } catch (err) {
    console.error("Create order error:", err);
    return res.status(500).json({ error: "Failed to create order" });
  }
};
