"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
};

export default class HomeRuntimeErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Homepage component failed", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <main style={{ margin: "0 auto", maxWidth: 720, padding: "64px 24px", textAlign: "center" }}>
            <h1>頁面暫時無法完整顯示</h1>
            <p>部分內容載入失敗，請重新整理後再試。</p>
            <button type="button" onClick={() => window.location.reload()}>
              重新整理
            </button>
          </main>
        )
      );
    }

    return this.props.children;
  }
}
