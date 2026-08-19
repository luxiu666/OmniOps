# Cookbook: Customizing the OmniOps web UI (copy, font sizes, and diagnosis catalog)

English | [中文](editing-web-copy-and-fonts.zh.md)

This guide is for anyone who needs to change the OmniOps Platform (formerly "数据库智能诊断系统") web UI. It covers four kinds of change — the **sidebar brand name**, its **font size**, the **hero headline**, and the **diagnosis cascading dropdown catalog**. Using the current product as the worked example, it gives file-by-file, line-by-line steps plus the mandatory rebuild-and-verify flow, so you can follow it directly.

---

## 0. How the web UI is built (read once)

The web UI is plugin-based: each region is its own package under `packages/client/*`. This guide touches two packages:

| UI region | Package path | Responsibility |
| --- | --- | --- |
| Left sidebar | `packages/client/ui-sidebar` | Sidebar (including the "OmniOps Platform" brand name) |
| Center conversation area | `packages/client/ui-conversation` | New-session empty state, hero headline, diagnosis cascading dropdowns |

**Key mechanism: source edits do not take effect immediately.** Source files (`.tsx` / `.module.css`) must first be compiled into a `lib/client.js` artifact. The running `dsh web` server watches `lib/client.js` and hot-reloads the page when it changes (refresh the browser if it does not).

```
source (.tsx / .module.css)  ──build(tsdown)──▶  lib/client.js  ──served──▶  page
```

> 📷 Screenshot placeholder: `docs/assets/editing-web-copy-and-fonts-00-overview.png` — an overview screenshot marking the three spots: the sidebar brand name, the hero headline, and the diagnosis cascading dropdowns.

---

## 1. Case A: Change the sidebar brand name text

**Goal**: rename the product name in the top-left corner (already changed from "数据库智能诊断系统" to "OmniOps Platform").

**File**: `packages/client/ui-sidebar/src/client/SidebarRoot.tsx`

**Line 140**:

```tsx
<span className={css.brandText}>OmniOps Platform</span>
```

Replace the text inside the tag. For example:

```tsx
<span className={css.brandText}>My Diagnosis System</span>
```

> 📷 Screenshot placeholder: `docs/assets/editing-web-copy-and-fonts-01-brand.png` — highlight the brand name at the top of the sidebar.

Then run the build command from [section 5](#5-rebuild-and-verify-required-after-every-edit).

---

## 2. Case B: Change the sidebar brand name font size

**Goal**: adjust the size of the brand name.

**File**: `packages/client/ui-sidebar/src/client/SidebarRoot.module.css`

**Lines 127–135**, the `.brandText` CSS block:

```css
.brandText {
  font-size: 22px;         /* ← font size, currently 22px */
  line-height: 28px;       /* ← line height, ~1.27× the font size */
  font-weight: 700;        /* bold */
  letter-spacing: 0.02em;  /* letter spacing */
  white-space: nowrap;     /* no wrapping */
  overflow: hidden;        /* hide overflow */
  text-overflow: ellipsis; /* show … on overflow */
}
```

**Only change `font-size`**, and optionally keep `line-height` around `font-size × 1.27` (e.g. 22→28, 24→30).

### Font-size reference table (sidebar default width 280px)

| Font size | Does "OmniOps Platform" fit fully? | Notes |
| --- | --- | --- |
| 18px | ✅ Fits | A bit small |
| 22px | ✅ Fits | **Current choice, recommended** |
| 24px | ✅ Fits | Latin text is much narrower than Chinese; plenty of room |
| 26px | ✅ Fits | Same size as the hero headline |

> Note: the brand name "OmniOps Platform" is ~170px wide, far below the ~216px available (280 total − 16 left padding − 48 right toggle button), so it no longer truncates. If you switch back to a long Chinese name (e.g. 9 characters), remember a Chinese glyph is roughly `font-size` wide, so 9 × font-size + letter-spacing must stay under 216px.

---

## 3. Case C: Change the hero headline / slogan

**Goal**: replace the large headline shown in the new-session empty state (already changed from "探索未至之境" to "洞察数据本源").

**File**: `packages/client/ui-conversation/src/client/locales.ts`

This file holds two dictionaries: Chinese (`zh`) and English (`en`).

**Line 73 (Chinese)**:

```ts
'hero.headline': '洞察数据本源',
```

Replace the text inside the quotes with the new slogan.

**Line 242 (English, optional)**:

```ts
'hero.headline': 'Into the Unknown',
```

> ⚠️ Changing the English slogan also touches 4 E2E tests and 2 snapshot files under `apps/web/tests/`; that is a larger change. A Chinese-only edit does not require touching English.

### 3.1 Update the unit-test assertions (otherwise `vitest` fails)

**File**: `packages/client/ui-conversation/tests/skeleton.client.spec.tsx`

Search the old slogan project-wide and replace all 4 assertions (already updated to `洞察数据本源` below):

| Line | Content |
| --- | --- |
| 365 | `expect(b.view.getByText('洞察数据本源')).toBeTruthy()` |
| 389 | `expect(b.view.queryByText('洞察数据本源')).toBeNull()` |
| 414 | `expect(b.view.getByText('洞察数据本源')).toBeTruthy()` |
| 432 | `expect(b.view.queryByText('洞察数据本源')).toBeNull()` |

**Rule of thumb**: every time you rename a slogan, do a project-wide search for the old text and replace it everywhere (source + tests).

---

## 4. Case D: The diagnosis cascading dropdown catalog (tech stack → component → diagnosis)

**Goal**: the three linked dropdowns on the hero — **tech stack**, **component**, and **diagnosis**. Selecting a tech stack refreshes the component list; selecting a component refreshes the diagnosis skill list.

**File**: `packages/client/ui-conversation/src/client/skeleton/ConversationRoot.tsx`

**Lines 26–177**, the `TECH_STACKS` constant. The whole three-level catalog lives here as a nested "tech stack → component → diagnosis skill" structure:

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

> `id` is the internal (stable, not displayed) identifier; `label` is what the UI shows. To rename an entry, change only `label`; to add/remove entries, maintain the `id` too.

### 4.1 Current catalog mapping

| Tech stack | Component | Diagnosis skills |
| --- | --- | --- |
| Database | MySQL | Slow query analysis, lock wait analysis, connection pool analysis, deadlock detection |
| | Redis | Slow query analysis, big key analysis, memory analysis, connection count analysis |
| | MongoDB | Slow query analysis, index analysis, lock wait analysis |
| Compute | GPU | Utilization analysis, VRAM analysis, dropped-card detection |
| | CPU | Utilization analysis, load analysis, context-switch analysis |
| | NPU | Utilization analysis, HBM memory analysis, dropped-card detection |
| Middleware | Kafka | Message backlog analysis, consumer lag analysis, partition skew analysis |
| | RabbitMQ | Message backlog analysis, connection analysis, memory analysis |
| | Nginx | Connection analysis, throughput analysis, upstream timeout analysis |
| | Zookeeper | Session analysis, election analysis, latency analysis |
| Kubernetes | Node | Resource watermark analysis, node anomaly detection |
| | Pod | OOM analysis, restart analysis, scheduling analysis |
| | Deployment | Release failure analysis, rolling update analysis |
| | Service | Connection analysis, DNS resolution analysis, load balancing analysis |

> ⚠️ Note: the requirement's "GPU、CPU、NPG" was interpreted as **NPU** (Neural Processing Unit); the middleware and Kubernetes entries and their skills are sensible defaults and can be adjusted.

### 4.2 Cascade logic (keep it consistent when editing)

`ConversationRoot.tsx` lines 193–212 hold three state values and two cascade handlers:

- `techStackId` (tech stack), `componentId` (component), `skillId` (diagnosis)
- Selecting a tech stack resets `componentId` to that stack's first component and `skillId` to that component's first skill
- Selecting a component resets `skillId` to that component's first skill

**To add a tech stack / component / skill**, just add the corresponding entry in `TECH_STACKS` — no other logic changes. But each component's `skills` array **must not be empty** (otherwise the reset would read `undefined`).

> 📷 Screenshot placeholder: `docs/assets/editing-web-copy-and-fonts-02-diagnosis-catalog.png` — highlight the three cascading dropdowns (tech stack / component / diagnosis).

---

## 5. Rebuild and verify (required after every edit)

After editing source, run the build inside the package directory; success prints `Build complete`:

```bash
# changed ui-sidebar (brand text / font size)
cd /Users/zhaohailiang/Desktop/WorkBuddy/OmniOps/packages/client/ui-sidebar
pnpm exec tsdown
```

```bash
# changed ui-conversation (hero slogan / diagnosis catalog)
cd /Users/zhaohailiang/Desktop/WorkBuddy/OmniOps/packages/client/ui-conversation
pnpm exec tsdown
```

Then refresh the browser (Cmd+R); the running `dsh web` server usually hot-reloads automatically.

> After editing `ConversationRoot.tsx`, run a typecheck too (the repo enables strict index checks, so an empty array fails):
>
> ```bash
> cd /Users/zhaohailiang/Desktop/WorkBuddy/OmniOps
> pnpm exec tsc --noEmit -p packages/client/ui-conversation/tsconfig.json
> ```

### Official watch mode (optional)

The repo provides a save-to-rebuild watcher:

```bash
cd /Users/zhaohailiang/Desktop/WorkBuddy/OmniOps
pnpm run dev:web
```

> ⚠️ Known issue: in the current local environment this command fails with an `import-without-cache` Node loader error (a Node version compatibility issue). If you hit it, use the manual `pnpm exec tsdown` approach above — same effect.

---

## 6. FAQ

| Question | Answer |
| --- | --- |
| Source changed but the page did not update? | Confirm you ran `pnpm exec tsdown` and saw `Build complete`, then refresh the browser. |
| Brand name truncates to "…"? | Reduce the font size (see section 2 table), or widen the sidebar (max 420px). |
| Want to rename a dropdown entry? | Change the `label` of the corresponding `TECH_STACKS` entry in `ConversationRoot.tsx`; keep `id` unchanged. |
| Added a component but its diagnosis dropdown is empty? | The component's `skills` array must be non-empty (see section 4.2). |
| Tests fail after changing the English slogan? | See section 3 ⚠️: English is referenced by `apps/web/tests/*` and must be updated together. |
| `pnpm run dev:web` errors? | See section 5: use `pnpm exec tsdown` inside the package directory instead. |
