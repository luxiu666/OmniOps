# 实操手册：修改 Web 界面文案与字号

[English](editing-web-copy-and-fonts.md) | 中文

本手册面向需要改动 DeepSeek Harness Web 界面文字（文案）或字号的人，覆盖两个最常见场景：**侧边栏品牌名** 与 **首页大字口号**。以「数据库智能诊断系统」产品为例，给出逐文件、逐行的操作步骤，以及改完必做的重新编译与验证方法，照着做即可。

---

## 0. 先理解界面是怎么构建的（1 分钟）

这个 Web 界面是插件化的，每个界面区域是一个独立包，位于 `packages/client/*`。本文只涉及两个包：

| 界面区域 | 包路径 | 负责内容 |
| --- | --- | --- |
| 左侧边栏 | `packages/client/ui-sidebar` | 侧边栏（含顶部品牌名「数据库智能诊断系统」） |
| 中间对话区 | `packages/client/ui-conversation` | 新建会话空态、首页大标题口号 |

**关键机制：改了源码不会立刻生效。** 源码（`.tsx` / `.module.css`）要先编译成 `lib/client.js` 产物文件，正在运行的 `dsh web` 服务会监听 `lib/client.js`，发现变化后自动热更新页面（没反应就刷新浏览器）。

```
源码 (.tsx / .module.css)  ──编译(tsdown)──▶  lib/client.js  ──被服务加载──▶  页面显示
```

> 📷 截图占位：`docs/assets/editing-web-copy-and-fonts-00-overview.png` —— 一张界面全景图，标出「侧边栏品牌名」与「首页大字口号」两处位置。

---

## 1. 场景 A：改侧边栏品牌名文字

**目标**：把左上角的产品名换掉（如「数据库智能诊断系统」→「XXX」）。

**文件**：`packages/client/ui-sidebar/src/client/SidebarRoot.tsx`

**第 140 行**：

```tsx
<span className={css.brandText}>数据库智能诊断系统</span>
```

把标签里的文字换成你要的名字即可。例如：

```tsx
<span className={css.brandText}>我的诊断系统</span>
```

> 📷 截图占位：`docs/assets/editing-web-copy-and-fonts-01-brand.png` —— 红框标出侧边栏顶部品牌名位置。

改完执行 [第 4 节](#4-重新编译与验证每次改完必做) 的编译命令。

---

## 2. 场景 B：改侧边栏品牌名字号

**目标**：调整品牌名字的大小。

**文件**：`packages/client/ui-sidebar/src/client/SidebarRoot.module.css`

**第 127～135 行**，`.brandText` 这个 CSS 块：

```css
.brandText {
  font-size: 22px;         /* ← 字号，当前 22px */
  line-height: 28px;       /* ← 行高，约为字号的 1.27 倍 */
  font-weight: 700;        /* 加粗 */
  letter-spacing: 0.02em;  /* 字间距 */
  white-space: nowrap;     /* 不换行 */
  overflow: hidden;        /* 超出隐藏 */
  text-overflow: ellipsis; /* 超出显示省略号 … */
}
```

**只改 `font-size` 一个值即可**，并建议同步把 `line-height` 调成「字号 × 1.27」左右（如 22→28、24→30）。

### 字号选择速查表（侧边栏默认宽度 280px）

| 字号 | 「数据库智能诊断系统」(9 个字) 能否完整显示 | 说明 |
| --- | --- | --- |
| 18px | ✅ 完整 | 原始大小，偏小 |
| 22px | ✅ 完整 | **当前采用，推荐** |
| 23px | ✅ 完整（很勉强） | 剩余空间约 5px |
| 24px | ❌ 截断成「…」 | 除非把侧边栏拖宽 |
| 26px | ❌ 明显截断 | 与首页大字同尺寸，但放不下 |

> 计算依据：侧边栏品牌名可用宽度约 216px（总宽 280 − 左内边距 16 − 右侧折叠按钮 48）。汉字宽度 ≈ 字号，9 个字 × 字号 + 字间距超过 216px 即被截断。

---

## 3. 场景 C：改首页大字口号

**目标**：把新建会话时页面中间的大标题口号换掉（如「探索未至之境」→「洞察数据本源」）。

**文件**：`packages/client/ui-conversation/src/client/locales.ts`

该文件同时含中文（`zh`）与英文（`en`）两套字典。

**第 73 行（中文）**：

```ts
'hero.headline': '洞察数据本源',
```

把引号里的文字换成新口号即可。

**第 242 行（英文，可选）**：

```ts
'hero.headline': 'Into the Unknown',
```

> ⚠️ 改英文口号会牵连 `apps/web/tests/` 下的 4 个 E2E 测试和 2 个快照文件，改动范围更大；只改中文时无需处理英文。

### 3.1 同步修改单测断言（否则 `vitest` 会挂）

**文件**：`packages/client/ui-conversation/tests/skeleton.client.spec.tsx`

全局搜索旧口号，把 4 处断言一起替换（当前已改为 `洞察数据本源`）：

| 行号 | 内容 |
| --- | --- |
| 365 | `expect(b.view.getByText('洞察数据本源')).toBeTruthy()` |
| 389 | `expect(b.view.queryByText('洞察数据本源')).toBeNull()` |
| 414 | `expect(b.view.getByText('洞察数据本源')).toBeTruthy()` |
| 432 | `expect(b.view.queryByText('洞察数据本源')).toBeNull()` |

**规律**：每次改口号，用 IDE「全项目搜索」搜旧文案，把「源码 + 测试」里所有出现的地方一起替换。

---

## 4. 重新编译与验证（每次改完必做）

改完源码后，进入对应包目录执行编译，看到 `Build complete` 即成功：

```bash
# 改了 ui-sidebar（品牌名文字 / 字号）
cd /Users/zhaohailiang/Desktop/WorkBuddy/deepseek-harness/packages/client/ui-sidebar
pnpm exec tsdown
```

```bash
# 改了 ui-conversation（首页口号）
cd /Users/zhaohailiang/Desktop/WorkBuddy/deepseek-harness/packages/client/ui-conversation
pnpm exec tsdown
```

然后刷新浏览器（Cmd+R）看效果；运行中的 `dsh web` 服务通常会直接热更新。

### 官方自动监听方式（可选）

仓库提供了保存即自动重建的命令：

```bash
cd /Users/zhaohailiang/Desktop/WorkBuddy/deepseek-harness
pnpm run dev:web
```

> ⚠️ 已知问题：本机当前环境下该命令会因 `import-without-cache` 的 Node loader 报错而失败（Node 版本兼容问题）。若遇到，改用上面的「手动 `pnpm exec tsdown`」方式，效果相同。

---

## 5. 常见问题（FAQ）

| 问题 | 答案 |
| --- | --- |
| 改了源码但页面没变？ | 确认执行了 `pnpm exec tsdown` 且看到 `Build complete`，再刷新浏览器。 |
| 品牌名被截断成「…」？ | 字号调小（见第 2 节表格），或把侧边栏拖宽（上限 420px）。 |
| 改了英文口号测试挂？ | 见第 3 节 ⚠️：英文被 `apps/web/tests/*` 引用，需一并更新。 |
| `pnpm run dev:web` 报错？ | 见第 4 节：改用包目录下 `pnpm exec tsdown`。 |
