# AI 私厨

一个由 FastAPI、LangGraph、React 和 Vite 构建的 AI 私厨对话应用，支持会话管理、图片上传与流式回复。

## 环境要求

- Python 3.13 或更高版本
- [uv](https://docs.astral.sh/uv/)
- Node.js 与 npm
- 可用的 MySQL 数据库

## 本地运行

1. 创建本地环境变量文件。PowerShell：

   ```powershell
   Copy-Item .env.example .env
   ```

2. 在 `.env` 中填写自己的服务密钥和数据库连接。不要提交该文件。

3. 安装后端依赖：

   ```powershell
   uv sync
   ```

4. 安装并构建前端：

   ```powershell
   Set-Location frontend
   npm install
   npm test
   npm run build
   Set-Location ..
   ```

5. 启动应用：

   ```powershell
   uv run python -m app.main
   ```

   默认访问地址为 `http://127.0.0.1:8001`。

## 前端开发模式

先在项目根目录启动后端，再在另一个终端运行：

```powershell
Set-Location frontend
npm run dev
```

Vite 会把 `/api` 请求代理到本地后端的 `8001` 端口。

## 提交前检查

- 只提交 `.env.example`，不要提交真实 `.env`。
- 不要提交 `.venv`、`node_modules`、`frontend/dist` 或缓存目录。
- 发布为公开仓库前，请确认图片与第三方服务的使用条款。

## 前端界面展示：
- <img width="967" height="632" alt="a95a512fb55ccf1eb42b2cab296ffa0b" src="https://github.com/user-attachments/assets/4d8a1483-9918-4b42-9532-71a96aeba292" />

