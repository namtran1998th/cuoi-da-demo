import { $, api, toast } from "./api.js";
export let currentUser = null;
let mode = "login";
const dialog = $("#account-dialog"),
  form = $("#account-form");
function update() {
  $("#account-button").textContent = currentUser
    ? currentUser.nickname
    : "Đăng nhập";
  window.dispatchEvent(new Event("account-change"));
}
export async function loadMe() {
  try {
    currentUser = await api("/auth/me");
  } catch (e) {
    if (e.status !== 401) toast("Chưa tải được tài khoản. Hãy tải lại trang.");
    currentUser = null;
  }
  update();
}
function configure() {
  const register = mode === "register",
    change = mode === "change";
  $("#account-title").textContent = change
    ? "Tài khoản của bạn"
    : register
      ? "Tạo tài khoản"
      : "Đăng nhập";
  $("#email-field").hidden = change;
  form.email.required = !change;
  $("#nickname-field").hidden = !register;
  form.nickname.required = register;
  $("#current-field").hidden = !change;
  form.currentPassword.required = change;
  form.password.autocomplete =
    mode === "login" ? "current-password" : "new-password";
  $("#account-submit").textContent = change
    ? "Đổi mật khẩu"
    : register
      ? "Đăng ký"
      : "Đăng nhập";
  $("#account-switch").hidden = change;
  $("#account-switch").textContent = register
    ? "Đã có tài khoản? Đăng nhập"
    : "Tạo tài khoản";
  $("#logout").hidden = !change;
  $("#account-note").textContent = change
    ? `${currentUser.nickname} · ${currentUser.email}`
    : register
      ? "Bản đầu chưa xác minh email hoặc hỗ trợ quên mật khẩu qua email. Hãy dùng mật khẩu riêng và lưu an toàn."
      : "Chào bạn, lại gặp nhau ở góc vui!";
  $("#account-error").textContent = "";
}
export function openAccount() {
  mode = currentUser ? "change" : "login";
  form.reset();
  configure();
  dialog.showModal();
}
export function requireSignIn() {
  if (currentUser) return true;
  openAccount();
  return false;
}
$("#account-button").onclick = openAccount;
dialog.querySelector(".close").onclick = () => dialog.close();
$("#account-switch").onclick = () => {
  mode = mode === "login" ? "register" : "login";
  configure();
};
form.onsubmit = async (e) => {
  e.preventDefault();
  const submit = $("#account-submit");
  submit.disabled = true;
  $("#account-error").textContent = "";
  try {
    const body = Object.fromEntries(new FormData(form));
    if (mode === "change") {
      await api("/auth/change-password", { method: "POST", body });
      toast("Đã đổi mật khẩu và thu hồi các phiên cũ.");
    } else currentUser = await api("/auth/" + mode, { method: "POST", body });
    dialog.close();
    form.reset();
    update();
  } catch (error) {
    $("#account-error").textContent = error.message;
  } finally {
    submit.disabled = false;
  }
};
$("#logout").onclick = async () => {
  try {
    await api("/auth/logout", { method: "POST" });
    currentUser = null;
    dialog.close();
    update();
    toast("Bạn đã đăng xuất.");
  } catch (e) {
    toast(e.message);
  }
};
