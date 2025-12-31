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

// --------------------- LIST ---------------------
router.get("/", async (req, res) => {
  try {
    const appUserId = req.session.user.id;

    // ✅ 프론트에서 맞춰서 보낼 파라미터들
    const { from, to, q, safe, revisit, new: isNew, guide ,repair} = req.query;

    let sql = `
      select
        id,
        to_char(repair_date, 'YYYY-MM-DD') as repair_date,
        customer_name,
        customer_phone,
        card_company,
        installment_mon,
        card_amount,
        cash_amount,
        bank_amount,
        product_name,
        repair_detail,
        car_name,
        note,
        customer_type,
        to_char(guide_date, 'YYYY-MM-DD') as guide_date,
        guide_done,
        guide_done_at
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

    // ✅ 체크박스 필터: customer_type 기준
    if (safe === "1")    sql += ` and customer_type = '안심회원'`;
    if (revisit === "1") sql += ` and customer_type = '재방문'`;
    if (isNew === "1")   sql += ` and customer_type = '신규'`;
    if (repair === "1")  sql += ` and customer_type = '수리'`;
  

    // ✅ 수리안내 대상: 안심회원 + 아직 안내 전(딱 1번 정책)
if (guide === "1") {
  sql += `
    and customer_type = '안심회원'
    and guide_done = false
  `;
}

    sql += ` order by repair_date desc, id desc`;

    const r = await pool.query(sql, params);

    const out = r.rows.map(x => ({
      id: Number(x.id),
      date: x.repair_date,
      name: x.customer_name || "",
      phone: x.customer_phone || "",
      card_company: x.card_company || "",
      installment_mon: Number(x.installment_mon || 0),
      pay_card: Number(x.card_amount || 0),
      pay_cash: Number(x.cash_amount || 0),
      pay_bank: Number(x.bank_amount || 0),
      product: x.product_name || "",
      car: x.car_name || "",
      desc: x.repair_detail || "",
      note: x.note || "",

      customer_type: x.customer_type || "신규",

      guide_date: x.guide_date || "",
      guide_done: x.guide_done === true || x.guide_done === "t",
      guide_done_at: x.guide_done_at || null,
    }));

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

    const customerType = b.customer_type || "신규"; // ✅ 여기서 status 절대 금지
    const isSafe = customerType === "안심회원";

    const sql = `
      insert into repair_payments (
        app_user_id,
        customer_id,
        repair_date,
        customer_name,
        customer_phone,
        card_company,
        installment_mon,
        card_amount,
        cash_amount,
        bank_amount,
        product_name,
        car_name,
        repair_detail,
        note,
        customer_type,
        guide_date,
        guide_done,
        guide_done_at
      ) values (
        $1, $2,
        $3::date,
        $4, $5,
        $6, $7,
        $8, $9, $10,
        $11, $12, $13,
        $14,
        $15,
        CASE WHEN $15 = '안심회원' THEN $3::date ELSE NULL END,
        false,
        null
      )
      returning id;
    `;

    const values = [
      appUserId,
      b.customer_id ?? null,
      b.date,
      b.name || "",
      b.phone || "",
      b.card_company || "",
      Number(b.installment_mon ?? 0),
      Number(b.pay_card ?? 0),
      Number(b.pay_cash ?? 0),
      Number(b.pay_bank ?? 0),
      b.product || "",
      b.car || "",
      b.desc || "",
      b.note || "",
      customerType,
    ];

    const r = await pool.query(sql, values);
    res.json({ ok: true, id: r.rows[0].id });
  } catch (e) {
    console.error("[POST /api/repairs ERROR]", e);
    res.status(500).json({ message: e.message });
  }
});

// --------------------- UPDATE ---------------------
// ✅ 날짜는 수정에서 못 바꾸기로 했으니 repair_date는 업데이트 안 함
router.put("/", async (req, res) => {
  try {
    const appUserId = req.session.user.id;
    const b = req.body || {};
    if (!b.id) return res.status(400).json({ message: "id 필요" });

    const customerType = b.customer_type || "신규"; // ✅ status 금지
    const isSafe = customerType === "안심회원";

    const sql = `
      update repair_payments
      set
        customer_id     = $3,
        customer_name   = $4,
        customer_phone  = $5,
        card_company    = $6,
        installment_mon = $7,
        card_amount     = $8,
        cash_amount     = $9,
        bank_amount     = $10,
        product_name    = $11,
        car_name        = $12,
        repair_detail   = $13,
        note            = $14,
        customer_type   = $15,
        -- ✅ 안심회원으로 '새로' 바뀌는 경우에만 기준일 세팅 + 안내상태 초기화
        guide_date = CASE
          WHEN $15 = '안심회원' AND customer_type <> '안심회원' THEN repair_date
          WHEN $15 <> '안심회원' THEN NULL
          ELSE guide_date
        END,
        guide_done = CASE
          WHEN $15 = '안심회원' AND customer_type <> '안심회원' THEN false
          WHEN $15 <> '안심회원' THEN false
          ELSE guide_done
        END,
        guide_done_at = CASE
          WHEN $15 = '안심회원' AND customer_type <> '안심회원' THEN NULL
          WHEN $15 <> '안심회원' THEN NULL
          ELSE guide_done_at
        END,
        updated_at      = now()
      where id = $1 and app_user_id = $2
      returning id;
    `;

    const values = [
      Number(b.id),
      appUserId,
      b.customer_id ?? null,
      b.name || "",
      b.phone || "",
      b.card_company || "",
      Number(b.installment_mon ?? 0),
      Number(b.pay_card ?? 0),
      Number(b.pay_cash ?? 0),
      Number(b.pay_bank ?? 0),
      b.product || "",
      b.car || "",
      b.desc || "",
      b.note || "",
      customerType,
    ];

    const r = await pool.query(sql, values);
    if (r.rowCount === 0) return res.status(403).json({ message: "권한 없음" });

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

    if (r.rowCount === 0) return res.status(403).json({ message: "권한 없음" });
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
        guide_date = current_date,
        updated_at = now()
      where id = $1
        and app_user_id = $2
        and customer_type = '안심회원'
        and guide_done = false
      returning id, guide_done, guide_date, guide_done_at
      `,
      [id, appUserId]
    );

    if (r.rowCount === 0) {
      return res.status(409).json({ message: "이미 수리안내 완료이거나 대상이 아닙니다." });
    }

    res.json({ ok: true, row: r.rows[0] });
  } catch (e) {
    console.error("[POST /api/repairs/:id/guide-done ERROR]", e);
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;