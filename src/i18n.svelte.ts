/**
 * Tiny i18n. The current locale is a Svelte `$state` signal so strings used in
 * Svelte templates re-render live when the language preference changes; plain-TS
 * callers (menus, modal, Bases view options, notices) read the current value on
 * demand.
 */

export type Lang = "en" | "zh" | "de";

let locale = $state<Lang>("en");

export function setLocale(lang: Lang): void {
	locale = lang;
}

export function getLocale(): Lang {
	return locale;
}

const dict = {
	// --- Kanban ---
	kanbanViewName: { en: "Kanban", zh: "看板", de: "Kanban" },
	timelineViewName: { en: "Timeline", zh: "时间线", de: "Zeitleiste" },
	expandColumn: { en: "Expand column", zh: "展开列", de: "Spalte erweitern" },
	columnGroup: { en: "Column", zh: "列", de: "Spalte" },
	collapseColumn: { en: "Collapse column", zh: "折叠列", de: "Spalte einklappen" },
	newItem: { en: "New item", zh: "新建工作项", de: "Neuer Eintrag" },
	archiveAll: { en: "Archive all in column", zh: "归档本列全部任务", de: "Alle in Spalte archivieren" },
	archiveAllTitle: { en: "Archive all tasks", zh: "归档全部任务", de: "Alle Aufgaben archivieren" },
	archiveAllConfirm: {
		en: "Archive every task in this column?",
		zh: "确定归档本列的全部任务吗？",
		de: "Alle Aufgaben in dieser Spalte archivieren?",
	},
	confirm: { en: "Confirm", zh: "确认", de: "Bestätigen" },
	moveTo: { en: "Move to", zh: "移动到", de: "Verschieben nach" },
	clearGroup: { en: "Clear group", zh: "清除分组", de: "Gruppe leeren" },
	archive: { en: "Archive", zh: "归档", de: "Archivieren" },
	uncategorized: { en: "Uncategorized", zh: "未分组", de: "Nicht kategorisiert" },
	emptyGroupByHint: {
		en: "Group by a property, or enable predefined columns in view options.",
		zh: "在 Bases 工具栏按某属性分组，或在视图选项里开启预定义列。",
		de: "Nach einer Eigenschaft gruppieren oder vordefinierte Spalten in den Ansichtsoptionen aktivieren.",
	},
	emptyNoColumns: { en: "No columns to show.", zh: "暂无可显示的列。", de: "Keine Spalten anzuzeigen." },

	// --- Timeline ---
	emptyNoData: { en: "No data.", zh: "暂无数据。", de: "Keine Daten." },
	timelineChooseDates: {
		en: "Choose a start and/or end date property in view options.",
		zh: "请在视图选项里选择开始/结束日期属性。",
		de: "Wähle in den Ansichtsoptionen eine Start- und/oder Enddatum-Eigenschaft.",
	},

	// --- Calendar ---
	weeklyLog: { en: "Weekly log", zh: "周历日志", de: "Wochenprotokoll" },
	openInJournal: { en: "Open in journal", zh: "在日记中打开", de: "Im Journal öffnen" },
	editBlock: { en: "Edit block", zh: "编辑时间块", de: "Block bearbeiten" },
	deleteBlock: { en: "Delete block", zh: "删除时间块", de: "Block löschen" },
	newLogBlock: { en: "New log block", zh: "新建时间块", de: "Neuer Protokollblock" },
	editLogBlock: { en: "Edit log block", zh: "编辑时间块", de: "Protokollblock bearbeiten" },
	save: { en: "Save", zh: "保存", de: "Speichern" },
	time: { en: "Time", zh: "时间", de: "Zeit" },
	description: { en: "Description", zh: "描述", de: "Beschreibung" },
	descPlaceholder: { en: "What did you do?", zh: "做了什么？", de: "Was hast du gemacht?" },
	linkTask: { en: "Link task", zh: "关联任务", de: "Aufgabe verknüpfen" },
	linkDesc: {
		en: "Optional. A task note title (becomes a [[wikilink]]).",
		zh: "可选。任务笔记标题（会变成 [[双链]]）。",
		de: "Optional. Titel einer Aufgaben-Notiz (wird zu einem [[Wikilink]]).",
	},
	taskTitlePlaceholder: { en: "Task title", zh: "任务标题", de: "Aufgabentitel" },
	category: { en: "Category", zh: "类型", de: "Kategorie" },
	none: { en: "(none)", zh: "（无）", de: "(keine)" },
	create: { en: "Create", zh: "创建", de: "Erstellen" },
	cancel: { en: "Cancel", zh: "取消", de: "Abbrechen" },
	today: { en: "Today", zh: "今天", de: "Heute" },
	prevWeek: { en: "Previous week", zh: "上一周", de: "Vorherige Woche" },
	nextWeek: { en: "Next week", zh: "下一周", de: "Nächste Woche" },
	jumpToDate: { en: "Jump to date", zh: "跳转到日期", de: "Zu Datum springen" },
	openWeeklyLog: { en: "Open weekly log", zh: "打开周历日志", de: "Wochenprotokoll öffnen" },

	// --- Notices ---
	kanbanRegisterFail: {
		en: "Task Manager: failed to register kanban view (requires Obsidian 1.10.2+).",
		zh: "Task Manager：注册看板视图失败（需要 Obsidian 1.10.2+）。",
		de: "Task Manager: Kanban-Ansicht konnte nicht registriert werden (benötigt Obsidian 1.10.2+).",
	},
	timelineRegisterFail: {
		en: "Task Manager: failed to register timeline view (requires Obsidian 1.10.2+).",
		zh: "Task Manager：注册时间线视图失败（需要 Obsidian 1.10.2+）。",
		de: "Task Manager: Timeline-Ansicht konnte nicht registriert werden (benötigt Obsidian 1.10.2+).",
	},
	writeFailed: { en: "Task Manager: failed to update", zh: "Task Manager：更新失败", de: "Task Manager: Aktualisierung fehlgeschlagen" },
	logEntryGone: {
		en: "Couldn't find that time block — it may have been edited or removed. Refreshed the view.",
		zh: "找不到该时间块——可能已被改动或删除。已刷新视图。",
		de: "Dieser Zeitblock wurde nicht gefunden — er wurde evtl. bearbeitet oder entfernt. Ansicht aktualisiert.",
	},

	// --- Bases view options ---
	optUsePredefined: { en: "Use predefined columns", zh: "使用预定义列", de: "Vordefinierte Spalten verwenden" },
	optPredefinedGroup: { en: "Predefined columns", zh: "预定义列", de: "Vordefinierte Spalten" },
	optPredefinedValues: {
		en: "Column values (match Bases group-by keys, in order; value or value|color)",
		zh: "列的值（与 Bases 分组键匹配，按顺序；可用 值 或 值|颜色）",
		de: "Spaltenwerte (passend zu den Bases-Gruppierungsschlüsseln, in Reihenfolge; Wert oder Wert|Farbe)",
	},
	optDoneStatuses: { en: "Done status values", zh: "完成状态值", de: "Werte für erledigten Status" },
	optArchiveValue: {
		en: "Archive value (right-click card → Archive sets the group property to this)",
		zh: "归档值（右键卡片 → 归档，会把分组属性写成此值）",
		de: "Archiv-Wert (Rechtsklick auf Karte → Archivieren setzt die Gruppen-Eigenschaft auf diesen Wert)",
	},
	optRecordChangelog: {
		en: "Record changelog (append a date old->new list item in the body when a card moves)",
		zh: "记录变更日志（移动卡片时在正文追加一条 日期 旧->新 的列表项）",
		de: "Änderungsprotokoll führen (beim Verschieben einer Karte einen Listeneintrag „Datum alt->neu“ im Text anhängen)",
	},
	optChangelogSection: {
		en: "Changelog section heading (body section the list items are appended under)",
		zh: "变更日志章节标题（列表项追加到的正文章节）",
		de: "Überschrift des Änderungsprotokoll-Abschnitts (Textabschnitt, unter dem die Einträge angehängt werden)",
	},
	optDates: { en: "Dates", zh: "日期", de: "Daten" },
	optStartProp: { en: "Start date property", zh: "开始日期属性", de: "Startdatum-Eigenschaft" },
	optEndProp: { en: "End date property", zh: "结束日期属性", de: "Enddatum-Eigenschaft" },
	optProperty: { en: "Property", zh: "属性", de: "Eigenschaft" },
	optScale: { en: "Scale", zh: "刻度", de: "Skala" },
	optSize: { en: "Size", zh: "大小", de: "Größe" },
	optZoom: { en: "Zoom (%)", zh: "缩放 (%)", de: "Zoom (%)" },
	optAutoZoom: { en: "Auto zoom", zh: "自动缩放", de: "Auto-Zoom" },
	optIgnoreMaxUnits: {
		en: "Ignore the max cells constraint",
		zh: "忽略最大单元格数限制",
		de: "Max.-Zellen-Beschränkung ignorieren",
	},
	barOutside: { en: "Outside the shown range", zh: "超出显示范围", de: "Außerhalb des gezeigten Bereichs" },
	optPadding: { en: "Padding", zh: "内边距", de: "Polsterung" },
	rangeDefault: { en: "Default", zh: "默认", de: "Standard" },
	rangeModerate: { en: "Moderate padding", zh: "适度留白", de: "Moderate Polsterung" },
	rangeFit: { en: "Fit to items", zh: "贴合条目", de: "Auf Einträge" },
	setMaxUnits: { en: "Max cells (timeline)", zh: "最大单元格数（时间线）", de: "Max. Zellen (Timeline)" },
	setMaxUnitsDesc: {
		en: "Most cells a timeline header may draw. When a range needs more, the window holding the most items whole is shown and items beyond it are marked at the edge. Raise it for wider — and heavier — timelines; 48 is the lowest accepted. A single timeline can waive this in its view options.",
		zh: "时间线表头最多绘制的单元格数。当范围需要更多时，将显示完整包含最多条目的窗口，超出的条目在边缘标记。调高可获得更宽（也更重）的时间线；最小可设为 48。单个时间线可在其视图选项中忽略此限制。",
		de: "Wie viele Zellen eine Timeline-Kopfzeile höchstens zeichnet. Braucht ein Bereich mehr, wird das Fenster mit den meisten vollständig enthaltenen Einträgen gezeigt; alles darüber hinaus wird am Rand markiert. Höhere Werte ergeben breitere — und trägere — Timelines; 48 ist der kleinste zulässige Wert. Eine einzelne Timeline kann das in ihren View-Optionen übergehen.",
	},
	setSnap: { en: "Snap to grid (timeline)", zh: "对齐网格（时间线）", de: "Am Raster ausrichten (Timeline)" },
	setSnapDesc: {
		en: "When on, dragging or resizing a timeline bar snaps to the current scale's grid: a start date to the unit's first day (month → month start, week → Monday), an end date to its last, as end dates are inclusive. Existing dates are only changed when you drag.",
		zh: "开启后，拖动或调整时间线条时对齐到当前刻度网格：开始日期对齐到单元的第一天（月→月初，周→周一），结束日期对齐到最后一天，因为结束日期为闭区间。仅在拖动时更改现有日期。",
		de: "Wenn aktiviert, rastet das Ziehen oder Anpassen eines Timeline-Balkens am Raster der aktuellen Skala ein: ein Startdatum auf den ersten Tag der Einheit (Monat → Monatsanfang, Woche → Montag), ein Enddatum auf den letzten, da Enddaten inklusiv sind. Bestehende Daten werden nur beim Ziehen geändert.",
	},
	scaleDay: { en: "Day", zh: "日", de: "Tag" },
	scaleWeek: { en: "Week", zh: "周", de: "Woche" },
	scaleMonth: { en: "Month", zh: "月", de: "Monat" },
	scaleQuarter: { en: "Quarter", zh: "季度", de: "Quartal" },
	scaleYear: { en: "Year", zh: "年", de: "Jahr" },

	// --- Settings ---
	setLanguage: { en: "Language", zh: "语言", de: "Sprache" },
	setLanguageDesc: {
		en: "Language for plugin views, options, settings, buttons, and menus.",
		zh: "插件视图、选项、设置、按钮与菜单所使用的语言。",
		de: "Sprache für Plugin-Ansichten, Optionen, Einstellungen, Schaltflächen und Menüs.",
	},
	setViews: { en: "Views", zh: "视图", de: "Ansichten" },
	setKanban: { en: "Kanban view", zh: "看板视图", de: "Kanban-Ansicht" },
	setKanbanDesc: { en: "Register the tm-kanban Bases view.", zh: "注册 tm-kanban Bases 视图。", de: "Die tm-kanban-Bases-Ansicht registrieren." },
	setTimeline: { en: "Timeline view", zh: "时间线视图", de: "Timeline-Ansicht" },
	setTimelineDesc: { en: "Register the tm-timeline Bases view.", zh: "注册 tm-timeline Bases 视图。", de: "Die tm-timeline-Bases-Ansicht registrieren." },
	setCalendar: { en: "Weekly log calendar", zh: "周历日志日历", de: "Wochenprotokoll-Kalender" },
	setCalendarDesc: {
		en: "Register the tm-calendar leaf view, ribbon icon and command.",
		zh: "注册 tm-calendar 视图、侧栏图标与命令。",
		de: "Die tm-calendar-Ansicht, das Ribbon-Symbol und den Befehl registrieren.",
	},
	setReloadNote: {
		en: "Turning a view on/off takes effect only after you disable and re-enable the plugin (or restart Obsidian).",
		zh: "开关视图后，需要在「社区插件」里关闭再启用本插件（或重启 Obsidian）才会生效。",
		de: "Das Ein-/Ausschalten einer Ansicht wirkt erst, nachdem du das Plugin deaktivierst und wieder aktivierst (oder Obsidian neu startest).",
	},
	setTimelineHeading: { en: "Timeline settings", zh: "时间线设置", de: "Einstellungen für die Timeline" },
	setCalendarHeading: { en: "Weekly log calendar settings", zh: "周历日志日历设置", de: "Einstellungen für den Wochenprotokoll-Kalender" },
	setDailyNotesHint: {
		en: "This view creates and looks up daily notes from the core Daily notes plugin's configuration. Review and adjust as needed — daily-note folder, filename date format, and template — under Settings → Core plugins → Daily notes.",
		zh: "此视图会根据核心「日记」插件的配置新建或查询日记。建议先确认并按需修改对应配置——日记文件夹、文件名日期格式、日记模板，均在 设置 → 核心插件 → 日记 中。",
		de: "Diese Ansicht erstellt und findet Tagesnotizen anhand der Konfiguration des Kern-Plugins „Tagesnotizen“. Prüfe und passe bei Bedarf an — Tagesnotiz-Ordner, Dateinamen-Datumsformat und Vorlage — unter Einstellungen → Kern-Plugins → Tagesnotizen.",
	},
	dailyNotesTitle: { en: "Weekly log — daily notes", zh: "周历日志 —— 日记配置", de: "Wochenprotokoll — Tagesnotizen" },
	dailyNotesIntro: {
		en: "This view creates and looks up daily notes using the core Daily notes plugin. Confirm the settings below, and change them under Settings → Core plugins → Daily notes if needed:",
		zh: "此视图会通过核心「日记」插件新建或查询日记。请确认以下配置，如需修改请前往 设置 → 核心插件 → 日记：",
		de: "Diese Ansicht erstellt und findet Tagesnotizen über das Kern-Plugin „Tagesnotizen“. Bestätige die folgenden Einstellungen und ändere sie bei Bedarf unter Einstellungen → Kern-Plugins → Tagesnotizen:",
	},
	dailyNotesFolderLabel: { en: "Daily-note folder", zh: "日记文件夹", de: "Tagesnotiz-Ordner" },
	dailyNotesFormatLabel: { en: "Filename date format", zh: "文件名日期格式", de: "Dateinamen-Datumsformat" },
	dailyNotesTemplateLabel: { en: "Template", zh: "日记模板", de: "Vorlage" },
	dailyNotesVaultRoot: { en: "(vault root)", zh: "（库根目录）", de: "(Vault-Wurzel)" },
	dailyNotesDisabled: {
		en: "The core Daily notes plugin isn't enabled. Enable it under Settings → Core plugins, then configure its folder, date format and template.",
		zh: "核心「日记」插件尚未启用。请在 设置 → 核心插件 中启用它，然后配置其文件夹、日期格式与模板。",
		de: "Das Kern-Plugin „Tagesnotizen“ ist nicht aktiviert. Aktiviere es unter Einstellungen → Kern-Plugins und konfiguriere Ordner, Datumsformat und Vorlage.",
	},
	dailyNotesOpenSettings: { en: "Open Daily notes settings", zh: "打开日记设置", de: "Tagesnotizen-Einstellungen öffnen" },
	dailyNotesDontRemind: { en: "Don't remind again", zh: "不再提醒", de: "Nicht mehr erinnern" },
	logWriteFail: {
		en: "Couldn't write the log. Enable the core Daily notes plugin (Settings → Core plugins → Daily notes) and try again.",
		zh: "无法写入日志。请启用核心「日记」插件（设置 → 核心插件 → 日记）后重试。",
		de: "Protokoll konnte nicht geschrieben werden. Aktiviere das Kern-Plugin „Tagesnotizen“ (Einstellungen → Kern-Plugins → Tagesnotizen) und versuche es erneut.",
	},
	calendarNeedsDailyNotes: {
		en: "Weekly log stores entries in your daily notes. Enable and configure the core Daily notes plugin (Settings → Core plugins → Daily notes) — folder, date format and template are taken from there.",
		zh: "周历日志把记录写入你的日记。请先启用并配置核心「日记」插件（设置 → 核心插件 → 日记）——文件夹、日期格式与模板都取自那里。",
		de: "Das Wochenprotokoll speichert Einträge in deinen Tagesnotizen. Aktiviere und konfiguriere das Kern-Plugin „Tagesnotizen“ (Einstellungen → Kern-Plugins → Tagesnotizen) — Ordner, Datumsformat und Vorlage stammen von dort.",
	},
	setFirstDay: { en: "First day of week", zh: "每周起始日", de: "Erster Wochentag" },
	setMonday: { en: "Monday", zh: "周一", de: "Montag" },
	setSunday: { en: "Sunday", zh: "周日", de: "Sonntag" },
	setDayStart: { en: "Day starts at", zh: "一天开始于", de: "Tag beginnt um" },
	setDayEnd: { en: "Day ends at", zh: "一天结束于", de: "Tag endet um" },
	setDayWindowDesc: {
		en: "Only this hour range is shown in the weekly grid. Narrow it (e.g. 08:00–18:00) to focus on working hours.",
		zh: "周历网格只显示这个时间段。把它收窄（如 08:00–18:00）可聚焦在工作时段。",
		de: "Im Wochenraster wird nur dieser Stundenbereich gezeigt. Verenge ihn (z. B. 08:00–18:00), um dich auf die Arbeitszeit zu konzentrieren.",
	},
	setLogSection: { en: "Log section heading", zh: "日志章节标题", de: "Überschrift des Protokoll-Abschnitts" },
	setLogSectionDesc: {
		en: "Heading whose list items are read as time blocks.",
		zh: "其列表项会被解析为时间块的章节标题。",
		de: "Überschrift, deren Listeneinträge als Zeitblöcke gelesen werden.",
	},
	setBacklink: { en: "Write back-reference into linked task", zh: "回写引用到关联任务", de: "Rückverweis in verknüpfte Aufgabe schreiben" },
	setBacklinkDesc: {
		en: "When a new time block links a task, also append a record under a heading in that task's note.",
		zh: "新建带链接的时间块时，在被链接任务的笔记中相应章节追加一条记录。",
		de: "Wenn ein neuer Zeitblock eine Aufgabe verknüpft, zusätzlich einen Eintrag unter einer Überschrift in der Notiz dieser Aufgabe anhängen.",
	},
	setBacklinkSection: { en: "Back-reference section heading", zh: "回写章节标题", de: "Überschrift des Rückverweis-Abschnitts" },
	setBacklinkSectionDesc: {
		en: "Heading inside the linked task where the record is appended.",
		zh: "回写记录追加到的、被链接任务里的章节标题。",
		de: "Überschrift in der verknüpften Aufgabe, unter der der Eintrag angehängt wird.",
	},
	setEnableCategories: { en: "Enable categories", zh: "启用类型", de: "Kategorien aktivieren" },
	setEnableCategoriesDesc: {
		en: "Pick a colour-coded category when creating a block. Off → default colour, no label.",
		zh: "创建时间块时可选带颜色的类型。关闭 → 默认颜色、无标签。",
		de: "Beim Erstellen eines Blocks eine farbcodierte Kategorie wählen. Aus → Standardfarbe, kein Label.",
	},
	setCategories: { en: "Categories", zh: "类型表", de: "Kategorien" },
	setCategoriesDesc: {
		en: "One per line as name|color. Color can be a colour name or any CSS colour — e.g. Dev|blue (named) or Meeting|rgb(224,164,88) (RGB). You can also put the colour inline in a log line: (Dev|blue).",
		zh: "每行一个，格式 名称|颜色。颜色可用颜色名或任意 CSS 颜色，例如 Dev|blue（颜色名）或 Meeting|rgb(224,164,88)（RGB）。也可在日志行内联写：(Dev|blue)。",
		de: "Eine pro Zeile als name|farbe. Farbe kann ein Farbname oder eine beliebige CSS-Farbe sein — z. B. Dev|blue (Name) oder Meeting|rgb(224,164,88) (RGB). Die Farbe kann auch inline in einer Protokollzeile stehen: (Dev|blue).",
	},
} as const satisfies Record<string, Record<Lang, string>>;

export type MsgKey = keyof typeof dict;

export function t(key: MsgKey): string {
	const entry = dict[key];
	return entry ? entry[locale] : key;
}

const WEEKDAYS_SHORT: Record<Lang, string[]> = {
	en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
	zh: ["日", "一", "二", "三", "四", "五", "六"],
	de: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
};

/** Short weekday label for a JS day index (0 = Sunday). */
export function weekdayShort(jsDay: number): string {
	return WEEKDAYS_SHORT[locale][jsDay] ?? "";
}
