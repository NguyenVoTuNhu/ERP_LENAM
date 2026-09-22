# Auth / phân quyền / audit theo Actor

- Không cấp tài khoản cho toàn bộ nhân viên. `DB.employees` vẫn giữ toàn bộ nhân sự để phục vụ truy xuất sản xuất/ca/KPI.
- Chỉ các actor thực sự tạo, duyệt, kiểm soát chứng từ mới nằm trong `lenam_users`.
- Mỗi actor dùng username riêng, mật khẩu demo `123456`, nên Audit biết chính xác ai thao tác.
- Menu được lọc theo role; action ghi dữ liệu có lớp kiểm tra permission trước khi chạy business logic cũ.
- PR đã bổ sung người tạo/người duyệt và dấu vết thao tác.
- Bảng KIO: `lenam_users`, `lenam_roles`, `lenam_permissions`, `lenam_role_permissions`, `lenam_audit_logs`.

## Test nhanh
1. Đăng nhập `ngan.vtk / 123456`, tạo PR.
2. Đăng xuất.
3. Đăng nhập `loi.tv / 123456`, mở PR và duyệt.
4. Mở lại chi tiết PR để xem Người tạo / Người duyệt / Dấu vết thao tác.
