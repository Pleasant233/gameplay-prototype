# Unity 镜头与界面对齐 — 2026-10-18

本次依据作者确认的 **当前打开的线上网页外观和操作** 更新原生 Unity 镜头与 UGUI。抓取时线上内容已与 10 月 17 日迁移快照不同，因此只采用当前页面的视觉、布局和镜头交互；游戏继续使用已确认的 **40 轮挑战、中央守护塔和无尽模式**。

`migration/interface-reference/` 保存本次 HTML、镜头源码和 SHA-256，仅作为界面参考；规则基准仍是 `migration/web-reference/`。没有用新抓取的旧规则覆盖 C# 规则层。

## 操作

- 桌面：单击选地块，左键拖动旋转，右键或中键拖动平移，滚轮缩放。WASD / 方向键平移，Q/E 旋转，R/F 拉近/拉远，空格复位。
- 触屏：点选，单指拖动旋转，双指缩放并平移。拖动或双指结束后不会误触地块。
- 1/2/3 选择候选地块，B 开关背包，Enter 结束本轮，Esc 依次关闭面板、取消目标或取消选择。完成初始地图后可按 P 摄影、Ctrl+S 导出地图。

按钮获得键盘焦点时，Enter 交由界面提交，避免与地图快捷键重复执行。Esc 会先取消选卡/施法目标，再取消普通地块选择；快速拖动后在同一帧松开也会核对位移，避免误放置。

地图输入会避开界面，背包滚动与菜单操作不会同时移动地图；点选相同地块或空白处可收起详情。镜头使用网页相同的 40° 视角、缩放范围、球面角度、平滑速度和底部工具栏构图偏移。右键纵向平移保持当前网页的方向约定。

## 界面

原生绘制顶部轮次、AP、灵力、空位胶囊，右上背包与菜单，底部三张候选地形卡、五种魔法和结束轮次按钮。补齐卡牌选择、悬停提示、目标范围、抽屉和对话框过渡，并保留收益飞行与延迟计数。

桌面详情在左侧，背包在右侧；窄屏详情成为工具栏上方的底部面板。图鉴、教学、声音、画面偏好、守护塔、无尽、摄影和导出入口保留；40 轮灵力公式与阶段目标可从灵力胶囊或菜单查看。

实现位于 `HabitatCamera.cs`、`HabitatWebUI.cs`、`HabitatWebGraphic.cs`、`HabitatDrawerMotion.cs`，由 `HabitatApp.cs` 连接目标选择与快捷键。界面没有嵌入网页，也不需要联网。

## 验证与复现

作者编辑器打开时应使用独立副本执行验收，避免同一项目被两个 Unity 实例占用。副本需包含 Assets、Packages、ProjectSettings，并使用独立 companyName/productName 隔离存档与偏好。

从验证副本构建交付包时，临时恢复主项目的 companyName/productName，保证玩家继续使用原来的本机存档目录；构建结束后将副本恢复为验证身份。

```powershell
powershell -ExecutionPolicy Bypass -File scripts/unity-check.ps1 -Interface -ProjectPath artifacts/unity-interface-project/SpotlightGamejam -ArtifactsPath artifacts/unity-interface-run
powershell -ExecutionPolicy Bypass -File scripts/unity-check.ps1 -Motion -ProjectPath artifacts/unity-interface-project/SpotlightGamejam -ArtifactsPath artifacts/unity-interface-regression
node scripts/unity-interface-reference.cjs
python scripts/unity-interface-evidence.py
```

界面验收使用真实 InputSystem 事件及 EventSystem 射线，开启默认域重载，检查 `pending` 不参与 Unity 递归序列化；不是直接调用按钮回调来代替鼠标/触摸。参考截图采用 CSS 终态，避免将抽屉滑入的中间帧当成最终位置。

结果与对比图分别保存于 `artifacts/unity-interface-run/unity-interface/`、`artifacts/unity-interface-regression/` 和 `artifacts/web-interface-reference/`。历史迁移与动效报告保留。

本次最终界面验收 **120 项通过、28 张真实渲染帧、0 运行错误**，包含默认域重载、桌面/触屏点击和拖动、UI 遮挡、双指、选卡/施法取消、焦点按钮后的单次 Enter 结算，以及摄影只读和实际 JSON 导出/恢复。地图测试点击先验证目标未被 UGUI 遮挡，避免将界面拦截误算成地图操作成功。

场景回归 **21 项通过、12 张截图、0 运行错误**；动效回归 **110 项通过、110 张帧图、0 错误**。`npm test` 通过，包括 35 组旧网页规则、30 局完整模拟、23 组 v1.3 检查和连续地形/云几何。原生规则层没有修改，既有 1,572 例规则对照报告继续保留。

Windows x64 构建成功，独立程序以 Direct3D / RTX 5070 Laptop GPU 运行 12 秒启动检查，无脚本或 Shader 错误。最新压缩包为 `artifacts/ElementHabitat-Windows.zip`（约 41.3 MiB），包含字体授权与操作说明，不包含 DoNotShip 调试资料。解压整个包后运行 `ElementHabitat.exe`。启动检查不等于完整独立程序对局。

当前验证覆盖 Windows Unity 编辑器与手机尺寸模拟。三维景观仍使用 Unity 程序模型，未作全画面逐像素复刻；Android/iOS 真机性能与构建尚未验证。
