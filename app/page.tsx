import Link from 'next/link';

export default function Home() {
  return (
    <main>
      <h1>🔔 subno.ts</h1>
      <p>加密推送通知服务 - SecureNotify</p>
      
      <section>
        <h2>核心功能</h2>
        <ul>
          <li>公钥注册与管理</li>
          <li>频道管理</li>
          <li>实时消息推送 (SSE)</li>
          <li>消息加密</li>
          <li>API 密钥认证</li>
        </ul>
      </section>

      <section>
        <h2>快速开始</h2>
        <pre>{`# 安装依赖
npm install

# 开发模式
npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm start`}</pre>
      </section>

      <section>
        <h2>文档</h2>
        <nav>
          <Link href="/docs/API_REFERENCE.md">API 参考</Link>
          <Link href="/docs/USER_GUIDE.md">用户指南</Link>
          <Link href="/docs/ARCHITECTURE.md">架构设计</Link>
        </nav>
      </section>
    </main>
  );
}
