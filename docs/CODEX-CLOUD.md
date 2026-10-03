# 在 Codex 云端继续迭代

仓库已包含项目交接说明、`AGENTS.md`、统一 npm 命令、固定版本的 Python 测试依赖、Chromium 启动适配及 Linux 安装脚本。游戏仍是无需构建的静态网页。

## 创建环境

按 [OpenAI 官方云端环境文档](https://learn.chatgpt.com/docs/environments/cloud-environments)，在 ChatGPT 网页或桌面端新建任务，选择 **Work in → Cloud → Select environment → Create environment**。也可从 **Settings → Codex Cloud → Environments** 创建。

选择私有仓库 **Pleasant233/gameplay-prototype**，使用 **main** 分支。如果列表里没有它，在 GitHub 连接的仓库权限中允许访问这个仓库，再刷新列表。现有本机 GitHub 登录不会自动替你完成 ChatGPT 的 GitHub 授权。

选择 **Get started**，把下面的说明发给环境设置中的 Codex：

```text
配置 gameplay-prototype 的开发环境。先读仓库的 AGENTS.md 和
docs/CODEX-CLOUD.md。使用 Node.js 24 与 Python 3.13（至少 3.10）。
这是无需构建的静态 Three.js 游戏，不需要数据库、API key 或部署密钥。
在仓库根目录运行 bash .codex/setup.sh，作为 Install script。
开发服务为 npm run dev，监听 0.0.0.0:8080；需要预览时启动，检查 HTTP
响应后再使用。此命令可写入 Start skill；浏览器测试会启动自己的服务器。
使用 Playwright 自带 Chromium + SwiftShader，不使用 Windows Edge。
检查 npm test 和 npm run test:smoke，随后顺序运行 npm run test:browser。
确认截图和测试报告后，报告结果并准备发布环境。
```

**Install script** 对应命令：

```bash
bash .codex/setup.sh
```

**Start skill** 的说明可使用：

```text
在仓库根目录按需运行 npm run dev，服务监听 0.0.0.0:8080。
将服务保持在后台，用 curl -fsS http://127.0.0.1:8080/ 检查就绪。
若服务已运行则复用。自动测试会自行启动临时服务器，不依赖开发服务。
```

安装脚本创建 `.venv` 并下载 Chromium，安装 Linux 系统库和中文字体，然后运行规则/几何检查和真实 WebGL 冒烟检查。npm 命令会直接使用 `.venv`，不依赖安装阶段的 `export` 或激活环境。

检查配置和测试结果，保存后选择 **Publish**；出现 **Environment published** 后才能从这个环境启动任务。这是账号中的环境设置，提交脚本到 GitHub 不会自动创建它。[官方创建与发布步骤](https://learn.chatgpt.com/docs/cloud)

## 网络与凭据

安装时使用 **Package managers** 网络预设，并为 Playwright 浏览器下载添加以下域名（包含下载回退地址）：

```text
cdn.playwright.dev
playwright.download.prss.microsoft.com
storage.googleapis.com
```

当前固定版本的 Linux Chromium 下载会从 `cdn.playwright.dev` 重定向到 `storage.googleapis.com`，因此需要同时允许该域名。Python/npm/Ubuntu 包源使用包管理器预设。若日志中下载重定向到其他域名，按失败日志补充该目标；不要把域名放行误认为授权凭据。安装完成后，现有游戏与本地测试不需要公网访问，可关闭任务网络；新增依赖或在线资料查询时再按任务需要配置。网络配置说明见 [OpenAI 官方文档](https://learn.chatgpt.com/docs/environments/cloud-environments#connect-to-services)。

此项目开发不需要密钥，也无需上传本机 `.env`、`.vercel`、Codex 登录文件或 GitHub token。发布站点是独立工作，继续使用已授权的发布流程。

## 云端迭代命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 静态网页预览，端口 8080 |
| `npm test` | 语法、规则、完整对局模拟、地形与云几何 |
| `npm run test:smoke` | 验证 Chromium、WebGL、开局状态与 HUD，生成截图 |
| `npm run test:ui` | 桌面/手机交互及反馈 |
| `npm run test:crystal` | 结晶免费使用的 UI 专项 |
| `npm run test:atmosphere` | Bloom/景深图像与交互专项 |
| `npm run test:browser` | 顺序运行三组浏览器测试 |
| `npm run test:all` | 规则/几何和全部浏览器测试 |

浏览器测试使用软件 WebGL，几分钟的运行时间正常；不要并行开启这些测试。所有测试自动创建临时 localhost 服务，截图和 JSON 报告在 `artifacts/`。检查截图需要云端任务支持读取图片；Playwright 测试通过终端运行，不依赖内置的浏览器操作功能。

首次任务可以直接写：

```text
读取 AGENTS.md 和 docs/PROJECT-CONTEXT.md，先运行 npm test 和
npm run test:smoke，确认当前基线，然后继续实现：<本次需求>。
修改后运行相关浏览器测试并检查桌面/手机截图，提交可审阅的变更。
```

## 旧版 Codex Web 环境

如果界面仍显示 **Setup script / Maintenance script**，设置：

```text
Setup script:       bash .codex/setup.sh
Maintenance script: bash .codex/maintenance.sh
```

在旧版环境里选择 Node.js 24、Python 3.13；安装阶段联网、任务阶段可保持关闭。维护脚本更新分支切换后的依赖及浏览器，复用已经安装的系统库。系统库变化时重新运行完整 setup 或重置环境缓存。旧版行为以 [Legacy 官方说明](https://learn.chatgpt.com/docs/environments/cloud-environment) 为准。

## 本地 Windows

统一命令同样可在 Windows 使用：

```powershell
npm ci
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe -m playwright install chromium
npm test
npm run test:smoke
```

要继续使用本机已安装的 Edge，可跳过 Chromium 下载，在 PowerShell 设置：

```powershell
$env:PLAYWRIGHT_BROWSER_CHANNEL = 'msedge'
npm run test:browser
```

清除该变量后恢复默认 Chromium：`Remove-Item Env:PLAYWRIGHT_BROWSER_CHANNEL`。

修改安装命令或工具版本后，在新环境的 Edit 流程中重新验证并 **Republish**，再启动新任务；已存在的任务保留自己的状态。GitHub Actions 示例是否启用不影响 Codex 云端测试。

## 此次仓库配置的验证

2026-10-03，在 Windows / Git Bash、Node.js 24.14.0、Python 3.13.3 和 Chromium 153.0.8010.12 上验证：安装脚本创建的新虚拟环境可用；16 项规则检查、7200 个共享边界/角点采样、云几何检查和 WebGL 冒烟检查通过。三组浏览器测试分别通过 28 项交互、9 项结晶和 14 项氛围检查，报告均无浏览器错误；已查看桌面与手机截图。

Linux 脚本通过 Bash 语法检查。本次验证在本机进行；Linux 系统库/中文字体的实际安装及云端环境发布，请在首次云端环境设置中运行安装脚本并核对结果。
