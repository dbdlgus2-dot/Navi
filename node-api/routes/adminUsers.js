"use strict";

const express = require("express");
const pool = require("../db");
const adminOnly = require("../middlewares/adminOnly");
const bcrypt = require("bcryptjs");

const router = express.Router();

/**
 * 1. 관리자 복귀 API (adminOnly 미들웨어보다 위에 있어야 함!)
 * - 대리 로그인 중에는 권한이 'USER'이므로 adminOnly를 통과할 수 없기 때문입니다.
 */
router.post('/exit-impersonate', async (req, res) => {
  try {
    // 세션에 저장해둔 원래 관리자 ID가 있는지 확인
    if (!req.session.adminId) {
      return res.status(400).json({ message: "복귀할 관리자 정보가 없습니다." });
    }

    // 저장해둔 adminId로 관리자 정보 재조회
    const { rows } = await pool.query("SELECT * FROM app_users WHERE id = $1", [req.session.adminId]);
    const adminUser = rows[0];

    if (!adminUser) {
      return res.status(404).json({ message: "관리자 정보를 찾을 수 없습니다." });
    }

    // 세션을 다시 관리자 정보로 복구
    req.session.user = {
      id: adminUser.id,
      user_id: adminUser.user_id,
      login_id: adminUser.login_id,
      role: adminUser.role,
      name: adminUser.name
    };

    // 복귀용 임시 ID 삭제
    delete req.session.adminId;

    req.session.save((err) => {
      if (err) throw err;
      res.json({ success: true, redirectUrl: "/admin" });
    });
  } catch (e) {
    console.error("[EXIT-IMPERSONATE ERROR]", e);
    res.status(500).json({ message: "복귀 중 오류 발생" });
  }
});

// --- 이 아래부터는 진짜 관리자(ADMIN)만 접근 가능하도록 설정 ---
router.use(adminOnly);

/**
 * GET /api/admin/users
 */
router.get("/", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const like = `%${q}%`;

    const { rows } = await pool.query(
      `select id, user_id, login_id, name, phone, email, role, is_active,
              joined_at, last_payment_at, paid_until, suspended_at, suspend_reason
       from app_users
       where ($1 = '' or name ilike $2 or phone ilike $2 or login_id ilike $2)
       order by id desc limit 50`,
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
 */
router.patch("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "ID 오류" });

    const b = req.body || {};
    const login_id = b.login_id ? String(b.login_id).trim() : null;
    const name = b.name ? String(b.name).trim() : null;
    const phone = b.phone ? String(b.phone).trim() : null;
    const email = b.email ? String(b.email).trim() : null;
    const role = String(b.role ?? "USER").toUpperCase();
    const is_active = b.is_active ?? true;
    const paid_until = b.paid_until || null;
    const last_payment_at = b.last_payment_at || null;

    let suspended_at = b.suspended_at ?? null;
    let suspend_reason = b.suspend_reason ?? null;

    if (is_active === false && !suspended_at) suspended_at = new Date();
    if (is_active === true) { suspended_at = null; suspend_reason = null; }

    let pw_hash = null;
    if (b.password && String(b.password).trim()) {
      const pw = String(b.password);
      if (pw.length < 8) return res.status(400).json({ message: "비밀번호 8자 이상" });
      pw_hash = await bcrypt.hash(pw, 10);
    }

    const sql = `
      update app_users set
        login_id = coalesce($1, login_id), name = coalesce($2, name), phone = $3, email = $4,
        role = $5, is_active = $6, paid_until = $7, last_payment_at = $8,
        suspended_at = $9, suspend_reason = $10, pw_hash = coalesce($11, pw_hash), updated_at = now()
      where id = $12
      returning *`;

    const r = await pool.query(sql, [login_id, name, phone, email, role, is_active, paid_until, last_payment_at, suspended_at, suspend_reason, pw_hash, id]);
    if (r.rows.length === 0) return res.status(404).json({ message: "유저 없음" });
    res.json({ ok: true, user: r.rows[0] });
  } catch (e) {
    console.error("[PATCH /api/admin/users ERROR]", e);
    res.status(500).json({ message: e.message });
  }
});

/**
 * POST /api/admin/impersonate/:userId
 */
router.post('/impersonate/:userId', async (req, res) => {
  try {
    // 관리자 본인이 본인 계정으로 대리 로그인하는 것 방지 (선택 사항)
    const targetId = Number(req.params.userId);
    if (req.session.user.id === targetId) {
      return res.status(400).json({ message: "본인 계정입니다." });
    }

    const { rows } = await pool.query("SELECT * FROM app_users WHERE id = $1", [targetId]);
    const targetUser = rows[0];
    if (!targetUser) return res.status(404).json({ message: "유저 없음" });

    // 1. 현재 관리자 ID를 복귀용으로 저장
    req.session.adminId = req.session.user.id;

    // 2. 세션을 대상 유저로 교체
    req.session.user = {
      id: targetUser.id,
      user_id: targetUser.user_id,
      login_id: targetUser.login_id,
      role: targetUser.role,
      name: targetUser.name,
      isImpersonated: true 
    };

    req.session.save(() => {
      res.json({ 
        success: true, 
        message: `${targetUser.name} 님으로 접속합니다.`, 
        redirectUrl: "/records" 
      });
    });
  } catch (err) {
    console.error("[IMPERSONATE ERROR]", err);
    res.status(500).json({ message: "서버 오류" });
  }
});

module.exports = router;