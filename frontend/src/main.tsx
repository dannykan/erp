import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhTW from 'antd/es/locale/zh_TW'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-tw'
import App from './app/App'
import { AuthProvider } from './app/auth'
import 'antd/dist/reset.css'

// 設定 dayjs 為繁體中文
dayjs.locale('zh-tw')

// Suppress findDOMNode warnings from Ant Design (third-party library issue)
if (process.env.NODE_ENV === 'development') {
  const originalError = console.error
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('findDOMNode is deprecated')
    ) {
      return
    }
    originalError.apply(console, args)
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ConfigProvider locale={zhTW}>
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </ConfigProvider>,
)

