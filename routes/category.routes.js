const router = require("express").Router();
const ctrl = require("../controllers/category.controller");

router.get("/", ctrl.list); // GET /api/categories

module.exports = router;
