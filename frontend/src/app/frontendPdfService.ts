import { generatePdfFromHtml, downloadPdf } from './pdfGenerator';
import { sendToPrintQueue } from './printService';
import { message } from 'antd';

/**
 * 從前端數據生成 PDF 並發送到列印佇列
 * 使用前端渲染確保中文正確顯示
 */
export async function generateAndPrintPdf(
  element: HTMLElement,
  options: {
    copies?: number;
    filename?: string;
  } = {}
): Promise<{ jobId: string; success: boolean }> {
  try {
    const { copies = 1, filename } = options;
    
    console.log('=== 開始前端生成 PDF ===');
    
    // 生成 PDF Blob
    const pdfBlob = await generatePdfFromHtml(element, {
      filename: filename || `print_${Date.now()}.pdf`,
      format: 'a4',
      orientation: 'portrait',
      scale: 2,
    });
    
    console.log('✅ PDF 生成成功，大小:', pdfBlob.size, 'bytes');
    
    // 發送到列印佇列
    const result = await sendToPrintQueue(pdfBlob, {
      copies,
      useImageText: true, // 使用圖片模式確保中文正確顯示
    });
    
    return result;
  } catch (error: any) {
    console.error('=== 前端生成 PDF 失敗 ===');
    console.error('Error:', error);
    message.error(`生成 PDF 失敗：${error.message || '未知錯誤'}`);
    return { jobId: '', success: false };
  }
}

/**
 * 從前端數據生成 PDF 並下載
 */
export async function generateAndDownloadPdf(
  element: HTMLElement,
  filename?: string
): Promise<void> {
  try {
    const pdfBlob = await generatePdfFromHtml(element, {
      filename: filename || `print_${Date.now()}.pdf`,
      format: 'a4',
      orientation: 'portrait',
      scale: 2,
    });
    
    downloadPdf(pdfBlob, filename || `print_${Date.now()}.pdf`);
    message.success('PDF 下載成功');
  } catch (error: any) {
    console.error('生成 PDF 失敗:', error);
    message.error(`生成 PDF 失敗：${error.message || '未知錯誤'}`);
  }
}
