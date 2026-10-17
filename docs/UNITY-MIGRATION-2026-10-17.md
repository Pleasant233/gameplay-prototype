# 元素生境 Unity 迁移

本次按作者在 2026-10-17 明确选择的**当前线上版本**迁移。正式站点与仓库根目录的网页源码存在规则差异；Unity 的依据是 `migration/web-reference/` 中保存的线上快照，来源和 SHA-256 在该目录的 `manifest.json`。根目录网页代码保留原样。

## 打开与试玩

1. Unity Hub 添加 `SpotlightGamejam` 文件夹，使用项目指定的 **Unity 6000.3.10f1**。
2. 等待资源导入，打开 `Assets/Scenes/ElementHabitat.unity`，点击 Play。编辑器菜单“元素生境 → 打开游戏场景”也能打开。
3. “初醒之旅”开启教程挑战，“自由挑战”跳过教程，“无尽生境”直接进入无限轮次和地图；有存档时可继续。

鼠标点击选格，拖动旋转，滚轮缩放，右键拖动平移；触屏支持点击、双指缩放和平移。卡牌、结晶和移动操作先选择，再点击地图目标；Esc 取消操作。界面、图鉴和长列表支持窄屏滚动。摄影模式可保存照片和导出地图，并有返回经营按钮。

编辑器菜单“元素生境 → 构建 Windows 试玩版”生成 `artifacts/unity-player/ElementHabitat.exe`，发布时需包含同目录的数据文件夹和 UnityPlayer.dll。

## 已迁移内容

- 80 种地块、10 系列、升级分支、连片属性上限与相邻系列滋养。
- 中央守护塔及五行庇护/灵力涌泉，初始 85 格轮廓中 84 格可铺；无尽地图支持向外延伸。
- 40 轮挑战，10/20/30/40 轮分别检查 500/1500/3000/6000 灵力；灵力为属性和 × 0.5 + 守护塔投入结晶颗数 + 生态值。
- 自由安排 AP，可同轮多次铺地；铺地、施法、刷新、铲除、守护灵移动各耗 1 AP；结束轮次不强制先铺地。
- 普通、大型、逆、至纯结晶，批量加点预览，自动补足缺失属性的升级及批量升级；元素盾支持普通/大型混合配比。
- 自动生态、自动合兽/合守护灵、五行魔法及永久扩大范围、每 4 轮自然事件预告、星雨防护、退化和消散。
- 中文教学、回声、图鉴、成就、愿景、挑战结果、无尽模式转换、自动存档、声音与画面设置。

## 原生项目结构

`Assets/ElementHabitat/Core/` 是不引用 UnityEngine 的 C# 规则和序列化实现；`Catalog.Generated.cs` 从固定线上数据导出。它不运行 JavaScript，也不嵌入网页。

`Presentation/HabitatBoard.cs` 创建连续地表、程序化卡通模型、云海、守护塔、护盾与池化反馈。URP 提供 Bloom 和景深，材质 Shader 与开源中文字体随 Resources 打包。无尽地图按相机周围区域绘制，完整状态保留在规则层。`HabitatUI.cs` 使用原生 UGUI。

`Runtime/HabitatApp.cs` 连接规则、输入目标、表现和自动存档。存档位于 `Application.persistentDataPath/element-habitat-unity-v1.json`，更新采用临时文件替换，并保留上一份 `.bak`。仅恢复当前线上存档结构；无效或旧结构会提示失败，原文件保留。不会自动读取浏览器 localStorage。

`Editor/HabitatTools.cs` 提供场景入口、Windows 构建和实际 Play Mode 验证。原来的 SampleScene 保留；构建入口已改为 ElementHabitat。

## 开发验证

```powershell
npm test
npm run test:unity-rules
powershell -ExecutionPolicy Bypass -File scripts/unity-check.ps1
powershell -ExecutionPolicy Bypass -File scripts/unity-check.ps1 -BuildWindows
```

规则对照需要 .NET SDK 9，不需要下载 NuGet 包。Unity 验证脚本可传 `-UnityPath`，或设置 `UNITY_EDITOR_PATH`。不要在同一项目已被 Unity 编辑器打开时再启动批处理。

对照报告位于 `artifacts/unity-rules-published/parity-report.json`；Unity 日志、Play Mode 报告和截图位于 `artifacts/unity/` 与 `artifacts/unity-validation.log`。线上参考截图是 `artifacts/web-reference-desktop.png` 与 `artifacts/web-reference-phone.png`。测试工具会保留并恢复已有存档与游戏偏好。

本次规则对照 **1,572 例通过**，覆盖 16 组规则、6 局挑战/无尽运行，以及 14 组在同一原生状态上连续操作/保存恢复的序列。逐字段比较状态、库存、分数、收益事件和随机数状态；额外覆盖铲除后重新放置，避免 C# 字典遍历顺序改变后续随机结果。仓库原有 `npm test` 通过。Unity Play Mode 已通过 20 项初始化、教程操作、自动存档与预览保护、1296 次连续地形边界采样、图鉴入口、无尽外扩和摄影检视检查，运行期错误为 0。已检查 12 张桌面/390 像素窄屏截图，包括开局、操作、铺满地图、塔面板、图鉴和摄影模式；氛围开关的实际图像输出有差异。

Windows x64 构建成功，并以独立程序运行了 12 秒启动检查：Unity、Direct3D 11、程序集与输入系统正常初始化，未发现脚本异常或 Shader 错误。试玩文件位于 `artifacts/unity-player/`；启动检查不等于完整的独立程序对局或性能测试。构建时 Unity 更新的 URP 运行设置及 Shader 裁剪设置随工程保留。

画面采用 Unity 原生程序模型重建；相机、材质和后处理没有逐像素复刻 Three.js。桌面/窄屏截图检查不能代替作者的美术验收；Android、iOS、WebGL 打包与真机性能未验证。

Noto Sans SC 字体以 SIL OFL 授权，许可证随 `Resources/NotoSansSC-LICENSE.txt` 保存。字体生成工具仅用于开发，运行时无需 Python、Node、网络或额外服务。

## 2026-10-18 编辑器序列化修复

`HabitatApp.pending` 是仅供选择目标的临时指令，现显式标记 `[NonSerialized]`。Unity 热重载也会序列化未标记的私有字段，原实现会沿 `GameAction.upgrades` 的递归类型布局触发深度 10 警告，即使字段为 null 也可能发生。规则层、批量升级参数和 NativeJson 存档保持原样。

修复后全量 C# 源码通过 Unity 所带 Roslyn 编译，并确认程序集中的 pending 字段带 NonSerialized 标记；`npm test` 和 1,572 例原生规则对照通过。检查时作者的 Unity 编辑器正在打开本项目，保留该实例；未在同一项目另开批处理或触发其 Play/热重载。回到 Unity 完成脚本重新编译后，再清除旧 Console 记录并进入 Play 检查。

同日后续[镜头与界面验收](UNITY-INTERFACE-2026-10-18.md)已在独立工程副本中实际开启默认域重载，确认 `pending` 不进入 SerializedObject；最终 120 项输入检查中未再出现序列化深度警告。
