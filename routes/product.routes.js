const router = require("express").Router();
const ctrl = require("../controllers/product.controller");

router.get("/", ctrl.getAll); // GET /api/products
router.get("/:id", ctrl.getById); // GET /api/products/:id
router.post("/", ctrl.create); // POST /api/products
// … другие роуты …

module.exports = router;
