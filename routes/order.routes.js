const router = require("express").Router();
const ctrl = require("../controllers/order.controller");

router.post("/", ctrl.createOrder);

module.exports = router;
