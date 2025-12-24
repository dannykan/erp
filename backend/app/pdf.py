import io
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
import qrcode

def build_work_order_pdf(
    wo_no: str,
    customer_name: str,
    due_date: str | None,
    urgent: bool,
    line: str | None,
    shift: str | None,
    assigned_to: str | None,
    items: list[dict],
    note: str | None,
    qr_url: str,
) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4

    c.setFont("Helvetica-Bold", 18)
    c.drawString(20*mm, height-20*mm, "工單 Work Order")
    c.drawRightString(width-20*mm, height-20*mm, wo_no)

    c.setFont("Helvetica", 11)
    y = height - 35*mm
    c.drawString(20*mm, y, f"客戶：{customer_name}")
    c.drawString(120*mm, y, f"交期：{due_date or '-'}")
    y -= 8*mm
    c.drawString(20*mm, y, f"產線：{line or '-'}")
    c.drawString(80*mm, y, f"班別：{shift or '-'}")
    c.drawString(120*mm, y, f"負責：{assigned_to or '-'}")

    if urgent:
        c.setFont("Helvetica-Bold", 12)
        c.drawRightString(width-20*mm, y, "【急件】")
        c.setFont("Helvetica", 11)

    qr = qrcode.make(qr_url)
    qr_buf = io.BytesIO()
    qr.save(qr_buf)
    qr_buf.seek(0)
    c.drawInlineImage(qr_buf, width-45*mm, height-65*mm, 25*mm, 25*mm)

    y -= 15*mm
    c.setFont("Helvetica-Bold", 11)
    c.drawString(20*mm, y, "明細")
    y -= 6*mm

    c.setFont("Helvetica", 10)
    for it in items:
        line_txt = f"{it['product_name']} / {it.get('spec','')}  數量:{it['qty']} {it.get('unit','')}"
        c.drawString(20*mm, y, line_txt[:80])
        y -= 6*mm

    y -= 6*mm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(20*mm, y, "備註：")
    c.setFont("Helvetica", 10)
    c.drawString(35*mm, y, (note or "-")[:80])

    y = 25*mm
    c.drawString(20*mm, y, "開始：________  完工：________  簽名：________")

    c.showPage()
    c.save()
    return buf.getvalue()

