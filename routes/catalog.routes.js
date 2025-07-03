const router = require("express").Router();
const ctrl = require("../controllers/catalog.controller");

router.get("/:category", ctrl.getByCategory);

module.exports = router;
