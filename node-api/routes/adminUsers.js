"use strict";

const express = require("express");
const pool = require("../db");
const adminOnly = require("../middlewares/adminOnly");
const bcrypt = require("bcryptjs");

const router = express.Router();
router.use(adminOnly);

/**
 * GET /api/admin/users?q=
 * - name / phone / login_id 검색
 * - 최신순 50개
 */
router.get("/", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const like = `%${q}%`;

    const { rows } = await pool.query(
      `
      select
        id,
        user_id,
        login_id,
        name,
        phone,
        email,
        role,
        is_active,
        joined_at,
        last_payment_at,
        paid_until,
        suspended_at,
        suspend_reason
      from app_users
      where ($1 = '' or name ilike $2 or phone ilike $2 or login_id ilike $2)
      order by id desc
      limit 50
      `,
      [q, like]
    );

    return res.json(rows);
  } catch (e) {
    console.error("[GET /api/admin/users ERROR]", e);
    return res.status(500).json({ message: e.message });
  }
});

/**
 * PATCH /api/admin/users/:id
 * body: { role, is_active, paid_until, last_payment_at, suspend_reason }
 *
 * 규칙
 * - is_active=false면 suspended_at=now() (기존 값 있으면 유지)
 * - is_active=true면 suspended_at/suspend_reason 모두 null 처리(정지 해제)
 * - 날짜는 'YYYY-MM-DD' 또는 null
 */
router.patch("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "id가 이상함" });

    const b = req.body || {};

    // 기본정보
    const login_id = b.login_id ? String(b.login_id).trim() : null;
    const name     = b.name ? String(b.name).trim() : null;
    const phone    = b.phone ? String(b.phone).trim() : null;
    const email    = b.email ? String(b.email).trim() : null;

    // 권한/상태
    const role = String(b.role ?? "USER").toUpperCase();
    const is_active = b.is_active ?? true;

    // 날짜
    const paid_until = b.paid_until || null;            // 'YYYY-MM-DD'
    const last_payment_at = b.last_payment_at || null;  // 'YYYY-MM-DD'

    // 정지
    let suspended_at = b.suspended_at ?? null;
    let suspend_reason = b.suspend_reason ?? null;

    if (is_active === false && !suspended_at) suspended_at = new Date();
    if (is_active === true) {
      suspended_at = null;
      suspend_reason = null;
    }

    // 비번(옵션) - 있으면 해시해서 저장
    let pw_hash = null;
    if (b.password && String(b.password).trim()) {
      const pw = String(b.password);
      if (pw.length < 8) return res.status(400).json({ message: "비밀번호는 8자 이상" });
      pw_hash = await bcrypt.hash(pw, 10);
    }

    const sql = `
      update app_users
      set
        login_id = coalesce($1, login_id),
        name = coalesce($2, name),
        phone = $3,
        email = $4,

        role = $5,
        is_active = $6,
        paid_until = $7,
        last_payment_at = $8,
        suspended_at = $9,
        suspend_reason = $10,

        pw_hash = coalesce($11, pw_hash),
        updated_at = now()
      where id = $12
      returning
        id, user_id, login_id, name, phone, email, role, is_active,
        joined_at, last_payment_at, paid_until, suspended_at, suspend_reason
    `;

    const r = await pool.query(sql, [
      login_id,
      name,
      phone,
      email,
      role,
      is_active,
      paid_until,
      last_payment_at,
      suspended_at,
      suspend_reason,
      pw_hash,
      id,
    ]);

    if (r.rows.length === 0) return res.status(404).json({ message: "유저 없음" });
    res.json({ ok: true, user: r.rows[0] });
  } catch (e) {
    console.error("[PATCH /api/admin/users/:id ERROR]", e);
    if (e.code === "23505") return res.status(409).json({ message: "이미 존재하는 로그인 ID" });
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;