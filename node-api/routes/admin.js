"use strict";

const express = require("express");
const adminOnly = require("../middlewares/adminOnly");

const router = express.Router();

// /api/admin 아래는 전부 관리자만
router.use(adminOnly);

// /api/admin/users
router.use("/users", require("./adminUsers"));

module.exports = router;