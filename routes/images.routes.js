const router = require("express").Router();
const ctrl = require("../controllers/images.controller");

router.get("/image/:path", ctrl.getImageUrl);

module.exports = router;
