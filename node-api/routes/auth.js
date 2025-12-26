"use strict";

const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../db");

const router = express.Router();

function formatYMD(date) {
  if (!date) return "";
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

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

    // ✅ 회원가입 insert
    const r = await pool.query(
  `insert into app_users (user_id, login_id, pw_hash, name, phone, email, joined_at, last_payment_at, paid_until, is_active)
   values ($1,$2,$3,$4,$5,$6, CURRENT_DATE, CURRENT_DATE, (CURRENT_DATE + INTERVAL '30 days')::date, true)
   returning id, user_id, login_id, name, joined_at, paid_until`,
  [user_id, login_id, pw_hash, name, phone || null, email || null]
);

    return res.json({ ok: true, user: r.rows[0] });
  } catch (e) {
    console.error("[/api/register ERROR]", e);
    if (e.code === "23505") return res.status(409).json({ message: "이미 존재하는 로그인 ID 입니다. 다른아이디 사용해주세요" });
    return res.status(500).json({ message: e.message });
  }
});

// ✅ 로그인
router.post("/login", async (req, res) => {
  try {
    const { login_id, password } = req.body || {};

    const r = await pool.query(
      `select id, user_id, login_id, pw_hash, name,
              is_active, role, joined_at, paid_until, suspend_reason
       from app_users
       where login_id=$1`,
      [login_id]
    );

    if (r.rows.length === 0) {
      return res.status(401).json({ message: "아이디 또는 비밀번호가 틀립니다. 확인해주세요." });
    }

    const user = r.rows[0];

    const ok = await bcrypt.compare(password, user.pw_hash);
    if (!ok) {
      return res.status(401).json({ message: "아이디 또는 비밀번호가 틀립니다. 확인해주세요." });
    }

    // ✅ 여기!! (async 함수 안)
    const expireCheck = await pool.query(
      `
      select
        (coalesce(paid_until, (joined_at + interval '30 days')::date)) as expires_at,
        (coalesce(paid_until, (joined_at + interval '30 days')::date) < current_date) as expired
      from app_users
      where id = $1
      `,
      [user.id]
    );

    const expired = expireCheck.rows[0]?.expired;
    const expiresAt = expireCheck.rows[0]?.expires_at;

    if (expired) {
      await pool.query(
        `
        update app_users
        set is_active = false,
            suspended_at = now(),
            suspend_reason = coalesce(nullif(suspend_reason,''), '사용기간 만료')
        where id = $1
        `,
        [user.id]
      );

      return res.status(403).json({
       message: `사용기간이 만료되어 계정이 비활성화되었습니다. 관리자에게 문의주세요.(만료일: ${formatYMD(expiresAt)})`,
      });
    }

    if (user.is_active === false) {
      return res.status(403).json({ message: "비활성 계정입니다. 관리자에게 문의주세요" });
    }

    req.session.user = {
      id: user.id,
      user_id: user.user_id,
      login_id: user.login_id,
      name: user.name,
      role: String(user.role || "USER").toUpperCase(),
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

// GET /api/me
router.get("/me", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: "로그인 필요" });
  }

  res.json({
    id: req.session.user.id,
    role: req.session.user.role, // ADMIN / USER
  });
});

// ✅ 회원정보수정
router.get("/me/detail", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: "로그인 필요" });

  const r = await pool.query(
    `select id, login_id, name, phone, email, role, is_active, joined_at, paid_until
     from app_users
     where id = $1`,
    [req.session.user.id]
  );
  const u = r.rows[0];
  if (!u) return res.status(404).json({ message: "유저 없음" });

  // 만료 여부(너가 쓰는 정책: paid_until 없으면 joined+30)
  const expiresAt = (u.paid_until ?? null);
  const expired = false; // 필요하면 여기서 계산해서 내려도 됨

  res.json({
    ...u,
    expired,
  });
});

// ===============================
// 내 정보 수정
// PATCH /api/me/profile
// ===============================
router.patch("/me/profile", async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ message: "로그인이 필요합니다." });
    }

    const { name, phone, email } = req.body || {};
    if (!name) {
      return res.status(400).json({ message: "이름은 필수입니다." });
    }

    const r = await pool.query(
      `
      update app_users
      set
        phone = $1,
        email = $2,
        updated_at = now()
      where id = $3
      returning id, login_id, phone, email, role
      `,
      [name, phone || null, email || null, req.session.user.id]
    );

    // 세션에도 반영 (중요)
    req.session.user.name = r.rows[0].name;

    res.json({ ok: true, user: r.rows[0] });
  } catch (e) {
    console.error("[PATCH /api/me/profile]", e);
    res.status(500).json({ message: e.message });
  }
});

// ===============================
// 비밀번호 변경
// PATCH /api/me/password
// ===============================
router.patch("/me/password", async (req, res) => {
  try {
    if (!req.session?.user?.id) {
      return res.status(401).json({ message: "로그인이 필요합니다." });
    }

    const { current_password, new_password } = req.body || {};
    if (!current_password || !new_password) {
      return res.status(400).json({ message: "비밀번호 누락" });
    }

    if (new_password.length < 8) {
      return res.status(400).json({ message: "비밀번호는 8자 이상" });
    }

    // 1️⃣ 기존 비밀번호 가져오기
    const r = await pool.query(
      `select pw_hash from app_users where id = $1`,
      [req.session.user.id]
    );

    if (r.rows.length === 0) {
      return res.status(404).json({ message: "사용자 없음" });
    }

    // 2️⃣ 현재 비밀번호 비교 (이게 핵심)
    const ok = await bcrypt.compare(current_password, r.rows[0].pw_hash);
    if (!ok) {
      return res.status(400).json({ message: "현재 비밀번호가 올바르지 않습니다." });
    }

    // 3️⃣ 새 비밀번호 해시
    const newHash = await bcrypt.hash(new_password, 10);

    // 4️⃣ 업데이트
    await pool.query(
      `update app_users set pw_hash = $1, updated_at = now() where id = $2`,
      [newHash, req.session.user.id]
    );

    res.json({ ok: true });
  } catch (e) {
    console.error("[PATCH /api/me/password]", e);
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;