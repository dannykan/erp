import { useState } from 'react';
import { generatePreviewImageFromHtml, generatePdfFromHtml } from '../app/pdfGenerator';
import { sendToPrintQueue } from '../app/printService';
import PrintPreviewModal from '../components/PrintPreviewModal';
import { message } from 'antd';

interface UseFrontendPrintPreviewOptions {
  copies?: number;
  filename?: string;
}

export function useFrontendPrintPreview() {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingPrint, setPendingPrint] = useState<{
    element: HTMLElement;
    options: UseFrontendPrintPreviewOptions;
  } | null>(null);

  const showPreview = async (element: HTMLElement, options: UseFrontendPrintPreviewOptions = {}) => {
    setLoading(true);
    setPreviewOpen(true);
    setPendingPrint({ element, options });

    try {
      // 生成預覽圖片
      const image = await generatePreviewImageFromHtml(element, { scale: 2 });
      setPreviewImage(image);
    } catch (error) {
      console.error('生成預覽失敗:', error);
      setPreviewImage(null);
      message.error('生成預覽失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!pendingPrint) return;

    setPreviewOpen(false);
    setLoading(true);

    try {
      // 生成 PDF
      const pdfBlob = await generatePdfFromHtml(pendingPrint.element, {
        filename: pendingPrint.options.filename || `print_${Date.now()}.pdf`,
        format: 'a4',
        orientation: 'portrait',
        scale: 2,
      });

      // 發送到列印佇列
      await sendToPrintQueue(pdfBlob, {
        copies: pendingPrint.options.copies || 1,
        useImageText: true,
      });
    } catch (error) {
      console.error('列印失敗:', error);
      message.error('列印失敗');
    } finally {
      setLoading(false);
      setPendingPrint(null);
      setPreviewImage(null);
    }
  };

  const handleCancel = () => {
    setPreviewOpen(false);
    setPendingPrint(null);
    setPreviewImage(null);
  };

  const handleDownloadPdf = async () => {
    if (!pendingPrint) return;
    
    try {
      const pdfBlob = await generatePdfFromHtml(pendingPrint.element, {
        filename: pendingPrint.options.filename || `print_${Date.now()}.pdf`,
        format: 'a4',
        orientation: 'portrait',
        scale: 2,
      });
      
      const url = window.URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pendingPrint.options.filename || `print_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      message.success('PDF 下載成功');
    } catch (error) {
      console.error('下載 PDF 失敗:', error);
      message.error('下載 PDF 失敗');
    }
  };

  const PrintPreview = () => (
    <PrintPreviewModal
      open={previewOpen}
      previewImage={previewImage}
      loading={loading}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      onDownloadPdf={handleDownloadPdf}
      copies={pendingPrint?.options.copies || 1}
    />
  );

  return {
    showPreview,
    PrintPreview,
  };
}
