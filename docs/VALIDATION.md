# 验证记录

验证日期：2026-10-02。预览版本使用当前源码；自动检查证明下列行为，画面风格仍需人工确认。

## 规则与几何

- `node test.js`：13 项通过，包含 30 局随机 AI 完整对局，以及结晶、行动、轮末计分事件和实际增量的一致性。
- `node test-view.js`：跨地块高度和颜色连续；放置与移除后的 7200 次边界采样一致；表面法线朝上、侧壁埋入底座。
- 四种程序云网格闭合、三角形朝外，并位于云团避让距离使用的几何范围内。
- JavaScript 文件及页面内联脚本语法检查通过。

## 浏览器与界面

Microsoft Edge 无头浏览器，桌面 1440×900、手机模拟 390×844，SwiftShader 软件 WebGL。全部 27 项通过，无脚本或 WebGL 错误，详见 [浏览器报告](browser-report.json)。

覆盖实际指针拾取、选择及放置、收益飞行与延迟计数、结晶从背包飞到地块、40 个 Token 上限及溢出合并、重开清理、减少动态效果偏好、手机触摸和界面边界。净化、采矿、涌泉、富庶、焚尽、合成与结晶的临时网格和灯光均回收；手机质量不启用临时灯光。

| 画面 | 截图 |
| --- | --- |
| 桌面地图与云海 | [查看](screenshots/desktop-midgame.png) |
| 桌面选框 | [查看](screenshots/desktop-selected.png) |
| 手机地图 | [查看](screenshots/phone-midgame.png) |
| 手机选框与详情 | [查看](screenshots/phone-selected.png) |
| 轮末收益飞行 | [查看](screenshots/round-tokens.png) |
| 结晶飞向地块 | [查看](screenshots/crystal-down.png) |

手机为浏览器触摸和视口模拟，尚未验证真实手机性能、耗电、Safari WebGL 或音效播放。截图不是用户的美术验收结论。

## 部署

[本次预览](https://gameplay-prototype-d9qbub3eh-wangshuq20041122-4927s-projects.vercel.app) 已就绪。页面、视图、收益飞行、规则、数据、Three.js、应用清单与许可文本均通过 HTTP 200 取得，内容逐字节匹配本地源文件；SHA-256 记录见 [线上文件报告](preview-report.json)。

在线上地址使用未经测试注入的应用完成开局和一次实际放置，验证 5→6 个地块、剩余空位结算为 79，未出现浏览器错误。

仅部署 Preview。正式域名仍指向原生产部署 `dpl_5oHtYRkL3rdg3FRkf5ySkPyhPHUu`，创建于 2026-10-02 16:46（UTC+8）。未配置自动部署或连接 Vercel Git 集成。

GitHub 当前登录令牌缺少 `workflow` 权限，平台拒绝了包含 `.github/workflows/check.yml` 的首次推送。配置已保留为 [CI 示例](ci-example.yml)，暂未启用；上述检查均在本机实际运行通过。
