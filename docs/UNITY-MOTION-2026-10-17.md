# Unity 动效对齐：2026-10-17

作者反馈初版 Unity 的动效与网页差别较大。本次以正式站点当天的 `view.js`、`tokens.js`、`music.js` 为依据补齐表现层；快照及文件校验保存在 `migration/web-reference/`。规则继续使用此前确认的线上版本。

## 表现与时序

- 地块从 2.2 单位高度落下，400ms 弹性落地，并带压缩、尘雾和同种连片波纹；选择放置卡时可以预览连片边界。
- 收益先散开 180ms、停留 150ms，再用 720ms 飞向对应 HUD。不同来源格间隔 40ms，与地块落地、结晶下落及星雨并行。数字按抵达时间更新；规则状态、资源成本及存档仍立即结算。
- 背包结晶飞向目标地块耗时 700ms；至纯结晶延迟 1600ms，然后用 650ms 入场、1750ms 展示、800ms 回到背包。
- 五种施法有各自形状；星雨先警示，再按格错开落下；元素盾包含半球、六边扫描和受击反馈；守护灵有汇聚、迁移及滋养反馈。
- 卡牌悬停、选中和按钮按压有弹性反馈。水面、晶体、云团保留轻微环境运动。
- 竖屏在动作后收起详情以露出目标和动效，再点地块可重新展开。飞行层显示在背包面板上方；最后一轮含至纯结晶时，结果面板等待 5 秒再出现。
- 音效和分阶段背景音乐按网页的合成参数原生生成；声音和背景音乐分别设置，无外部音源或联网依赖。

HUD 排队与可见飞行合计最多 40 个；3D 特效使用共享材质、对象池、粒子及待执行预算。重开、读取、打开主菜单和进入摄影检视会清理待执行反馈。减少动态效果会立即结清 HUD，取消飞行、延迟落点与镜头震动。

## 复现与证据

```powershell
npm test
powershell -ExecutionPolicy Bypass -File scripts/unity-check.ps1 -Motion
powershell -ExecutionPolicy Bypass -File scripts/unity-check.ps1
powershell -ExecutionPolicy Bypass -File scripts/unity-check.ps1 -Audio
powershell -ExecutionPolicy Bypass -File scripts/unity-check.ps1 -BuildWindows
```

`-Motion` 在实际 Unity Play Mode 中顺序检查 1440×900 和 390×844，包括落地、结晶、部署盾、星雨、守护灵合成/移动以及清理与减少动态效果。每张截图记录实际经过时间、特效/飞行数量和权威/显示计数；截图读取的耗时也保留在记录中。

线上参考可用 `scripts/unity-motion-reference.cjs` 重新获取；开发工具只向浏览器测试请求注入私有访问点，不更改线上资源。网页采用虚拟时钟逐步采样，Unity 采用真实帧，两边的时间戳应分别阅读。

`artifacts/web-motion-reference/` 和 `artifacts/unity-motion/` 保存 PNG、JSON、GIF 和连帧图。用安装了 Pillow 的 Python 执行 `scripts/unity-motion-evidence.py <目录>` 可从原始记录重建 GIF；它不补帧或合成动画。

连续截图首轮检查发现原生图标未实际渲染的问题；已改为标准 UGUI Image 加本地生成的图标纹理，并增加火晶展示区域的真实像素验收。它同时检查计数与可见图像，避免只检查对象和轨迹就判定成功。

2026-10-18 完成实际 Unity Play Mode 复测：**110 项动效检查通过，110 张真实连续帧，运行期错误为 0**。桌面与竖屏火晶中心区域分别测得 3059 / 2701 个有效橙红像素，超过 350 像素门槛；修复前仅 17 / 24。已检查落地、结晶、星雨及守护灵的连帧图，竖屏动作后可以看清地图。另通过 **20 项场景回归**，包括 1296 次共享地形边界采样、存档、无尽外扩和摄影检视。

线上对照记录为 114 张真实帧、12 组 GIF，浏览器错误为 0；手机参考启用 iPhone UA 下的 LOW 档。Unity 新录帧的 14 组 GIF 与连帧图位于 `artifacts/unity-motion/`，首轮缺图标的证据保存在 `artifacts/unity-motion-before-glyph-fix/`。仓库 `npm test` 通过。

音频实际 Play Mode **72 项检查通过**，包括五阶段原 BPM、非零有限 PCM、后台合成后上传、DSP 队列/音源/缓存预算，以及静音、重新开启和销毁取消。测试期间静音，未做扬声器听感验收。

Windows x64 已重新构建，试玩包为 `artifacts/ElementHabitat-Windows.zip`（约 41.3 MiB），包含更新后的原生程序及数据，排除 Unity 的 DoNotShip 调试目录。独立程序运行 12 秒启动检查，未发现脚本异常或 Shader 错误；随后由测试工具关闭。

此前迁移说明中的验证是初版记录，保持原样。桌面 GPU 和手机尺寸模拟不代表手机真机性能，也不构成逐像素美术验收。
