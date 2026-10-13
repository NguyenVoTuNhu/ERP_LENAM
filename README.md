# Lê Nam ERP

Bản gộp ngày 13/10/2026 từ `ERP_LENAM-main (1).zip` và `lenamfn1018.zip`.

## Chạy local

1. Giải nén thư mục `lenam` vào `C:\xampp\htdocs\`.
2. Mở XAMPP và bật Apache.
3. Truy cập `http://localhost/lenam/`.
4. Nhấn Ctrl + F5 sau khi thay mã nguồn để bỏ cache trình duyệt.

Ứng dụng hiện dùng KIO API của công ty để đọc/ghi dữ liệu, không kèm PHP API
hoặc SQL cho MySQL local. Cần kết nối Internet và quyền truy cập server KIO.
Hai thư viện server đang được nạp trong `index.html`:
`https://kio.dvqt.vn/list.js` và `https://kio.dvqt.vn/krud.js`.
Cấu hình kết nối, tên bảng và payload nằm trong `js/api/kio-config.js`,
`js/api/kio-api.js` và các adapter API tương ứng. Nếu báo lỗi thiếu bảng,
cần quản trị viên server kiểm tra hoặc tạo bảng; frontend không tự tạo bảng.

## Cấu trúc chính

- `index.html`: trang vào ứng dụng và thứ tự nạp script.
- `css/`: giao diện.
- `assets/`: thư viện, font, hình ảnh.
- `js/api/`: kết nối và đồng bộ dữ liệu.
- `js/core/`: tiện ích, điều hướng, render và biểu đồ.
- `js/data/`: dữ liệu và công cụ dữ liệu mẫu.
- `js/modules/`: nghiệp vụ và giao diện các phân hệ.
- `js/modules/legacy/`: các module báo giá/danh mục hiện được index.html sử dụng.
- `docs/`: dữ liệu JSON và tài liệu PDF còn giữ lại.

## Những thay đổi được ghép

- Giữ mọi file dùng chung có nội dung giống nhau giữa hai bản.
- Giữ sửa lỗi đồng bộ phê duyệt trong `approvals-api.js` từ GitHub.
- Giữ module nối các luồng phê duyệt `mod-approvals-flows.js` từ GitHub,
  nạp sau `mod-approvals.js` như bản GitHub.
- Giữ chức năng sửa chấm công, kiểm tra quyền và ghi nhật ký từ GitHub.
- BI: giữ tab, biểu đồ Kinh doanh/Nhà hàng/Nhân sự và nút đổi kỳ từ GitHub;
  giữ logic Nhà hàng của lenamfn1018: doanh thu chỉ gồm đơn PAID,
  giá vốn lấy cả nguyên liệu và thành phẩm.
- Kế toán: giữ thanh tab ở màn Thuế của lenamfn1018.
- Tăng phiên bản URL các script vừa gộp để trình duyệt tải mã mới.
- Gom tài liệu Markdown còn một README; xóa các alias JS chỉ khi trùng byte
  với file trong thư mục con và không được index.html nạp.
- Giữ các file JS khác nội dung, dữ liệu JSON, CSV, PDF và tài nguyên khác.

Module phê duyệt bổ sung là phần đã có trong bản GitHub. Luồng mua hàng gốc
và bộ xử lý PR/PO không được viết lại trong lần gộp này.

## Kiểm tra sau khi chạy với server thật

- Đăng nhập bằng các vai trò đang dùng; mở Mua hàng, CRM và Kho.
- Mở BI Kinh doanh, đổi kỳ xem và kiểm tra biểu đồ.
- Mở BI Nhà hàng: đơn chưa thanh toán không được tính vào doanh thu.
- Với tài khoản đủ quyền HR, sửa chấm công rồi tải lại trang.
- Tạo/duyệt yêu cầu, tải lại trang và kiểm tra dữ liệu còn trên KIO.
- Mở Kế toán / Thuế và kiểm tra thanh tab.

Kiểm tra offline chỉ xác nhận cú pháp, đường dẫn tài nguyên và logic ghép
bằng dữ liệu giả lập. Chưa xác nhận các thao tác đọc/ghi trên server KIO thật.
