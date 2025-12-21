"use strict";

const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../db");

const router = express.Router();

/**
 * app_users (스샷 기준)
 * - id bigserial
 * - user_id varchar(50) NOT NULL
 * - login_id varchar(50) NOT NULL
 * - pw_hash text NOT NULL
 * - name varchar(100) NOT NULL
 * - phone/email nullable
 * - is_active bool default true
 */

router.post("/register", async (req, res) => {
  try {
    const { login_id, password, name, phone, email } = req.body || {};
    if (!login_id || !password || !name) {
      return res.status(400).json({ message: "필수값 누락(login_id/password/name)" });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ message: "비밀번호는 8자 이상" });
    }

    const pw_hash = await bcrypt.hash(password, 10);

    // ✅ user_id NOT NULL 대응 (충분히 유니크)
    const user_id = "U" + Date.now();

    const r = await pool.query(
      `insert into app_users (user_id, login_id, pw_hash, name, phone, email)
       values ($1,$2,$3,$4,$5,$6)
       returning id, user_id, login_id, name`,
      [user_id, login_id, pw_hash, name, phone || null, email || null]
    );

    return res.json({ ok: true, user: r.rows[0] });
  } catch (e) {
    console.error("[/api/register ERROR]", e);
    if (e.code === "23505") return res.status(409).json({ message: "이미 존재하는 로그인 ID" });
    return res.status(500).json({ message: e.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { login_id, password } = req.body || {};
    if (!login_id || !password) {
      return res.status(400).json({ message: "login_id/password 필요" });
    }

    const r = await pool.query(
      `select id, user_id, login_id, pw_hash, name, is_active
       from app_users
       where login_id=$1`,
      [login_id]
    );

    if (r.rows.length === 0) {
      return res.status(401).json({ message: "아이디 또는 비밀번호가 틀림" });
    }

    const user = r.rows[0];
    if (user.is_active === false) {
      return res.status(403).json({ message: "비활성 계정입니다." });
    }

    const ok = await bcrypt.compare(password, user.pw_hash);
    if (!ok) {
      return res.status(401).json({ message: "아이디 또는 비밀번호가 틀림" });
    }

    // ✅ 세션에 app_users.id 저장 (핵심)
    req.session.user = {
      id: user.id,          // ✅ PK
      user_id: user.user_id,
      login_id: user.login_id,
      name: user.name,
    };

    return res.json({ ok: true });
  } catch (e) {
    console.error("[/api/login ERROR]", e);
    return res.status(500).json({ message: e.message });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get("/me", (req, res) => {
  res.json({ ok: true, user: req.session?.user || null });
});

module.exports = router;