# Cookbook: Editing web UI copy and font sizes

English | [中文](editing-web-copy-and-fonts.zh.md)

This guide is for anyone who needs to change visible text (copy) or font sizes in the DeepSeek Harness Web UI. It covers the two most common cases — the **sidebar brand name** and the **hero headline** — using the "数据库智能诊断系统" (Database Intelligent Diagnosis System) product as a worked example. It gives file-by-file, line-by-line steps plus the mandatory rebuild-and-verify flow, so you can follow it directly.

---

## 0. How the web UI is built (read once)

The web UI is plugin-based: each region is its own package under `packages/client/*`. This guide touches two packages:

| UI region | Package path | Responsibility |
| --- | --- | --- |
| Left sidebar | `packages/client/ui-sidebar` | Sidebar (including the brand name at the top) |
| Center conversation area | `packages/client/ui-conversation` | New-session empty state, hero headline/slogan |

**Key mechanism: source edits do not take effect immediately.** Source files (`.tsx` / `.module.css`) must first be compiled into a `lib/client.js` artifact. The running `dsh web` server watches `lib/client.js` and hot-reloads the page when it changes (refresh the browser if it does not).

```
source (.tsx / .module.css)  ──build(tsdown)──▶  lib/client.js  ──served──▶  page
```

> 📷 Screenshot placeholder: `docs/assets/editing-web-copy-and-fonts-00-overview.png` — an overview screenshot marking the two spots: the sidebar brand name and the hero headline.

---

## 1. Case A: Change the sidebar brand name text

**Goal**: rename the product name in the top-left corner.

**File**: `packages/client/ui-sidebar/src/client/SidebarRoot.tsx`

**Line 140**:

```tsx
<span className={css.brandText}>数据库智能诊断系统</span>
```

Replace the text inside the tag. For example:

```tsx
<span className={css.brandText}>My Diagnosis System</span>
```

> 📷 Screenshot placeholder: `docs/assets/editing-web-copy-and-fonts-01-brand.png` — highlight the brand name at the top of the sidebar.

Then run the build command from [section 4](#4-rebuild-and-verify-required-after-every-edit).

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

| Font size | Does "数据库智能诊断系统" (9 chars) fit fully? | Notes |
| --- | --- | --- |
| 18px | ✅ Fits | Original size, a bit small |
| 22px | ✅ Fits | **Current choice, recommended** |
| 23px | ✅ Fits (very tight) | ~5px of space left |
| 24px | ❌ Truncates to "…" | Unless the sidebar is widened |
| 26px | ❌ Clearly truncates | Same size as the hero, but does not fit |

> Rationale: the brand name has ~216px of available width (280 total − 16 left padding − 48 right toggle button). A Chinese glyph is roughly `font-size` wide, so 9 × font-size + letter-spacing must stay under 216px.

---

## 3. Case C: Change the hero headline / slogan

**Goal**: replace the large headline shown in the new-session empty state (e.g. "探索未至之境" → "洞察数据本源").

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

## 4. Rebuild and verify (required after every edit)

After editing source, run the build inside the package directory; success prints `Build complete`:

```bash
# changed ui-sidebar (brand text / font size)
cd /Users/zhaohailiang/Desktop/WorkBuddy/deepseek-harness/packages/client/ui-sidebar
pnpm exec tsdown
```

```bash
# changed ui-conversation (hero slogan)
cd /Users/zhaohailiang/Desktop/WorkBuddy/deepseek-harness/packages/client/ui-conversation
pnpm exec tsdown
```

Then refresh the browser (Cmd+R); the running `dsh web` server usually hot-reloads automatically.

### Official watch mode (optional)

The repo provides a save-to-rebuild watcher:

```bash
cd /Users/zhaohailiang/Desktop/WorkBuddy/deepseek-harness
pnpm run dev:web
```

> ⚠️ Known issue: in the current local environment this command fails with an `import-without-cache` Node loader error (a Node version compatibility issue). If you hit it, use the manual `pnpm exec tsdown` approach above — same effect.

---

## 5. FAQ

| Question | Answer |
| --- | --- |
| Source changed but the page did not update? | Confirm you ran `pnpm exec tsdown` and saw `Build complete`, then refresh the browser. |
| Brand name truncates to "…"? | Reduce the font size (see section 2 table), or widen the sidebar (max 420px). |
| Tests fail after changing the English slogan? | See section 3 ⚠️: English is referenced by `apps/web/tests/*` and must be updated together. |
| `pnpm run dev:web` errors? | See section 4: use `pnpm exec tsdown` inside the package directory instead. |
