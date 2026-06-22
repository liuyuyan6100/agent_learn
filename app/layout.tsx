import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent 工程仪表盘",
  description: "用于展示 Agent 工程实践、token 使用遥测和持续学习闭环的公开仪表盘。"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
