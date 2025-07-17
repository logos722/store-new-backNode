const router = require("express").Router();
const { body } = require("express-validator");
const ctrl = require("../controllers/auth.controller");
const authMiddleware = require("../middleware/auth.middleware");

// Регистрация
router.post(
  "/register",
  [
    body("email").isEmail().withMessage("Некорректный email"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Пароль минимум 6 символов"),
    body("name").notEmpty().withMessage("Введите имя"),
  ],
  ctrl.register
);

// Логин
router.post(
  "/login",
  [body("email").isEmail(), body("password").notEmpty()],
  ctrl.login
);

// Получить свой профиль
router.get("/me", authMiddleware, ctrl.me);

module.exports = router;
