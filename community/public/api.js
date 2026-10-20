export const $ = (s) => document.querySelector(s);
export const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function toast(message) {
  $("#toast").textContent = message;
  $("#toast").style.display = "block";
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ($("#toast").style.display = "none"), 4000);
}
export async function api(path, { method = "GET", body, signal } = {}) {
  const response = await fetch("/api" + path, {
    method,
    credentials: "same-origin",
    signal,
    headers: {
      "X-Cuoi-Da-Request": "1",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok)
    throw Object.assign(
      Error(data.error?.message || "Không xử lý được yêu cầu."),
      { status: response.status },
    );
  return data;
}
export function uploadPost(data, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/posts");
    xhr.setRequestHeader("X-Cuoi-Da-Request", "1");
    xhr.timeout = 90000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let body;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        return reject(Error("Phản hồi máy chủ không hợp lệ."));
      }
      xhr.status === 201
        ? resolve(body)
        : reject(Error(body.error?.message || "Không đăng được bài."));
    };
    xhr.onerror = () =>
      reject(Error("Mất kết nối. Hãy kiểm tra mạng và thử lại."));
    xhr.ontimeout = () =>
      reject(
        Error("Tải lên quá lâu. Hãy kiểm tra Bài của tôi trước khi thử lại."),
      );
    xhr.send(data);
  });
}
