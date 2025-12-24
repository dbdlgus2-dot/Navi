"use strict";

const express = require("express");
const pool = require("../db");
const adminOnly = require("../middlewares/adminOnly");

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
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "id가 이상함" });
    }

    const body = req.body || {};

    const role = String(body.role || "USER").toUpperCase();
    const isActive = body.is_active === false ? false : true; // 기본 true

    const paidUntil = body.paid_until || null;
    const lastPaymentAt = body.last_payment_at || null;

    // 정지 사유: 정지일 때만 반영, 활성일 땐 null
    const suspendReason = isActive ? null : (String(body.suspend_reason || "").trim() || null);

    const { rows } = await pool.query(
      `
      update app_users
      set
        role = $1,
        is_active = $2,
        paid_until = $3,
        last_payment_at = $4,

        suspended_at = case
          when $2 = false then coalesce(suspended_at, now())  -- 정지: 없으면 now()
          else null                                           -- 활성: null
        end,

        suspend_reason = case
          when $2 = false then $5  -- 정지: 입력값(없으면 null)
          else null                 -- 활성: null
        end,

        updated_at = now()
      where id = $6
      returning
        id, user_id, login_id, name, phone, email, role, is_active,
        joined_at, last_payment_at, paid_until, suspended_at, suspend_reason
      `,
      [role, isActive, paidUntil, lastPaymentAt, suspendReason, id]
    );

    if (!rows.length) return res.status(404).json({ message: "유저 없음" });
    return res.json({ ok: true, user: rows[0] });
  } catch (e) {
    console.error("[PATCH /api/admin/users/:id ERROR]", e);
    return res.status(500).json({ message: e.message });
  }
});

module.exports = router;