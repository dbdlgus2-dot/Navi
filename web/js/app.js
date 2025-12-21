window.NAVI = window.NAVI || {};

// ❗ 여기서만 선언
const $ = (sel) => document.querySelector(sel);

window.NAVI.bindLogin = function () {
  const form = $("#loginForm");
  const msg = $("#msg");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "";

    const login_id = form.login_id.value.trim();
    const password = form.password.value;

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ login_id, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        msg.textContent = data.message || "로그인 실패";
        return;
      }

      location.href = "/records";
    } catch (err) {
      console.error(err);
      msg.textContent = "서버/네트워크 오류";
    }
  });
};

window.NAVI.bindRegister = function () {
  const form = $("#registerForm");
  const msg = $("#msg");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "";

    const login_id = form.login_id.value.trim();
    const password = form.password.value;
    const password_confirm = form.password_confirm.value;
    const name = form.name.value.trim();
    const phone = form.phone.value.trim();
    const email = form.email.value.trim();

    if (password.length < 8) {
      msg.textContent = "비밀번호는 8자 이상";
      return;
    }
    if (password !== password_confirm) {
      msg.textContent = "비밀번호가 서로 다름";
      return;
    }

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ login_id, password, name, phone, email }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        msg.textContent = data.message || "가입 실패";
        return;
      }

      location.href = "/login";
    } catch (err) {
      console.error(err);
      msg.textContent = "서버/네트워크 오류";
    }
  });
};