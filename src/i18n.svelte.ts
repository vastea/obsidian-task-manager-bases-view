/**
 * Tiny i18n. The current locale is a Svelte `$state` signal so strings used in
 * Svelte templates re-render live when the language preference changes; plain-TS
 * callers (menus, modal, Bases view options, notices) read the current value on
 * demand.
 */

export type Lang = "en" | "zh";

let locale = $state<Lang>("en");

export function setLocale(lang: Lang): void {
	locale = lang;
}

export function getLocale(): Lang {
	return locale;
}

const dict = {
	// --- Kanban ---
	newItem: { en: "New item", zh: "新建工作项" },
	archiveAll: { en: "Archive all in column", zh: "归档本列全部任务" },
	moveTo: { en: "Move to", zh: "移动到" },
	clearGroup: { en: "Clear group", zh: "清除分组" },
	archive: { en: "Archive", zh: "归档" },
	uncategorized: { en: "Uncategorized", zh: "未分组" },
	emptyGroupByHint: {
		en: "Group by a property, or enable predefined columns in view options.",
		zh: "在 Bases 工具栏按某属性分组，或在视图选项里开启预定义列。",
	},
	emptyNoColumns: { en: "No columns to show.", zh: "暂无可显示的列。" },

	// --- Timeline ---
	emptyNoData: { en: "No data.", zh: "暂无数据。" },
	timelineChooseDates: {
		en: "Choose a start and/or end date property in view options.",
		zh: "请在视图选项里选择开始/结束日期属性。",
	},

	// --- Calendar ---
	weeklyLog: { en: "Weekly log", zh: "周历日志" },
	openInJournal: { en: "Open in journal", zh: "在日记中打开" },
	deleteBlock: { en: "Delete block", zh: "删除时间块" },
	newLogBlock: { en: "New log block", zh: "新建时间块" },
	description: { en: "Description", zh: "描述" },
	descPlaceholder: { en: "What did you do?", zh: "做了什么？" },
	linkTask: { en: "Link task", zh: "关联任务" },
	linkDesc: {
		en: "Optional. A task note title (becomes a [[wikilink]]).",
		zh: "可选。任务笔记标题（会变成 [[双链]]）。",
	},
	taskTitlePlaceholder: { en: "Task title", zh: "任务标题" },
	category: { en: "Category", zh: "类型" },
	none: { en: "(none)", zh: "（无）" },
	create: { en: "Create", zh: "创建" },
	cancel: { en: "Cancel", zh: "取消" },
	today: { en: "Today", zh: "今天" },
	prevWeek: { en: "Previous week", zh: "上一周" },
	nextWeek: { en: "Next week", zh: "下一周" },
	openWeeklyLog: { en: "Open weekly log", zh: "打开周历日志" },

	// --- Notices ---
	kanbanRegisterFail: {
		en: "Task Manager: failed to register kanban view (requires Obsidian 1.10+).",
		zh: "Task Manager：注册看板视图失败（需要 Obsidian 1.10+）。",
	},
	timelineRegisterFail: {
		en: "Task Manager: failed to register timeline view (requires Obsidian 1.10+).",
		zh: "Task Manager：注册时间线视图失败（需要 Obsidian 1.10+）。",
	},
	writeFailed: { en: "Task Manager: failed to update", zh: "Task Manager：更新失败" },

	// --- Bases view options ---
	optUsePredefined: { en: "Use predefined columns", zh: "使用预定义列" },
	optPredefinedGroup: { en: "Predefined columns", zh: "预定义列" },
	optPredefinedValues: {
		en: "Column values (match Bases group-by keys, in order; value or value|color)",
		zh: "列的值（与 Bases 分组键匹配，按顺序；可用 值 或 值|颜色）",
	},
	optDoneStatuses: { en: "Done status values", zh: "完成状态值" },
	optArchiveValue: {
		en: "Archive value (right-click card → Archive sets the group property to this)",
		zh: "归档值（右键卡片 → 归档，会把分组属性写成此值）",
	},
	optDates: { en: "Dates", zh: "日期" },
	optStartProp: { en: "Start date property", zh: "开始日期属性" },
	optEndProp: { en: "End date property", zh: "结束日期属性" },
	optProperty: { en: "Property", zh: "属性" },
	optScale: { en: "Scale", zh: "刻度" },
	scaleDay: { en: "Day", zh: "日" },
	scaleWeek: { en: "Week", zh: "周" },
	scaleMonth: { en: "Month", zh: "月" },

	// --- Settings ---
	setLanguage: { en: "Language", zh: "语言" },
	setLanguageDesc: { en: "Language for in-view buttons and menus.", zh: "视图内按钮与菜单的语言。" },
	setViews: { en: "Views", zh: "视图" },
	setKanban: { en: "Kanban view", zh: "看板视图" },
	setKanbanDesc: { en: "Register the tm-kanban Bases view.", zh: "注册 tm-kanban Bases 视图。" },
	setTimeline: { en: "Timeline view", zh: "时间线视图" },
	setTimelineDesc: { en: "Register the tm-timeline Bases view.", zh: "注册 tm-timeline Bases 视图。" },
	setCalendar: { en: "Weekly log calendar", zh: "周历日志日历" },
	setCalendarDesc: {
		en: "Register the tm-calendar leaf view, ribbon icon and command.",
		zh: "注册 tm-calendar 视图、侧栏图标与命令。",
	},
	setReloadNote: {
		en: "Turning a view on/off takes effect only after you disable and re-enable the plugin (or restart Obsidian).",
		zh: "开关视图后，需要在「社区插件」里关闭再启用本插件（或重启 Obsidian）才会生效。",
	},
	setCalendarHeading: { en: "Weekly log calendar", zh: "周历日志日历" },
	setJournalFolder: { en: "Journal folder", zh: "日记文件夹" },
	setJournalFolderDesc: { en: "Folder containing your daily notes.", zh: "存放日记的文件夹。" },
	setDateFormat: { en: "Date format", zh: "日期格式" },
	setDateFormatDesc: {
		en: "Moment format of daily-note filenames, e.g. YYYY-MM-DD.",
		zh: "日记文件名的 Moment 格式，例如 YYYY-MM-DD。",
	},
	setFirstDay: { en: "First day of week", zh: "每周起始日" },
	setMonday: { en: "Monday", zh: "周一" },
	setSunday: { en: "Sunday", zh: "周日" },
	setLogSection: { en: "Log section heading", zh: "日志章节标题" },
	setLogSectionDesc: {
		en: "Heading whose list items are read as time blocks.",
		zh: "其列表项会被解析为时间块的章节标题。",
	},
	setBacklink: { en: "Write back-reference into linked task", zh: "回写引用到关联任务" },
	setBacklinkDesc: {
		en: "When a new time block links a task, also append a record under a heading in that task's note.",
		zh: "新建带链接的时间块时，在被链接任务的笔记中相应章节追加一条记录。",
	},
	setBacklinkSection: { en: "Back-reference section heading", zh: "回写章节标题" },
	setBacklinkSectionDesc: {
		en: "Heading inside the linked task where the record is appended.",
		zh: "回写记录追加到的、被链接任务里的章节标题。",
	},
	setCategoriesHeading: { en: "Time-block categories", zh: "时间块类型" },
	setEnableCategories: { en: "Enable categories", zh: "启用类型" },
	setEnableCategoriesDesc: {
		en: "Pick a colour-coded category when creating a block. Off → default colour, no label.",
		zh: "创建时间块时可选带颜色的类型。关闭 → 默认颜色、无标签。",
	},
	setCategories: { en: "Categories", zh: "类型表" },
	setCategoriesDesc: {
		en: "One per line as name|color. Color can be a colour name or any CSS colour — e.g. Dev|blue (named) or Meeting|rgb(224,164,88) (RGB). You can also put the colour inline in a log line: (Dev|blue).",
		zh: "每行一个，格式 名称|颜色。颜色可用颜色名或任意 CSS 颜色，例如 Dev|blue（颜色名）或 Meeting|rgb(224,164,88)（RGB）。也可在日志行内联写：(Dev|blue)。",
	},
} as const;

export type MsgKey = keyof typeof dict;

export function t(key: MsgKey): string {
	const entry = dict[key];
	return entry ? entry[locale] : key;
}

const WEEKDAYS_SHORT: Record<Lang, string[]> = {
	en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
	zh: ["日", "一", "二", "三", "四", "五", "六"],
};

/** Short weekday label for a JS day index (0 = Sunday). */
export function weekdayShort(jsDay: number): string {
	return WEEKDAYS_SHORT[locale][jsDay] ?? "";
}
