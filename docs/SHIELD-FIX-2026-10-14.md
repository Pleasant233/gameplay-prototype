# 元素盾调配修复（2026-10-14）

旧界面制造一次元素盾后同时禁用了调配入口，不能再查看或调整配比；制造按钮也将部分限制误提示为配比数量不符。

现在制造后仍能打开面板和调整配比。实际制造继续遵守每轮一次；制造按钮和预览明确显示本轮已制造、库存不足或配比缺口，并明确需要普通结晶。每5颗普通结晶覆盖1格、制造不消耗AP、配比只在制造成功时扣除的规则保留。

验证：`npm test`通过；`FEEDBACK_UI_ONLY=1 npm run test:feedback`桌面与320px手机模拟33项通过、浏览器错误0，覆盖增减、拖动／触控滑条、Home／End、混合配比、精确扣晶、制造后再次调配、下一轮制造及滚动后的按钮可用性。已检查两种视口截图。

![桌面制造后仍可调配](screenshots/shield-fix-2026-10-14-desktop.png)
![320px手机模拟制造后仍可调配](screenshots/shield-fix-2026-10-14-phone.png)

正式地址：https://element-habitat.vercel.app 。部署 `dpl_3ErfVzbYKpTyiWeAEcGqfRZiMpX8`，READY / production；游戏源码 `a86d789ce7fb43fed35f40492cfd8a4c06681e51`。

线上7项复测通过、浏览器错误0：页面公开访问200且与本地修复逐字节一致；桌面／手机真实控件制造混合元素盾、精确扣晶且AP与轮次不变；制造后重新调配并提示本轮限制；下一轮恢复制造。直接加载线上源码，没有替换游戏或渲染代码。报告位于忽略的 `artifacts/shield-live-report.json`。手机为模拟视口。
