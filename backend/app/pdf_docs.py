import io
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm

def build_po_pdf(po_no: str, supplier_name: str, doc_date: str | None, items: list[dict], note: str | None) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4

    c.setFont("Helvetica-Bold", 16)
    c.drawString(20*mm, h-20*mm, "進貨單 Purchase Order")
    c.drawRightString(w-20*mm, h-20*mm, po_no)

    c.setFont("Helvetica", 11)
    y = h-35*mm
    c.drawString(20*mm, y, f"供應商：{supplier_name}")
    c.drawString(120*mm, y, f"日期：{doc_date or '-'}")

    y -= 12*mm
    c.setFont("Helvetica-Bold", 11)
    c.drawString(20*mm, y, "明細")
    y -= 8*mm
    c.setFont("Helvetica", 10)

    for it in items:
        # it: {product_name, qty, unit, note}
        line = f"{it.get('product_name','')}  數量:{it.get('qty')} {it.get('unit','')}"
        if it.get("note"):
            line += f"  ({it.get('note')})"
        c.drawString(20*mm, y, line[:95])
        y -= 6*mm
        if y < 30*mm:
            c.showPage()
            y = h-20*mm

    y -= 6*mm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(20*mm, y, "備註：")
    c.setFont("Helvetica", 10)
    c.drawString(35*mm, y, (note or "-")[:95])

    c.showPage()
    c.save()
    return buf.getvalue()

def build_so_pdf(so_no: str, customer_name: str, doc_date: str | None, items: list[dict], note: str | None, customer_address: str | None = None, customer_phone: str | None = None) -> bytes:
    """估價/出貨單 PDF - 陣列式印表機格式（固定欄位寬度，按照圖二格式）"""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4

    # 使用等寬字體以確保固定欄位寬度
    c.setFont("Courier-Bold", 14)
    c.drawString(20*mm, h-20*mm, "估價 / 出貨單")
    c.drawRightString(w-20*mm, h-20*mm, so_no)

    # 客戶資訊區塊（固定位置）
    c.setFont("Courier", 10)
    y = h-35*mm
    c.drawString(20*mm, y, f"客戶名稱：{customer_name}")
    y -= 6*mm
    c.drawString(20*mm, y, f"送貨地址：{customer_address or '-'}")
    y -= 6*mm
    c.drawString(20*mm, y, f"聯繫電話：{customer_phone or '-'}")
    y -= 6*mm
    c.drawString(20*mm, y, f"日期：{doc_date or '-'}")

    y -= 10*mm
    # 表頭（按照圖二格式：項、品名規格、MARK、報價單位、件入數(箱入數)、件數(箱數)、單價、小計、備註）
    c.setFont("Courier-Bold", 9)
    header_x = 15*mm
    col_widths = [8*mm, 60*mm, 25*mm, 20*mm, 25*mm, 20*mm, 25*mm, 25*mm, 30*mm]
    c.drawString(header_x, y, "項")
    c.drawString(header_x + col_widths[0], y, "品名規格")
    c.drawString(header_x + col_widths[0] + col_widths[1], y, "MARK")
    c.drawString(header_x + col_widths[0] + col_widths[1] + col_widths[2], y, "報價單位")
    c.drawString(header_x + col_widths[0] + col_widths[1] + col_widths[2] + col_widths[3], y, "件入數(箱入數)")
    c.drawString(header_x + col_widths[0] + col_widths[1] + col_widths[2] + col_widths[3] + col_widths[4], y, "件數(箱數)")
    c.drawString(header_x + col_widths[0] + col_widths[1] + col_widths[2] + col_widths[3] + col_widths[4] + col_widths[5], y, "單價")
    c.drawString(header_x + col_widths[0] + col_widths[1] + col_widths[2] + col_widths[3] + col_widths[4] + col_widths[5] + col_widths[6], y, "小計")
    c.drawString(header_x + col_widths[0] + col_widths[1] + col_widths[2] + col_widths[3] + col_widths[4] + col_widths[5] + col_widths[6] + col_widths[7], y, "備註")

    y -= 8*mm
    c.setFont("Courier", 9)
    
    total_case_qty = 0
    total_amount = 0.0
    price_unit_used = None
    
    # 明細（固定欄位寬度對齊）
    for idx, it in enumerate(items, 1):
        unit_price = float(it.get('unit_price', 0) or 0)
        price_unit = it.get('price_unit', '件') or '件'
        if not price_unit_used:
            price_unit_used = price_unit
        case_qty = float(it.get('case_qty', it.get('qty', 0)) or 0)
        subtotal = case_qty * unit_price
        total_case_qty += case_qty
        total_amount += subtotal
        
        product_sku = it.get('product_sku', '') or ''
        product_name = it.get('product_name', '') or ''
        product_spec = it.get('product_spec', '') or ''
        # 品名規格：貨號 + 產品名稱 + 規格
        product_full = ' '.join(filter(None, [product_sku, product_name, product_spec]))[:50]
        mark = it.get('mark', '') or ''
        pieces_per_case = it.get('pieces_per_case', '') or ''
        note_text = it.get('note', '') or ''
        
        # 固定欄位寬度對齊
        item_x = header_x
        c.drawString(item_x, y, str(idx))
        c.drawString(item_x + col_widths[0], y, product_full[:28])
        c.drawString(item_x + col_widths[0] + col_widths[1], y, mark[:10])
        c.drawString(item_x + col_widths[0] + col_widths[1] + col_widths[2], y, price_unit[:8])
        c.drawString(item_x + col_widths[0] + col_widths[1] + col_widths[2] + col_widths[3], y, str(pieces_per_case) if pieces_per_case else '-')
        # 件數(箱數) 使用粗體
        c.setFont("Courier-Bold", 9)
        c.drawString(item_x + col_widths[0] + col_widths[1] + col_widths[2] + col_widths[3] + col_widths[4], y, str(int(case_qty)))
        c.setFont("Courier", 9)
        c.drawString(item_x + col_widths[0] + col_widths[1] + col_widths[2] + col_widths[3] + col_widths[4] + col_widths[5], y, f"NT${unit_price:.2f}")
        c.drawString(item_x + col_widths[0] + col_widths[1] + col_widths[2] + col_widths[3] + col_widths[4] + col_widths[5] + col_widths[6], y, f"NT${subtotal:.2f}")
        c.drawString(item_x + col_widths[0] + col_widths[1] + col_widths[2] + col_widths[3] + col_widths[4] + col_widths[5] + col_widths[6] + col_widths[7], y, note_text[:15])
        
        y -= 6*mm
        if y < 60*mm:
            c.showPage()
            y = h-20*mm
            # 新頁面重複表頭
            c.setFont("Courier-Bold", 9)
            c.drawString(header_x, y, "項")
            c.drawString(header_x + col_widths[0], y, "品名規格")
            c.drawString(header_x + col_widths[0] + col_widths[1], y, "MARK")
            c.drawString(header_x + col_widths[0] + col_widths[1] + col_widths[2], y, "報價單位")
            c.drawString(header_x + col_widths[0] + col_widths[1] + col_widths[2] + col_widths[3], y, "件入數(箱入數)")
            c.drawString(header_x + col_widths[0] + col_widths[1] + col_widths[2] + col_widths[3] + col_widths[4], y, "件數(箱數)")
            c.drawString(header_x + col_widths[0] + col_widths[1] + col_widths[2] + col_widths[3] + col_widths[4] + col_widths[5], y, "單價")
            c.drawString(header_x + col_widths[0] + col_widths[1] + col_widths[2] + col_widths[3] + col_widths[4] + col_widths[5] + col_widths[6], y, "小計")
            c.drawString(header_x + col_widths[0] + col_widths[1] + col_widths[2] + col_widths[3] + col_widths[4] + col_widths[5] + col_widths[6] + col_widths[7], y, "備註")
            y -= 8*mm
            c.setFont("Courier", 9)

    # 底部總計（按照圖二格式：總件數、銷貨總金額）
    y -= 8*mm
    c.setFont("Courier-Bold", 9)
    c.drawString(header_x, y, f"總件數：{int(total_case_qty)}{price_unit_used or '件'}")
    c.drawRightString(w - 20*mm, y, f"銷貨總金額：NT${total_amount:.2f}")

    y -= 10*mm
    if note:
        c.setFont("Courier-Bold", 9)
        c.drawString(20*mm, y, "備註：")
        c.setFont("Courier", 9)
        # 備註可能多行
        note_lines = (note or "").split('\n')
        for note_line in note_lines[:5]:  # 最多5行
            c.drawString(35*mm, y, note_line[:80])
            y -= 6*mm
            if y < 30*mm:
                break

    c.showPage()
    c.save()
    return buf.getvalue()

def build_so_picklist_pdf(so_no: str, customer_name: str, doc_date: str | None, items: list[dict], note: str | None) -> bytes:
    """揀貨單 PDF（不顯示單價）"""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4

    c.setFont("Helvetica-Bold", 16)
    c.drawString(20*mm, h-20*mm, "揀貨單 Pick List")
    c.drawRightString(w-20*mm, h-20*mm, so_no)

    c.setFont("Helvetica", 11)
    y = h-35*mm
    c.drawString(20*mm, y, f"客戶：{customer_name}")
    c.drawString(120*mm, y, f"日期：{doc_date or '-'}")

    y -= 12*mm
    c.setFont("Helvetica-Bold", 11)
    c.drawString(20*mm, y, "明細")
    y -= 8*mm
    c.setFont("Helvetica", 10)

    for it in items:
        line = f"{it.get('product_name','')}  數量:{it.get('qty')} {it.get('unit','')}"
        if it.get("note"):
            line += f"  ({it.get('note')})"
        c.drawString(20*mm, y, line[:95])
        y -= 6*mm
        if y < 30*mm:
            c.showPage()
            y = h-20*mm

    y -= 6*mm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(20*mm, y, "備註：")
    c.setFont("Helvetica", 10)
    c.drawString(35*mm, y, (note or "-")[:95])

    c.showPage()
    c.save()
    return buf.getvalue()

def build_so_shipping_pdf(
    so_no: str, 
    customer_name: str, 
    doc_date: str | None, 
    items: list[dict], 
    note: str | None,
    shipped_at: str | None = None,
    logistics_no: str | None = None,
    ship_note: str | None = None
) -> bytes:
    """出貨單 PDF（含出貨資訊）"""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4

    c.setFont("Helvetica-Bold", 16)
    c.drawString(20*mm, h-20*mm, "出貨單 Shipping Order")
    c.drawRightString(w-20*mm, h-20*mm, so_no)

    c.setFont("Helvetica", 11)
    y = h-35*mm
    c.drawString(20*mm, y, f"客戶：{customer_name}")
    c.drawString(120*mm, y, f"日期：{doc_date or '-'}")

    y -= 8*mm
    if shipped_at:
        c.drawString(20*mm, y, f"出貨時間：{shipped_at}")
    if logistics_no:
        c.drawString(120*mm, y, f"物流單號：{logistics_no}")

    y -= 12*mm
    c.setFont("Helvetica-Bold", 11)
    c.drawString(20*mm, y, "明細")
    y -= 8*mm
    c.setFont("Helvetica", 10)

    for it in items:
        unit_price = it.get('unit_price', 0) or 0
        price_unit = it.get('price_unit', '件') or '件'
        subtotal = (it.get('qty', 0) or 0) * unit_price
        line = f"{it.get('product_name','')}  數量:{it.get('qty')} {it.get('unit','')}  單價:{unit_price:.2f}/{price_unit}  小計:{subtotal:.2f}"
        if it.get("note"):
            line += f"  ({it.get('note')})"
        c.drawString(20*mm, y, line[:95])
        y -= 6*mm
        if y < 30*mm:
            c.showPage()
            y = h-20*mm

    y -= 6*mm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(20*mm, y, "備註：")
    c.setFont("Helvetica", 10)
    note_text = note or ""
    if ship_note:
        note_text = f"{note_text} | 出貨備註：{ship_note}" if note_text else f"出貨備註：{ship_note}"
    c.drawString(35*mm, y, (note_text or "-")[:95])

    c.showPage()
    c.save()
    return buf.getvalue()

