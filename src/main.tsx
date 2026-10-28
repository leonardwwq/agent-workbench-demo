import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  Link,
  useLocation,
} from "react-router-dom";
import { ConfigProvider, Spin, Button } from "antd";
import zhCN from "antd/locale/zh_CN";
import { ConfigProvider as MobileConfigProvider } from "antd-mobile";
import { initStore } from "./shared/store";
import "./styles.css";

const MobileApp = lazy(() => import("./mobile/MobileApp"));
const AdminApp = lazy(() => import("./admin/AdminApp"));

class ErrorBoundary extends React.Component<
  React.PropsWithChildren,
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    if (this.state.error)
      return (
        <main className="boot-screen">
          <div className="boot-logo">L</div>
          <h2>页面暂时没有打开</h2>
          <p>本地演示记录仍保存在当前浏览器。</p>
          <pre>{this.state.error}</pre>
          <Button type="primary" onClick={() => location.reload()}>
            重新加载
          </Button>
        </main>
      );
    return this.props.children;
  }
}
function Shell() {
  const { pathname } = useLocation();
  return (
    <>
      {!pathname.startsWith("/admin") && (
        <div className="desktop-demo-bar">
          <Link className="demo-brand" to="/app">
            <span>L</span>LABU
          </Link>
          <div>
            <span className="demo-hint">个人版 · 交互演示</span>
            <Link to="/admin" target="_blank" rel="noopener">
              打开服务配置端 ↗
            </Link>
          </div>
        </div>
      )}
      <Suspense
        fallback={
          <div className="boot-screen">
            <Spin />
            <p>正在打开工作台…</p>
          </div>
        }
      >
        <Routes>
          <Route path="/app/*" element={<MobileApp />} />
          <Route path="/admin/*" element={<AdminApp />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </Suspense>
      <div className="global-watermark" aria-hidden="true" />
    </>
  );
}
const root = ReactDOM.createRoot(document.getElementById("root")!);
const theme = {
  token: {
    colorPrimary: "#237A57",
    colorInfo: "#2463A6",
    colorSuccess: "#237A57",
    colorWarning: "#A15C00",
    colorError: "#C93732",
    colorText: "#1F2937",
    colorTextSecondary: "#667085",
    colorBorder: "#E5E7EB",
    colorBgLayout: "#F5F7F8",
    borderRadius: 8,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
  },
};
function render() {
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <ConfigProvider locale={zhCN} theme={theme}>
          <MobileConfigProvider>
            <HashRouter>
              <Shell />
            </HashRouter>
          </MobileConfigProvider>
        </ConfigProvider>
      </ErrorBoundary>
    </React.StrictMode>,
  );
}
root.render(
  <div className="boot-screen">
    <div className="boot-logo">L</div>
    <h2>LABU</h2>
    <Spin />
    <p>正在恢复本地演示记录…</p>
  </div>,
);
initStore()
  .then(render)
  .catch((err: Error) =>
    root.render(
      <div className="boot-screen">
        <h2>无法打开本地演示存储</h2>
        <p>请使用允许本地存储的普通浏览窗口，然后重试。</p>
        <pre>{err.message}</pre>
        <Button onClick={() => location.reload()}>重试</Button>
      </div>,
    ),
  );
