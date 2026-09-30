# HƯỚNG DẪN KẾT NỐI LÊ NAM ERP VỚI SERVER KIO

## 1. Mô hình mới

Source này KHÔNG dùng MySQL/XAMPP/phpMyAdmin local nữa.

Luồng chạy:

```text
Lê Nam ERP (http://localhost/lenam/)
        ↓
https://kio.dvqt.vn/list.js
https://kio.dvqt.vn/krud.js
        ↓
API server của công ty
        ↓
Database dùng chung trên máy chủ
```

XAMPP chỉ còn dùng Apache để mở giao diện local. Không cần Start MySQL nếu project này không dùng MySQL local cho phần khác.

## 2. File đã thay đổi

- `index.html`
  - thêm `https://kio.dvqt.vn/list.js`
  - thêm `https://kio.dvqt.vn/krud.js`
  - thêm `js/kio-api.js`
- `js/kio-api.js`
  - adapter chung đọc/ghi server
- `js/purchase-api.js`
  - giữ nguyên interface `PurchaseAPI` hiện tại nhưng chuyển sang server KIO
- `js/inventory-api.js`
  - giữ nguyên interface `InventoryAPI` hiện tại nhưng chuyển sang server KIO
- đã bỏ thư mục `api/` và `database/` local để tránh nhầm với mô hình cũ.

Business logic ở `app.js`, `mod-purchases.js`, `mod-inventory.js`, `data.js` không bị viết lại.

## 3. API mẫu của sếp được dùng như thế nào

Đọc danh sách:

```js
getKrudList({
  table: 'lenam_materials',
  page: 1,
  limit: 1000,
  sort: { id: 'ASC' },
  where: []
})
```

Thêm/sửa:

```js
sendFormDataKRUD('insert', 'lenam_materials', null, '#form')
sendFormDataKRUD('update', 'lenam_materials', id, '#form')
```

Xóa:

```js
krud('delete', 'lenam_materials', {}, id)
```

Source đã bọc các hàm này trong `KioStore`, nên các module nghiệp vụ không cần gọi trực tiếp.

## 4. Danh sách bảng cần có trên server

### Purchase

- `lenam_suppliers`
- `lenam_purchase_requests`
- `lenam_supplier_quotations`
- `lenam_purchase_orders`
- `lenam_goods_receipts`
- `lenam_supplier_payments`
- `lenam_purchase_price_history`
- `lenam_supplier_evaluations`

### Inventory / Master

- `lenam_warehouses`
- `lenam_warehouse_locations`
- `lenam_inventory_lots`
- `lenam_inventory_balances`
- `lenam_stock_transfers`
- `lenam_inventory_counts`
- `lenam_inventory_transactions`
- `lenam_goods_issues`
- `lenam_stock_moves`
- `lenam_inventory_audit_logs`
- `lenam_material_return_requests`
- `lenam_material_return_history`
- `lenam_material_inspections`
- `lenam_item_categories`
- `lenam_materials`
- `lenam_semi_finished_products`
- `lenam_finished_products`
- `lenam_inventory_settings`

## 5. Cấu trúc tối thiểu của mỗi bảng

Frontend KHÔNG tạo bảng. Sếp/admin database cần tạo các bảng trên server trước.

Để giữ nguyên logic object hiện tại, mỗi bảng chỉ cần tối thiểu:

```text
id       : khóa chính tự tăng
payload  : TEXT hoặc LONGTEXT
```

Ví dụ yêu cầu kỹ thuật gửi cho sếp/admin:

```text
Tên bảng: lenam_materials
- id: INT, PRIMARY KEY, AUTO_INCREMENT
- payload: LONGTEXT
```

Tương tự cho các bảng `lenam_*` phía trên.

Lý do dùng `payload`: source hiện tại có nhiều object lồng nhau (PR items, PO items, lot, QC, lịch sử...). Lưu JSON giúp kết nối server mà không phải thay business logic hiện hữu. Khi hệ thống ổn định có thể chuẩn hóa schema từng bảng ở giai đoạn sau.

## 6. Cách chạy

1. Copy project vào:

```text
C:\xampp\htdocs\lenam
```

2. Start `Apache` trong XAMPP.

3. Mở:

```text
http://localhost/lenam/
```

4. Dùng `Ctrl + F5` lần đầu để browser lấy JS mới.

## 7. Cách kiểm tra server đã kết nối

Mở F12 → Console.

Khi thành công có thể thấy:

```text
[PurchaseAPI] Đã nạp Purchase từ KIO server.
[InventoryAPI] Đã nạp Kho/Master từ KIO server.
```

Nếu các bảng project đang trống ở lần đầu:

```text
[PurchaseAPI] Các bảng Purchase trên server đang trống, seed dữ liệu hiện tại lần đầu.
[InventoryAPI] Các bảng Kho trên server đang trống, seed dữ liệu hiện tại lần đầu.
```

Sau đó:

```text
[PurchaseAPI] Đã đồng bộ Purchase với KIO server.
[InventoryAPI] Đã đồng bộ Kho/Master với KIO server.
```

## 8. Cách test persistence

### Danh mục / nguyên liệu

1. Tạo danh mục.
2. Tạo nguyên liệu.
3. Refresh F5.
4. Danh mục và nguyên liệu phải còn.

### Purchase

1. Tạo PR.
2. Chọn NCC theo logic hiện tại.
3. Refresh F5.
4. PR phải còn.
5. Duyệt → PO → nhập kho như logic cũ.

### Inventory / QC

1. Nhập kho từ PO.
2. Dòng vật tư xuất hiện, chưa cộng tồn nếu đang chờ QC.
3. Refresh F5 → vẫn còn.
4. QC đạt một phần/không đạt theo logic hiện tại.
5. Refresh F5 → trạng thái và số lượng vẫn còn.
6. Trả NCC phần lỗi → ghi chú lỗi mất theo logic hiện tại.

## 9. Nếu thấy lỗi `table ... not found`

Đây không phải lỗi frontend. Có nghĩa bảng `lenam_*` đó chưa được tạo trên database server.

Gửi cho sếp/admin tên bảng xuất hiện trong lỗi và yêu cầu tạo bảng đó theo mục 5.

## 10. Nếu `kio.dvqt.vn/list.js` hoặc `krud.js` không tải được

F12 → Network và tìm:

```text
list.js
krud.js
```

Phải HTTP 200.

Nếu không tải được thì máy phải truy cập được `kio.dvqt.vn`/mạng công ty.

## 11. Các nguyên tắc đang được giữ nguyên

- `DB.*` vẫn là data model mà UI/module đang sử dụng.
- PR → Duyệt → PO → Nhập kho → QC → Tồn kho không bị đổi logic.
- Các action CRUD hiện tại không bị viết lại nghiệp vụ.
- Adapter chỉ đứng giữa `DB.*` và server.
- Không còn `api/purchase.php`, `api/inventory.php`, `config.php` hay SQL local trong bản này.

## 12. Lưu ý quan trọng

API mẫu của sếp cho thấy cách LIST/KRUD với bảng đã tồn tại, nhưng không có chức năng CREATE TABLE. Vì vậy việc tạo bảng trên database server phải do tài khoản/admin có quyền thực hiện hoặc theo công cụ nội bộ của công ty.

Nếu server đã có schema khác (không phải `id + payload`), cần lấy cấu trúc bảng thật từ sếp/admin rồi map adapter tương ứng; không nên tự đoán field.
