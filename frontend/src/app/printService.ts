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
 * 將 PDF Blob 轉換為預覽圖片 Data URL（用於顯示預覽）
 * 返回完整的 data URL（包含 data:image/png;base64, 前綴）
 */
export async function pdfBlobToPreviewImage(blob: Blob): Promise<string> {
  // 動態載入 PDF.js
  const pdfjsLib = await import('pdfjs-dist');
  
  // 設置 worker（使用本地 public 目錄中的文件）
  if (typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  }
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const arrayBuffer = reader.result as ArrayBuffer;
        // 配置 PDF.js 以正確渲染嵌入的 TTF 字體
        const pdf = await pdfjsLib.getDocument({
          data: arrayBuffer,
          cMapUrl: '/cmaps/',
          cMapPacked: true,
          standardFontDataUrl: '/standard_fonts/',
          verbosity: pdfjsLib.VerbosityLevel.WARNINGS,
          useSystemFonts: false,
          disableFontFace: false,
        }).promise;
        
        // 處理所有頁面（合併為一張圖片）
        const numPages = pdf.numPages;
        const pages: HTMLCanvasElement[] = [];
        
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 2.0 }); // 2x 解析度以確保清晰度
          
          // 創建 canvas
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (!context) {
            reject(new Error('無法創建 canvas context'));
            return;
          }
          
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          // 獲取操作列表以觸發字體加載
          await page.getOperatorList();
          
          // 渲染 PDF 頁面到 canvas
          // PDF.js 會自動處理嵌入的 TTF 字體
          await page.render({
            canvasContext: context,
            viewport: viewport,
            enableWebGL: false,
          }).promise;
          
          // 等待一小段時間確保字體渲染完成
          await new Promise(resolve => setTimeout(resolve, 50));
          
          pages.push(canvas);
        }
        
        // 如果有多頁，垂直合併所有頁面
        let finalCanvas: HTMLCanvasElement;
        if (pages.length === 1) {
          finalCanvas = pages[0];
        } else {
          // 計算總高度
          const totalHeight = pages.reduce((sum, canvas) => sum + canvas.height, 0);
          const maxWidth = Math.max(...pages.map(canvas => canvas.width));
          
          finalCanvas = document.createElement('canvas');
          finalCanvas.width = maxWidth;
          finalCanvas.height = totalHeight;
          
          const finalContext = finalCanvas.getContext('2d');
          if (!finalContext) {
            reject(new Error('無法創建最終 canvas context'));
            return;
          }
          
          let yOffset = 0;
          for (const pageCanvas of pages) {
            finalContext.drawImage(pageCanvas, 0, yOffset);
            yOffset += pageCanvas.height;
          }
        }
        
        // 將 canvas 轉換為 data URL（包含前綴，用於直接顯示）
        const imageDataUrl = finalCanvas.toDataURL('image/png', 1.0);
        resolve(imageDataUrl);
      } catch (error) {
        console.error('PDF 轉換為預覽圖片失敗:', error);
        reject(error);
      }
    };
    
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * 將 PDF Blob 轉換為圖片 Base64（用於 image_text 類型）
 */
async function pdfBlobToImageBase64(blob: Blob): Promise<string> {
  // 動態載入 PDF.js
  const pdfjsLib = await import('pdfjs-dist');
  
  // 設置 worker（使用本地 public 目錄中的文件）
  if (typeof window !== 'undefined') {
    // 使用 public 目錄中的 worker 文件（已複製）
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  }
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const arrayBuffer = reader.result as ArrayBuffer;
        // 配置 PDF.js 以正確渲染嵌入的 TTF 字體
        const pdf = await pdfjsLib.getDocument({
          data: arrayBuffer,
          cMapUrl: '/cmaps/',
          cMapPacked: true,
          standardFontDataUrl: '/standard_fonts/',
          verbosity: pdfjsLib.VerbosityLevel.WARNINGS,
          useSystemFonts: false,
          disableFontFace: false,
        }).promise;
        
        // 處理所有頁面（合併為一張圖片）
        const numPages = pdf.numPages;
        const pages: HTMLCanvasElement[] = [];
        
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 2.0 }); // 2x 解析度以確保清晰度
          
          // 創建 canvas
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (!context) {
            reject(new Error('無法創建 canvas context'));
            return;
          }
          
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          // 獲取操作列表以觸發字體加載
          await page.getOperatorList();
          
          // 渲染 PDF 頁面到 canvas
          // PDF.js 會自動處理嵌入的 TTF 字體
          await page.render({
            canvasContext: context,
            viewport: viewport,
            enableWebGL: false,
          }).promise;
          
          // 等待一小段時間確保字體渲染完成
          await new Promise(resolve => setTimeout(resolve, 50));
          
          pages.push(canvas);
        }
        
        // 如果有多頁，垂直合併所有頁面
        let finalCanvas: HTMLCanvasElement;
        if (pages.length === 1) {
          finalCanvas = pages[0];
        } else {
          // 計算總高度
          const totalHeight = pages.reduce((sum, canvas) => sum + canvas.height, 0);
          const maxWidth = Math.max(...pages.map(canvas => canvas.width));
          
          finalCanvas = document.createElement('canvas');
          finalCanvas.width = maxWidth;
          finalCanvas.height = totalHeight;
          
          const finalContext = finalCanvas.getContext('2d');
          if (!finalContext) {
            reject(new Error('無法創建最終 canvas context'));
            return;
          }
          
          let yOffset = 0;
          for (const pageCanvas of pages) {
            finalContext.drawImage(pageCanvas, 0, yOffset);
            yOffset += pageCanvas.height;
          }
        }
        
        // 將 canvas 轉換為 base64 圖片
        // 使用 PNG 格式（agent 端會轉換為 BMP）
        // 確保圖片質量，並驗證 base64 數據有效性
        const imageBase64 = finalCanvas.toDataURL('image/png', 1.0); // 最高質量
        const base64String = imageBase64.split(',')[1]; // 移除 data:image/png;base64, 前綴
        
        // 驗證 base64 字符串是否有效
        if (!base64String || base64String.length === 0) {
          throw new Error('圖片轉換失敗：base64 字符串為空');
        }
        
        // 驗證 base64 格式（應該只包含 base64 字符）
        const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
        if (!base64Regex.test(base64String)) {
          throw new Error('圖片轉換失敗：base64 格式無效');
        }
        
        // 驗證 PNG 文件頭（確保是有效的 PNG）
        const pngHeader = atob(base64String.substring(0, 8));
        const isValidPng = pngHeader.charCodeAt(0) === 0x89 && 
                           pngHeader.charCodeAt(1) === 0x50 && 
                           pngHeader.charCodeAt(2) === 0x4E && 
                           pngHeader.charCodeAt(3) === 0x47;
        
        if (!isValidPng) {
          console.warn('警告：轉換後的數據可能不是有效的 PNG 格式');
        }
        
        console.log('圖片轉換成功:', {
          canvasSize: `${finalCanvas.width}x${finalCanvas.height}`,
          base64Length: base64String.length,
          isValidPng: isValidPng,
          base64Preview: base64String.substring(0, 50) + '...',
        });
        
        resolve(base64String);
      } catch (error) {
        console.error('PDF 轉換為圖片失敗:', error);
        reject(error);
      }
    };
    
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
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
    useImageText?: boolean; // 是否使用 image_text 類型（將 PDF 轉換為圖片）
  } = {}
): Promise<{ jobId: string; success: boolean }> {
  const { encoding = 'cp950', copies = 1, alsoDownload = false, filename, useImageText = true } = options;

  try {
    console.log('=== 開始發送列印任務 ===');
    console.log('PDF Blob size:', blob.size, 'bytes');
    console.log('PDF Blob type:', blob.type);
    console.log('Use image_text:', useImageText);
    
    let base64Text: string;
    let jobKind: 'raw' | 'image_text';
    
    if (useImageText) {
      // 將 PDF 轉換為圖片（用於 image_text 類型，可以正確顯示中文）
      console.log('正在將 PDF 轉換為圖片...');
      try {
        base64Text = await pdfBlobToImageBase64(blob);
        jobKind = 'image_text';
        console.log('✅ 圖片轉換成功');
        console.log('圖片 Base64 length:', base64Text.length);
        console.log('圖片 Base64 preview:', base64Text.substring(0, 100) + '...');
        
        // 驗證 base64 數據（解碼後應該是有效的 PNG）
        try {
          const testDecode = atob(base64Text.substring(0, 8));
          const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
          const isValid = Array.from(testDecode).every((char, i) => 
            char.charCodeAt(0) === pngSignature[i]
          );
          console.log('PNG 格式驗證:', isValid ? '✅ 有效' : '❌ 無效');
        } catch (e) {
          console.warn('PNG 格式驗證失敗:', e);
        }
      } catch (error) {
        console.error('❌ PDF 轉換為圖片失敗，改用 raw 類型:', error);
        // 如果轉換失敗，回退到 raw 類型
        base64Text = await blobToBase64(blob);
        jobKind = 'raw';
        console.log('使用 raw 類型（可能會有中文亂碼）');
      }
    } else {
      // 使用原始 PDF base64（raw 類型）
      base64Text = await blobToBase64(blob);
      jobKind = 'raw';
      console.log('PDF Base64 length:', base64Text.length);
      console.log('PDF Base64 preview:', base64Text.substring(0, 50) + '...');
    }

    // 發送到 print job 佇列
    const payload = {
      kind: jobKind,
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

    message.success(`列印任務已加入佇列（任務 ID: ${result.id}，類型: ${jobKind}）`);

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
 * 從相對路徑獲取 PDF Blob
 */
export async function fetchPdfBlob(pdfPath: string): Promise<Blob> {
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
  return blob;
}

/**
 * 從相對路徑獲取 PDF 並生成預覽圖片
 * 
 * @param pdfPath PDF 相對路徑（例如：/sales-orders/123/print）
 * @returns Promise<string> 預覽圖片的 data URL
 */
export async function getPrintPreview(pdfPath: string): Promise<string> {
  try {
    const blob = await fetchPdfBlob(pdfPath);
    console.log('=== PDF 獲取成功，開始生成預覽 ===');
    const previewImage = await pdfBlobToPreviewImage(blob);
    console.log('=== 預覽圖片生成成功 ===');
    return previewImage;
  } catch (error: any) {
    console.error('=== 生成預覽失敗 ===');
    console.error('Error:', error);
    message.error(`生成預覽失敗：${error.message || '未知錯誤'}`);
    throw error;
  }
}

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
    showPreview?: boolean; // 是否顯示預覽（如果為 true，會先顯示預覽 Modal）
  } = {}
): Promise<{ jobId: string; success: boolean }> {
  try {
    const blob = await fetchPdfBlob(pdfPath);
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

