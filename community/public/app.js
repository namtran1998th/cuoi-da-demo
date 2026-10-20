import { $, esc, api, toast, uploadPost } from "./api.js";
import { currentUser, loadMe, requireSignIn } from "./account.js";
let items = [],
  nextCursor = null,
  controller,
  viewVersion = 0,
  loading = false;
const date = (value) =>
  new Date(value).toLocaleString("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  });
function go(url) {
  history.pushState(null, "", url);
  loadView();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
document.addEventListener("click", (e) => {
  const a = e.target.closest("a[data-nav]");
  if (a && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    go(a.getAttribute("href"));
  }
});
window.addEventListener("popstate", () => loadView());
function card(p) {
  const owner = currentUser?.id === p.author.id;
  return `<article class="post" id="post-${esc(p.id)}" data-id="${esc(p.id)}"><div class="post-head"><div class="author"><a data-nav href="/profiles/${esc(p.author.id)}" class="avatar">${esc(p.author.nickname[0])}</a><a class="author-link" data-nav href="/profiles/${esc(p.author.id)}">${esc(p.author.nickname)}</a><span>· ${date(p.createdAt)}</span><span class="category">${esc(p.topic)}</span></div><h3><a data-nav href="/posts/${esc(p.id)}">${esc(p.title)}</a></h3></div><div class="meme">${p.media.type.startsWith("video/") ? `<video src="${esc(p.media.url)}" controls playsinline preload="metadata" aria-label="${esc(p.title)}"></video>` : `<img src="${esc(p.media.url)}" loading="lazy" alt="${esc(p.title)}">`}</div><div class="post-actions"><button data-action="like" aria-label="Thích bài viết" aria-pressed="${p.liked}" class="${p.liked ? "liked" : ""}" ${owner ? 'disabled title="Không tự thích bài của mình"' : ""}>↑ <b>${p.likeCount}</b></button><button data-action="comment" aria-expanded="false">♧ ${p.commentCount} bình luận</button><button data-action="save" class="save ${p.saved ? "saved" : ""}" aria-label="Lưu bài viết" aria-pressed="${p.saved}">▱</button><button data-action="share" class="share" aria-label="Chia sẻ bài viết">↗</button>${owner ? '<button data-action="edit" class="own-action">Sửa</button><button data-action="delete" class="own-action">Xóa</button>' : ""}</div><div class="comments" hidden></div></article>`;
}
function draw() {
  $("#feed").innerHTML = items.length
    ? items.map(card).join("")
    : '<div class="empty"><strong>Góc này đang chờ tiếng cười đầu tiên.</strong><p>Chưa có bài phù hợp. Bạn thử chủ đề khác hoặc đăng một bài nhé.</p><button id="empty-upload">Góp một tiếng cười</button></div>';
  $("#load-more").hidden = nextCursor === null;
  $("#load-more").disabled = false;
  $("#empty-upload")?.addEventListener("click", () => openPost());
}
function rankRow(row, index) {
  return `<a class="ranking-row" data-nav href="/profiles/${esc(row.author.id)}"><span>${index + 1}</span><span class="avatar">${esc(row.author.nickname[0])}</span><strong>${esc(row.author.nickname)}</strong><small>${row.score} lượt thích</small></a>`;
}
async function loadRanking(signal) {
  try {
    const board = await api("/leaderboard", { signal });
    $("#ranking").innerHTML = board.items.length
      ? board.items.slice(0, 3).map(rankRow).join("")
      : '<p class="field-note">Chưa có lượt thích trong tuần này. Vị trí đầu tiên đang chờ bạn!</p>';
    return board;
  } catch (e) {
    if (e.name !== "AbortError")
      $("#ranking").textContent = "Chưa tải được xếp hạng.";
    return null;
  }
}
function feedParams() {
  const url = new URL(location.href),
    params = new URLSearchParams(url.search);
  params.delete("cursor");
  if (location.pathname === "/saved") params.set("saved", "1");
  if (location.pathname === "/me/posts" && currentUser)
    params.set("author", currentUser.id);
  if (location.pathname.startsWith("/profiles/"))
    params.set("author", location.pathname.split("/")[2]);
  return params;
}
async function loadView(append = false) {
  if (append && loading) return;
  controller?.abort();
  controller = new AbortController();
  const signal = controller.signal,
    version = ++viewVersion;
  loading = true;
  $("#load-more").disabled = true;
  if (!append) {
    items = [];
    nextCursor = null;
    $("#feed").innerHTML = '<div class="empty">Đang tìm tiếng cười…</div>';
    $("#load-more").hidden = true;
  }
  const path = location.pathname,
    params = feedParams();
  $("#search").value = params.get("q") || "";
  document
    .querySelectorAll("a[data-nav]")
    .forEach((a) =>
      a.classList.toggle(
        "active",
        a.getAttribute("href") === path + location.search,
      ),
    );
  const boardPromise = loadRanking(signal);
  try {
    if ((path === "/saved" || path === "/me/posts") && !currentUser) {
      $("#feed-title").textContent =
        path === "/saved" ? "Đã lưu" : "Bài của tôi";
      $("#feed").innerHTML =
        '<div class="empty">Đăng nhập để xem góc riêng của bạn.<button id="feed-login">Đăng nhập</button></div>';
      $("#feed-login").onclick = requireSignIn;
      return;
    }
    if (path === "/leaderboard") {
      const board = await boardPromise;
      if (version !== viewVersion) return;
      if (!board) throw Error("Chưa tải được bảng xếp hạng.");
      $("#feed-title").textContent = "Cây hài của tuần";
      $("#feed-description").textContent =
        `Tuần từ ${date(board.start)} · giờ Việt Nam`;
      $("#feed").innerHTML = board.items.length
        ? '<section class="side-card">' +
          board.items.map(rankRow).join("") +
          "</section>"
        : '<div class="empty">Chưa có điểm tuần này. Đăng bài và đón những lượt thích đầu tiên nhé!</div>';
      return;
    }
    let response;
    if (path.startsWith("/posts/")) {
      response = {
        items: [
          await api("/posts/" + encodeURIComponent(path.split("/")[2]), {
            signal,
          }),
        ],
        nextCursor: null,
      };
      $("#feed-title").textContent = "Chuyện vui hôm nay";
    } else {
      if (append) params.set("cursor", nextCursor);
      response = await api("/posts?" + params, { signal });
      const title =
        path === "/me/posts"
          ? "Bài của tôi"
          : path === "/saved"
            ? "Đã lưu"
            : params.get("topic") ||
              { new: "Mới tinh", top: "Top tiếng cười", hot: "Đang hot" }[
                params.get("tab")
              ] ||
              "Đang hot";
      $("#feed-title").textContent = title;
      if (path.startsWith("/profiles/")) {
        const profile = await api(
          "/profiles/" + encodeURIComponent(path.split("/")[2]),
          { signal },
        );
        $("#feed-title").textContent = profile.nickname;
      }
    }
    if (version !== viewVersion) return;
    items = append ? [...items, ...response.items] : response.items;
    nextCursor = response.nextCursor;
    $("#feed-description").textContent =
      "Những câu chuyện thật từ cộng đồng Cười Đã.";
    draw();
  } catch (e) {
    if (e.name !== "AbortError" && version === viewVersion) {
      $("#feed").innerHTML =
        `<div class="empty load-error">${esc(e.message)}<button id="retry">Thử lại</button></div>`;
      $("#retry").onclick = () => loadView();
    }
  } finally {
    if (version === viewVersion) {
      loading = false;
      $("#load-more").disabled = false;
    }
  }
}
$("#load-more").onclick = () => loadView(true);
let searchTimer;
$("#search").oninput = (e) => {
  const q = e.target.value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => go("/?q=" + encodeURIComponent(q)), 300);
};
async function showComments(article, p) {
  const area = article.querySelector(".comments"),
    button = article.querySelector("[data-action=comment]");
  area.hidden = !area.hidden;
  button.setAttribute("aria-expanded", String(!area.hidden));
  if (area.hidden) return;
  area.textContent = "Đang tải bình luận…";
  try {
    let cursor = 0;
    area.innerHTML =
      '<div class="comment-list"></div><button class="more-comments">Xem thêm bình luận</button><form class="comment-form"><input name="comment" maxlength="500" required aria-label="Viết bình luận" placeholder="Nói gì đó vui vui…"><button>Gửi</button></form>';
    const list = area.querySelector(".comment-list"),
      more = area.querySelector(".more-comments");
    async function read() {
      const data = await api(`/posts/${p.id}/comments?cursor=${cursor}`);
      for (const c of data.items)
        list.insertAdjacentHTML(
          "beforeend",
          `<div class="comment"><a data-nav href="/profiles/${esc(c.author.id)}"><strong>${esc(c.author.nickname)}</strong></a><p>${esc(c.text)}</p></div>`,
        );
      cursor = data.nextCursor;
      more.hidden = cursor === null;
    }
    await read();
    more.onclick = () => {
      more.disabled = true;
      read()
        .catch((e) => toast(e.message))
        .finally(() => (more.disabled = false));
    };
    area.querySelector("form").onsubmit = async (e) => {
      e.preventDefault();
      if (!requireSignIn()) return;
      const form = e.target,
        send = form.querySelector("button");
      send.disabled = true;
      try {
        const c = await api(`/posts/${p.id}/comments`, {
          method: "POST",
          body: { text: form.comment.value },
        });
        list.insertAdjacentHTML(
          "beforeend",
          `<div class="comment"><strong>${esc(c.author.nickname)}</strong><p>${esc(c.text)}</p></div>`,
        );
        form.reset();
        p.commentCount++;
        button.textContent = `♧ ${p.commentCount} bình luận`;
      } catch (error) {
        toast(error.message);
      } finally {
        send.disabled = false;
      }
    };
  } catch (e) {
    area.textContent = e.message;
  }
}
$("#feed").onclick = async (e) => {
  const button = e.target.closest("[data-action]"),
    article = button?.closest(".post");
  if (!article) return;
  const p = items.find((p) => p.id === article.dataset.id);
  if (!p) return;
  const action = button.dataset.action;
  if (action === "comment") return showComments(article, p);
  if (action === "share") return share(p);
  if (!requireSignIn()) return;
  if (action === "edit") return openPost(p);
  button.disabled = true;
  try {
    if (action === "like" || action === "save") {
      const updated = await api(
        `/posts/${p.id}/${action === "like" ? "like" : "bookmark"}`,
        {
          method: "PUT",
          body: { active: action === "like" ? !p.liked : !p.saved },
        },
      );
      Object.assign(p, updated);
      button.setAttribute(
        "aria-pressed",
        String(action === "like" ? p.liked : p.saved),
      );
      button.classList.toggle(
        action === "like" ? "liked" : "saved",
        action === "like" ? p.liked : p.saved,
      );
      if (action === "like") button.innerHTML = `↑ <b>${p.likeCount}</b>`;
      await loadRanking();
    } else if (
      action === "delete" &&
      confirm("Xóa bài viết này? Bài sẽ biến mất khỏi bảng tin và xếp hạng.")
    ) {
      await api("/posts/" + p.id, { method: "DELETE" });
      toast("Đã xóa bài.");
      await loadView();
    }
  } catch (error) {
    toast(error.message);
    if (error.status === 401) await loadMe();
  } finally {
    button.disabled = false;
  }
};
const postDialog = $("#post-dialog"),
  postForm = $("#post-form");
let editing = null,
  previewURL = "",
  validMedia = false,
  uploading = false,
  previewVersion = 0;
function resetMedia() {
  previewVersion++;
  if (previewURL) URL.revokeObjectURL(previewURL);
  previewURL = "";
  validMedia = false;
  $("#media-preview").replaceChildren();
}
function openPost(p = null) {
  if (!requireSignIn()) return;
  editing = p;
  postForm.reset();
  resetMedia();
  $("#post-error").textContent = "";
  $("#post-title").textContent = p ? "Sửa bài viết" : "Góp một tiếng cười";
  $("#media-field").hidden = !!p;
  postForm.media.required = !p;
  $("#post-submit").textContent = p ? "Lưu thay đổi" : "Đăng bài";
  $("#post-submit").disabled = !p;
  $("#upload-progress").hidden = true;
  if (p) {
    postForm.title.value = p.title;
    postForm.topic.value = p.topic;
  }
  postDialog.showModal();
}
$("#upload").onclick = () => openPost();
$("#join-upload").onclick = () => openPost();
postDialog.querySelector(".close").onclick = () => {
  if (!uploading) postDialog.close();
};
postDialog.addEventListener("cancel", (e) => {
  if (uploading) e.preventDefault();
});
postDialog.addEventListener("close", resetMedia);
postForm.media.onchange = () => {
  resetMedia();
  $("#post-submit").disabled = true;
  $("#post-error").textContent = "";
  const file = postForm.media.files[0];
  if (!file) return;
  const video = ["video/mp4", "video/webm"].includes(file.type),
    image = ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(
      file.type,
    );
  if (
    (!video && !image) ||
    !file.size ||
    file.size > (video ? 50 : 2) * 1024 * 1024
  ) {
    $("#post-error").textContent =
      "Chọn ảnh tối đa 2 MB hoặc video MP4/WebM tối đa 50 MB.";
    return;
  }
  const version = previewVersion,
    el = document.createElement(video ? "video" : "img");
  previewURL = URL.createObjectURL(file);
  if (video) {
    el.controls = true;
    el.playsInline = true;
    el.preload = "auto";
  } else el.alt = "Ảnh xem trước";
  const ready = () => {
    if (version !== previewVersion) return;
    validMedia = true;
    $("#post-submit").disabled = false;
  };
  el.addEventListener(video ? "loadeddata" : "load", ready);
  el.onerror = () => {
    if (version === previewVersion) {
      $("#post-error").textContent = "Trình duyệt không đọc được tệp này.";
      validMedia = false;
      $("#post-submit").disabled = true;
    }
  };
  el.src = previewURL;
  $("#media-preview").append(el);
};
postForm.onsubmit = async (e) => {
  e.preventDefault();
  if (uploading || (!editing && !validMedia)) return;
  uploading = true;
  $("#post-submit").disabled = true;
  $("#post-error").textContent = "";
  postForm.media.disabled = true;
  try {
    if (editing)
      await api("/posts/" + editing.id, {
        method: "PATCH",
        body: { title: postForm.title.value, topic: postForm.topic.value },
      });
    else {
      const data = new FormData();
      data.append("title", postForm.title.value);
      data.append("topic", postForm.topic.value);
      data.append("media", postForm.media.files[0]);
      $("#upload-progress").hidden = false;
      await uploadPost(data, (n) => ($("#upload-progress").value = n));
    }
    postDialog.close();
    toast(
      editing ? "Đã cập nhật bài." : "Đã đăng bài. Cảm ơn bạn góp tiếng cười!",
    );
    go("/me/posts");
  } catch (error) {
    $("#post-error").textContent = error.message;
  } finally {
    uploading = false;
    postForm.media.disabled = false;
    $("#post-submit").disabled = false;
  }
};
let shareData;
function share(p) {
  shareData = { title: p.title, url: location.origin + "/posts/" + p.id };
  $("#share-link").value = shareData.url;
  $("#native-share").hidden = !navigator.share;
  $("#share-dialog").showModal();
}
$("#share-dialog .close").onclick = () => $("#share-dialog").close();
$("#copy-share").onclick = async () => {
  try {
    await navigator.clipboard.writeText(shareData.url);
    toast("Đã sao chép liên kết.");
  } catch {
    $("#share-link").select();
    toast("Hãy sao chép liên kết trong ô đã chọn.");
  }
};
$("#native-share").onclick = async () => {
  try {
    await navigator.share(shareData);
  } catch (e) {
    if (e.name !== "AbortError")
      toast("Chưa chia sẻ được. Hãy sao chép liên kết.");
  }
};
window.addEventListener("account-change", () => loadView());
await loadMe();
