import { api, API_BASE } from './api';
import { message } from 'antd';

/**
 * 將 PDF Blob 轉換為 Base64 字串（用於存儲在數據庫中）
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1]; // 移除 data:application/pdf;base64, 前綴
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * 統一的列印服務
 * 將 PDF blob 發送到 print job 佇列
 * 
 * @param blob PDF Blob 對象
 * @param options 選項
 * @param options.encoding 編碼方式，默認為 'cp950'（適合繁體中文 Windows 列印機）
 * @param options.copies 列印份數，默認為 1
 * @param options.alsoDownload 是否同時下載 PDF，默認為 false
 * @param options.filename 下載時的檔案名稱（僅在 alsoDownload=true 時使用）
 * @returns Promise<{jobId: string, success: boolean}>
 */
export async function sendToPrintQueue(
  blob: Blob,
  options: {
    encoding?: string;
    copies?: number;
    alsoDownload?: boolean;
    filename?: string;
  } = {}
): Promise<{ jobId: string; success: boolean }> {
  const { encoding = 'cp950', copies = 1, alsoDownload = false, filename } = options;

  try {
    console.log('=== 開始發送列印任務 ===');
    console.log('PDF Blob size:', blob.size, 'bytes');
    console.log('PDF Blob type:', blob.type);
    
    // 將 PDF blob 轉換為 Base64 字串（用於在數據庫中存儲）
    const base64Text = await blobToBase64(blob);
    console.log('Base64 length:', base64Text.length);
    console.log('Base64 preview:', base64Text.substring(0, 50) + '...');

    // 發送到 print job 佇列
    const payload = {
      kind: 'raw',
      text: base64Text,
      encoding,
      copies,
    };
    console.log('Print job payload:', {
      kind: payload.kind,
      encoding: payload.encoding,
      copies: payload.copies,
      textLength: payload.text.length,
    });

    const result = await api.createPrintJob(payload);
    console.log('Print job created:', result);
    console.log('Job ID:', result.id);
    console.log('Job Status:', result.status);
    console.log('=== 列印任務已加入佇列 ===');

    message.success(`列印任務已加入佇列（任務 ID: ${result.id}）`);

    // 如果需要同時下載
    if (alsoDownload) {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `print_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    }

    return { jobId: result.id, success: true };
  } catch (error: any) {
    console.error('=== 發送列印任務失敗 ===');
    console.error('Error:', error);
    console.error('Error details:', {
      message: error.message,
      status: error.status,
      stack: error.stack,
    });
    message.error(`列印任務發送失敗：${error.message || '未知錯誤'}`);
    return { jobId: '', success: false };
  }
}

/**
 * 從 URL 獲取 PDF 並發送到列印佇列
 * 
 * @param pdfUrl PDF URL（例如：/api/sales-orders/123/print）
 * @param options 選項
 */
/**
 * 從相對路徑獲取 PDF 並發送到列印佇列
 * 
 * @param pdfPath PDF 相對路徑（例如：/sales-orders/123/print）
 * @param options 選項
 */
export async function printFromPath(
  pdfPath: string,
  options: {
    encoding?: string;
    copies?: number;
    alsoDownload?: boolean;
    filename?: string;
  } = {}
): Promise<{ jobId: string; success: boolean }> {
  try {
    console.log('=== 開始從路徑獲取 PDF ===');
    console.log('PDF Path:', pdfPath);
    
    // 構建完整 URL
    const pdfUrl = pdfPath.startsWith('http') ? pdfPath : `${API_BASE}${pdfPath}`;
    console.log('Full PDF URL:', pdfUrl);
    
    // 使用 fetch 獲取 PDF
    const token = localStorage.getItem('token');
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    console.log('Fetch headers:', { hasToken: !!token });

    const response = await fetch(pdfUrl, { headers });
    console.log('PDF Response status:', response.status);
    console.log('PDF Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('PDF fetch error:', errorText);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const blob = await response.blob();
    console.log('PDF Blob received:', {
      size: blob.size,
      type: blob.type,
    });
    console.log('=== PDF 獲取成功，開始發送到列印佇列 ===');
    
    return await sendToPrintQueue(blob, options);
  } catch (error: any) {
    console.error('=== 獲取 PDF 失敗 ===');
    console.error('Error:', error);
    console.error('Error details:', {
      message: error.message,
      status: error.status,
      stack: error.stack,
    });
    message.error(`獲取 PDF 失敗：${error.message || '未知錯誤'}`);
    return { jobId: '', success: false };
  }
}

