# obsidian-task-manager-bases-view — 设计文档

> 基于 Obsidian **Bases** 的轻量任务管理插件。**只负责渲染**：数据落在用户的 markdown
> frontmatter / 正文，配置来自 Bases 与各视图选项。插件不拥有数据模型、不硬编码字段。
> 视图/类名前缀统一 `tm-`。

提供三个视图：
- `tm-kanban`（Bases view）：按某属性分列管理完成度，可拖拽。
- `tm-timeline`（Bases view）：按起止日期渲染甘特条，可拖拽改期。
- `tm-calendar`（独立 leaf view）：周时间网格，渲染日记的日志时间块，可拖拽建日志。

---

## 1. 设计哲学

1. **只渲染，不建模**：任务数据 = 用户 markdown 的 frontmatter / 正文，字段名不硬编码。
2. **配置来自 Bases + 视图选项**：filter / sort / groupBy / 可见属性来自 Bases 工具栏；
   视图自身参数走 `BasesViewRegistration.options`（原生视图设置），用 `config.get/set` 存取。
3. **无需提前约定字段**：每个视图需要的「角色」（分组属性、起止日期属性…）由用户在视图选项里
   指向自己的任意属性。插件不关心字段叫什么。

---

## 2. 各视图消费什么

插件只读取「渲染所需」的少量角色，全部由用户在视图选项中指定，**不预设任何 frontmatter 结构**：

| 视图 | 渲染所需角色 | 来源 |
|---|---|---|
| tm-kanban | 分组属性（列）；可选「完成状态值」用于完成样式 | 原生 groupBy，或视图选项 `groupProperty` + `predefinedValues` + `doneStatuses` |
| tm-timeline | 开始日期属性、结束日期属性；可选分组/排序 | 视图选项 `startProp` / `endProp`；左侧排列跟随 Bases groupBy/sort |
| tm-calendar | 日记集合；每天的日志时间块 | 日记路径+日期格式（设置）；解析日记正文的**日志章节**（见 2.1） |

### 2.1 日记日志格式（calendar 唯一需要解析的内容约定）

calendar 读日记正文里一个日志章节（章节名可配，默认 `Log`），每行渲染为一个时间块：

```markdown
## Log
- 14:00-15:00 [[某任务]] 备注
- 16:00-16:30
```

规则：列表项以 `HH:MM-HH:MM`（24h）开头 → 可选 `[[wikilink]]` → 可选备注。
这是插件唯一需要解析的正文格式；其余一切都走 frontmatter 属性，无需约定。

---

## 3. 总体架构

```
ObsidianTaskManagerPlugin (main.ts，极简：生命周期 + 按设置注册)
├── registerBasesView('tm-kanban',   …)
├── registerBasesView('tm-timeline', …)
├── registerView(TM_CALENDAR_VIEW, …)   // 独立 leaf（非 Bases）
└── addSettingTab(…)
```

```
src/
  main.ts                      # 生命周期 + 按设置注册
  settings.ts                  # 全局设置（视图开关、日记路径/格式/周起始、日志章节名）
  shared/                      # ★ 三视图共享内核
    entry-accessor.ts          # 从 BasesEntry 安全读 Value
    frontmatter-writer.ts      # processFrontMatter 回写 + 可写性判定（仅 note.*）
    value-render.ts            # 统一 Value.renderTo
    open-detail.ts             # 点击任务 → 右侧分栏（复用同一详情 leaf）
    section-parser.ts          # metadataCache.headings 定位章节 + 切正文（日志解析）
    view-config.ts             # config.get/set 读写 tmKanbanState
    palette.ts                 # 主题友好命名色板（CSS 变量）
  kanban/    kanban-view.ts column.svelte card.svelte drag.ts predefined.ts
  timeline/  timeline-view.ts lane.svelte bar.svelte time-axis.svelte
  calendar/  calendar-view.ts week-grid.svelte log-block.svelte log-io.ts
  styles.css                   # 统一 tm- 前缀，全程 CSS 变量
```

**数据流（Bases view）**：改 frontmatter / 改 Bases 配置 / 拖拽回写 → Bases 重新查询 →
`view.onDataUpdated()` 读 `data.groupedData`·`data.data`·`config.*`·`entry.getValue()` → Svelte 渲染 →
DOM 拖拽 → `shared/frontmatter-writer` → 闭环。
铁律：**不长期持有 `this.data` / `BasesEntry`**（每次更新被整体替换），用 getter 闭包现取。

---

## 4. 视图规格

### 4.1 tm-kanban（Bases view）

按分组属性分列展示 filter 的任务，拖拽改完成度。

**分组模式（视图选项开关 `usePredefinedColumns`）**
- **开**：指定 `groupProperty` + `predefinedValues`（multitext）。列 = 预定义值，**按填写顺序渲染**；
  自己 `entry.getValue(groupProperty)` 分桶。
- **关**：降级用原生 groupBy（`data.groupedData`）。
- `shouldHide`：`groupProperty` / `predefinedValues` / `doneStatuses` 仅在开关开时显示。

**列行为**
- **可折叠**：全部可折叠；默认预定义列展开、非预定义列 / 未分组列折叠。折叠状态存 view config，
  仅记用户显式改过的列。
- **任务数量**：列头显示 `group.entries.length`。
- **列内顺序**：跟随 Bases sort，不手动拖排序。
- **列颜色**：按列位置自动取 `shared/palette.ts` 柔和色，或预定义值携带颜色（`todo|blue`）；
  不做取色器、不单独持久化。`doneStatuses`（视图选项，默认 `done`）命中的列加「完成」样式。
- **新增按钮**：列底「+」→ `createFileForView(undefined, fm => fm[prop]=列值)`。未分组/只读列禁用。

**拖拽**：跨列拖卡 → 回写 `groupProperty` frontmatter（**仅 `note.*` 可写**，否则禁用拖拽）；
回写后靠 `onDataUpdated` 闭环刷新。

### 4.2 tm-timeline（Bases view）

左侧任务项 + 右侧时间条，**不渲染依赖关系**。

- **起止**：视图选项 `startProp` / `endProp`（过滤为日期属性）。
- **左侧排列**：跟随 Bases groupBy/sort——分组→泳道，排序→排序，都无→平铺。
- **scale**：dropdown 视图选项 `day | week | month`。
- **里程碑**：只有单端 → 里程碑点；两端皆无 → 左侧保留、右侧无条。
- **拖拽**：拖整条平移双端、拖两端改单端 → 回写 start/end（仅 `note.*`）。

### 4.3 tm-calendar（独立 leaf view，非 Bases）

**为何非 Bases**：日历几乎用不到查询能力（日记按文件夹+文件名日期即可圈定），且是固定 7 天窗口、
按周翻页、真正数据（时间块）在正文里 Bases 看不见。故做独立视图。

- **数据源**：设置里配「日记路径 + 日期格式 + 周起始（周日/周一）」，或复用 Daily/Periodic Notes
  （`obsidian-daily-notes-interface`）。
- **渲染**：每天一列，日志章节每条 `HH:MM-HH:MM [[…]]` → 时间块（见 2.1）。
- **交互**：网格拖拽 → 在当天日记日志章节插入/改一行（`shared/section-parser` + `calendar/log-io`）。
- **UI 库**：`@event-calendar/core`（Svelte 原生、MIT、自带拖拽、轻量；已选定）。
- 打开：ribbon 图标 + 命令「Open weekly log」。

### 4.4 点击任务项 → 右侧分栏

kanban / timeline 任务项点击后，在**右侧分栏**打开该任务文件——不替换当前视图、不全屏，
保持「视图在左、详情在右」双栏；文件本身即详情面板。**不建自定义详情视图**。
- 实现：`openLinkText(path, '', 'split')` 或 `getLeaf('split','vertical')`，并**复用同一详情 leaf**
  （存活则复用，失效则新建），避免重复点击不断新开分栏。
- mod+点击仍可新标签/新窗口打开（`Keymap.isModEvent`）。

---

## 5. 设置与注册

- 设置页提供**每视图开关**。kanban/timeline 开 → `registerBasesView`；calendar 开 → `registerView` + ribbon/命令。
- **单视图参数**（分组属性、预定义值、`doneStatuses`、startProp/endProp、scale）→ `registration.options`。
- **全局/跨文件约定**（日记路径、日期格式、周起始、日志章节名）→ 设置页。
- ⚠️ 运行时切开关可能需**重载插件**才生效（Bases 大概率无单视图注销 API）；开关旁加提示。待实现验证。

---

## 6. 持久化

**视图态一律存 view config `config.set/get`（物理在 `.base` 文件里），不要用 `plugin.saveData`。**
（参考 `obsidian-bases-kanban-2`：曾存全局 `data.json`，后被迫迁移到 view config——全局 blob 分不清多个看板。）

```ts
config.set('tmKanbanState', { collapsed: { [columnId]: boolean } })
```
columnId = 列值；空值/null 用哨兵 `__tm_empty__` / `__tm_null__`。全局设置才用 `plugin.saveData`。

---

## 7. 样式

全程 Obsidian CSS 变量（`--background-*`、`--text-*`、`--interactive-accent`、`--radius-*`、`--size-4-*`），
不硬编码色值，自动适配主题/明暗。三视图共享 `styles.css` + `tm-` 前缀。

---

## 8. Templater 联动（不硬耦合）

用 **Folder Templates**：用户给任务文件夹配模板，`createFileForView` 建文件后 Templater 自动套用——
零集成代码、未装也优雅降级。待实现实测 `frontmatterProcessor` 与模板的写 frontmatter 时序。

---

## 9. 技术栈与构建

- **Svelte 5** + esbuild（`esbuild-svelte` + `svelte-preprocess`），构建参考
  `../reference-projects/obsidian-bases-kanban-1`，加 `svelte-check`。
- 入口 `src/main.ts` → 根 `main.js`（CJS，单文件，依赖内联）。
- 日历库 `@event-calendar/core`。`minAppVersion ≥ 1.10`；`isDesktopOnly: true`。

---

## 10. 参考项目对照

| 部分 | 抄哪个 |
|---|---|
| Kanban（拖拽/键盘/回写/计数/列序持久化） | `kanban-base-view-obsidian` |
| Kanban 列颜色（如需取色器） | `obsidian-bases-kanban-2` |
| 正文渲染 / 章节切片 | `obsidian-feed-bases` |
| 日历 UI 形态（仅参考，其 Bases 源只读且绕开真 API） | `plugin-full-calendar` |
| Bases 视图骨架 / Manager 拆分 | `obsidian-maps`（官方规范插件） |

---

## 11. 实施路线

1. 骨架（Svelte+esbuild + manifest/tsconfig）+ `shared/` 内核 + **示例仓库**（§12）。
2. tm-kanban：移植 kanban-base-view + 预定义列开关 + `doneStatuses` + 折叠 + 计数 + 新增按钮 + 拖拽回写。
3. tm-timeline：start/end 选项 + 泳道/排序/平铺 + scale + 里程碑 + 拖拽回写。
4. tm-calendar：独立 leaf + 周网格 + 日志解析/回写 + 拖拽建日志。

---

## 12. 示例仓库（example vault）

示例库已拆为独立仓库 **obsidian-task-manager-example-vault**（与本插件分仓），用于**实例测试与效果演示**。
它**既覆盖插件渲染的全部功能，也纳入讨论过程中的发散性用法**，用本插件渲染观察效果。

**A. 覆盖渲染功能的测试数据**
- **kanban**：一组任务，其分组属性取值要覆盖——预定义值、不在预定义内的值、空值（验证未分组/
  非预定义列默认折叠）、命中 `doneStatuses` 的值（验证完成样式）、足量卡片（验证计数）。
- **timeline**：任务覆盖 start+end、仅 start、仅 end、两者皆无；并跨分组（泳道）与带排序。
- **calendar**：若干日记，每篇含日志章节与多条 `HH:MM-HH:MM [[任务]]` 时间块。
- 预置 `.base` 文件：在任务 base 上配好 tm-kanban（预定义列开）与 tm-timeline（映射起止）；
  calendar 经命令在日记文件夹上打开。

**B. 发散性场景（仅用于「丢给插件看渲染效果」，插件不专门支持）**
- **relation task**：带 `parent` / `blocks` / `relates` / `project` 等关系型 frontmatter 的任务——
  插件不渲染关系，纳入以观察这些属性作为普通字段时的卡片表现、并确认插件对其无害忽略。
- **issue 状态流**：带 `## Activity` / 状态流转段落的笔记——观察右侧分栏详情与原生渲染的表现。
- **daily-log / tracelog**：日记式笔记——观察 calendar 的日志渲染，以及「靠原生 Backlinks 聚合 trace」
  这种用法（非插件功能）的实际效果。

**C. 可选 agent 工具（仅示例库内，非插件必选项）**
若用户希望 AI agent 统计/操作任务，可在示例库内放置一个 **`/setup` skill** + **`AGENTS.md`** +
**`conventions.md`** 作为演示：`/setup` 交互式确认该库的任务约定（锚点/字段名/完成状态值/日记格式）
并写入 `conventions.md`，`AGENTS.md` 据此给出统计配方与安全修改守则。
**这些不是插件的一部分，也非必选**——插件本身无需任何提前约定；仅当用户有「让 agent 操作任务」
的需求时才用。

---

## 13. 待确认开放项

- [x] 前缀 = `tm-`。
- [x] 日历库 = `@event-calendar/core`。
- [x] `doneStatuses` = kanban 视图选项（默认 `done`）。
- [x] 示例仓库：独立仓库 `obsidian-task-manager-example-vault`，日记 `Journal/`，日期格式 `YYYY-MM-DD`，周起始周一。

---

## 14. 实现增量（相对本设计的细化/调整）

> 实现以「分组/筛选一律走 Bases」为准；以下记录与上文的差异与新增。

**分组一律走 Bases**
- kanban 预定义列**不再自己 `entry.getValue` 分桶**，改为消费 `data.groupedData`，
  用每个组的 key 值匹配 `predefinedValues`（决定列的顺序/颜色/完成标记）；未匹配的组与空值合并进折叠的 Uncategorized 列。
- 因此取消了独立的 `groupProperty` 选项：分组属性 = Bases 工具栏的 group-by；拖拽/新增回写该属性（裸名自动补 `note.`）。
- timeline 泳道同样来自 `data.groupedData`（无分组则平铺）。

**kanban 布局（参考 Plane）**
- 列头：左上「圆点+列名+数量」，右上「+新增」「折叠」两个图标按钮（第二种新增方式）。
- 折叠态 = 竖向窄条（含数量/圆点/竖排列名），点击展开。
- 列**整屏高**且整列为 drop 区；`+ 新建工作项` 在最后一张卡片下方随流渲染。
- 列保留**主背景色**（柔和色调），新增按钮/列名与列背景融合，**只有任务卡是明确的块**。
- 卡片属性统一**无框**内联渲染（含日期）。
- 拖拽与单击区分：HTML5 拖拽/像素位移判定，拖动后不再误触打开文件。
- 卡片**右键菜单**：移动到任意列；若设置了视图选项 `archiveValue`，提供「归档」（把 group 属性写成该值）。

**timeline**
- 时间轴改为**固定窗格**：month 取最早前 3 月~最晚后 3 月，week ±3 周，day 前 7/后 14 天；打开时自动滚动到今天。

**calendar**
- 点击时间块打开**当天日记**并定位到该日志行（不再跳到被引用任务）。
- **重叠时间块并排**显示；支持**从下往上**拖拽创建。
- 拖拽创建弹 **modal** 填描述 / 可选 `[[链接]]` / 类型；可在设置开启「写回被链接任务」，在其 `## Log`（章节名可配）追加一条记录。
- 时间块**右键删除**。
- **类型/颜色**：设置中开启「Time-block categories」并以 `name|color` 定义；日志行格式扩展为
  `- HH:MM-HH:MM (Category) [[Task]] note`，`(Category)` 可选、驱动块颜色；默认关闭、无 label、用默认色。

**完成列的作用**：`doneStatuses` 命中的列加完成（淡化/删除线）样式，仅为视觉标记；完成本身仍是普通
`status` 值，可照常用 Bases 过滤/排序/归档/统计。

**日历库**：未引入 `@event-calendar/core`，改为自实现轻量周网格（完全可控、零外部依赖、满足拖拽建块/重叠/分类需求）。
