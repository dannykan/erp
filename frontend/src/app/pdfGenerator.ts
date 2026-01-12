import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * 從 HTML 元素生成 PDF（前端生成，確保中文正確顯示）
 */
export async function generatePdfFromHtml(
  element: HTMLElement,
  options: {
    filename?: string;
    format?: 'a4' | 'letter';
    orientation?: 'portrait' | 'landscape';
    scale?: number;
  } = {}
): Promise<Blob> {
  const {
    filename = `print_${Date.now()}.pdf`,
    format = 'a4',
    orientation = 'portrait',
    scale = 2,
  } = options;

  // 使用 html2canvas 將 HTML 轉換為圖片
  const canvas = await html2canvas(element, {
    scale: scale,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  });

  // 計算 PDF 尺寸
  const pdfWidth = format === 'a4' ? 210 : 216; // A4: 210mm, Letter: 216mm
  const pdfHeight = format === 'a4' ? 297 : 279; // A4: 297mm, Letter: 279mm
  const imgWidth = orientation === 'portrait' ? pdfWidth : pdfHeight;
  const imgHeight = orientation === 'portrait' ? pdfHeight : pdfWidth;

  // 計算圖片尺寸
  const imgData = canvas.toDataURL('image/png', 1.0);
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;
  const ratio = canvasWidth / canvasHeight;
  
  let finalWidth = imgWidth;
  let finalHeight = imgWidth / ratio;
  
  // 如果高度超過一頁，按比例縮放
  if (finalHeight > imgHeight) {
    finalHeight = imgHeight;
    finalWidth = imgHeight * ratio;
  }

  // 創建 PDF
  const pdf = new jsPDF({
    orientation: orientation,
    unit: 'mm',
    format: format,
  });

  // 添加圖片到 PDF
  let heightLeft = finalHeight;
  let position = 0;

  pdf.addImage(imgData, 'PNG', 0, position, finalWidth, finalHeight);
  heightLeft -= imgHeight;

  // 如果內容超過一頁，添加更多頁面
  while (heightLeft > 0) {
    position = position - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, finalWidth, finalHeight);
    heightLeft -= imgHeight;
  }

  // 返回 PDF Blob
  const pdfBlob = pdf.output('blob');
  return pdfBlob;
}

/**
 * 從 HTML 元素生成預覽圖片（用於顯示預覽）
 */
export async function generatePreviewImageFromHtml(
  element: HTMLElement,
  options: {
    scale?: number;
  } = {}
): Promise<string> {
  const { scale = 2 } = options;

  // 使用 html2canvas 將 HTML 轉換為圖片
  const canvas = await html2canvas(element, {
    scale: scale,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  });

  // 返回 data URL
  return canvas.toDataURL('image/png', 1.0);
}

/**
 * 下載 PDF
 */
export function downloadPdf(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
