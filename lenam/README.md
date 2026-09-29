# Lê Nam ERP — Quản lý sản xuất và kinh doanh đậu hủ

Lê Nam ERP là hệ thống ERP nội bộ phục vụ quản lý mua hàng, kho, sản xuất, bán hàng, QC/QA, nhà hàng/cửa hàng và các nghiệp vụ liên quan của Công ty Lê Nam.

Phiên bản hiện tại được phát triển theo kiến trúc frontend JavaScript chạy trên Apache/XAMPP, sử dụng KIO API làm lớp đọc/ghi dữ liệu dùng chung. Một số phân hệ phụ trợ vẫn dùng localStorage để lưu tạm trong giai đoạn hoàn thiện.

> Mục tiêu của source hiện tại là giữ nguyên logic nghiệp vụ đã xây dựng, đồng thời tách rõ UI, business logic và persistence để dễ mở rộng và tránh phát sinh lỗi đồng bộ dữ liệu.

---

## 1. Chạy project

### Yêu cầu

- Windows 10/11
- XAMPP hoặc Apache tương đương
- Trình duyệt Chrome/Edge
- Có kết nối tới KIO API của công ty

### Cách chạy

1. Giải nén project vào:

```text
C:\xampp\htdocs\lenam\
```

2. Mở XAMPP và Start **Apache**.

3. Truy cập:

```text
http://localhost/lenam/
```

4. Sau khi thay source, nên dùng:

```text
Ctrl + F5
```

để bỏ cache JavaScript cũ.

Project sử dụng hai thư viện KIO do công ty cung cấp:

```html
<script src="https://kio.dvqt.vn/list.js"></script>
<script src="https://kio.dvqt.vn/krud.js"></script>
```

Các hàm chính:

```text
getKrudList(...)       → đọc dữ liệu
sendFormDataKRUD(...)  → thêm / cập nhật
krud('delete', ...)    → xóa
```

---

## 2. Kiến trúc tổng thể

```text
Người dùng
   ↓
UI / Modal / View
   ↓
Action trong app.js và mod-*.js
   ↓
DB.* — state runtime phía frontend
   ↓
API layer
   ├── PurchaseAPI
   ├── InventoryAPI
   ├── CRMAPI
   ├── ProductionAPI
   └── SystemAPI
   ↓
KioStore / kio-api.js
   ↓
list.js / krud.js
   ↓
KIO Server
```

Nguyên tắc quan trọng:

- Module giao diện không gọi KIO trực tiếp.
- Business logic nằm trong `app.js` và `js/modules/`.
- Persistence nằm trong `js/api/`.
- `data.js` chỉ dùng làm dữ liệu demo/seed và cấu hình ban đầu, không phải database runtime.
- Cache local chỉ giúp mở màn hình nhanh; dữ liệu server vẫn là nguồn chính đối với các module đã kết nối KIO.

---

## 3. Cấu trúc source

```text
lenam/
├── index.html
├── README.md
├── LOGIN_CREDENTIALS_ACTORS.csv
├── css/
│   └── style.css
└── js/
    ├── app.js
    ├── api/
    │   ├── kio-config.js
    │   ├── kio-data-utils.js
    │   ├── kio-api.js
    │   ├── purchase-api.js
    │   ├── inventory-api.js
    │   ├── crm-api.js
    │   ├── production-api.js
    │   └── system-api.js
    ├── core/
    │   ├── app.core.js
    │   └── charts.js
    ├── data/
    │   └── data.js
    └── modules/
        ├── mod-dashboard.js
        ├── mod-purchases.js
        ├── mod-inventory.js
        ├── mod-production.js
        ├── mod-crm-sales.js
        ├── mod-enterprise.js
        ├── mod-customers.js
        ├── mod-orders.js
        ├── mod-hr.js
        └── mod-reports.js
```

---

## 4. Các phân hệ chính

### 4.1 Mua hàng

Luồng hiện tại:

```text
Đề nghị mua
   ↓
Duyệt mua
   ↓
Báo giá nhà cung cấp
   ↓
Đơn đặt hàng PO
   ↓
Nhập kho nguyên liệu
   ↓
QC đầu vào
   ↓
Cộng tồn / trả NCC nếu không đạt
```

Chức năng chính:

- Nhà cung cấp
- Đề nghị mua PR
- Duyệt PR
- Báo giá nhà cung cấp
- PO
- Nhập kho
- Công nợ nhà cung cấp
- Lịch sử giá
- Đánh giá nhà cung cấp

Rule quan trọng:

- PR chưa duyệt mới được chỉnh sửa/xóa theo trạng thái cho phép.
- Quyền duyệt được kiểm tra theo role/permission.
- Dữ liệu mua hàng được lưu ở các bảng KIO riêng.

---

### 4.2 Kho

Các khu vực tồn kho:

```text
Kho nguyên liệu
Kho bán thành phẩm
Kho thành phẩm
Kho sản xuất
Kho cửa hàng
Kho hàng lỗi
Kho hàng trả về
```

Chức năng:

- Nhập kho
- Xuất kho
- Chuyển kho
- Kiểm kê
- Tồn kho
- Lô & hạn sử dụng
- Kho & vị trí lưu trữ
- Sổ giao dịch kho
- Theo dõi tồn tối thiểu
- Theo dõi số lô

#### Xuất NVL cho sản xuất

Yêu cầu nguyên liệu từ Sản xuất được đưa trực tiếp vào:

```text
Kho → Xuất kho → Kho nguyên liệu
```

Luồng:

```text
Sản xuất lập yêu cầu NVL
   ↓
Kho nhận yêu cầu
   ↓
Kho duyệt
   ↓
Kho xuất NVL
   ↓
Trừ tồn theo lô
   ↓
Tạo phiếu xuất kho
   ↓
Ghi lịch sử inventoryTransactions
```

Mọi dòng dữ liệu nghiệp vụ đều có thao tác **Xem chi tiết**.

---

## 5. BOM / Định mức

BOM được khai báo theo từng thành phẩm.

Mỗi BOM gồm:

```text
Thành phẩm
├── Danh sách nguyên liệu
│   ├── Mã nguyên liệu
│   └── Định mức cho 1 đơn vị thành phẩm
└── Routing / Công đoạn
    └── Chọn công đoạn
```

Phần công đoạn hiện tại **không yêu cầu nhập số lượng**. Người dùng chỉ chọn công đoạn áp dụng cho sản phẩm.

Ví dụ:

```text
Đậu hủ cứng — 1 Khối
├── Đậu nành: 0.18 Kg
├── Thạch cao: 0.004 Kg
├── Muối: 0.001 Kg
└── Hộp PP: 1 Cái
```

Khi sản xuất 100 khối:

```text
Nhu cầu NVL = Định mức BOM × 100
```

BOM là nguồn dữ liệu chuẩn để tự động sinh yêu cầu NVL cho kế hoạch và lệnh sản xuất.

---

## 6. Kế hoạch sản xuất

### Luồng từ Kho

```text
Kho phát hiện thành phẩm thiếu/hết tồn
   ↓
Tạo kế hoạch sản xuất
   ↓
Người dùng tự chọn thành phẩm cần sản xuất
   ↓
Duyệt kế hoạch
   ↓
Kế hoạch chuyển sang phân hệ Sản xuất
```

Lưu ý:

- Hệ thống chỉ gợi ý thành phẩm thiếu/hết hàng.
- Không tự tick thành phẩm khi mở form.
- Kế hoạch phía Sản xuất không được sửa nội dung kế hoạch đã được Kho phê duyệt.

### Phía Sản xuất

Sau khi kế hoạch được duyệt:

```text
Sản xuất xem kế hoạch
   ↓
Nạp BOM của từng thành phẩm
   ↓
Điều chỉnh NVL thực tế nếu cần
   ↓
Bổ sung nguyên liệu ngoài BOM nếu có
   ↓
Chọn công đoạn / gia công
   ↓
Lập phiếu yêu cầu NVL
```

Việc điều chỉnh nguyên liệu trong kế hoạch **không tự sửa BOM chuẩn**.

---

## 7. Lệnh sản xuất

Luồng chuẩn của LSX:

```text
Tạo Lệnh sản xuất
   ↓
Chờ duyệt
   ↓
Duyệt LSX
   ↓
Chờ sản xuất
   ↓
Kho đã cấp NVL theo phiếu yêu cầu
   ↓
Bắt đầu sản xuất
   ↓
Thực hiện các công đoạn
   ↓
Hoàn tất công đoạn sản xuất
   ↓
Tạo tồn ảo Thành phẩm - Chờ QC
   ↓
QC / QA → Kiểm tra thành phẩm
   ↓
QC đạt → cộng số đạt vào tồn kho thành phẩm
QC không đạt → không cộng tồn
   ↓
Đã nhập kho
```

### Quy tắc quan trọng

- LSX chưa duyệt mới được xóa.
- LSX đã duyệt hoặc đã bắt đầu sản xuất không được xóa.
- Không tự trừ NVL lần thứ hai khi bắt đầu công đoạn.
- NVL được trừ tại thời điểm Kho thực hiện xuất NVL.
- Nếu thành phẩm có BOM, phiếu yêu cầu NVL sẽ tự lấy BOM × số lượng LSX.
- Mọi LSX đều có màn xem chi tiết.

### QC thành phẩm

QC thành phẩm không còn ghi trực tiếp trong màn Lệnh sản xuất. Khi công đoạn sản xuất cuối trước QC hoàn tất, hệ thống tạo một lô thành phẩm có trạng thái **Chờ QC** và hiển thị trong **Kho → Tồn kho → Kho thành phẩm** dưới dạng số lượng chờ kiểm, chưa tính vào tồn khả dụng.

QC/QA vào **Kiểm tra thành phẩm** để ghi nhận:

```text
Số lượng đạt
Số lượng không đạt
Ghi chú QC
```

Điều kiện:

```text
Số đạt + Số không đạt = Số lượng chờ QC
```

Khi xác nhận QC, chỉ số lượng đạt được cộng vào `qtyOnHand/qtyAvailable` của Kho thành phẩm. Số không đạt được lưu lịch sử QC nhưng không cộng tồn. Hệ thống đồng thời tạo phiếu nhập thành phẩm và giao dịch kho để truy vết theo LSX/lô.

---

## 8. Bán hàng / CRM

Luồng đơn hàng bán:

```text
Tạo đơn hàng
   ↓
Chờ duyệt
   ↓
Duyệt đơn
   ↓
Giữ chỗ tồn kho thành phẩm
   ↓
Kho xác nhận xuất
   ↓
Giảm tồn thực tế
```

Nếu thiếu tồn thành phẩm:

```text
Đơn bán
   ↓
Thiếu tồn
   ↓
Tạo Lệnh sản xuất
   ↓
BOM / NVL / Sản xuất
```

Rule:

- Đơn chưa duyệt mới được xóa.
- Đơn đã duyệt không được xóa.
- Dữ liệu CRM/Bán hàng được lưu ở các bảng KIO riêng.

Các bảng:

```text
lenam_customers
lenam_sales_orders
lenam_crm_opportunities
lenam_customer_care_logs
lenam_crm_complaints
lenam_crm_activities
```

---

## 9. QC / QA

Các luồng QC hiện có:

- QC nguyên liệu đầu vào
- Kiểm tra lô nhập
- Đạt → cộng tồn
- Không đạt → trả nhà cung cấp
- QC thành phẩm tại màn QC / QA → Kiểm tra thành phẩm
- Thành phẩm chờ QC hiển thị ảo trong Kho thành phẩm và chưa tính vào tồn
- Lịch sử QC được liên kết với lô/chứng từ tương ứng

Người kiểm tra QC mặc định lấy theo người dùng đang đăng nhập.

---

## 10. Nhà hàng & Cửa hàng

Các màn đã triển khai:

```text
Tổng quan
POS bán hàng
Tablet Ordering
QR Ordering
Menu / Combo
Recipe / BOM món
Đơn hàng
Chi nhánh
Xuất kho nguyên liệu
Doanh thu
Báo cáo cửa hàng
```

### POS / Tablet / QR

- Chọn chi nhánh
- Chọn món
- Nhập số lượng
- Tạo đơn
- Thanh toán
- Khi thanh toán, hệ thống kiểm tra Recipe/BOM món và tồn kho cửa hàng
- Trừ nguyên liệu theo định lượng Recipe

### Recipe / BOM món

Mỗi món có:

```text
Mã món
Tên món
Nhóm món
Giá bán
Đơn vị
Nguyên liệu
Định lượng
Trạng thái bán
```

Món đã phát sinh đơn không được xóa; chuyển sang trạng thái ngừng bán để giữ lịch sử.

### Persistence hiện tại

Dữ liệu Nhà hàng & Cửa hàng đang được lưu tạm bằng:

```text
localStorage: lenam_restaurant_v1
```

Kho nguyên liệu bị trừ qua InventoryAPI để đảm bảo số liệu tồn kho được cập nhật.

---

## 11. Quy tắc CRUD chung

Nguyên tắc UI hiện tại:

> Màn hình có dữ liệu phải có thao tác **Xem chi tiết**.

CRUD được mở tùy theo trạng thái nghiệp vụ.

Ví dụ:

- Master data: có thể Tạo / Xem / Sửa / Xóa.
- Đơn hàng chưa duyệt: được sửa/xóa.
- Đơn hàng đã duyệt: không được xóa.
- LSX chưa duyệt: được xóa.
- LSX đã duyệt/đang sản xuất: không được xóa.
- Chứng từ đã phát sinh tồn kho: không xóa trực tiếp nếu việc xóa làm sai lịch sử kho.
- Giao dịch ledger/audit luôn ưu tiên giữ lịch sử.

Không chỉ ẩn nút ở UI; action nghiệp vụ cũng phải kiểm tra trạng thái trước khi thực hiện.

---

## 12. Quy tắc ngày

Các form nghiệp vụ có ngày sử dụng ngày hiện tại của trình duyệt.

Nguyên tắc:

```text
Ngày tạo mới >= ngày hiện tại
```

Không cho chọn ngày quá khứ đối với các form tạo nghiệp vụ mới.

Các màn xem lịch sử/bộ lọc báo cáo vẫn có thể sử dụng khoảng ngày quá khứ.

---

## 13. Bảng KIO chính

### Purchase

```text
lenam_suppliers
lenam_purchase_requests
lenam_supplier_quotations
lenam_purchase_orders
lenam_goods_receipts
lenam_supplier_payments
lenam_purchase_price_history
lenam_supplier_evaluations
```

### Inventory / Master

```text
lenam_warehouses
lenam_warehouse_locations
lenam_inventory_lots
lenam_inventory_balances
lenam_stock_transfers
lenam_inventory_counts
lenam_inventory_transactions
lenam_goods_issues
lenam_stock_moves
lenam_inventory_audit_logs
lenam_material_return_requests
lenam_material_return_history
lenam_material_inspections
lenam_item_categories
lenam_materials
lenam_semi_finished_products
lenam_finished_products
```

### CRM / Sales

```text
lenam_customers
lenam_sales_orders
lenam_crm_opportunities
lenam_customer_care_logs
lenam_crm_complaints
lenam_crm_activities
```

### System / Authorization

```text
lenam_users
lenam_roles
lenam_permissions
lenam_role_permissions
lenam_audit_logs
```

Tên bảng KIO được tập trung trong:

```text
js/api/kio-config.js
```

Không khai báo table name rải rác trong module nghiệp vụ.

---

## 14. Cơ chế payload KIO

Adapter hiện sử dụng cấu trúc tối thiểu:

```text
id       → khóa kỹ thuật trên server
payload  → JSON nghiệp vụ
```

Nếu payload lớn hơn giới hạn của server, `kio-api.js` có cơ chế chia nhỏ dữ liệu khi ghi và ghép lại khi đọc.

Không nên tự xử lý chunk trong module nghiệp vụ.

---

## 15. Cache và hiệu năng

Các API chính ưu tiên:

```text
Cache local
   ↓
Render giao diện nhanh
   ↓
Refresh KIO ở background
   ↓
Cập nhật DB.*
   ↓
Render lại khi cần
```

Một số nguyên tắc để tránh hệ thống chậm:

- Không gọi KIO khi chỉ mở modal.
- Không sync toàn bộ collection nếu chỉ một record thay đổi.
- Không seed state lớn khi boot nếu không cần.
- Không gọi refresh cùng một dữ liệu từ nhiều API cùng lúc.
- Không lưu BOM lặp lại ở nhiều nguồn dữ liệu.
- Production persistence được tách nhỏ để tránh tạo hàng trăm request khi khởi động.

Nếu Network xuất hiện hàng trăm request sau khi chỉ mở một màn hình, cần kiểm tra lại bootstrap/sync thay vì tăng debounce ở UI.

---

## 16. Cache key chính

Một số cache key hiện tại:

```text
lenam:kio:purchase-cache:v2
lenam:kio:inventory-cache:v2
lenam:kio:crm-cache:v1
lenam:kio:system-cache:v1
lenam:auth:session:v1
lenam_restaurant_v1
```

Để reset cache Purchase/Inventory trong môi trường test:

```javascript
localStorage.removeItem('lenam:kio:purchase-cache:v2');
localStorage.removeItem('lenam:kio:inventory-cache:v2');
location.reload();
```

Các lệnh trên chỉ xóa cache trình duyệt, không xóa dữ liệu KIO server.

---

## 17. Phân quyền

Quyền được đọc từ:

```text
DB.users
   ↓
roleId
   ↓
DB.roles
   ↓
permissions
```

Các nghiệp vụ quan trọng như duyệt mua, duyệt đơn hàng, duyệt PO và các thao tác quản trị phải kiểm tra permission trước khi thực hiện.

Phân quyền frontend giúp kiểm soát UI và action, nhưng nếu KIO/backend hỗ trợ authorization thì vẫn nên kiểm tra thêm phía server để đảm bảo bảo mật thực sự.

---

## 18. Quy tắc khi phát triển tiếp

Để source không quay lại tình trạng chồng chéo:

1. Không gọi `getKrudList`, `sendFormDataKRUD`, `krud` trực tiếp trong module nghiệp vụ.
2. Không khai báo tên bảng `lenam_*` trực tiếp trong `app.js` hoặc `mod-*.js`.
3. Không dùng `data.js` như database runtime.
4. Không tự động DELETE record server trong hàm sync tổng quát.
5. Không tạo thêm một nguồn BOM thứ hai nếu BOM đã nằm trong master thành phẩm.
6. Mọi dòng dữ liệu mới phải có **Xem chi tiết**.
7. CRUD phải tuân theo trạng thái nghiệp vụ.
8. Chứng từ đã ảnh hưởng tồn kho không được xóa tùy ý.
9. Khi thêm module mới, tách rõ business logic và persistence.
10. Không thay đổi logic module khác nếu yêu cầu chỉ liên quan một phân hệ.

---

## 19. Checklist test nhanh

Sau mỗi lần sửa source nên kiểm tra:

1. Login / Logout hoạt động bình thường.
2. Console không có lỗi JavaScript từ source ERP.
3. Không có 404 file JS/CSS local.
4. Network không phát sinh hàng trăm request bất thường lúc mở màn hình.
5. Purchase đọc được dữ liệu.
6. Inventory đọc được dữ liệu.
7. CRM/Bán hàng đọc được dữ liệu.
8. Tồn kho khớp sau nhập/xuất/chuyển kho.
9. PR → Báo giá → PO → Nhập → QC chạy đúng.
10. Kế hoạch SX → BOM → Yêu cầu NVL → Kho xuất chạy đúng.
11. LSX → Công đoạn → QC → Nhập kho TP chạy đúng.
12. Đơn hàng bán duyệt/xuất kho đúng trạng thái.
13. POS/Restaurant trừ NVL đúng Recipe.
14. F5 không làm mất các dữ liệu đã persistence.
15. Các dòng dữ liệu đều mở được màn chi tiết.

---

## 20. Ghi chú về lỗi trình duyệt

Nếu Console xuất hiện lỗi từ file như:

```text
gads-scrapper.js
```

nhưng file đó không tồn tại trong source project, đây thường là script do extension trình duyệt inject vào trang. Nên thử mở Incognito hoặc tắt extension trước khi kết luận đó là lỗi của ERP.

---

## 21. Phiên bản tài liệu

README này được cập nhật theo source **lenam16** ngày **14/09/2026**.

Các nội dung chính đã phản ánh:

- Mua hàng
- Kho
- BOM / Định mức
- Kế hoạch sản xuất
- Yêu cầu NVL
- Lệnh sản xuất
- QC thành phẩm
- Nhập kho thành phẩm
- Bán hàng / CRM
- Nhà hàng & Cửa hàng
- Phân quyền
- KIO persistence
- Cache và tối ưu request


## Cập nhật Gia công — lenam32

Luồng nghiệp vụ được rút gọn và tích hợp đúng phân hệ:

`Tạo đơn gia công → Duyệt → Kho/Xuất kho nguyên liệu → Giao đối tác → Theo dõi tiến độ → Nhận hàng hoàn thành → QC/QA kiểm tra → Nhập kho thành phẩm → Đối chiếu công nợ`.

- **Gia công → Đơn gia công** là màn chính để tạo, xem, sửa/xóa khi Nháp và duyệt đơn.
- Đơn **Đã duyệt** tự xuất hiện tại **Kho → Xuất kho → Kho nguyên liệu**.
- Sau khi Kho xuất NVL, dòng yêu cầu vẫn còn để Kho **Xác nhận giao đối tác**.
- Sau khi giao, đơn xuất hiện tại **Gia công → Theo dõi tiến độ**.
- Khi tiến độ đạt 100%, ghi nhận hàng hoàn thành; lô hàng tự xuất hiện tại **QC/QA → Kiểm tra thành phẩm**.
- QC xác nhận đạt/lỗi xong, hệ thống chuyển tiếp bước **Nhập kho thành phẩm**; hàng đạt vào Kho thành phẩm, hàng lỗi vào Kho Hàng lỗi.

## Cập nhật Gia công / QC / Kho — lenam35

Luồng Gia công được tách đúng trách nhiệm theo phân hệ:

```text
Kế hoạch gia công
→ Duyệt
→ Kho xuất NVL gia công
→ Giao đối tác
→ Theo dõi tiến độ
→ Ghi nhận hàng hoàn thành
→ QC/QA → Kiểm tra gia công
→ Kho → Nhập kho → Kho thành phẩm
→ Đối chiếu công nợ
```

- **QC / QA** có menu riêng **Kiểm tra gia công**. Hàng đối tác giao về được kiểm tra tại đây, tách biệt với **Kiểm tra thành phẩm** của sản xuất nội bộ.
- QC chỉ xác nhận **số lượng đạt / số lượng lỗi** và ghi chú. QC không tự cộng tồn.
- Sau khi QC hoàn tất, lô hàng được chuyển sang **Kho → Nhập kho → Kho thành phẩm** ở trạng thái **Chờ nhập kho**.
- Kho xác nhận nhập: hàng đạt vào **Kho thành phẩm**, hàng lỗi vào **Kho Hàng lỗi**.
- Đã bỏ menu **Kiểm tra chất lượng** và **Nhập kho hàng gia công** khỏi phân hệ Gia công để tránh trùng trách nhiệm với QC/QA và Kho.


## Cập nhật Bảo trì thiết bị - lenam39
- Đổi tên chỉ số kỹ thuật trên giao diện thành cách gọi dễ hiểu: **Thời gian máy chạy ổn định giữa các lần hỏng**, **Thời gian trung bình để sửa xong một sự cố**, **Tổng thời gian máy ngừng hoạt động**.
- Cảnh báo **Sắp đến hạn bảo trì** khi lịch còn từ 0 đến 7 ngày.
- Cảnh báo **Quá hạn bảo trì** khi ngày kế hoạch đã qua nhưng lịch chưa hoàn thành.

## Google Maps cho Logistics (Routes API)

Bản này hỗ trợ tính quãng đường và thời gian dự kiến theo Google Maps ngay trong **Logistics → Đơn giao hàng → Điều phối**. Khi ghép nhiều đơn, hệ thống gửi Kho xuất phát + các điểm giao đến Google Routes API, sau đó tự tính phí gợi ý theo `đ/km`. Người điều phối vẫn có thể sửa phí dự kiến bằng tay.

### Cấu hình API key

1. Trong Google Cloud, bật **Routes API**. Nếu muốn nhúng bản đồ trực tiếp trong modal, bật thêm **Maps Embed API**.
2. Copy `api/google-maps.local.php.example` thành `api/google-maps.local.php`.
3. Điền key server vào `api_key`. Có thể dùng key browser riêng trong `browser_key` để nhúng bản đồ.
4. File `api/google-maps.local.php` đã được đưa vào `.gitignore`, không commit API key lên GitHub.
5. Đơn giá mặc định được cấu hình bằng `default_rate_per_km` (mặc định 10.000 đ/km).

Nếu chưa cấu hình Google Maps, ERP vẫn chạy bình thường; trường **Km dự kiến (dự phòng)** có thể nhập tay như trước.

### Dữ liệu vị trí

Hệ thống ưu tiên `lat/lng` nếu master Kho hoặc Đơn hàng có khai báo. Nếu chưa có tọa độ, Routes API dùng chuỗi địa chỉ hiện tại. Vì vậy nên khai báo địa chỉ Kho và địa chỉ giao hàng càng chính xác càng tốt.

## Nhà hàng/Cửa hàng & QC/QA - persistence thật trên KIO

Bản này không seed dữ liệu demo cho Nhà hàng/Cửa hàng và QC/QA. Server là nguồn dữ liệu chính.

Các bảng mới dùng prefix `lenam_`:
- `lenam_restaurant_stores`
- `lenam_restaurant_recipes`
- `lenam_restaurant_pos_orders`
- `lenam_restaurant_replenishment_requests`
- `lenam_quality_inspection_records`
- `lenam_quality_capa`
- `lenam_quality_product_recalls`

Tạo các bảng bằng file `docs/lenam_restaurant_quality_tables.sql` trước khi sử dụng chức năng.
Master dùng chung như nguyên liệu, thành phẩm, kho, lô, nhân viên vẫn lấy từ các bảng hiện hữu; module không tạo bản sao master.
