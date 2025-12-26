"use strict";

const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const pool = require("../db");

const router = express.Router();

function normPhone(s) {
  return String(s || "").replace(/[^\d]/g, "");
}
function maskLoginId(id) {
  if (!id) return "";
  if (id.length <= 2) return id[0] + "*";
  return id.slice(0, 2) + "*".repeat(Math.max(2, id.length - 4)) + id.slice(-2);
}

/**
 * POST /api/recover/login-id
 * body: { name, phone }
 * 응답: { ok:true, login_id_masked?:string }
 */
router.post("/login-id", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const phone = normPhone(req.body?.phone || "");
    if (!name || !phone) return res.status(400).json({ message: "이름/전화번호가 필요합니다." });

    const r = await pool.query(
      `select login_id
         from app_users
        where name = $1
          and regexp_replace(coalesce(phone,''), '[^0-9]', '', 'g') = $2
        limit 1`,
      [name, phone]
    );

    // ✅ 존재여부로 계정 추측 못하게 "항상 ok:true"
    if (r.rows.length === 0) return res.json({ ok: true });

    return res.json({ ok: true, login_id_masked: maskLoginId(r.rows[0].login_id) });
  } catch (e) {
    console.error("[POST /api/recover/login-id]", e);
    res.status(500).json({ message: e.message });
  }
});

/**
 * POST /api/recover/password/request
 * body: { login_id, name, phone }
 * 개발모드에서는 token을 응답으로 내려줌(나중에 SMS/메일로 대체)
 */
router.post("/password/request", async (req, res) => {
  try {
    const login_id = String(req.body?.login_id || "").trim();
    const name = String(req.body?.name || "").trim();
    const phone = normPhone(req.body?.phone || "");
    if (!login_id || !name || !phone) {
      return res.status(400).json({ message: "아이디/이름/전화번호가 필요합니다." });
    }

    const r = await pool.query(
      `select id
         from app_users
        where login_id = $1
          and name = $2
          and regexp_replace(coalesce(phone,''), '[^0-9]', '', 'g') = $3
        limit 1`,
      [login_id, name, phone]
    );

    // ✅ 여기서도 존재여부 숨김
    if (r.rows.length === 0) return res.json({ ok: true });

    const userId = r.rows[0].id;
    const token = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6자리 느낌
    const expiresMinutes = 10;

    await pool.query(
      `update app_users
          set reset_token = $1,
              reset_token_expires_at = now() + ($2 || ' minutes')::interval
        where id = $3`,
      [token, String(expiresMinutes), userId]
    );

    // TODO: 여기에 SMS/Email 전송 붙이면 됨
    // 개발모드에서는 편하게 토큰을 내려주자
    if (process.env.NODE_ENV !== "production") {
      return res.json({ ok: true, dev_token: token, expires_minutes: expiresMinutes });
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/recover/password/request]", e);
    res.status(500).json({ message: e.message });
  }
});

/**
 * POST /api/recover/password/confirm
 * body: { login_id, token, new_password }
 */
router.post("/password/confirm", async (req, res) => {
  try {
    const login_id = String(req.body?.login_id || "").trim();
    const token = String(req.body?.token || "").trim().toUpperCase();
    const new_password = String(req.body?.new_password || "");
    if (!login_id || !token || !new_password) {
      return res.status(400).json({ message: "아이디/인증코드/새 비밀번호가 필요합니다." });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ message: "비밀번호는 8자 이상" });
    }

    const r = await pool.query(
      `select id
         from app_users
        where login_id = $1
          and reset_token = $2
          and reset_token_expires_at is not null
          and reset_token_expires_at > now()
        limit 1`,
      [login_id, token]
    );
    if (r.rows.length === 0) {
      return res.status(400).json({ message: "인증코드가 올바르지 않거나 만료되었습니다." });
    }

    const pw_hash = await bcrypt.hash(new_password, 10);

    await pool.query(
      `update app_users
          set pw_hash = $1,
              reset_token = null,
              reset_token_expires_at = null,
              updated_at = now()
        where id = $2`,
      [pw_hash, r.rows[0].id]
    );

    res.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/recover/password/confirm]", e);
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;