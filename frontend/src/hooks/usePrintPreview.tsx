import { useState } from 'react';
import { getPrintPreview, printFromPath, fetchPdfBlob } from '../app/printService';
import PrintPreviewModal from '../components/PrintPreviewModal';

interface UsePrintPreviewOptions {
  copies?: number;
  encoding?: string;
  alsoDownload?: boolean;
  filename?: string;
}

export function usePrintPreview() {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingPrint, setPendingPrint] = useState<{
    pdfPath: string;
    options: UsePrintPreviewOptions;
  } | null>(null);

  const showPreview = async (pdfPath: string, options: UsePrintPreviewOptions = {}) => {
    setLoading(true);
    setPreviewOpen(true);
    setPendingPrint({ pdfPath, options });

    try {
      const image = await getPrintPreview(pdfPath);
      setPreviewImage(image);
    } catch (error) {
      console.error('生成預覽失敗:', error);
      setPreviewImage(null);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!pendingPrint) return;

    setPreviewOpen(false);
    setLoading(true);

    try {
      await printFromPath(pendingPrint.pdfPath, {
        ...pendingPrint.options,
        showPreview: false, // 不再显示预览
      });
    } catch (error) {
      console.error('列印失敗:', error);
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
      const blob = await fetchPdfBlob(pendingPrint.pdfPath);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pendingPrint.options.filename || `print_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('下載 PDF 失敗:', error);
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
