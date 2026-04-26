# 利姆露桌面助手

基于 `Tauri 2 + React + TypeScript + Vite` 的桌面助手应用，当前重点支持 Windows 桌面形态。

## 当前能力（按项目进度）

- 史莱姆本体主窗口（透明、置顶、无边框）
- 聊天与备忘录子窗口（Tauri 子窗口）
- LLM 聊天（支持流式返回、上下文轮数控制）
- LLM 可插拔接口适配（OpenAI Compatible / ClaudeCode Messages / 自定义直连）
- 聊天消息 Markdown 渲染（`react-markdown + remark-gfm`）
- 每条消息可复制、代码块可复制、聊天记录可复制
- 吞噬区开关与交互修复
- 默认配置已内置（见下方“默认配置”）

## 默认配置

当前默认值来自 `src/utils/settings.ts`：

- 吞噬功能：开启
- 启用聊天：开启
- 最小兼容模式：开启
- Provider：`OpenAI`
- 接口形态：`openai-compatible`
- Base URL：`https://it-ai.fineres.com/v1`
- Model：`gpt-5.3-codex`
- API Key：默认空
- 上下文轮数：`20`
- 系统提示词：`你是利姆露桌面助手，在回答时，请在符合你史莱姆人设的情况下，用简洁，明确，友好的中文回复。`

## LLM 配置说明

- 服务商支持：`OpenAI`、`ClaudeCode`、`自定义兼容`
- 仅当服务商为 `自定义兼容` 时显示“接口形态”
- 接口形态支持：`openai-compatible`、`claude-code`、`custom`
- 当接口形态为 `custom` 时，`Base URL` 可编辑，并按“完整 URL”直连（不自动追加后缀）
- 非 `custom` 形态下，`Base URL` 只读，系统自动拼接后缀：
  - `openai-compatible` -> `/chat/completions`
  - `claude-code` -> `/messages`
- 最小兼容模式开启时仅发送基础入参（例如 `model/messages`），细节参数（如 `temperature/top_p/penalty/stop`）会被忽略

## 环境要求

- Node.js 18+（建议 LTS）
- npm 9+
- Rust（`rustup` + `cargo`）
- WebView2 Runtime（Windows）
- Visual Studio C++ Build Tools（Windows 打包推荐）

## 安装依赖

```bash
npm install
```

## 开发运行

```bash
npm run tauri dev
```

仅启动前端（不拉起桌面窗口）：

```bash
npm run dev
```

## 构建与打包

前端构建：

```bash
npm run build
```

桌面打包：

```bash
npx tauri build
```

清理旧产物再打包（PowerShell）：

```powershell
Remove-Item -Recurse -Force .\dist, .\src-tauri\target -ErrorAction SilentlyContinue
npx tauri build
```

产物目录通常为：

- `src-tauri/target/release/bundle/nsis/`
- `src-tauri/target/release/bundle/msi/`

## Windows 分发说明

- 未签名安装包可能被 SmartScreen 拦截（“未知发布者”）。
- 面向他人分发建议做代码签名（`signtool` + 证书 + 时间戳）。
- 推荐分发已签名的安装器（`nsis exe` 或 `msi`），不要直接分发裸可执行文件。

## Android 支持现状

- 目前仓库尚未初始化 Android 工程产物（无 `src-tauri/gen/android`）。
- 当前桌面能力（透明置顶、窗口拖拽/穿透、多子窗口）也需要移动端专项适配。
- 如需 APK，请先执行 `npx tauri android init` 并进行平台分支改造。

## 常用命令

```bash
# 前端开发
npm run dev

# 前端构建
npm run build

# 前端预览
npm run preview

# Tauri 命令（dev/build 等）
npm run tauri

# 安全模式开发脚本（PowerShell）
npm run tauri:dev:safe
```

## 推荐开发工具

- [VS Code](https://code.visualstudio.com/)
- [Tauri VS Code 扩展](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
