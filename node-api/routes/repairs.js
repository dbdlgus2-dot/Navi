"use strict";

const express = require("express");
const pool = require("../db");
const router = express.Router();

function requireLogin(req, res, next) {
  if (!req.session?.user?.id) {
    return res.status(401).json({ message: "로그인이 필요합니다." });
  }
  next();
}
router.use(requireLogin);

// status(안심회원/무상/일반) -> DB bool 2개로 변환
function statusToFlags(status, safe_member, free_repair) {
  if (status === "무상") return { safe_member: false, free_repair: true };
  if (status === "안심회원") return { safe_member: true, free_repair: false };
  if (status === "일반") return { safe_member: false, free_repair: false };
  return { safe_member: !!safe_member, free_repair: !!free_repair };
}

// DB date/timestamp -> YYYY-MM-DD (input[type=date]용)
function toYMD(v) {
  if (!v) return "";
  if (typeof v === "string") return v.slice(0, 10);
  try {
    return new Date(v).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

// --------------------- LIST ---------------------
router.get("/", async (req, res) => {
  try {
    const appUserId = req.session.user.id;
    const { from, to, q, safe, free, guide80 } = req.query;

    let sql = `
      select
        id,
        app_user_id,
        to_char(repair_date, 'YYYY-MM-DD') as repair_date,
        customer_name,
        customer_phone,
        card_company,
        installment_mon,
        safe_member,
        free_repair,
        card_amount,
        cash_amount,
        bank_amount,
        product_name,
        repair_detail,
        car_name,
        note,
         to_char(guide_date, 'YYYY-MM-DD') as guide_date,
        guide_done,
        guide_done_at,

        -- ✅ 90일 도래하면 true (안심회원만)
        (
          safe_member = true
          and current_date >= (coalesce(guide_date, repair_date) + interval '90 days')::date
        ) as guide_due

      from repair_payments
      where app_user_id = $1
    `;

    const params = [appUserId];

    if (from) { params.push(from); sql += ` and repair_date >= $${params.length}::date`; }
    if (to)   { params.push(to);   sql += ` and repair_date <= $${params.length}::date`; }

    if (q) {
      params.push(`%${q}%`);
      sql += ` and (customer_name ilike $${params.length} or customer_phone ilike $${params.length})`;
    }

    if (safe === "1") sql += ` and safe_member = true`;
    if (free === "1") sql += ` and free_repair = true`;

    // ✅ “수리안내” 체크박스는 “안심회원 + 90일 도래”만 보기
    if (guide80 === "1") {
      sql += `
        and safe_member = true
        and current_date >= (coalesce(guide_date, repair_date) + interval '90 days')::date
      `;
    }

    sql += ` order by repair_date desc, id desc`;

    const r = await pool.query(sql, params);

    const out = r.rows.map(x => {
      const isSafe = x.safe_member === true || x.safe_member === "t";
      const isFree = x.free_repair === true || x.free_repair === "t";
      const guideDue = x.guide_due === true || x.guide_due === "t";

      // ✅ “안내완료”는 이번 사이클에서만 표시 (90일 도래하면 다시 안내 가능 → 완료표시 숨김)
      const guideDoneDisplay =
        (x.guide_done === true || x.guide_done === "t") && !guideDue;

      return {
        id: Number(x.id),
        date: String(x.repair_date).slice(0, 10),
        name: x.customer_name,
        phone: x.customer_phone,
        memo: x.card_company || "",
        installment_mon: Number(x.installment_mon || 0),
        pay_card: Number(x.card_amount || 0),
        pay_cash: Number(x.cash_amount || 0),
        pay_bank: Number(x.bank_amount || 0),
        product: x.product_name || "",
        car: x.car_name || "",
        desc: x.repair_detail || "",
        note: x.note || "",

        guide_date: x.guide_date ? String(x.guide_date).slice(0, 10) : "",

        safe_member: isSafe,
        free_repair: isFree,

        guide_due: guideDue,
        guide_done: guideDoneDisplay,          // ✅ 프론트는 이 값으로 “안내완료” 표시
        guide_done_at: x.guide_done_at || null,

        status: isFree ? "무상" : (isSafe ? "안심회원" : "일반"),
      };
    });

    res.json(out);
  } catch (e) {
    console.error("[GET /api/repairs ERROR]", e);
    res.status(500).json({ message: e.message });
  }
});

// --------------------- CREATE ---------------------
router.post("/", async (req, res) => {
  try {
    const appUserId = req.session.user.id;
    const b = req.body || {};
    const flags = statusToFlags(b.status, b.safe_member, b.free_repair);

    const sql = `
      INSERT INTO repair_payments (
        app_user_id,
        customer_id,
        repair_date,
        customer_name,
        customer_phone,
        card_company,
        installment_mon,
        safe_member,
        free_repair,
        card_amount,
        cash_amount,
        bank_amount,
        product_name,
        car_name,
        repair_detail,
        note,
        guide_date,
        guide_done,
        guide_done_at
      ) VALUES (
        $1,   $2,
        $3::date,
        $4,   $5,
        $6,   $7,
        $8,   $9,
        $10,  $11,  $12,
        $13,  $14,  $15,
        $16,
        $3::date,    
        false,        
        null
      )
      RETURNING id;
    `;

    const values = [
      appUserId,
      b.customer_id ?? null,
      b.date,
      b.name,
      b.phone || null,
      b.card_company ?? b.memo ?? null,
      Number(b.installment_mon ?? 0),
      flags.safe_member,
      flags.free_repair,
      Number(b.pay_card ?? 0),
      Number(b.pay_cash ?? 0),
      Number(b.pay_bank ?? 0),
      b.product || null,
      b.car || null,
      b.desc || null,
      b.note || null,
    ];

    const r = await pool.query(sql, values);
    res.json({ ok: true, id: r.rows[0].id });
  } catch (e) {
    console.error("[POST /api/repairs ERROR]", e);
    res.status(500).json({ message: e.message });
  }
});

// --------------------- UPDATE ---------------------
router.put("/", async (req, res) => {
  try {
    const appUserId = req.session.user.id;
    const b = req.body || {};
    if (!b.id) return res.status(400).json({ message: "id 필요" });

    const flags = statusToFlags(b.status, b.safe_member, b.free_repair);

    const sql = `
      UPDATE repair_payments
      SET
        customer_id     = $3,
        repair_date     = $4::date,
        customer_name   = $5,
        customer_phone  = $6,
        card_company    = $7,
        installment_mon = $8,
        safe_member     = $9,
        free_repair     = $10,
        card_amount     = $11,
        cash_amount     = $12,
        bank_amount     = $13,
        product_name    = $14,
        car_name        = $15,
        repair_detail   = $16,
        note            = $17,

        guide_date      = $4::date,   -- ✅ 수정(=수리 갱신)이면 다시 기준일 리셋
        guide_done      = false,
        guide_done_at   = null,

        updated_at      = now()
      WHERE id = $1
        AND app_user_id = $2
      RETURNING id;
    `;

    const values = [
      Number(b.id),
      appUserId,
      b.customer_id ?? null,
      b.date,
      b.name,
      b.phone || null,
      b.card_company ?? b.memo ?? null,
      Number(b.installment_mon ?? 0),
      flags.safe_member,
      flags.free_repair,
      Number(b.pay_card ?? 0),
      Number(b.pay_cash ?? 0),
      Number(b.pay_bank ?? 0),
      b.product || null,
      b.car || null,
      b.desc || null,
      b.note || null,
    ];

    const r = await pool.query(sql, values);

    if (r.rowCount === 0) {
      return res.status(403).json({ message: "권한 없음(내 데이터 아님)" });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("[PUT /api/repairs ERROR]", e);
    res.status(500).json({ message: e.message });
  }
});
// --------------------- DELETE ---------------------
router.delete("/:id", async (req, res) => {
  try {
    const appUserId = req.session.user.id;
    const id = Number(req.params.id);

    const r = await pool.query(
      `delete from repair_payments where id = $1 and app_user_id = $2`,
      [id, appUserId]
    );

    if (r.rowCount === 0) {
      return res.status(403).json({ message: "권한 없음" });
    }

    res.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /api/repairs ERROR]", e);
    res.status(500).json({ message: e.message });
  }
});

// --------------------- GUIDE DONE ---------------------
router.post("/:id/guide-done", async (req, res) => {
  try {
    const appUserId = req.session.user.id;
    const id = Number(req.params.id);

    const r = await pool.query(
      `
      update repair_payments
      set
        guide_done = true,
        guide_done_at = now(),
        guide_date = current_date,   -- ✅ 누른 시점으로 기준일 리셋
        updated_at = now()
      where id = $1 and app_user_id = $2
      returning id, guide_done, guide_date, guide_done_at
      `,
      [id, appUserId]
    );

    if (r.rowCount === 0) return res.status(403).json({ message: "권한 없음" });
    res.json({ ok: true, row: r.rows[0] });
  } catch (e) {
    console.error("[POST /api/repairs/:id/guide-done ERROR]", e);
    res.status(500).json({ message: e.message });
  }
});
module.exports = router;