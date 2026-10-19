"use strict";

const STORAGE_KEY = "mrz-habit-tracker-v1";
const LEGACY_STORAGE_KEY = "apex-habit-tracker-v1";
const BACKUP_FORMAT = "mrz-habit-tracker-backup";
const LEGACY_BACKUP_FORMAT = "apex-habit-tracker-backup";
const SYNC_META_KEY = "mrz-habit-tracker-sync-v1";
const CLOUD_CONFIG_PATH = "./cloud-config.json";
const WEEKDAYS = [
  { value: 1, short: "Пн", full: "понедельник" },
  { value: 2, short: "Вт", full: "вторник" },
  { value: 3, short: "Ср", full: "среда" },
  { value: 4, short: "Чт", full: "четверг" },
  { value: 5, short: "Пт", full: "пятница" },
  { value: 6, short: "Сб", full: "суббота" },
  { value: 0, short: "Вс", full: "воскресенье" },
];
const BALANCE_AREAS = [
  { key: "rest", label: "Отдых" },
  { key: "health", label: "Здоровье" },
  { key: "finance", label: "Финансы" },
  { key: "work", label: "Работа" },
  { key: "sport", label: "Спорт" },
  { key: "growth", label: "Саморазвитие" },
  { key: "family", label: "Семья" },
  { key: "network", label: "Нетворкинг" },
];
const STATE_AREAS = ["money", "body", "skills", "mind"];

const elements = {
  breadcrumb: document.querySelector("#view-breadcrumb"),
  todayLabel: document.querySelector("#today-label"),
  weekRange: document.querySelector("#week-range"),
  weekHeadings: document.querySelector("#week-headings"),
  habitGrid: document.querySelector("#habit-grid"),
  dashboardEmpty: document.querySelector("#dashboard-empty"),
  periodSummary: document.querySelector("#period-summary"),
  weekdayPreview: document.querySelector("#weekday-preview"),
  analyticsCards: document.querySelector("#analytics-cards"),
  dailyChart: document.querySelector("#daily-chart"),
  dailyDetails: document.querySelector("#daily-details"),
  dayInsights: document.querySelector("#day-insights"),
  weekdayChart: document.querySelector("#weekday-chart"),
  weeklyChart: document.querySelector("#weekly-chart"),
  habitPerformance: document.querySelector("#habit-performance"),
  habitList: document.querySelector("#habit-list"),
  mainGoalList: document.querySelector("#main-goal-list"),
  annualGoalList: document.querySelector("#annual-goal-list"),
  goalYearLabel: document.querySelector("#goal-year-label"),
  balanceWheel: document.querySelector("#balance-wheel"),
  stateSaveStatus: document.querySelector("#state-save-status"),
  backupCounts: document.querySelector("#backup-counts"),
  backupStatus: document.querySelector("#backup-status"),
  exportBackup: document.querySelector("#export-backup"),
  importBackup: document.querySelector("#import-backup"),
  backupFile: document.querySelector("#backup-file"),
  storageNote: document.querySelector("#storage-note"),
  authForm: document.querySelector("#auth-form"),
  authEmail: document.querySelector("#auth-email"),
  authPassword: document.querySelector("#auth-password"),
  authSignIn: document.querySelector("#auth-sign-in"),
  authSignUp: document.querySelector("#auth-sign-up"),
  authSignOut: document.querySelector("#auth-sign-out"),
  signedInControls: document.querySelector("#signed-in-controls"),
  signedInEmail: document.querySelector("#signed-in-email"),
  syncNow: document.querySelector("#sync-now"),
  syncStatus: document.querySelector("#sync-status"),
  syncIndicator: document.querySelector("#sync-indicator"),
  goalDialog: document.querySelector("#goal-dialog"),
  goalForm: document.querySelector("#goal-form"),
  goalDialogTitle: document.querySelector("#goal-dialog-title"),
  goalName: document.querySelector("#goal-name"),
  goalNameError: document.querySelector("#goal-name-error"),
  goalDescription: document.querySelector("#goal-description"),
  goalDeadline: document.querySelector("#goal-deadline"),
  goalProgress: document.querySelector("#goal-progress"),
  goalProgressValue: document.querySelector("#goal-progress-value"),
  deleteGoalButton: document.querySelector("#delete-goal"),
  saveGoalButton: document.querySelector("#save-goal"),
  dialog: document.querySelector("#habit-dialog"),
  form: document.querySelector("#habit-form"),
  dialogTitle: document.querySelector("#habit-dialog-title"),
  habitName: document.querySelector("#habit-name"),
  nameError: document.querySelector("#name-error"),
  daysError: document.querySelector("#days-error"),
  scheduleNote: document.querySelector("#schedule-note"),
  archiveButton: document.querySelector("#archive-habit"),
  saveButton: document.querySelector("#save-habit"),
  toast: document.querySelector("#toast"),
};

let state = loadState();
let selectedWeek = mondayOf(new Date());
let selectedDayKey = todayKey();
let editingHabitId = null;
let editingGoalId = null;
let goalType = "main";
let selectedGoalYear = new Date().getFullYear();
let toastTimer = null;
let cloudClient = null;
let cloudUser = null;
let cloudRevision = 0;
let cloudReady = false;
let cloudBusy = false;
let authLoading = false;
let syncPending = false;
let syncConflict = false;
let syncTimer = null;

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function addDays(date, count) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  copy.setDate(copy.getDate() + count);
  return copy;
}

function mondayOf(date) {
  const weekday = date.getDay();
  return addDays(date, -(weekday === 0 ? 6 : weekday - 1));
}

function todayKey() {
  return dateKey(new Date());
}

function formatDate(date, options) {
  return new Intl.DateTimeFormat("ru-RU", options).format(date);
}

function formatWeekRange(start) {
  const end = addDays(start, 6);
  const firstDay = start.getDate();
  const lastDay = end.getDate();
  const firstMonth = formatDate(start, { day: "numeric", month: "long" }).replace(/^\d+\s+/, "");
  const lastMonth = formatDate(end, { day: "numeric", month: "long" }).replace(/^\d+\s+/, "");
  return start.getMonth() === end.getMonth()
    ? `${firstDay}–${lastDay} ${lastMonth}`
    : `${firstDay} ${firstMonth} – ${lastDay} ${lastMonth}`;
}

function loadState() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw !== null) {
        try {
          localStorage.setItem(STORAGE_KEY, raw);
        } catch (error) {
          console.warn("Не удалось перенести старые данные в хранилище MRZ.", error);
        }
      }
    }
    const saved = JSON.parse(raw || "null");
    if (saved && Array.isArray(saved.habits)) {
      return {
        habits: saved.habits.filter(
          (habit) =>
            typeof habit.id === "string" &&
            typeof habit.name === "string" &&
            Array.isArray(habit.periods) &&
            Array.isArray(habit.schedules) &&
            Array.isArray(habit.completedDates),
        ),
        goals: Array.isArray(saved.goals)
          ? saved.goals.filter((goal) =>
            typeof goal.id === "string" &&
            typeof goal.name === "string" &&
            ["main", "annual"].includes(goal.type),
          )
          : [],
        balance: Object.fromEntries(BALANCE_AREAS.map(({ key }) => [key, clampScore(saved.balance?.[key])])),
        currentState: Object.fromEntries(STATE_AREAS.map((key) => [
          key,
          { score: clampScore(saved.currentState?.[key]?.score), note: typeof saved.currentState?.[key]?.note === "string" ? saved.currentState[key].note.slice(0, 1000) : "" },
        ])),
      };
    }
  } catch (error) {
    console.warn("Не удалось прочитать сохранённые привычки.", error);
  }
  return {
    habits: [],
    goals: [],
    balance: Object.fromEntries(BALANCE_AREAS.map(({ key }) => [key, 0])),
    currentState: Object.fromEntries(STATE_AREAS.map((key) => [key, { score: 0, note: "" }])),
  };
}

function clampScore(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(10, Math.round(number))) : 0;
}

function saveState({ sync = true } = {}) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    renderBackupCounts();
    if (sync) queueCloudSync();
    return true;
  } catch (error) {
    console.warn("Не удалось сохранить данные.", error);
    showToast("Браузер не позволил сохранить изменения.");
    return false;
  }
}

function createElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function activeHabit(habit) {
  return habit.periods.at(-1)?.to === null;
}

function activeOnDate(habit, key) {
  return habit.periods.some((period) => period.from <= key && (period.to === null || key < period.to));
}

function scheduleOnDate(habit, key) {
  let selected = null;
  for (const schedule of habit.schedules) {
    if (schedule.from <= key && (!selected || selected.from <= schedule.from)) selected = schedule;
  }
  return selected?.days || [];
}

function scheduledOnDate(habit, key) {
  return activeOnDate(habit, key) && scheduleOnDate(habit, key).includes(fromKey(key).getDay());
}

function completedOnDate(habit, key) {
  return habit.completedDates.includes(key);
}

function statusOnDate(habit, key) {
  if (!scheduledOnDate(habit, key)) return "unscheduled";
  if (completedOnDate(habit, key)) return "complete";
  if (key < todayKey()) return "missed";
  if (key === todayKey()) return "due";
  return "upcoming";
}

function rangeStats(startKey, endKey, habit = null) {
  const result = { complete: 0, scheduled: 0 };
  const last = endKey < todayKey() ? endKey : todayKey();
  if (startKey > last) return result;

  for (let date = fromKey(startKey); dateKey(date) <= last; date = addDays(date, 1)) {
    const key = dateKey(date);
    for (const item of habit ? [habit] : state.habits) {
      if (!scheduledOnDate(item, key)) continue;
      result.scheduled += 1;
      if (completedOnDate(item, key)) result.complete += 1;
    }
  }
  return result;
}

function percentage(stats) {
  return stats.scheduled ? Math.round((stats.complete / stats.scheduled) * 100) : 0;
}

function earliestHabitDate() {
  return state.habits.reduce((earliest, habit) => {
    const start = habit.periods[0]?.from;
    return start && (!earliest || start < earliest) ? start : earliest;
  }, null);
}

function weekdayStats() {
  const totals = WEEKDAYS.map(() => ({ complete: 0, scheduled: 0 }));
  const earliest = earliestHabitDate();
  if (!earliest) return totals;

  for (let date = fromKey(earliest); dateKey(date) <= todayKey(); date = addDays(date, 1)) {
    const key = dateKey(date);
    const index = WEEKDAYS.findIndex((item) => item.value === date.getDay());
    for (const habit of state.habits) {
      if (!scheduledOnDate(habit, key)) continue;
      totals[index].scheduled += 1;
      if (completedOnDate(habit, key)) totals[index].complete += 1;
    }
  }
  return totals;
}

function periodDefinitions() {
  const today = new Date();
  const chosenStart = dateKey(selectedWeek);
  const currentStart = dateKey(mondayOf(today));
  const monthStart = dateKey(new Date(today.getFullYear(), today.getMonth(), 1, 12));
  const threeMonthStart = dateKey(new Date(today.getFullYear(), today.getMonth() - 2, 1, 12));

  return [
    {
      label: chosenStart === currentStart ? "На этой неделе" : "Выбранная неделя",
      start: chosenStart,
      end: dateKey(addDays(selectedWeek, 6)),
    },
    { label: "В этом месяце", start: monthStart, end: todayKey() },
    { label: "Последние 3 месяца", start: threeMonthStart, end: todayKey() },
  ];
}

function renderWeekHeadings() {
  elements.weekHeadings.replaceChildren(createElement("th", "", "Привычка"));
  elements.weekHeadings.firstChild.scope = "col";

  WEEKDAYS.forEach((weekday, index) => {
    const day = addDays(selectedWeek, index);
    const th = createElement("th", dateKey(day) === todayKey() ? "is-today" : "");
    th.scope = "col";
    th.append(weekday.short, createElement("span", "day-date", String(day.getDate())));
    elements.weekHeadings.append(th);
  });
}

function renderHabitGrid() {
  elements.weekRange.textContent = formatWeekRange(selectedWeek);
  renderWeekHeadings();
  elements.habitGrid.replaceChildren();

  const start = dateKey(selectedWeek);
  const end = dateKey(addDays(selectedWeek, 6));
  const visibleHabits = state.habits.filter((habit) =>
    habit.periods.some((period) => period.from <= end && (period.to === null || period.to > start)),
  );

  elements.dashboardEmpty.hidden = visibleHabits.length > 0;
  for (const habit of visibleHabits) {
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    const nameButton = createElement("button", "habit-name-button", habit.name);
    nameButton.type = "button";
    nameButton.dataset.action = "edit";
    nameButton.dataset.id = habit.id;
    nameButton.title = "Изменить привычку";
    nameCell.append(nameButton);
    row.append(nameCell);

    WEEKDAYS.forEach((_, index) => {
      const day = addDays(selectedWeek, index);
      const key = dateKey(day);
      const status = statusOnDate(habit, key);
      const cell = document.createElement("td");
      const button = createElement("button", `day-cell status-${status}`);
      button.type = "button";
      button.dataset.action = "toggle";
      button.dataset.id = habit.id;
      button.dataset.date = key;
      button.disabled = status === "unscheduled" || status === "upcoming";
      button.textContent = status === "complete" ? "✓" : status === "unscheduled" ? "•" : "";
      const statusText = {
        complete: "выполнено",
        missed: "пропущено",
        due: "запланировано на сегодня",
        upcoming: "предстоит",
        unscheduled: "не запланировано",
      }[status];
      button.setAttribute("aria-label", `${habit.name}, ${formatDate(day, { day: "numeric", month: "long" })}: ${statusText}`);
      cell.append(button);
      row.append(cell);
    });
    elements.habitGrid.append(row);
  }
}

function renderSummary() {
  elements.periodSummary.replaceChildren();
  for (const period of periodDefinitions()) {
    const stats = rangeStats(period.start, period.end);
    const item = createElement("div", "period-item");
    const label = createElement("div", "period-label", period.label);
    const numbers = createElement("div", "period-numbers");
    numbers.append(
      createElement("span", "period-count", String(stats.complete)),
      createElement("span", "period-total", `из ${stats.scheduled}`),
    );
    const track = createElement("div", "progress-track");
    const fill = createElement("div", "progress-fill");
    fill.style.width = `${percentage(stats)}%`;
    track.setAttribute("aria-label", `${percentage(stats)} процентов выполнено`);
    track.append(fill);
    item.append(label, numbers, track);
    elements.periodSummary.append(item);
  }
}

function renderDotChart(container, stats) {
  container.replaceChildren();
  stats.forEach((dayStats, index) => {
    const percent = percentage(dayStats);
    const column = createElement("div", "weekday-column");
    column.append(createElement("div", "weekday-percent", dayStats.scheduled ? `${percent}%` : "—"));
    const dots = createElement("div", "dot-stack");
    dots.setAttribute("aria-hidden", "true");
    const filledCount = Math.round(percent / 5);
    for (let dotIndex = 0; dotIndex < 20; dotIndex += 1) {
      dots.append(createElement("span", dotIndex < filledCount ? "dot is-filled" : "dot"));
    }
    column.append(dots, createElement("span", "weekday-day", WEEKDAYS[index].short));
    column.setAttribute("aria-label", `${WEEKDAYS[index].full}: ${dayStats.complete} из ${dayStats.scheduled}, ${percent}%`);
    container.append(column);
  });
}

function chartClass(stats) {
  if (!stats.scheduled) return "is-unplanned";
  const percent = percentage(stats);
  if (percent < 50) return "is-weak";
  if (percent < 80) return "is-medium";
  return "is-strong";
}

function recentDays() {
  const today = fromKey(todayKey());
  return Array.from({ length: 30 }, (_, index) => {
    const date = addDays(today, index - 29);
    const key = dateKey(date);
    return { date, key, stats: rangeStats(key, key) };
  });
}

function renderDayDetails(record) {
  elements.dailyDetails.replaceChildren();
  const heading = createElement("div", "daily-detail-heading");
  heading.append(
    createElement("h3", "", formatDate(record.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })),
    createElement(
      "span",
      `daily-detail-score ${chartClass(record.stats)}`,
      record.stats.scheduled ? `${percentage(record.stats)}% · ${record.stats.complete} из ${record.stats.scheduled}` : "Без плана",
    ),
  );
  elements.dailyDetails.append(heading);

  if (!record.stats.scheduled) {
    elements.dailyDetails.append(createElement("p", "daily-detail-note", "На эту дату не было запланированных привычек."));
    return;
  }

  const completed = [];
  const missed = [];
  for (const habit of state.habits) {
    if (!scheduledOnDate(habit, record.key)) continue;
    (completedOnDate(habit, record.key) ? completed : missed).push(habit.name);
  }

  const breakdown = createElement("div", "daily-breakdown");
  for (const [title, names, className] of [
    ["Выполнено", completed, "completed-list"],
    ["Не выполнено", missed, "missed-list"],
  ]) {
    const group = document.createElement("div");
    group.append(createElement("h4", "", title));
    if (names.length) {
      const list = createElement("ul", className);
      names.forEach((name) => list.append(createElement("li", "", name)));
      group.append(list);
    } else {
      group.append(createElement("p", "daily-detail-note", "Нет"));
    }
    breakdown.append(group);
  }
  elements.dailyDetails.append(breakdown);
}

function renderDayInsights(records) {
  elements.dayInsights.replaceChildren();
  const completedDays = records.filter((record) => record.key < todayKey() && record.stats.scheduled > 0);
  if (!completedDays.length) {
    elements.dayInsights.append(
      createElement("p", "insight-empty", "Сравнение появится после первого завершённого дня с запланированными привычками."),
    );
    return;
  }

  const best = [...completedDays].sort((first, second) =>
    percentage(second.stats) - percentage(first.stats) ||
    second.stats.complete - first.stats.complete ||
    second.key.localeCompare(first.key),
  )[0];
  const weakest = [...completedDays].sort((first, second) =>
    percentage(first.stats) - percentage(second.stats) ||
    (second.stats.scheduled - second.stats.complete) - (first.stats.scheduled - first.stats.complete) ||
    second.key.localeCompare(first.key),
  )[0];

  function addInsight(label, record, weak) {
    const card = createElement("div", weak ? "insight-card is-weak" : "insight-card");
    card.append(createElement("div", "insight-label", label));
    if (record) {
      card.append(
        createElement("div", "insight-date", formatDate(record.date, { day: "numeric", month: "long" })),
        createElement("div", "insight-result", `${percentage(record.stats)}% · ${record.stats.complete} из ${record.stats.scheduled}`),
      );
    } else {
      card.append(createElement("div", "insight-result", "Появится после второго завершённого дня."));
    }
    elements.dayInsights.append(card);
  }

  addInsight("Лучший день", best, false);
  addInsight("День для внимания", completedDays.length > 1 ? weakest : null, true);
}

function renderDailyChart() {
  const records = recentDays();
  if (!records.some((record) => record.key === selectedDayKey)) selectedDayKey = todayKey();
  elements.dailyChart.replaceChildren();

  records.forEach((record, index) => {
    const percent = percentage(record.stats);
    const selected = record.key === selectedDayKey;
    const button = createElement("button", `daily-day ${chartClass(record.stats)}${selected ? " is-selected" : ""}`);
    button.type = "button";
    button.dataset.action = "select-day";
    button.dataset.date = record.key;
    button.setAttribute("aria-pressed", String(selected));
    button.setAttribute(
      "aria-label",
      `${formatDate(record.date, { day: "numeric", month: "long" })}: ${record.stats.scheduled ? `${record.stats.complete} из ${record.stats.scheduled}, ${percent}%` : "нет запланированных привычек"}`,
    );
    const track = createElement("span", "daily-bar-track");
    const bar = createElement("span", "daily-bar");
    bar.style.height = record.stats.scheduled ? `${Math.max(percent, 4)}%` : "5px";
    track.append(bar);
    button.append(track, createElement("span", "daily-day-label", index % 5 === 0 || index === 29 ? String(record.date.getDate()) : ""));
    elements.dailyChart.append(button);
  });

  renderDayDetails(records.find((record) => record.key === selectedDayKey));
  renderDayInsights(records);
}

function renderWeeklyChart() {
  elements.weeklyChart.replaceChildren();
  const thisMonday = mondayOf(new Date());
  for (let index = 11; index >= 0; index -= 1) {
    const start = addDays(thisMonday, -index * 7);
    const end = addDays(start, 6);
    const stats = rangeStats(dateKey(start), dateKey(end));
    const percent = percentage(stats);
    const column = createElement("div", `week-column ${chartClass(stats)}`);
    column.setAttribute(
      "aria-label",
      `${formatWeekRange(start)}: ${stats.scheduled ? `${stats.complete} из ${stats.scheduled}, ${percent}%` : "нет запланированных привычек"}`,
    );
    column.append(createElement("span", "week-percent", stats.scheduled ? `${percent}%` : "—"));
    const track = createElement("div", "week-bar-track");
    const bar = createElement("div", "week-bar");
    bar.style.height = stats.scheduled ? `${Math.max(percent, 4)}%` : "5px";
    track.append(bar);
    column.append(track, createElement("span", "week-label", formatDate(start, { day: "numeric", month: "short" })));
    elements.weeklyChart.append(column);
  }
}

function renderAnalytics() {
  const periods = periodDefinitions();
  elements.analyticsCards.replaceChildren();
  for (const period of periods) {
    const stats = rangeStats(period.start, period.end);
    const card = createElement("div", "stat-card");
    card.append(createElement("div", "stat-card-label", period.label));
    const number = createElement("div", "stat-card-number", `${percentage(stats)}%`);
    card.append(number, createElement("div", "stat-card-total", `${stats.complete} из ${stats.scheduled} выполнено`));
    elements.analyticsCards.append(card);
  }

  const weekdayData = weekdayStats();
  renderDailyChart();
  renderWeeklyChart();
  renderDotChart(elements.weekdayChart, weekdayData);
  renderDotChart(elements.weekdayPreview, weekdayData);
  elements.habitPerformance.replaceChildren();
  const earliest = earliestHabitDate();
  if (!earliest) {
    elements.habitPerformance.append(createElement("p", "no-data", "Добавь привычку, чтобы увидеть её результаты."));
    return;
  }

  for (const habit of state.habits) {
    const stats = rangeStats(habit.periods[0].from, todayKey(), habit);
    const row = createElement("div", "performance-row");
    const top = createElement("div", "performance-top");
    top.append(createElement("span", "", habit.name), createElement("span", "", `${percentage(stats)}%`));
    const track = createElement("div", "progress-track");
    const fill = createElement("div", "progress-fill");
    fill.style.width = `${percentage(stats)}%`;
    track.append(fill);
    const details = createElement("div", "performance-details");
    details.append(
      createElement("span", "", activeHabit(habit) ? "Активна" : "В архиве"),
      createElement("span", "", `${stats.complete} из ${stats.scheduled}`),
    );
    row.append(top, track, details);
    elements.habitPerformance.append(row);
  }
}

function scheduleLabel(days) {
  return days.length === 7
    ? "Каждый день"
    : WEEKDAYS.filter((day) => days.includes(day.value)).map((day) => day.short).join(", ");
}

function renderHabitList() {
  elements.habitList.replaceChildren();
  const active = state.habits.filter(activeHabit);
  const archived = state.habits.filter((habit) => !activeHabit(habit));
  if (!active.length) {
    elements.habitList.append(createElement("p", "no-data", "Активных привычек пока нет."));
  }

  function addHabitItem(habit, archivedItem) {
    const item = createElement("div", archivedItem ? "habit-list-item is-archived" : "habit-list-item");
    const info = document.createElement("div");
    info.append(createElement("h3", "habit-list-name", habit.name));
    const latest = habit.schedules.at(-1);
    info.append(createElement("div", "habit-meta", archivedItem ? "В архиве · история сохранена" : scheduleLabel(latest.days)));
    const schedule = createElement("div", "habit-schedule");
    WEEKDAYS.filter((day) => latest.days.includes(day.value)).forEach((day) => {
      schedule.append(createElement("span", "schedule-pill", day.short));
    });
    info.append(schedule);
    const action = createElement("button", "habit-edit", archivedItem ? "Вернуть" : "Изменить");
    action.type = "button";
    action.dataset.action = archivedItem ? "restore" : "edit";
    action.dataset.id = habit.id;
    item.append(info, action);
    elements.habitList.append(item);
  }

  active.forEach((habit) => addHabitItem(habit, false));
  if (archived.length) {
    elements.habitList.append(createElement("h3", "archived-heading", "АРХИВ"));
    archived.forEach((habit) => addHabitItem(habit, true));
  }
}

function renderGoalList(container, goals, emptyText) {
  container.replaceChildren();
  if (!goals.length) {
    container.append(createElement("p", "goal-empty", emptyText));
    return;
  }

  goals.forEach((goal) => {
    const card = createElement("article", "goal-card");
    const top = createElement("div", "goal-card-top");
    const title = createElement("h3", "", goal.name);
    const edit = createElement("button", "goal-edit", "Изменить");
    edit.type = "button";
    edit.dataset.editGoal = goal.id;
    edit.setAttribute("aria-label", `Изменить цель «${goal.name}»`);
    top.append(title, edit);
    card.append(top);
    if (goal.description) card.append(createElement("p", "goal-card-description", goal.description));
    if (goal.deadline) {
      const date = fromKey(goal.deadline);
      if (!Number.isNaN(date.getTime())) {
        card.append(createElement("p", "goal-card-meta", `Срок: ${formatDate(date, { day: "numeric", month: "long", year: "numeric" })}`));
      }
    }
    const progress = Math.max(0, Math.min(100, Number(goal.progress) || 0));
    const label = createElement("div", "goal-card-progress");
    label.append(createElement("span", "", "Прогресс"), createElement("strong", "", `${progress}%`));
    const track = createElement("div", "goal-progress-track");
    const fill = createElement("div", "goal-progress-fill");
    fill.style.width = `${progress}%`;
    track.append(fill);
    card.append(label, track);
    container.append(card);
  });
}

function renderGoals() {
  elements.goalYearLabel.textContent = String(selectedGoalYear);
  renderGoalList(elements.mainGoalList, state.goals.filter((goal) => goal.type === "main"), "Добавь главную цель, чтобы держать её перед глазами.");
  renderGoalList(
    elements.annualGoalList,
    state.goals.filter((goal) => goal.type === "annual" && goal.year === selectedGoalYear),
    `На ${selectedGoalYear} год целей пока нет.`,
  );
}

function wheelPoint(index, score, radius = 160) {
  const angle = -Math.PI / 2 + index * Math.PI / 4;
  const distance = radius * score / 10;
  return { x: 250 + Math.cos(angle) * distance, y: 250 + Math.sin(angle) * distance };
}

function svgNode(tag, attributes = {}, textValue) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  if (textValue !== undefined) node.textContent = textValue;
  return node;
}

function renderBalance() {
  const wheel = elements.balanceWheel;
  wheel.querySelectorAll(".wheel-drawing").forEach((node) => node.remove());
  const drawing = svgNode("g", { class: "wheel-drawing", "aria-hidden": "true" });
  for (const level of [2, 4, 6, 8, 10]) {
    const points = BALANCE_AREAS.map((_, index) => wheelPoint(index, level));
    drawing.append(svgNode("polygon", { class: "wheel-ring", points: points.map(({ x, y }) => `${x},${y}`).join(" ") }));
  }
  BALANCE_AREAS.forEach((area, index) => {
    const end = wheelPoint(index, 10);
    drawing.append(svgNode("line", { class: "wheel-spoke", x1: 250, y1: 250, x2: end.x, y2: end.y }));
  });
  const scores = BALANCE_AREAS.map(({ key }) => state.balance[key]);
  if (scores.some(Boolean)) {
    const points = scores.map((score, index) => wheelPoint(index, score));
    drawing.append(svgNode("polygon", { class: "wheel-area", points: points.map(({ x, y }) => `${x},${y}`).join(" ") }));
    points.forEach(({ x, y }, index) => {
      if (scores[index]) drawing.append(svgNode("circle", { class: "wheel-point", cx: x, cy: y, r: 5 }));
    });
  }
  BALANCE_AREAS.forEach((area, index) => {
    const point = wheelPoint(index, 10, 213);
    const x = Math.max(64, Math.min(436, point.x));
    const label = svgNode("text", { class: "wheel-axis-label", x, y: point.y + 4 }, area.label);
    drawing.append(label);
    const input = document.querySelector(`[data-balance="${area.key}"]`);
    input.value = String(state.balance[area.key]);
    document.querySelector(`#balance-${area.key}-value`).textContent = state.balance[area.key] ? `${state.balance[area.key]}/10` : "—";
  });
  wheel.append(drawing);
}

function renderCurrentState() {
  STATE_AREAS.forEach((key) => {
    const entry = state.currentState[key];
    document.querySelector(`[data-state-score="${key}"]`).value = String(entry.score);
    document.querySelector(`[data-state-note="${key}"]`).value = entry.note;
    document.querySelector(`#state-${key}-value`).textContent = entry.score ? `${entry.score}/10` : "—";
  });
}

function renderBackupCounts() {
  const counts = [
    [state.habits.length, "привычек"],
    [state.habits.reduce((total, habit) => total + habit.completedDates.length, 0), "отметок"],
    [state.goals.length, "целей"],
    [BALANCE_AREAS.filter(({ key }) => state.balance[key] > 0).length, "сфер оценено"],
    [STATE_AREAS.filter((key) => state.currentState[key].score || state.currentState[key].note).length, "записей состояния"],
  ];
  elements.backupCounts.replaceChildren();
  counts.forEach(([count, label]) => {
    const item = createElement("div", "backup-count");
    item.append(createElement("strong", "", String(count)), createElement("span", "", label));
    elements.backupCounts.append(item);
  });
}

function setBackupStatus(message, error = false) {
  elements.backupStatus.textContent = message;
  elements.backupStatus.classList.toggle("is-error", error);
}

function validDateKey(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && dateKey(fromKey(value)) === value;
}

function downloadBackup() {
  const backup = {
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    data: state,
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `mrz-backup-${todayKey()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  setBackupStatus("Резервная копия скачана. Сохрани файл в надёжном месте.");
}

function validBackup(backup) {
  if (!backup || ![BACKUP_FORMAT, LEGACY_BACKUP_FORMAT].includes(backup.format) || backup.version !== 1) return false;
  const data = backup.data;
  if (!data || !Array.isArray(data.habits) || !Array.isArray(data.goals) || !data.balance || !data.currentState) return false;
  if (!data.habits.every((habit) =>
    habit && typeof habit.id === "string" && typeof habit.name === "string" &&
    Array.isArray(habit.periods) && habit.periods.length > 0 && habit.periods.every((period) =>
      period && validDateKey(period.from) && (period.to === null || validDateKey(period.to)),
    ) &&
    Array.isArray(habit.schedules) && habit.schedules.length > 0 && habit.schedules.every((schedule) =>
      schedule && validDateKey(schedule.from) && Array.isArray(schedule.days) && schedule.days.length > 0 &&
      schedule.days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6),
    ) &&
    Array.isArray(habit.completedDates) && habit.completedDates.every(validDateKey),
  )) return false;
  if (!data.goals.every((goal) =>
    goal && typeof goal.id === "string" && typeof goal.name === "string" &&
    ["main", "annual"].includes(goal.type) &&
    (goal.type !== "annual" || Number.isInteger(goal.year)) &&
    typeof goal.description === "string" && (goal.deadline === "" || validDateKey(goal.deadline)) &&
    Number.isFinite(goal.progress) && goal.progress >= 0 && goal.progress <= 100,
  )) return false;
  if (!BALANCE_AREAS.every(({ key }) => Number.isInteger(data.balance[key]) && data.balance[key] >= 0 && data.balance[key] <= 10)) return false;
  if (!STATE_AREAS.every((key) =>
    data.currentState[key] && Number.isInteger(data.currentState[key].score) &&
    data.currentState[key].score >= 0 && data.currentState[key].score <= 10 &&
    typeof data.currentState[key].note === "string",
  )) return false;
  return true;
}

async function restoreBackup(file) {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    setBackupStatus("Файл слишком большой. Максимальный размер — 10 МБ.", true);
    return;
  }
  try {
    const backup = JSON.parse(await file.text());
    if (!validBackup(backup)) {
      setBackupStatus("Файл не похож на резервную копию этого трекера или содержит ошибки.", true);
      return;
    }
    const count = `${backup.data.habits.length} привычек и ${backup.data.goals.length} целей`;
    const destination = cloudUser
      ? "Текущие данные в этом браузере будут заменены, затем новая копия синхронизируется с облаком."
      : "Текущие данные в этом браузере будут заменены.";
    if (!window.confirm(`Восстановить копию (${count})? ${destination}`)) {
      setBackupStatus("Восстановление отменено. Текущие данные сохранены.");
      return;
    }
    const previous = state;
    state = backup.data;
    if (!saveState()) {
      state = previous;
      setBackupStatus("Не удалось сохранить копию. Текущие данные не изменены.", true);
      return;
    }
    selectedWeek = mondayOf(new Date());
    selectedGoalYear = new Date().getFullYear();
    render();
    renderCurrentState();
    setBackupStatus("Данные восстановлены. Все разделы обновлены.");
    showToast("Резервная копия восстановлена.");
  } catch (error) {
    console.warn("Не удалось прочитать резервную копию.", error);
    setBackupStatus("Не удалось прочитать JSON-файл. Текущие данные не изменены.", true);
  }
}

function stateFingerprint(data) {
  const source = JSON.stringify(data);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${source.length}:${hash >>> 0}`;
}

function hasRecords(data) {
  return data.habits.length > 0 || data.goals.length > 0 ||
    BALANCE_AREAS.some(({ key }) => data.balance[key] > 0) ||
    STATE_AREAS.some((key) => data.currentState[key].score || data.currentState[key].note);
}

function loadSyncMeta() {
  try {
    const saved = JSON.parse(localStorage.getItem(SYNC_META_KEY) || "null");
    return saved && typeof saved.userId === "string" && Number.isInteger(saved.revision) ? saved : null;
  } catch {
    return null;
  }
}

function saveSyncMeta(fingerprint = stateFingerprint(state)) {
  if (!cloudUser) return;
  try {
    localStorage.setItem(SYNC_META_KEY, JSON.stringify({
      userId: cloudUser.id,
      revision: cloudRevision,
      fingerprint,
    }));
  } catch (error) {
    console.warn("Не удалось сохранить служебные данные синхронизации.", error);
  }
}

function setSyncStatus(message, kind = "idle") {
  elements.syncStatus.textContent = message;
  elements.syncStatus.classList.toggle("is-error", kind === "error");
  elements.syncIndicator.classList.toggle("is-synced", kind === "synced");
  elements.syncIndicator.classList.toggle("is-error", kind === "error");
  elements.syncIndicator.textContent = {
    synced: "Синхронизировано", pending: "Ожидает синхронизации",
    error: "Требует внимания", idle: cloudUser ? "Подключено" : "Только в этом браузере",
  }[kind];
  elements.storageNote.textContent = kind === "synced"
    ? "Данные сохранены в браузере и облаке"
    : "Данные сохранены в этом браузере";
}

function updateAuthUi() {
  elements.authForm.hidden = Boolean(cloudUser);
  elements.signedInControls.hidden = !cloudUser;
  elements.signedInEmail.textContent = cloudUser?.email || "";
}

function adoptCloudState(row) {
  if (!validBackup({ format: BACKUP_FORMAT, version: 1, data: row.data })) {
    throw new Error("В облаке обнаружены повреждённые данные. Локальные записи сохранены.");
  }
  const previous = state;
  state = row.data;
  if (!saveState({ sync: false })) {
    state = previous;
    throw new Error("Не удалось сохранить облачные данные в браузере.");
  }
  cloudRevision = row.revision;
  syncPending = false;
  syncConflict = false;
  cloudReady = true;
  saveSyncMeta();
  render();
  renderCurrentState();
  setSyncStatus("Последняя версия данных загружена из облака.", "synced");
}

async function readCloudRow() {
  const { data, error } = await cloudClient.from("tracker_state")
    .select("data, revision").eq("user_id", cloudUser.id).maybeSingle();
  if (error) throw error;
  return data;
}

function queueCloudSync() {
  if (!cloudUser) return;
  syncPending = true;
  if (!cloudReady || syncConflict) return;
  setSyncStatus("Изменения сохранены в браузере. Отправляем их в облако…", "pending");
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => { void flushCloudSync(); }, 700);
}

async function flushCloudSync() {
  if (!cloudClient || !cloudUser || !cloudReady || !syncPending || syncConflict || cloudBusy) return;
  cloudBusy = true;
  const snapshot = JSON.parse(JSON.stringify(state));
  const fingerprint = stateFingerprint(snapshot);
  try {
    let result;
    if (cloudRevision === 0) {
      result = await cloudClient.from("tracker_state")
        .insert({ user_id: cloudUser.id, data: snapshot, revision: 1 })
        .select("revision").single();
    } else {
      result = await cloudClient.from("tracker_state")
        .update({ data: snapshot, revision: cloudRevision + 1 })
        .eq("user_id", cloudUser.id).eq("revision", cloudRevision)
        .select("revision").maybeSingle();
    }
    if (result.error) {
      if (result.error.code === "23505") {
        syncConflict = true;
        setSyncStatus("На другом устройстве уже есть данные. Нажми «Синхронизировать сейчас», чтобы выбрать версию.", "error");
        return;
      }
      throw result.error;
    }
    if (!result.data) {
      syncConflict = true;
      setSyncStatus("Данные изменились на другом устройстве. Нажми «Синхронизировать сейчас», чтобы выбрать версию.", "error");
      return;
    }
    cloudRevision = result.data.revision;
    saveSyncMeta(fingerprint);
    if (stateFingerprint(state) === fingerprint) {
      syncPending = false;
      setSyncStatus("Все изменения сохранены на телефоне и компьютере.", "synced");
    } else {
      syncPending = true;
      setSyncStatus("Отправляем последние изменения…", "pending");
    }
  } catch (error) {
    console.warn("Ошибка синхронизации.", error);
    setSyncStatus("Нет связи с облаком. Изменения остались в браузере; повторим при подключении.", "error");
  } finally {
    cloudBusy = false;
    if (syncPending && !syncConflict && navigator.onLine) {
      window.clearTimeout(syncTimer);
      syncTimer = window.setTimeout(() => { void flushCloudSync(); }, 15000);
    }
  }
}

async function reconcileCloudOnSignIn() {
  const row = await readCloudRow();
  const meta = loadSyncMeta();
  const localFingerprint = stateFingerprint(state);
  if (!row) {
    cloudRevision = 0;
    if (!hasRecords(state)) {
      cloudReady = true;
      syncPending = false;
      setSyncStatus("Аккаунт подключён. Новые записи будут синхронизироваться.", "synced");
    } else if (window.confirm("В этом браузере уже есть записи, а в облаке пока пусто. Перенести локальные записи в аккаунт MRZ?")) {
      cloudReady = true;
      syncPending = true;
      setSyncStatus("Переносим данные в облако…", "pending");
      await flushCloudSync();
    } else {
      syncConflict = true;
      setSyncStatus("Локальные записи не перенесены. Нажми «Синхронизировать сейчас», когда будешь готов.", "error");
    }
    return;
  }
  if (!validBackup({ format: BACKUP_FORMAT, version: 1, data: row.data })) {
    throw new Error("Облачная копия повреждена. Локальные записи не изменены.");
  }
  if (localFingerprint === stateFingerprint(row.data) || !hasRecords(state) ||
    (meta?.userId === cloudUser.id && meta.fingerprint === localFingerprint && meta.revision < row.revision)) {
    adoptCloudState(row);
    return;
  }
  cloudRevision = row.revision;
  if (meta?.userId === cloudUser.id && meta.revision === row.revision) {
    cloudReady = true;
    syncPending = true;
    await flushCloudSync();
    return;
  }
  syncConflict = true;
  setSyncStatus("В браузере и облаке разные записи. Нажми «Синхронизировать сейчас», чтобы выбрать версию.", "error");
}

async function enterCloudSession(user) {
  if (authLoading || (cloudUser?.id === user.id && cloudReady)) return;
  authLoading = true;
  cloudUser = user;
  cloudReady = false;
  syncConflict = false;
  updateAuthUi();
  setSyncStatus("Проверяем сохранённые записи…", "pending");
  try {
    await reconcileCloudOnSignIn();
  } catch (error) {
    console.warn("Не удалось загрузить данные аккаунта.", error);
    setSyncStatus(error.message || "Не удалось загрузить данные аккаунта. Локальные записи сохранены.", "error");
  } finally {
    authLoading = false;
  }
}

async function resolveCloudConflict() {
  if (!cloudUser || cloudBusy) return;
  cloudBusy = true;
  try {
    const row = await readCloudRow();
    if (!row) {
      cloudRevision = 0;
      if (!window.confirm("В облаке нет записей. Перенести данные из этого браузера в аккаунт?")) return;
      cloudReady = true;
      syncConflict = false;
      syncPending = true;
      return;
    }
    if (!validBackup({ format: BACKUP_FORMAT, version: 1, data: row.data })) {
      throw new Error("Облачная копия повреждена. Локальные записи сохранены.");
    }
    if (stateFingerprint(state) === stateFingerprint(row.data)) {
      adoptCloudState(row);
      return;
    }
    if (window.confirm("В браузере и облаке разные записи. Заменить облачную версию данными этого браузера? Облачные изменения на другом устройстве будут потеряны.")) {
      cloudRevision = row.revision;
      cloudReady = true;
      syncConflict = false;
      syncPending = true;
      return;
    }
    if (window.confirm("Загрузить облачную версию и заменить локальные записи в этом браузере? При необходимости сначала скачай резервную копию.")) {
      adoptCloudState(row);
    }
  } catch (error) {
    console.warn("Не удалось разрешить различия между устройствами.", error);
    setSyncStatus(error.message || "Не удалось получить облачные данные. Попробуй позже.", "error");
  } finally {
    cloudBusy = false;
    if (syncPending && !syncConflict) await flushCloudSync();
  }
}

async function refreshCloudState() {
  if (!cloudUser || !cloudReady || cloudBusy || syncPending || document.hidden) return;
  cloudBusy = true;
  try {
    const row = await readCloudRow();
    if (!row || row.revision <= cloudRevision) return;
    const meta = loadSyncMeta();
    if (meta?.userId === cloudUser.id && meta.fingerprint === stateFingerprint(state)) {
      adoptCloudState(row);
    } else {
      syncConflict = true;
      setSyncStatus("Появились изменения с другого устройства. Выбери версию на странице «Данные».", "error");
    }
  } catch (error) {
    console.warn("Не удалось проверить облачные изменения.", error);
  } finally {
    cloudBusy = false;
  }
}

async function loadSupabaseLibrary() {
  if (window.supabase?.createClient) return;
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Не удалось загрузить библиотеку синхронизации."));
    document.head.append(script);
  });
}

async function initCloudSync() {
  try {
    const response = await fetch(CLOUD_CONFIG_PATH, { cache: "no-store" });
    if (!response.ok) throw new Error("Настройки облака пока не опубликованы.");
    const config = await response.json();
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url) ||
      typeof config.publishableKey !== "string" || !config.publishableKey.startsWith("sb_publishable_")) {
      throw new Error("Настройки облака некорректны.");
    }
    await loadSupabaseLibrary();
    cloudClient = window.supabase.createClient(config.url, config.publishableKey);
    cloudClient.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        cloudUser = null;
        cloudReady = false;
        syncPending = false;
        syncConflict = false;
        updateAuthUi();
        setSyncStatus("Вы вышли из аккаунта. Записи остались в этом браузере.");
      } else if (event === "SIGNED_IN" && session?.user) {
        window.setTimeout(() => { void enterCloudSession(session.user); }, 0);
      }
    });
    const { data, error } = await cloudClient.auth.getSession();
    if (error) throw error;
    if (data.session?.user) await enterCloudSession(data.session.user);
    else setSyncStatus("Войди в аккаунт, чтобы синхронизировать записи.");
  } catch (error) {
    console.warn("Синхронизация ещё не настроена.", error);
    elements.authEmail.disabled = true;
    elements.authPassword.disabled = true;
    elements.authSignIn.disabled = true;
    elements.authSignUp.disabled = true;
    setSyncStatus("Синхронизация ещё настраивается. Все записи пока сохраняются в этом браузере.", "error");
  }
}

function render() {
  elements.todayLabel.textContent = formatDate(new Date(), { weekday: "long", day: "numeric", month: "long" });
  renderHabitGrid();
  renderSummary();
  renderAnalytics();
  renderHabitList();
  renderGoals();
  renderBalance();
  renderBackupCounts();
}

function showView(name) {
  const selected = ["dashboard", "analytics", "habits", "goals", "balance", "state", "data"].includes(name) ? name : "dashboard";
  document.querySelectorAll(".view").forEach((view) => {
    view.hidden = view.id !== `${selected}-view`;
  });
  document.querySelectorAll(".nav-item").forEach((button) => {
    const current = button.dataset.view === selected;
    button.classList.toggle("is-active", current);
    if (current) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  elements.breadcrumb.textContent = {
    dashboard: "ОБЗОР", analytics: "СТАТИСТИКА", habits: "ПРИВЫЧКИ",
    goals: "ЦЕЛИ", balance: "КОЛЕСО БАЛАНСА", state: "ТЕКУЩЕЕ СОСТОЯНИЕ", data: "ДАННЫЕ",
  }[selected];
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 3200);
}

function openHabitDialog(habit = null) {
  elements.form.reset();
  elements.nameError.hidden = true;
  elements.daysError.hidden = true;
  editingHabitId = habit?.id || null;
  elements.dialogTitle.textContent = habit ? "Изменить привычку" : "Новая привычка";
  elements.saveButton.textContent = habit ? "Сохранить" : "Создать привычку";
  elements.archiveButton.hidden = !habit;
  elements.scheduleNote.hidden = !habit;
  elements.habitName.value = habit?.name || "";
  const days = habit ? habit.schedules.at(-1).days : WEEKDAYS.map((day) => day.value);
  elements.form.querySelectorAll('input[name="weekday"]').forEach((checkbox) => {
    checkbox.checked = days.includes(Number(checkbox.value));
  });
  elements.dialog.showModal();
  elements.habitName.focus();
}

function closeHabitDialog() {
  elements.dialog.close();
  editingHabitId = null;
}

function openGoalDialog(type, goal = null) {
  elements.goalForm.reset();
  elements.goalNameError.hidden = true;
  editingGoalId = goal?.id || null;
  goalType = goal?.type || type;
  elements.goalDialogTitle.textContent = goal ? "Изменить цель" : goalType === "annual" ? `Цель на ${selectedGoalYear} год` : "Главная цель";
  elements.saveGoalButton.textContent = goal ? "Сохранить" : "Создать цель";
  elements.deleteGoalButton.hidden = !goal;
  elements.goalName.value = goal?.name || "";
  elements.goalDescription.value = goal?.description || "";
  elements.goalDeadline.value = goal?.deadline || "";
  elements.goalProgress.value = String(goal?.progress || 0);
  elements.goalProgressValue.textContent = `${elements.goalProgress.value}%`;
  elements.goalDialog.showModal();
  elements.goalName.focus();
}

function closeGoalDialog() {
  elements.goalDialog.close();
  editingGoalId = null;
}

function saveGoalFromForm(event) {
  event.preventDefault();
  const name = elements.goalName.value.trim();
  elements.goalNameError.hidden = Boolean(name);
  if (!name) {
    elements.goalName.focus();
    return;
  }
  const values = {
    name,
    description: elements.goalDescription.value.trim(),
    deadline: elements.goalDeadline.value,
    progress: Math.max(0, Math.min(100, Number(elements.goalProgress.value) || 0)),
  };
  if (editingGoalId) {
    const goal = state.goals.find((item) => item.id === editingGoalId);
    if (!goal) return;
    Object.assign(goal, values);
    showToast("Цель обновлена.");
  } else {
    state.goals.push({
      id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      type: goalType,
      year: goalType === "annual" ? selectedGoalYear : null,
      ...values,
    });
    showToast("Цель создана.");
  }
  saveState();
  closeGoalDialog();
  renderGoals();
}

function deleteGoal() {
  const goal = state.goals.find((item) => item.id === editingGoalId);
  if (!goal || !window.confirm(`Удалить цель «${goal.name}»? Это действие нельзя отменить.`)) return;
  state.goals = state.goals.filter((item) => item.id !== goal.id);
  saveState();
  closeGoalDialog();
  renderGoals();
  showToast("Цель удалена.");
}

function saveHabitFromForm(event) {
  event.preventDefault();
  const name = elements.habitName.value.trim();
  const days = [...elements.form.querySelectorAll('input[name="weekday"]:checked')]
    .map((checkbox) => Number(checkbox.value))
    .sort((first, second) => first - second);
  elements.nameError.hidden = Boolean(name);
  elements.daysError.hidden = days.length > 0;
  if (!name || !days.length) return;

  const today = todayKey();
  if (editingHabitId) {
    const habit = state.habits.find((item) => item.id === editingHabitId);
    if (!habit) return;
    habit.name = name;
    const existingDays = scheduleOnDate(habit, today);
    if (JSON.stringify(existingDays) !== JSON.stringify(days)) {
      habit.schedules = habit.schedules.filter((schedule) => schedule.from < today);
      habit.schedules.push({ from: today, days });
    }
    showToast("Привычка обновлена. Прошлое расписание сохранено.");
  } else {
    const id = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    state.habits.push({
      id,
      name,
      periods: [{ from: today, to: null }],
      schedules: [{ from: today, days }],
      completedDates: [],
    });
    showToast("Привычка создана.");
  }
  saveState();
  closeHabitDialog();
  render();
}

function archiveHabit() {
  const habit = state.habits.find((item) => item.id === editingHabitId);
  if (!habit || !activeHabit(habit)) return;
  habit.periods.at(-1).to = dateKey(addDays(new Date(), 1));
  saveState();
  closeHabitDialog();
  render();
  showToast("Привычка в архиве. История сохранена.");
}

function restoreHabit(id) {
  const habit = state.habits.find((item) => item.id === id);
  if (!habit || activeHabit(habit)) return;
  const lastPeriod = habit.periods.at(-1);
  if (lastPeriod.to > todayKey()) lastPeriod.to = null;
  else habit.periods.push({ from: todayKey(), to: null });
  saveState();
  render();
  showToast("Привычка снова активна.");
}

function toggleCompletion(id, key) {
  const habit = state.habits.find((item) => item.id === id);
  if (!habit || key > todayKey() || !scheduledOnDate(habit, key)) return;
  if (completedOnDate(habit, key)) {
    habit.completedDates = habit.completedDates.filter((date) => date !== key);
    showToast("Отметка снята.");
  } else {
    habit.completedDates.push(key);
    habit.completedDates.sort();
    showToast("Готово. День отмечен.");
  }
  saveState();
  render();
}

document.addEventListener("click", (event) => {
  const openButton = event.target.closest("[data-open-habit-dialog]");
  if (openButton) return openHabitDialog();

  const closeButton = event.target.closest("[data-close-dialog]");
  if (closeButton) return closeHabitDialog();

  const openGoalButton = event.target.closest("[data-open-goal-dialog]");
  if (openGoalButton) return openGoalDialog(openGoalButton.dataset.openGoalDialog);

  const closeGoalButton = event.target.closest("[data-close-goal-dialog]");
  if (closeGoalButton) return closeGoalDialog();

  const editGoalButton = event.target.closest("[data-edit-goal]");
  if (editGoalButton) {
    const goal = state.goals.find((item) => item.id === editGoalButton.dataset.editGoal);
    if (goal) openGoalDialog(goal.type, goal);
    return;
  }

  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    location.hash = viewButton.dataset.view;
    return showView(viewButton.dataset.view);
  }

  const action = event.target.closest("[data-action]");
  if (!action) return;
  if (action.dataset.action === "select-day") {
    selectedDayKey = action.dataset.date;
    renderDailyChart();
    return;
  }
  const habit = state.habits.find((item) => item.id === action.dataset.id);
  if (action.dataset.action === "edit" && habit) openHabitDialog(habit);
  if (action.dataset.action === "restore") restoreHabit(action.dataset.id);
  if (action.dataset.action === "toggle") toggleCompletion(action.dataset.id, action.dataset.date);
});

document.querySelector("#previous-week").addEventListener("click", () => {
  selectedWeek = addDays(selectedWeek, -7);
  render();
});

document.querySelector("#next-week").addEventListener("click", () => {
  selectedWeek = addDays(selectedWeek, 7);
  render();
});

document.querySelector("#current-week").addEventListener("click", () => {
  selectedWeek = mondayOf(new Date());
  render();
});

elements.exportBackup.addEventListener("click", downloadBackup);
elements.importBackup.addEventListener("click", () => elements.backupFile.click());
elements.backupFile.addEventListener("change", async () => {
  const file = elements.backupFile.files[0];
  elements.backupFile.value = "";
  await restoreBackup(file);
});

elements.authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!cloudClient || !elements.authForm.reportValidity()) return;
  elements.authSignIn.disabled = true;
  setSyncStatus("Проверяем аккаунт…", "pending");
  try {
    const { error } = await cloudClient.auth.signInWithPassword({
      email: elements.authEmail.value.trim(),
      password: elements.authPassword.value,
    });
    if (error) throw error;
    elements.authPassword.value = "";
  } catch (error) {
    console.warn("Не удалось войти в аккаунт.", error);
    setSyncStatus("Не удалось войти. Проверь почту, пароль и подтверждение email.", "error");
  } finally {
    elements.authSignIn.disabled = false;
  }
});

elements.authSignUp.addEventListener("click", async () => {
  if (!cloudClient || !elements.authForm.reportValidity()) return;
  elements.authSignUp.disabled = true;
  setSyncStatus("Создаём аккаунт…", "pending");
  try {
    const { data, error } = await cloudClient.auth.signUp({
      email: elements.authEmail.value.trim(),
      password: elements.authPassword.value,
      options: { emailRedirectTo: `${location.origin}${location.pathname}` },
    });
    if (error) throw error;
    elements.authPassword.value = "";
    if (!data.session) setSyncStatus("Аккаунт создан. Подтверди почту по ссылке в письме, затем войди.");
  } catch (error) {
    console.warn("Не удалось создать аккаунт.", error);
    setSyncStatus("Не удалось создать аккаунт. Проверь почту и пароль или попробуй позже.", "error");
  } finally {
    elements.authSignUp.disabled = false;
  }
});

elements.authSignOut.addEventListener("click", async () => {
  if (!cloudClient) return;
  const { error } = await cloudClient.auth.signOut();
  if (error) setSyncStatus("Не удалось выйти из аккаунта. Попробуй ещё раз.", "error");
});

elements.syncNow.addEventListener("click", async () => {
  if (!cloudUser) return;
  if (syncConflict || !cloudReady) await resolveCloudConflict();
  else if (syncPending) await flushCloudSync();
  else await refreshCloudState();
});

document.querySelector("#previous-goal-year").addEventListener("click", () => {
  selectedGoalYear -= 1;
  renderGoals();
});
document.querySelector("#next-goal-year").addEventListener("click", () => {
  selectedGoalYear += 1;
  renderGoals();
});

elements.goalProgress.addEventListener("input", () => {
  elements.goalProgressValue.textContent = `${elements.goalProgress.value}%`;
});
elements.goalForm.addEventListener("submit", saveGoalFromForm);
elements.deleteGoalButton.addEventListener("click", deleteGoal);
elements.goalDialog.addEventListener("click", (event) => {
  if (event.target === elements.goalDialog) closeGoalDialog();
});
elements.goalDialog.addEventListener("close", () => { editingGoalId = null; });

document.querySelectorAll("[data-balance]").forEach((input) => {
  input.addEventListener("input", () => {
    state.balance[input.dataset.balance] = clampScore(input.value);
    renderBalance();
    saveState();
  });
});

document.querySelectorAll("[data-state-score]").forEach((input) => {
  input.addEventListener("input", () => {
    const key = input.dataset.stateScore;
    state.currentState[key].score = clampScore(input.value);
    document.querySelector(`#state-${key}-value`).textContent = state.currentState[key].score ? `${state.currentState[key].score}/10` : "—";
    elements.stateSaveStatus.textContent = saveState() ? "Оценка сохранена автоматически." : "Не удалось сохранить оценку.";
  });
});
document.querySelectorAll("[data-state-note]").forEach((input) => {
  input.addEventListener("input", () => {
    state.currentState[input.dataset.stateNote].note = input.value.slice(0, 1000);
    elements.stateSaveStatus.textContent = saveState() ? "Заметка сохранена автоматически." : "Не удалось сохранить заметку.";
  });
});

elements.form.addEventListener("submit", saveHabitFromForm);
elements.archiveButton.addEventListener("click", archiveHabit);
elements.dialog.addEventListener("click", (event) => {
  if (event.target === elements.dialog) closeHabitDialog();
});
elements.dialog.addEventListener("close", () => {
  editingHabitId = null;
});
window.addEventListener("hashchange", () => showView(location.hash.slice(1)));
window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY) return;
  state = loadState();
  render();
  renderCurrentState();
  setBackupStatus("Данные обновлены из другой вкладки этого адреса.");
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    render();
    if (syncPending) void flushCloudSync();
    else void refreshCloudState();
  }
});
window.addEventListener("online", () => {
  if (syncPending) void flushCloudSync();
  else void refreshCloudState();
});
window.setInterval(() => { void refreshCloudState(); }, 30000);

render();
renderCurrentState();
showView(location.hash.slice(1));
void initCloudSync();
