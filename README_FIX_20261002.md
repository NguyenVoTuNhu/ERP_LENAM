# Lê Nam ERP — follow-up 2026-10-02

Baseline: ERP_LENAM_fix_hr_accounting_entries_20261002.zip

Phạm vi sửa:
1. Nhà hàng/Cửa hàng: nhân viên không còn chọn định khoản thủ công khi thanh toán. Kế toán cấu hình định khoản tự động theo Tiền mặt/Chuyển khoản tại Khai báo định khoản. Nếu chưa cấu hình, giao dịch bị chặn rõ ràng.
2. Nhân sự: route HR hydrate KIO trước first paint để không render 86 rồi nhảy về 50.
3. SĐT: các input điện thoại chỉ nhận số, tối đa 10; hồ sơ nhân sự bắt buộc đúng 10 số.
4. CRM: tạo đơn bán tự gán nhân viên Kinh doanh đang đăng nhập và khóa lựa chọn khi actor là nhân viên Kinh doanh.
5. Email nhân sự + tài khoản: nếu tạo tài khoản ERP thì email cá nhân là bắt buộc.
6. Quên/Đổi mật khẩu: OTP 6 số qua email, hết hạn 5 phút, tối đa 5 lần nhập sai, chống gửi lại trong 60 giây. Backend mới api/auth-otp.php dùng PHP session + PHP mail().

Lưu ý mail:
- Code KHÔNG giả lập gửi OTP. Nếu hosting chưa cấu hình mail()/sendmail/SMTP, API trả lỗi rõ "Máy chủ chưa gửi được email OTP".
- Có thể đặt biến môi trường LENAM_MAIL_FROM cho địa chỉ From.
