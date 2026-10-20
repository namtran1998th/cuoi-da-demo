# Cười Đã

Demo cộng đồng ảnh chế bằng HTML, CSS và JavaScript thuần. Mở `index.html` hoặc phục vụ thư mục repository bằng một máy chủ HTTP tĩnh.

Bình chọn, lưu bài và bình luận dùng localStorage. Ảnh/video mới được lưu cùng thông tin bài trong IndexedDB; các bài ảnh cũ vẫn được đọc từ localStorage. Không có tài khoản hoặc cơ sở dữ liệu dùng chung. Ảnh mẫu từ Unsplash, font Be Vietnam Pro từ Google Fonts; cần Internet để tải các tài nguyên này.

Đăng ảnh PNG/JPG/WebP/GIF tối đa 2 MB hoặc video MP4/WebM tối đa 50 MB. Video có xem trước, điều khiển phát, không tự phát. Codec phải được trình duyệt hỗ trợ. Tệp hỏng hoặc vượt giới hạn bị từ chối; lỗi hết dung lượng không được báo thành công. Dữ liệu chỉ thuộc trình duyệt và địa chỉ website hiện tại, có thể mất khi xóa dữ liệu trang hoặc khi trình duyệt thu hồi dung lượng.

Chia sẻ tạm thời bằng sao chép liên kết và menu chia sẻ hệ thống nếu trình duyệt hỗ trợ. Bài đăng cục bộ chỉ chia sẻ liên kết trang demo, không chia sẻ tệp riêng. Website Sites hiện riêng tư.

Kiểm thử trình duyệt: cài Playwright và Chrome, chạy máy chủ tại cổng 4173 rồi chạy `node check.cjs` và `node check-video.cjs`. Có thể đặt biến môi trường `PLAYWRIGHT_MODULE` tới một bộ Playwright đã cài. `flower.webm` là video CC0 từ https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm, dùng để kiểm tra phát video thật và lưu qua tải lại trang.

Kiểm tra cú pháp: `node --check app.js`.

## Chạy trên máy

```sh
python -m http.server 4173
```

Mở http://localhost:4173. Trên Windows có thể dùng `py -3 -m http.server 4173`. Không cần cài thư viện để chạy website.

Để chạy kiểm thử tự động, cài Google Chrome, Node.js rồi chạy `npm install` và `npm test` khi máy chủ đang mở.

Bản demo đã triển khai: https://cuoi-da-demo-p7.marketing-tn-1396.chatgpt.site (riêng tư).

## Bản cộng đồng có tài khoản

Bản máy chủ mới nằm trong [community](community/README.md): đăng ký/đăng nhập email và mật khẩu, đăng ảnh/video theo tài khoản, sửa/xóa bài của chính chủ, bình luận, lưu bài, lượt thích và bảng xếp hạng Cây hài của tuần theo giờ Việt Nam. Dữ liệu dùng SQLite và thư mục uploads trên máy chủ.

Cài Node.js 24 LTS, chạy:

```sh
cd community
npm ci
npm start
```

Mở http://localhost:4174 để tạo tài khoản. Xem hướng dẫn cấu hình, sao lưu và khôi phục trong [community/README.md](community/README.md).

**GitHub Pages vẫn phục vụ bản demo tĩnh ở thư mục gốc.** Tài khoản và dữ liệu dùng chung cần chạy bản community trên máy chủ Node.js có ổ đĩa bền vững; GitHub Pages không chạy được backend này. Không đưa database, tệp người dùng hoặc `.env` lên GitHub.

Kiểm tra bản community: 13 bài kiểm thử API/dữ liệu và kiểm thử trình duyệt hai tài khoản (video, lượt thích, xếp hạng, khởi động lại, giao diện mobile/desktop) đã đạt.
