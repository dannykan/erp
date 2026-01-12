import { Modal, Button, Spin, Image } from 'antd';
import { useState } from 'react';

interface PrintPreviewModalProps {
  open: boolean;
  previewImage: string | null;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onDownloadPdf?: () => void;
  copies?: number;
}

export default function PrintPreviewModal({
  open,
  previewImage,
  loading,
  onConfirm,
  onCancel,
  onDownloadPdf,
  copies = 1,
}: PrintPreviewModalProps) {
  return (
    <Modal
      title="列印預覽"
      open={open}
      onCancel={onCancel}
      width={800}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button
          key="download"
          onClick={onDownloadPdf}
          disabled={loading}
        >
          下載 PDF
        </Button>,
        <Button
          key="confirm"
          type="primary"
          onClick={onConfirm}
          disabled={loading || !previewImage}
        >
          確認列印 {copies > 1 ? `(${copies} 份)` : ''}
        </Button>,
      ]}
    >
      <div style={{ textAlign: 'center', minHeight: '400px', padding: '20px' }}>
        {loading ? (
          <div style={{ padding: '100px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: '16px', color: '#666' }}>正在生成預覽...</div>
          </div>
        ) : previewImage ? (
          <div>
            <Image
              src={previewImage}
              alt="列印預覽"
              style={{ maxWidth: '100%', height: 'auto' }}
              preview={{
                mask: '點擊放大',
              }}
            />
            <div style={{ marginTop: '16px', color: '#666', fontSize: '12px' }}>
              提示：點擊圖片可以放大查看
            </div>
          </div>
        ) : (
          <div style={{ padding: '100px 0', color: '#999' }}>
            無法生成預覽
          </div>
        )}
      </div>
    </Modal>
  );
}
