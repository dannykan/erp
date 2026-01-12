import React, { useState } from 'react';
import { Button, Card, Space, Typography, Input, Alert, App } from 'antd';
import { api, API_BASE } from '../app/api';

const { Title, Paragraph, Text } = Typography;

export default function TestPrint() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<any>(null);
  const [customApiBase, setCustomApiBase] = useState<string>('');
  
  // 使用自定义 API base 或默认值
  const effectiveApiBase = customApiBase.trim() || API_BASE;

  async function testPrint() {
    setLoading(true);
    setLastResponse(null);
    
    try {
      const payload = {
        kind: "image_text",
        copies: 1,
        text: `【前端測試列印】
時間：${new Date().toISOString()}
中文：無塵室手套A 10
英文：ABC123
`,
      };

      const fullUrl = `${effectiveApiBase}/print-jobs`;
      console.log('=== 測試列印開始 ===');
      console.log('Default API_BASE:', API_BASE);
      console.log('Effective API_BASE:', effectiveApiBase);
      console.log('Full URL:', fullUrl);
      console.log('Payload:', payload);

      // 直接使用 fetch 以便获取更详细的错误信息
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(payload),
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('Print job created:', data);
      console.log('Job ID:', data.id);
      console.log('Job Status:', data.status);
      console.log('=== 測試列印成功 ===');
      
      setLastResponse({ 
        success: true, 
        data: data,
        url: fullUrl,
        jobId: data.id
      });
      message.success(`已送出列印任務 (Job ID: ${data.id})，請檢查 Windows agent log`);
    } catch (error: any) {
      console.error('=== 測試列印失敗 ===');
      console.error('Error:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        stack: error.stack
      });
      setLastResponse({ 
        success: false, 
        error: error.message || String(error),
        status: error.status,
        url: `${API_BASE}/print-jobs`
      });
      message.error(`列印任務失敗: ${error.message || String(error)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <Card>
        <Title level={2}>測試列印</Title>
        <Paragraph>
          點擊下方按鈕測試列印功能。請確認：
        </Paragraph>
        <ul>
          <li>Windows agent 已啟動（<code>python -u C:\print_agent\agent.py</code>）</li>
          <li>環境變數 <code>ROTATE_DEG=90</code> 已設定</li>
          <li>印表機已連接並就緒</li>
        </ul>

        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {API_BASE === 'http://localhost:8000' && (
            <Alert
              message="⚠️ API 地址不匹配"
              description={
                <div>
                  <p>當前使用本地後端：<code>{API_BASE}</code></p>
                  <p>Windows agent 通常連接到生產環境：<code>https://chopsticks-erp-backend.onrender.com</code></p>
                  <p>請在下方輸入生產環境 URL，或確保 Windows agent 連接到本地後端。</p>
                </div>
              }
              type="warning"
              showIcon
              style={{ marginBottom: '16px' }}
            />
          )}
          
          <Card size="small" title="API 地址設定（選填）">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text type="secondary">預設 API 地址：</Text>
                <code style={{ marginLeft: '8px' }}>{API_BASE}</code>
              </div>
              <Input
                placeholder="輸入自訂 API 地址（例如：https://chopsticks-erp-backend.onrender.com）"
                value={customApiBase}
                onChange={(e) => setCustomApiBase(e.target.value)}
                allowClear
              />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                將使用：<code>{effectiveApiBase}</code>
              </Text>
            </Space>
          </Card>
          <Button 
            type="primary" 
            size="large" 
            onClick={testPrint}
            loading={loading}
            block
          >
            測試列印
          </Button>

          {lastResponse && (
            <Card 
              size="small" 
              title={lastResponse.success ? '✅ 成功' : '❌ 失敗'}
              style={{ 
                backgroundColor: lastResponse.success ? '#f6ffed' : '#fff2f0',
                borderColor: lastResponse.success ? '#b7eb8f' : '#ffccc7'
              }}
            >
              {lastResponse.success ? (
                <div>
                  <Paragraph>
                    <Text strong>API URL:</Text> {lastResponse.url}
                  </Paragraph>
                  <Paragraph>
                    <Text strong>HTTP Status:</Text> 200 OK
                  </Paragraph>
                  <Paragraph>
                    <Text strong>Job ID:</Text> {lastResponse.jobId}
                  </Paragraph>
                  <Paragraph>
                    <Text strong>Response:</Text>
                  </Paragraph>
                  <pre style={{ 
                    background: '#f5f5f5', 
                    padding: '12px', 
                    borderRadius: '4px',
                    overflow: 'auto'
                  }}>
                    {JSON.stringify(lastResponse.data, null, 2)}
                  </pre>
                  <Paragraph type="secondary" style={{ marginTop: '16px' }}>
                    <Text strong>下一步檢查：</Text>
                    <ol>
                      <li>檢查 Windows agent log 是否出現 "Printing IMG job=..." 訊息</li>
                      <li>如果沒有，請確認 agent 是否正常運行並正在輪詢 <code>{effectiveApiBase}/print-jobs/next</code></li>
                      <li>可以在 Windows PowerShell 手動測試：<br />
                        <code style={{ background: '#f5f5f5', padding: '4px 8px', borderRadius: '4px', display: 'inline-block', marginTop: '8px' }}>
                          {`curl.exe -i "${effectiveApiBase}/print-jobs/next" -H "Authorization: Bearer 26980288"`}
                        </code>
                      </li>
                      <li>如果 curl 返回 200 且有 job 数据，说明后端有任务，agent 应该能收到</li>
                      <li>如果 curl 返回 204，说明后端没有待处理的任务（可能已经被处理）</li>
                    </ol>
                  </Paragraph>
                </div>
              ) : (
                <div>
                  <Paragraph>
                    <Text strong>API URL:</Text> {lastResponse.url}
                  </Paragraph>
                  <Paragraph>
                    <Text strong>錯誤訊息:</Text> {lastResponse.error}
                  </Paragraph>
                  {lastResponse.status && (
                    <Paragraph>
                      <Text strong>HTTP Status:</Text> {lastResponse.status}
                    </Paragraph>
                  )}
                  <Paragraph type="secondary" style={{ marginTop: '16px' }}>
                    <Text strong>請檢查：</Text>
                    <ul>
                      <li>前端 Console 是否有 CORS 錯誤（按 F12 查看）</li>
                      <li>後端 API 是否正常運行：<code>{effectiveApiBase}/health</code></li>
                      <li>網路連線是否正常</li>
                      <li>後端 URL 是否正確：<code>{effectiveApiBase}</code></li>
                    </ul>
                  </Paragraph>
                </div>
              )}
            </Card>
          )}
        </Space>
      </Card>
    </div>
  );
}
