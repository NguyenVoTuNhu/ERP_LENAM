/* ============================================================================
 * KIO SERVER ADAPTER - CHUNKED PAYLOAD v2
 *
 * Dùng đúng API mẫu của công ty:
 *   - getKrudList(...) từ https://kio.dvqt.vn/list.js
 *   - sendFormDataKRUD(...) / krud(...) từ https://kio.dvqt.vn/krud.js
 *
 * KHÔNG thay đổi business logic. Các module vẫn dùng DB.* như cũ.
 *
 * Vì cột `payload` trên server có thể là VARCHAR ngắn, một object nghiệp vụ
 * lớn sẽ bị lỗi MySQL 1406 (Data too long). Adapter này chia một record JSON
 * thành nhiều dòng payload nhỏ, rồi tự ghép lại khi đọc.
 *
 * Server chỉ cần mỗi bảng có tối thiểu:
 *   id      : khóa chính tự tăng
 *   payload : VARCHAR/TEXT (VARCHAR ngắn vẫn dùng được)
 * ========================================================================== */
const KioStore = (() => {
  const PAGE_SIZE = 1000;
  const FORM_ID = '__kio_payload_form__';
  // 120 ký tự giúp payload hoàn chỉnh vẫn an toàn với VARCHAR(255).
  const CHUNK_SIZE = 120;
  const FORMAT_VERSION = 2;

  function assertReady() {
    if (typeof getKrudList !== 'function') {
      throw new Error('Chưa tải https://kio.dvqt.vn/list.js');
    }
    if (typeof sendFormDataKRUD !== 'function' || typeof krud !== 'function') {
      throw new Error('Chưa tải https://kio.dvqt.vn/krud.js');
    }
  }

  function clonePlain(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function keyOf(item, index = 0) {
    if (item && typeof item === 'object') {
      const candidates = [
        item.id, item.code, item.key, item.lotId, item.lotNumber,
        item.transactionId, item.transferId, item.countId, item.requestId,
        item.inspectionId, item.moveId,
      ];
      const found = candidates.find(v => v !== undefined && v !== null && String(v) !== '');
      if (found !== undefined) return String(found);
    }
    return `ROW-${index + 1}`;
  }

  function splitText(text, size = CHUNK_SIZE) {
    const out = [];
    for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
    return out.length ? out : [''];
  }

  function encodeItem(item, index) {
    const key = keyOf(item, index);
    const raw = JSON.stringify(clonePlain(item));
    const chunks = splitText(raw);
    return {
      key,
      raw,
      payloads: chunks.map((data, i) => JSON.stringify({
        v: FORMAT_VERSION,
        k: key,
        i,
        n: chunks.length,
        d: data,
      })),
    };
  }

  function parsePayload(raw) {
    if (raw == null || raw === '') return null;
    let parsed = raw;
    if (typeof raw === 'string') {
      try { parsed = JSON.parse(raw); }
      catch (_) { return null; }
    }
    return parsed && typeof parsed === 'object' ? parsed : null;
  }

  async function listRows(table) {
    assertReady();
    const out = [];
    let page = 1;

    while (true) {
      const res = await getKrudList({
        table,
        page,
        limit: PAGE_SIZE,
        sort: { id: 'ASC' },
        where: [],
      });
      if (!res || !res.success) {
        throw new Error(res?.error || `Không đọc được bảng ${table}`);
      }
      const rows = Array.isArray(res.data) ? res.data : [];
      out.push(...rows);
      if (rows.length < PAGE_SIZE || out.length >= Number(res.total || 0)) break;
      page += 1;
    }
    return out;
  }

  function groupRemoteRows(rows) {
    const groups = new Map();

    rows.forEach(row => {
      const parsed = parsePayload(row.payload);
      if (!parsed) return;

      // Format chunk v2.
      if (parsed.v === FORMAT_VERSION && parsed.k != null && Number.isInteger(Number(parsed.i))) {
        const key = String(parsed.k);
        if (!groups.has(key)) groups.set(key, { key, rows: [], parts: [], legacy: false });
        const g = groups.get(key);
        g.rows.push(row);
        g.parts.push({ i: Number(parsed.i), n: Number(parsed.n || 0), d: String(parsed.d ?? '') });
        return;
      }

      // Hỗ trợ payload cũ { key, data } từ adapter v1.
      if (Object.prototype.hasOwnProperty.call(parsed, 'data')) {
        const key = String(parsed.key ?? keyOf(parsed.data, 0));
        if (!groups.has(key)) groups.set(key, { key, rows: [], parts: [], legacy: true, legacyData: parsed.data });
        const g = groups.get(key);
        g.rows.push(row);
        g.legacy = true;
        g.legacyData = parsed.data;
        return;
      }

      // Hỗ trợ trường hợp trước đó payload lưu thẳng object.
      const key = keyOf(parsed, 0);
      if (!groups.has(key)) groups.set(key, { key, rows: [], parts: [], legacy: true, legacyData: parsed });
      const g = groups.get(key);
      g.rows.push(row);
      g.legacy = true;
      g.legacyData = parsed;
    });

    for (const g of groups.values()) {
      if (g.legacy) {
        try { g.raw = JSON.stringify(g.legacyData); } catch (_) { g.raw = ''; }
        g.data = g.legacyData;
        continue;
      }
      g.parts.sort((a, b) => a.i - b.i);
      const raw = g.parts.map(p => p.d).join('');
      g.raw = raw;
      try { g.data = JSON.parse(raw); }
      catch (_) { g.data = null; }
    }

    return groups;
  }

  async function listCollection(table) {
    const rows = await listRows(table);
    const groups = groupRemoteRows(rows);
    return [...groups.values()].map(g => g.data).filter(Boolean);
  }

  function ensurePayloadForm() {
    let form = document.getElementById(FORM_ID);
    if (form) return form;
    form = document.createElement('form');
    form.id = FORM_ID;
    form.style.display = 'none';
    form.innerHTML = '<textarea class="data-element" name="payload"></textarea>';
    document.body.appendChild(form);
    return form;
  }

  async function writePayload(action, table, recordId, payloadText) {
    assertReady();
    const form = ensurePayloadForm();
    form.querySelector('[name="payload"]').value = payloadText;
    const res = await sendFormDataKRUD(action, table, recordId || null, `#${FORM_ID}`);
    if (!res || !res.success) {
      throw new Error(res?.error || `${action} thất bại ở bảng ${table}`);
    }
    return res;
  }

  async function deleteRows(table, rows) {
    for (const row of rows || []) {
      const res = await krud('delete', table, {}, row.id);
      if (!res || !res.success) {
        throw new Error(res?.error || `Không xóa được record ${row.id} ở ${table}`);
      }
    }
  }

  async function insertEncoded(table, encoded) {
    for (const payloadText of encoded.payloads) {
      await writePayload('insert', table, null, payloadText);
    }
  }

  // async function syncCollection(table, items) {
  //   assertReady();
  //   const local = (Array.isArray(items) ? items : []).map(encodeItem);
  //   const remoteRows = await listRows(table);
  //   const remoteGroups = groupRemoteRows(remoteRows);
  //   const localKeys = new Set(local.map(x => x.key));

  //   // Insert/update từng record nghiệp vụ. Nếu nội dung thay đổi thì thay cả bộ chunks.
  //   for (const encoded of local) {
  //     const remote = remoteGroups.get(encoded.key);
  //     if (!remote) {
  //       await insertEncoded(table, encoded);
  //       continue;
  //     }
  //     if (remote.raw !== encoded.raw || remote.legacy) {
  //       await deleteRows(table, remote.rows);
  //       await insertEncoded(table, encoded);
  //     }
  //   }

  //   // Xóa record server không còn tồn tại ở DB.* hiện tại.
  //   for (const [key, remote] of remoteGroups.entries()) {
  //     if (!localKeys.has(key)) await deleteRows(table, remote.rows);
  //   }

  //   return true;
  // }

  async function syncCollection(table, items) {

    assertReady();

    const local = (Array.isArray(items) ? items : []).map(encodeItem);

    const remoteRows = await listRows(table);
    const remoteGroups = groupRemoteRows(remoteRows);

    for (const encoded of local) {

        const remote = remoteGroups.get(encoded.key);

        if (!remote) {

            await insertEncoded(table, encoded);

            continue;
        }

        if (remote.raw !== encoded.raw || remote.legacy) {

            await deleteRows(table, remote.rows);

            await insertEncoded(table, encoded);
        }
    }

    return true;
  }

  async function saveSingleton(table, key, data) {
    return syncCollection(table, [{ id: key, ...clonePlain(data) }]);
  }

  async function loadSingleton(table, key) {
    const rows = await listCollection(table);
    return rows.find(x => String(x?.id) === String(key)) || null;
  }

  return {
    listRows,
    listCollection,
    syncCollection,
    saveSingleton,
    loadSingleton,
  };
})();
