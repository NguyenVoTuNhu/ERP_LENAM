# HƯỚNG DẪN SỬ DỤNG KIO SERVER – BẢN CHUNKED PAYLOAD

## 1. Lỗi cũ là gì?

Console báo:

`SQLSTATE[22001]: String data, right truncated: 1406 Data too long for column 'payload' at row 1`

Điều này nghĩa là API KIO đã kết nối được tới database server, nhưng cột `payload` của bảng `lenam_*` không đủ dài để chứa toàn bộ JSON của một PR, PO, tồn kho hoặc lô hàng trong một dòng.

Đây KHÔNG phải lỗi kết nối server.

## 2. Bản mới xử lý như thế nào?

Không đổi business logic, không đổi cấu trúc DB.* và không cần PHP/MySQL local.

Một record lớn sẽ được chia thành nhiều đoạn ngắn.

Ví dụ một PR có JSON dài 800 ký tự sẽ được lưu thành nhiều dòng cùng một khóa logic:

- chunk 0/7
- chunk 1/7
- ...
- chunk 6/7

Khi đọc lại, `js/kio-api.js` tự ghép các đoạn này thành object PR ban đầu trước khi gán về `DB.purchases`.

Do đó các module hiện tại vẫn dùng:

- `DB.purchases`
- `DB.purchaseOrders`
- `DB.materials`
- `DB.inventory`
- `DB.inventoryLots`

như trước, business logic không thay đổi.

## 3. Cấu trúc server tối thiểu

Mỗi bảng `lenam_*` chỉ cần tối thiểu:

- `id`: khóa chính tự tăng
- `payload`: cột chuỗi

Bản mới dùng chunk nhỏ nên ngay cả `payload VARCHAR(255)` cũng hoạt động.

Nếu admin có thể đổi `payload` thành TEXT/LONGTEXT thì vẫn tốt hơn về hiệu năng, nhưng KHÔNG bắt buộc với adapter này.

## 4. Cách chạy

1. Chép project vào `C:\xampp\htdocs\lenam`.
2. Start Apache trong XAMPP.
3. Không cần MySQL local cho persistence KIO.
4. Mở `http://localhost/lenam/`.
5. Nhấn `Ctrl + F5`.
6. Mở F12 > Console.

Khi thành công sẽ thấy:

- `[PurchaseAPI] Đã đồng bộ Purchase với KIO server.`
- `[InventoryAPI] Đã đồng bộ Kho/Master với KIO server.`

Lần tải sau sẽ thấy:

- `[PurchaseAPI] Đã nạp Purchase từ KIO server.`
- `[InventoryAPI] Đã nạp Kho/Master từ KIO server.`

## 5. Test persistence

### Purchase

1. Tạo PR.
2. Refresh trang.
3. PR vẫn còn.
4. Duyệt PR / tạo PO.
5. Refresh lại.
6. Trạng thái vẫn còn.

### Master/Kho

1. Tạo danh mục.
2. Tạo nguyên liệu.
3. Refresh.
4. Danh mục và nguyên liệu vẫn còn.
5. Nhập kho.
6. Refresh.
7. Dòng tồn kho/lô vẫn còn.

## 6. Không dùng nữa

Với mô hình KIO server, các file PHP/MySQL local cũ không còn là nguồn persistence chính:

- `api/config.php`
- `api/purchase.php`
- `api/inventory.php`
- `database/*.sql`

Chúng có thể còn trong project để tham khảo nhưng adapter KIO không gọi đến chúng.

## 7. Nếu vẫn lỗi 1406

Bản này giới hạn mỗi chunk dữ liệu còn 120 ký tự. Payload hoàn chỉnh của một chunk thường nhỏ hơn 200–220 ký tự.

Nếu server `payload` ngắn hơn khoảng 200 ký tự, cần hỏi admin độ dài chính xác của cột. Khi đó chỉ cần giảm `CHUNK_SIZE` trong `js/kio-api.js`, không đổi business logic.
