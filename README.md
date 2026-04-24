# 利姆露桌面助手（desktop）

基于 `Tauri 2 + React + TypeScript + Vite` 的桌面应用。

## 环境要求

- Node.js 18+（建议 LTS）
- npm 9+
- Rust 工具链（`rustup` + `cargo`）
- macOS 开发工具（执行 `xcode-select --install` 安装命令行工具）

## 安装依赖

在当前目录（`apps/desktop`）执行：

```bash
npm install
```

## 开发运行

```bash
npm run tauri dev
```

说明：

- 会先启动前端开发服务器（`http://localhost:1420`）
- 再启动 Tauri 桌面窗口并加载该地址

仅启动前端（不打开桌面窗口）可用：

```bash
npm run dev
```

## 构建与打包

1. 构建前端静态资源：

```bash
npm run build
```

2. 构建桌面应用安装包：

```bash
npm run tauri build
```

产物通常在 `src-tauri/target/release/bundle/` 目录下。

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
```

## 推荐开发工具

- [VS Code](https://code.visualstudio.com/)
- [Tauri VS Code 扩展](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
