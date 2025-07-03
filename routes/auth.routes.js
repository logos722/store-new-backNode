const router = require("express").Router();
const ctrl = require("../controllers/product.controller");

router.get("/auth", ctrl.getAll);
router.post("/auth", ctrl.create);
// router.get('/:id', …)  router.put('/:id', …)  router.delete('/:id', …)

module.exports = router;
