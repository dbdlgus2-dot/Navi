"use strict";

require("dotenv").config();
const path = require("path");
const express = require("express");
const session = require("express-session");

const authRoutes = require("./routes/auth");
const repairRoutes = require("./routes/repairs");
const adminOnly = require("./middlewares/adminOnly");

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

const WEB_DIR = path.resolve(__dirname, "../web");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ 세션 (반드시 라우트보다 위)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "navi-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false, // 로컬 http는 false, https 배포면 true
    },
  })
);

app.use("/api/admin", require("./routes/adminUsers"));
app.use("/api/admin", require("./routes/admin")); 
app.use("/api/recover", require("./routes/recover"));
// 정적 서빙
app.use(express.static(WEB_DIR));

// 페이지 라우팅
app.get("/", (req, res) => res.sendFile(path.join(WEB_DIR, "login.html")));
app.get("/login", (req, res) => res.sendFile(path.join(WEB_DIR, "login.html")));
app.get("/register", (req, res) => res.sendFile(path.join(WEB_DIR, "register.html")));
app.get("/records", (req, res) => res.sendFile(path.join(WEB_DIR, "records.html")));
app.get("/admin", adminOnly, (req, res) => res.sendFile(path.join(WEB_DIR, "admin.html")));
app.get("/mypage", (req, res) =>  res.sendFile(path.join(WEB_DIR, "mypage.html")));
app.get("/recover", (req, res) => res.sendFile(path.join(WEB_DIR, "recover.html")));

// API
app.use("/api", authRoutes);
app.use("/api/repairs", repairRoutes);

// DB 헬스
app.get("/api/health/db", async (req, res) => {
  const pool = require("./db");
  try {
    await pool.query("select 1");
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`Server listening: http://${HOST}:${PORT}`);
  console.log(`Serving static from: ${WEB_DIR}`);
});
