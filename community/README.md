# Cười Đã — tài khoản và cộng đồng

Ứng dụng máy chủ độc lập. GitHub Pages và link Sites cũ vẫn là demo tĩnh; **không có API tài khoản tại hai địa chỉ đó**.

## Chạy trên máy

Cài Node.js **24 LTS**, sau đó mở terminal trong `community/`:

```sh
npm ci
npm start
```

Mở **http://localhost:4174**. Tạo hai tài khoản để thử đăng bài và bình chọn. Không có tài khoản/mật khẩu mặc định hoặc dữ liệu xếp hạng giả.

Mỗi tài khoản có email đăng nhập, biệt danh công khai và mật khẩu 12–128 ký tự. Mật khẩu được băm scrypt với salt riêng; phiên có thời hạn 7 ngày. Email chỉ trả về cho chính chủ trong trang tài khoản. Đổi mật khẩu thu hồi các phiên cũ.

**Giới hạn bản đầu:** email chưa được xác minh, chưa có khôi phục mật khẩu qua email, chưa có quản trị/duyệt nội dung. Dùng cho thử nghiệm hoặc cộng đồng nhỏ có kiểm soát; cần bổ sung các phần này trước khi mở đăng ký đại trà.

## Lưu trữ và vận hành

- `data/community.sqlite`: tài khoản, phiên, bài viết, tương tác và giới hạn tốc độ.
- `data/uploads/`: ảnh/video đã kiểm tra; `data/tmp/`: tệp đang tải.
- Các đường dẫn này và `.env` được Git bỏ qua. Không đưa tệp người dùng, cơ sở dữ liệu hoặc bí mật lên GitHub.
- Chỉ chạy **một process** trên một thư mục data. `server.lock` ngăn chạy trùng và khóa khi sao lưu. Nếu process bị tắt cưỡng bức, xác nhận không còn server dùng thư mục đó rồi mới xóa file khóa. Khởi động lại sẽ dọn tệp tạm/bài chưa hoàn tất.
- Node lắng nghe `127.0.0.1` để triển khai sau reverse proxy. Dùng ổ đĩa bền vững; không triển khai trên filesystem tạm thời/serverless.
- FFprobe được đi kèm qua `ffprobe-static`; có thể đặt `FFPROBE_PATH` để dùng bản hệ thống cập nhật. MP4/WebM vẫn cần codec mà trình duyệt hỗ trợ, server không chuyển mã video.

Sao chép `.env.example` thành `.env` nếu muốn đổi cấu hình. `PORT` mặc định 4174; `APP_ORIGIN` phải là origin chính xác (không dấu `/` cuối); `DATA_DIR` mặc định `./data`, tính từ thư mục chạy lệnh. Production đặt `NODE_ENV=production`, `APP_ORIGIN=https://ten-mien-cua-ban` và proxy HTTPS về loopback. Chỉ đặt `TRUST_PROXY=loopback` nếu proxy đã loại bỏ header chuyển tiếp do client cung cấp. Cookie HTTPS dùng Secure/HttpOnly/SameSite; API ghi kiểm tra Origin và header riêng.

Không có tài khoản hosting Node.js nào được tạo tự động. Repository công khai không đồng nghĩa dữ liệu người dùng công khai.

## Ảnh/video và xếp hạng

Ảnh PNG/JPEG/WebP/GIF tối đa 2 MiB; video MP4/WebM tối đa 50 MiB. Server kiểm tra chữ ký tệp, thông tin media và kích thước, không chỉ tin MIME của trình duyệt. Ảnh được giải mã bằng Sharp; PNG được kiểm tra checksum từng chunk để từ chối tệp hỏng. Chủ bài được sửa tiêu đề/chủ đề hoặc xóa; người khác chỉ tương tác. Video không tự phát, hỗ trợ HTTP Range.

“Cây hài của tuần” lấy lượt thích đang có hiệu lực được tạo lần đầu trong tuần, từ thứ Hai 00:00 theo giờ Việt Nam. Không tính tự thích và bài đã xóa. Bỏ thích/thích lại không làm mới thời gian. Đồng điểm: số bài nhận lượt thích, sau đó ID tài khoản. Dữ liệu demo cũ không được tự nhập.

## Sao lưu và khôi phục

Dừng server bằng Ctrl+C, chờ thoát rồi:

```sh
npm run backup -- ./data ../backup-2026-10-20
```

Thư mục đích phải mới, nằm ngoài data; thư mục cha phải tồn tại. Lưu bản sao ở nơi riêng tư. Muốn khôi phục, giữ server dừng, sao chép bản backup sang một thư mục dữ liệu mới, đặt `DATA_DIR` vào đó rồi chạy server. Không chép đè database đang mở. Có thể dùng hai thư mục khác nhau để giữ bản cũ khi kiểm tra khôi phục.

## Kiểm thử

```sh
npm test
npm run test:browser
```

Kiểm thử trình duyệt dùng Google Chrome, tự mở máy chủ tạm ở cổng 4176, hai phiên độc lập và dữ liệu tạm. Có kiểm tra đăng video, lượt thích, xếp hạng và dữ liệu còn sau khi khởi động lại server. Ảnh chụp kiểm tra nằm trong `test-output/` và không được đưa lên Git. Video fixture `test/fixtures/flower.webm` là CC0 từ MDN: https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm.

Tham chiếu mật khẩu: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html — scrypt N=131072, r=8, p=1, tối đa 2 phép băm chạy đồng thời. Giới hạn theo IP dùng IP trực tiếp mặc định; cấu hình proxy sai sẽ khiến giới hạn áp dụng chung cho mọi người hoặc có thể bị vượt qua.

