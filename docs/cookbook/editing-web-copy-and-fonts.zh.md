# 实操手册：自定义 OmniOps Web 界面（文案、字号与诊断目录）

[English](editing-web-copy-and-fonts.md) | 中文

本手册面向需要改动 OmniOps Platform（原「数据库智能诊断系统」）Web 界面的人，覆盖四类常见改动：**侧边栏品牌名文字**、**品牌名字号**、**首页大字口号**、**诊断三级下拉框目录**。以当前产品为例，给出逐文件、逐行的操作步骤，以及改完必做的重新编译与验证方法，照着做即可。

---

## 0. 先理解界面是怎么构建的（1 分钟）

这个 Web 界面是插件化的，每个界面区域是一个独立包，位于 `packages/client/*`。本文只涉及两个包：

| 界面区域 | 包路径 | 负责内容 |
| --- | --- | --- |
| 左侧边栏 | `packages/client/ui-sidebar` | 侧边栏（含顶部品牌名「OmniOps Platform」） |
| 中间对话区 | `packages/client/ui-conversation` | 新建会话空态、首页大标题口号、诊断三级下拉框 |

**关键机制：改了源码不会立刻生效。** 源码（`.tsx` / `.module.css`）要先编译成 `lib/client.js` 产物文件，正在运行的 `dsh web` 服务会监听 `lib/client.js`，发现变化后自动热更新页面（没反应就刷新浏览器）。

```
源码 (.tsx / .module.css)  ──编译(tsdown)──▶  lib/client.js  ──被服务加载──▶  页面显示
```

> 📷 截图占位：`docs/assets/editing-web-copy-and-fonts-00-overview.png` —— 一张界面全景图，标出「侧边栏品牌名」「首页大字口号」「诊断三级下拉框」三处位置。

---

## 1. 场景 A：改侧边栏品牌名文字

**目标**：把左上角的产品名换掉（本次已从「数据库智能诊断系统」改为「OmniOps Platform」）。

**文件**：`packages/client/ui-sidebar/src/client/SidebarRoot.tsx`

**第 140 行**：

```tsx
<span className={css.brandText}>OmniOps Platform</span>
```

把标签里的文字换成你要的名字即可。例如：

```tsx
<span className={css.brandText}>我的诊断系统</span>
```

> 📷 截图占位：`docs/assets/editing-web-copy-and-fonts-01-brand.png` —— 红框标出侧边栏顶部品牌名位置。

改完执行 [第 5 节](#5-重新编译与验证每次改完必做) 的编译命令。

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

| 字号 | 「OmniOps Platform」能否完整显示 | 说明 |
| --- | --- | --- |
| 18px | ✅ 完整 | 偏小 |
| 22px | ✅ 完整 | **当前采用，推荐** |
| 24px | ✅ 完整 | 英文宽度远小于中文，余量充足 |
| 26px | ✅ 完整 | 与首页大字同尺寸 |

> 说明：品牌名改成英文「OmniOps Platform」后宽度约 170px，远小于可用宽度约 216px（总宽 280 − 左内边距 16 − 右侧折叠按钮 48），不会再截断。若改回较长中文（如 9 个字），请参考：汉字宽度 ≈ 字号，9 个字 × 字号 + 字间距需 ≤ 216px。

---

## 3. 场景 C：改首页大字口号

**目标**：把新建会话时页面中间的大标题口号换掉（已从「探索未至之境」改为「洞察数据本源」）。

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

## 4. 场景 D：诊断三级下拉框目录（技术栈 → 组件 → 诊断）

**目标**：首页的三个联动下拉框——「技术栈」「组件」「诊断」。选技术栈刷新组件列表，选组件刷新诊断技能列表。

**文件**：`packages/client/ui-conversation/src/client/skeleton/ConversationRoot.tsx`

**第 26～177 行**，`TECH_STACKS` 常量。三级目录全部集中在这里，是一个「技术栈 → 组件 → 诊断技能」的嵌套数据结构：

```ts
const TECH_STACKS = [
  {
    id: 'database',
    label: '数据库',
    components: [
      { id: 'mysql', label: 'MySQL', skills: [
        { id: 'slow-query', label: '慢查询分析' },
        // ...
      ]},
      // ...
    ],
  },
  // ...
] as const satisfies readonly TechStackOption[]
```

> `id` 是内部标识（稳定、不显示），`label` 是界面上显示的文字。改显示名只改 `label`；新增/删除条目则需同时维护 `id`。

### 4.1 当前完整目录映射表

| 技术栈 | 组件 | 诊断技能 |
| --- | --- | --- |
| 数据库 | MySQL | 慢查询分析、锁等待分析、连接池分析、死锁检测 |
| | Redis | 慢查询分析、大 Key 分析、内存分析、连接数分析 |
| | MongoDB | 慢查询分析、索引分析、锁等待分析 |
| 计算资源 | GPU | 利用率分析、显存分析、掉卡检测 |
| | CPU | 利用率分析、负载分析、上下文切换分析 |
| | NPU | 利用率分析、HBM 显存分析、掉卡检测 |
| 中间件 | Kafka | 消息堆积分析、消费者 Lag 分析、分区倾斜分析 |
| | RabbitMQ | 消息堆积分析、连接分析、内存分析 |
| | Nginx | 连接分析、吞吐分析、上游超时分析 |
| | Zookeeper | 会话分析、选举分析、延迟分析 |
| Kubernetes | Node | 资源水位分析、节点异常检测 |
| | Pod | OOM 分析、重启分析、调度分析 |
| | Deployment | 发布失败分析、滚动更新分析 |
| | Service | 连接分析、DNS 解析分析、负载均衡分析 |

> ⚠️ 说明：需求原文「GPU、CPU、NPG」中的「NPG」按 **NPU**（Neural Processing Unit，神经网络处理器）理解并实现；中间件、Kubernetes 及其诊断技能为补充的合理默认值，可按需调整。

### 4.2 联动逻辑（改动时需保持一致）

`ConversationRoot.tsx` 第 193～212 行维护三个状态与两个联动函数：

- `techStackId`（技术栈）、`componentId`（组件）、`skillId`（诊断）
- 选技术栈 → `componentId` 重置为该栈第一个组件，`skillId` 重置为该组件第一个技能
- 选组件 → `skillId` 重置为该组件第一个技能

**新增一个技术栈/组件/技能**，只需在 `TECH_STACKS` 里加对应条目即可，无需改其它逻辑；但每个「组件」的 `skills` 数组**不能为空**（否则重置会取到 `undefined`）。

> 📷 截图占位：`docs/assets/editing-web-copy-and-fonts-02-diagnosis-catalog.png` —— 红框标出三个联动下拉框（技术栈 / 组件 / 诊断）。

---

## 5. 重新编译与验证（每次改完必做）

改完源码后，进入对应包目录执行编译，看到 `Build complete` 即成功：

```bash
# 改了 ui-sidebar（品牌名文字 / 字号）
cd /Users/zhaohailiang/Desktop/WorkBuddy/OmniOps/packages/client/ui-sidebar
pnpm exec tsdown
```

```bash
# 改了 ui-conversation（首页口号 / 诊断目录）
cd /Users/zhaohailiang/Desktop/WorkBuddy/OmniOps/packages/client/ui-conversation
pnpm exec tsdown
```

然后刷新浏览器（Cmd+R）看效果；运行中的 `dsh web` 服务通常会直接热更新。

> 改完 `ConversationRoot.tsx` 建议顺手跑一次类型检查（本仓库启用了严格索引检查，空数组会报错）：
>
> ```bash
> cd /Users/zhaohailiang/Desktop/WorkBuddy/OmniOps
> pnpm exec tsc --noEmit -p packages/client/ui-conversation/tsconfig.json
> ```

### 官方自动监听方式（可选）

仓库提供了保存即自动重建的命令：

```bash
cd /Users/zhaohailiang/Desktop/WorkBuddy/OmniOps
pnpm run dev:web
```

> ⚠️ 已知问题：本机当前环境下该命令会因 `import-without-cache` 的 Node loader 报错而失败（Node 版本兼容问题）。若遇到，改用上面的「手动 `pnpm exec tsdown`」方式，效果相同。

---

## 6. 常见问题（FAQ）

| 问题 | 答案 |
| --- | --- |
| 改了源码但页面没变？ | 确认执行了 `pnpm exec tsdown` 且看到 `Build complete`，再刷新浏览器。 |
| 品牌名被截断成「…」？ | 字号调小（见第 2 节表格），或把侧边栏拖宽（上限 420px）。 |
| 下拉框里某项想换名字？ | 改 `ConversationRoot.tsx` 里 `TECH_STACKS` 对应条目的 `label`，`id` 保持不变。 |
| 新增一个组件但诊断框是空的？ | 该组件的 `skills` 数组不能为空，至少填一个技能（见第 4.2 节）。 |
| 改了英文口号测试挂？ | 见第 3 节 ⚠️：英文被 `apps/web/tests/*` 引用，需一并更新。 |
| `pnpm run dev:web` 报错？ | 见第 5 节：改用包目录下 `pnpm exec tsdown`。 |
