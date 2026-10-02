# Lê Nam ERP — Admin cấp lại mật khẩu

- Bỏ hoàn toàn Quên mật khẩu/OTP/SMTP khỏi màn đăng nhập.
- Bỏ Đổi mật khẩu bằng OTP khỏi menu tài khoản.
- Khi Admin (ROLE_ADMIN) mở **Nhân sự → Sửa hồ sơ** của nhân sự đã có tài khoản, phần **Admin cấp lại mật khẩu** xuất hiện.
- Mật khẩu mới tối thiểu 6 ký tự, nhập 2 lần, lưu SHA-256 qua SystemAPI.hashPassword và ghi `lenam_users`.
- Có audit `ADMIN_RESET_PASSWORD`; không ghi mật khẩu vào audit.
- HR/Giám đốc/role khác không thấy và cũng không gọi được action reset.
- Email cá nhân không còn bắt buộc chỉ vì tạo tài khoản đăng nhập.
