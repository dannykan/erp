import io
import os
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
import qrcode
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.cidfonts import UnicodeCIDFont

# 註冊支持中文的字體（只使用 TTF，絕對不使用 CID）
CHINESE_FONT = None
CHINESE_FONT_BOLD = None

# 優先使用項目內的字體文件
_font_dir = os.path.join(os.path.dirname(__file__), 'fonts')
font_paths = [
    os.path.join(_font_dir, 'NotoSansCJK-Regular.ttf'),  # Noto Sans CJK（專門支持中文）
    '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',  # 系統字體備選
]

for font_path in font_paths:
    if os.path.exists(font_path) and font_path.endswith('.ttf'):
        try:
            print(f"[FONT] Registering TTF font: {font_path}")
            font = TTFont('ChineseFont', font_path)
            pdfmetrics.registerFont(font)
            CHINESE_FONT = 'ChineseFont'
            CHINESE_FONT_BOLD = 'ChineseFont'
            print(f"[FONT] ✅ Successfully registered TTF font")
            break
        except Exception as e:
            print(f"[FONT] ❌ Failed: {e}")
            continue

if not CHINESE_FONT:
    print("[FONT] ❌ CRITICAL: No TTF Chinese font available!")
    CHINESE_FONT = 'Helvetica'
    CHINESE_FONT_BOLD = 'Helvetica-Bold'

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

    c.setFont(CHINESE_FONT, 18)
    c.drawString(20*mm, height-20*mm, "工單 Work Order")
    c.setFont("Courier-Bold", 18)  # 單號使用等寬字體
    c.drawRightString(width-20*mm, height-20*mm, wo_no)

    c.setFont(CHINESE_FONT, 11)
    y = height - 35*mm
    c.drawString(20*mm, y, f"客戶：{customer_name}")
    c.drawString(120*mm, y, f"交期：{due_date or '-'}")
    y -= 8*mm
    c.drawString(20*mm, y, f"產線：{line or '-'}")
    c.drawString(80*mm, y, f"班別：{shift or '-'}")
    c.drawString(120*mm, y, f"負責：{assigned_to or '-'}")

    if urgent:
        c.setFont(CHINESE_FONT, 12)
        c.drawRightString(width-20*mm, y, "【急件】")
        c.setFont(CHINESE_FONT, 11)

    qr = qrcode.make(qr_url)
    qr_buf = io.BytesIO()
    qr.save(qr_buf)
    qr_buf.seek(0)
    c.drawInlineImage(qr_buf, width-45*mm, height-65*mm, 25*mm, 25*mm)

    y -= 15*mm
    c.setFont(CHINESE_FONT, 11)
    c.drawString(20*mm, y, "明細")
    y -= 6*mm

    c.setFont(CHINESE_FONT, 10)
    for it in items:
        line_txt = f"{it['product_name']} / {it.get('spec','')}  數量:{it['qty']} {it.get('unit','')}"
        c.drawString(20*mm, y, line_txt[:80])
        y -= 6*mm

    y -= 6*mm
    c.setFont(CHINESE_FONT, 10)
    c.drawString(20*mm, y, "備註：")
    c.setFont(CHINESE_FONT, 10)
    c.drawString(35*mm, y, (note or "-")[:80])

    y = 25*mm
    c.drawString(20*mm, y, "開始：________  完工：________  簽名：________")

    c.showPage()
    c.save()
    return buf.getvalue()

