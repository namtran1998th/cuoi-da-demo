# Cười Đã — Tài khoản, bài đăng và xếp hạng tuần

Trạng thái: người dùng đã duyệt ngày 2026-10-20; chưa triển khai.

## Mục tiêu đã chốt

Đăng ký và đăng nhập bằng email + mật khẩu, có biệt danh công khai. Bài ảnh/video và tương tác thuộc tài khoản, dùng chung giữa các trình duyệt. Bảng “Cây hài của tuần” tính từ dữ liệu thật. Giữ phong cách và các thao tác của demo; tiếp tục lưu mã nguồn tại https://github.com/namtran1998th/cuoi-da-demo.

## Quyết định kiến trúc và giới hạn triển khai

Chọn ứng dụng Node.js với Express, SQLite và thư mục lưu tệp bền vững trên cùng máy chủ, phục vụ cả giao diện và API cùng nguồn. Đây là phiên bản cho cộng đồng nhỏ, một máy chủ. Dùng node:sqlite tích hợp trong Node.js 24 LTS (máy hiện có v24.21.0); không đưa cơ sở dữ liệu, tệp người dùng, mật khẩu hay khóa bí mật vào GitHub.

Hai hướng đã cân nhắc: tiếp tục Sites với đăng nhập ChatGPT không đáp ứng yêu cầu email/mật khẩu riêng; dùng dịch vụ xác thực bên ngoài cần thêm tài khoản dịch vụ. Backend độc lập đáp ứng yêu cầu hiện tại và có thể chạy, kiểm thử ngay trên máy.

Sites hiện tại tiếp tục là bản demo. GitHub lưu mã nguồn, không chạy backend này. Bước triển khai Internet cần hosting hỗ trợ Node.js, HTTPS và ổ đĩa bền vững; chưa có hosting đó trong phạm vi truy cập đã xác nhận. Không tuyên bố tài khoản hoạt động trên link Sites, không tự đổi quyền truy cập Site, không đăng ký dịch vụ trả phí. Bản bàn giao đầu tiên gồm backend chạy cục bộ, kiểm thử và mã nguồn GitHub; triển khai Internet tiếp tục khi có đích hosting phù hợp.

## Luồng người dùng

- Khách xem bảng tin, bài chi tiết, hồ sơ công khai và bảng xếp hạng. Đăng nhập trước khi đăng bài, thích, lưu bài hoặc bình luận.
- Đăng ký: email, biệt danh và mật khẩu; đăng nhập bằng email/mật khẩu; có đăng xuất và đổi mật khẩu khi biết mật khẩu hiện tại. Email không xuất hiện trong API công khai.
- Hồ sơ “Bài của tôi” liệt kê bài của tài khoản. Chủ bài được sửa tiêu đề/chủ đề và xóa bài của mình; API kiểm tra quyền sở hữu cho mọi thay đổi.
- Ảnh tối đa 2 MB; video MP4/WebM tối đa 50 MB. Xem trước, báo tiến trình và lỗi, khóa thao tác đăng trùng trong lúc tải. Video có điều khiển phát và không tự phát tiếng.
- Bài có đường dẫn chi tiết ổn định. Chia sẻ vẫn ở mức sao chép link/menu hệ thống; không tự đăng lên mạng xã hội.
- Không tự nhập bài hoặc lượt thích demo vào dữ liệu thật. Bản demo cũ và dữ liệu cục bộ của nó được giữ nguyên; người dùng có thể đăng lại tệp đã chọn trong bản mới.

## Dữ liệu và tính nhất quán

- users: ID, email chuẩn hóa duy nhất, biệt danh, hash mật khẩu kèm salt/tham số, thời điểm tạo.
- sessions: hash token ngẫu nhiên, user ID, ngày hết hạn. Token thô chỉ nằm trong cookie của người dùng.
- posts: ID, author ID, tiêu đề, chủ đề hợp lệ, khóa tệp, loại media, kích thước, ngày tạo/cập nhật và trạng thái xóa.
- likes: cặp user ID/post ID duy nhất, thời điểm thích đầu tiên và trạng thái đang thích. Bỏ thích rồi thích lại không làm mới thời điểm để tăng điểm tuần.
- comments: ID, post ID, author ID, nội dung, ngày tạo.
- bookmarks: cặp user ID/post ID duy nhất.
- Các bảng có khóa ngoại và chỉ mục theo tác giả, thời gian, bài đăng. Thời gian lưu UTC; máy chủ là nguồn thời gian và số lượt thích.
- Tải tệp vào vùng tạm, kiểm tra loại bằng nội dung và kích thước, đặt tên ngẫu nhiên. Chỉ công bố bài sau khi tệp và bản ghi đều sẵn sàng; lỗi phải dọn tệp tạm và không tạo bài lỗi. Xóa bài loại bỏ tương tác khỏi truy vấn công khai và xếp hạng, sau đó dọn tệp tương ứng; ghi nhận lỗi dọn tệp để xử lý lại.

## Xếp hạng tuần

Tuần bắt đầu thứ Hai 00:00, kết thúc trước thứ Hai kế tiếp, theo Asia/Ho_Chi_Minh. Cộng các lượt thích đang có hiệu lực, được tạo lần đầu trong tuần, trên mọi bài còn hiển thị của tác giả. Không tính lượt tự thích, bài mẫu hoặc bài đã xóa. Một người có thể thích các bài khác nhau nhưng chỉ đóng góp một lượt cho mỗi bài.

Hiển thị top 10 người có điểm lớn hơn 0, gồm biệt danh, điểm và liên kết hồ sơ. Cột trang chủ hiển thị top 3. Cùng điểm thì xếp theo số bài khác nhau nhận được lượt thích hợp lệ trong tuần, sau đó user ID tăng dần để kết quả ổn định. Tuần mới được tính qua truy vấn khoảng thời gian, không xóa dữ liệu hay cần tác vụ đặt lại điểm. Chưa có lượt thích thì hiển thị trạng thái trống, không dùng số liệu giả.

## Xác thực và bảo vệ dữ liệu

- Dùng hàm băm mật khẩu tiêu chuẩn có salt riêng, chi phí được đo trên runtime thực tế và ghi trong bản ghi để nâng cấp được. Không tự viết thuật toán mã hóa, không lưu mật khẩu rõ hay ghi mật khẩu/token vào log.
- Mật khẩu 12–128 ký tự; cho phép dán và dùng trình quản lý mật khẩu. Email kiểm tra định dạng và chuẩn hóa nhất quán. Biệt danh 2–40 ký tự, tiêu đề 1–180 ký tự, bình luận 1–500 ký tự.
- Phiên hết hạn sau 7 ngày; cookie HttpOnly, SameSite=Lax và Secure khi chạy HTTPS. Đăng xuất thu hồi phiên; đổi mật khẩu thu hồi các phiên cũ và cấp phiên mới.
- Kiểm tra nguồn yêu cầu/CSRF cho thao tác ghi, truy vấn SQL có tham số, escape nội dung hiển thị, giới hạn tốc độ đăng nhập/đăng ký và tải tệp. Trả lỗi đăng nhập chung để hạn chế dò tài khoản.
- Chỉ phục vụ tệp ảnh/video đã kiểm tra, không phục vụ HTML/SVG do người dùng tải lên. Có hỗ trợ HTTP Range cho video và header chống diễn giải sai MIME.
- Chưa có dịch vụ gửi email: email ở bản đầu là định danh chưa xác minh; chưa có quên mật khẩu qua email. Ghi rõ giới hạn này trong màn đăng ký và tài liệu. Trước khi mở đăng ký đại trà cần bổ sung xác minh email, khôi phục mật khẩu và quản trị nội dung; không gọi bản đầu là hệ thống sẵn sàng vận hành cộng đồng công khai.

## Giao diện và API

Giữ màu, bố cục và tính responsive. Thêm hộp đăng nhập/đăng ký, menu tài khoản, trang bài của tôi, hồ sơ và bài chi tiết. Bảng tin dùng API phân trang; trạng thái tải, trống, lỗi đều có thông báo và thao tác thử lại. Hộp thoại dùng được bằng bàn phím, có nhãn và trả focus về nút mở.

API nhóm auth (register/login/logout/me/change-password), posts (list/detail/create/update/delete), likes, comments, bookmarks, profiles và leaderboard. Kiểm tra phiên và quyền ở máy chủ; không nhận author ID từ client làm bằng chứng sở hữu. Chỉ trả dữ liệu công khai cần thiết, không trả hash mật khẩu, session hoặc email của người khác.

## Kiểm chứng và bàn giao

1. Hai tài khoản ở hai phiên trình duyệt độc lập: đăng ký, đăng nhập, đăng xuất, đổi mật khẩu và phiên hết hạn.
2. Đăng ảnh/video thật, tải lại và khởi động lại máy chủ vẫn còn; tài khoản khác xem được và không thể sửa/xóa bài của người khác.
3. Tệp hỏng, sai loại, quá dung lượng và lỗi lưu không tạo bài thành công giả. Kiểm thử giới hạn tốc độ, truy cập không đăng nhập, CSRF và nội dung chứa ký tự HTML.
4. Lượt thích đồng thời không đếm trùng; không tính tự thích; bỏ thích/thích lại không làm mới điểm. Kiểm tra biên tuần Việt Nam, đồng điểm, bài bị xóa và tuần trống.
5. Kiểm tra giao diện desktop/mobile, tương thích ảnh/video hiện có, bàn phím và các trạng thái lỗi.
6. Mã nguồn, migration, hướng dẫn chạy/cấu hình/sao lưu, tệp môi trường mẫu không có bí mật và kiểm thử được lưu lên GitHub. Bản demo tĩnh được giữ làm mốc trước nâng cấp.

Chỉ xác nhận hoàn tất tài khoản và xếp hạng khi các kiểm thử backend và luồng trình duyệt đạt. Link website online mới chỉ được công bố sau khi triển khai và kiểm chứng trên hosting thật.
