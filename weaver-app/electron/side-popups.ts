import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  NativeImage,
  nativeImage,
  screen,
  Tray
} from 'electron';
import * as path from 'path';
import { DataSource } from 'typeorm';

import { adoWorkItemIdForTitle } from './ado/match-task';
import { loggingTitle } from './ado/parse';
import { AdoWorkItem } from './entities/AdoWorkItem';
import { Setting } from './entities/Setting';
import { Task } from './entities/Task';
import { routeExternalLinks } from './open-external';
import {
  dailyTargetHours,
  formatLocalDate,
  parsePopupRules,
  PopupRule,
  roundHours
} from './popup-rules';

export interface PopupEntry {
  title: string;
  hours: number;
}

export interface SidePopupHosts {
  getDataSource: () => DataSource | undefined;
  showMainWindow: () => void;
  loadRenderer: (win: BrowserWindow, query: Record<string, string>) => void;
}

interface OpenPopup {
  ruleId: string;
  type: PopupRule['type'];
  window: BrowserWindow;
  resolved: boolean;
  suppressResolve: boolean;
  dismissTimer?: NodeJS.Timeout;
}

interface TimeSnapshot {
  today: string;
  previousDate: string | null;
  targetHours: number;
  todayHours: number;
  remainingHours: number;
  previousTitles: string[];
  recentTitles: string[];
}

const CHECK_INTERVAL_MS = 15000;
const TIME_LOG_WIDTH = 400;
const REMINDER_WIDTH = 340;
const REMINDER_WINDOW_HEIGHT = 120;
const TIME_LOG_WINDOW_HEIGHT = 360;
const STACK_MARGIN = 12;
const STACK_GAP = 8;
const MINUTES_PER_HOUR = 60;
const MIN_POPUP_HEIGHT = 48;
const MAX_POPUP_HEIGHT = 720;
const MAX_SAVED_ENTRIES = 30;
const FALLBACK_MAX_HOURS = 8;
const RECENT_DAY_WINDOW = 30;

let hosts: SidePopupHosts | null = null;
let tray: Tray | null = null;
let quitting = false;
let launchAtLoginEnabled = false;
let schedulerStarted = false;
let ipcReady = false;

const openPopups: OpenPopup[] = [];

export function markSidePopupsQuitting(): void {
  quitting = true;
}

export function shouldKeepSidePopupsAlive(): boolean {
  return !!tray && !quitting;
}

export function attachMainWindow(win: BrowserWindow): void {
  win.on('close', event => {
    if (quitting || !launchAtLoginEnabled || !tray)
      return;

    event.preventDefault();
    win.hide();
  });
}

export async function refreshSidePopups(nextHosts: SidePopupHosts): Promise<void> {
  hosts = nextHosts;
  ensurePopupIpc();
  await applyLaunchAndTray();
  await runSchedulerTick();

  if (!schedulerStarted) {
    schedulerStarted = true;
    setInterval(() => {
      void runSchedulerTick();
    }, CHECK_INTERVAL_MS);
  }
}

async function applyLaunchAndTray(): Promise<void> {
  const settings = await readSettings();

  launchAtLoginEnabled = !!settings?.launchAtLogin;

  try {
    app.setLoginItemSettings({ openAtLogin: launchAtLoginEnabled });
  } catch (error) {
    console.error('Could not update launch-at-login', error);
  }

  if (launchAtLoginEnabled)
    ensureTray();
  else
    destroyTray();

  if (!launchAtLoginEnabled)
    closeAllPopups(true);
}

function ensureTray(): void {
  if (tray)
    return;

  const icon = trayIcon();

  if (icon.isEmpty()) {
    console.error('Weaver tray icon is missing');
    return;
  }

  try {
    tray = new Tray(icon);
  } catch (error) {
    console.error('Could not create tray', error);
    tray = null;
    return;
  }

  tray.setToolTip('Weaver');

  const openMainWindow = (): void => {
    hosts?.showMainWindow();
  };
  const quitApplication = (): void => {
    quitting = true;
    app.quit();
  };

  tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Open', click: openMainWindow }, { label: 'Quit', click: quitApplication }]));

  tray.on('click', () => hosts?.showMainWindow());
}

function trayIcon(): NativeImage {
  const candidates = [path.join(__dirname, '../build/tray.png'), path.join(process.resourcesPath, 'tray.png')];

  for (const candidate of candidates) {
    const icon = nativeImage.createFromPath(candidate);

    if (!icon.isEmpty())
      return process.platform === 'win32' ? icon.resize({ width: 32, height: 32 }) : icon;
  }

  return nativeImage.createEmpty();
}

function destroyTray(): void {
  if (!tray)
    return;

  tray.destroy();
  tray = null;
}

async function runSchedulerTick(): Promise<void> {
  if (quitting || !launchAtLoginEnabled)
    return;

  const dataSource = hosts?.getDataSource();

  if (!dataSource?.isInitialized)
    return;

  const settings = await readSettings();

  if (!settings?.launchAtLogin)
    return;

  const now = new Date();
  const today = formatLocalDate(now);
  const weekday = now.getDay();
  const minutesNow = now.getHours() * MINUTES_PER_HOUR + now.getMinutes();

  for (const rule of parsePopupRules(settings.popupRules)) {
    if (!rule.enabled || !rule.weekdays.includes(weekday))
      continue;

    if (popupAlreadyHandledToday(rule, today, now))
      continue;

    if (openPopups.some(popup => popup.ruleId === rule.id))
      continue;

    const [hours, minutes] = rule.time.split(':').map(Number);

    if (minutesNow < hours * MINUTES_PER_HOUR + minutes)
      continue;

    if (rule.type === 'time-log' && !(await timeLogShouldOpen(rule, dataSource, settings, today)))
      continue;

    try {
      showPopup(rule);
    } catch (error) {
      console.error('Could not show popup', rule.id, error);
    }
  }
}

async function timeLogShouldOpen(
  rule: PopupRule,
  dataSource: DataSource,
  settings: Setting,
  today: string
): Promise<boolean> {
  const snapshot = await buildTimeSnapshot(dataSource, settings);

  if (rule.onlyIfNothingReported && snapshot.todayHours > 0)
    return false;

  if (!rule.onlyIfNothingReported && snapshot.remainingHours <= 0) {
    if (rule.intervalMinutes <= 0)
      await markResolved(rule.id, today);

    return false;
  }

  return true;
}

function showPopup(rule: PopupRule): void {
  if (!hosts)
    return;

  const reminder = rule.type === 'reminder';
  const win = new BrowserWindow({
    width: reminder ? REMINDER_WIDTH : TIME_LOG_WIDTH,
    height: reminder ? REMINDER_WINDOW_HEIGHT : TIME_LOG_WINDOW_HEIGHT,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: !reminder,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false
    }
  });

  routeExternalLinks(win);
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  if (reminder)
    win.setIgnoreMouseEvents(true);

  const record: OpenPopup = {
    ruleId: rule.id,
    type: rule.type,
    window: win,
    resolved: false,
    suppressResolve: false
  };

  openPopups.push(record);

  win.on('closed', () => {
    if (record.dismissTimer)
      clearTimeout(record.dismissTimer);

    const index = openPopups.indexOf(record);

    if (index >= 0)
      openPopups.splice(index, 1);

    layoutPopups();

    if (!quitting && !record.resolved && !record.suppressResolve) {
      const now = new Date();
      const resolvedOn = formatLocalDate(now);

      void markResolved(record.ruleId, resolvedOn);
    }
  });

  if (reminder) {
    record.dismissTimer = setTimeout(() => {
      void resolvePopup(rule.id);
    }, rule.durationSeconds * 1000);
  }

  win.once('ready-to-show', () => {
    if (win.isDestroyed())
      return;

    layoutPopups();

    if (reminder)
      win.showInactive();
    else
      win.show();
  });

  hosts.loadRenderer(win, { overlay: rule.type, ruleId: rule.id });
}

function layoutPopups(): void {
  const area = screen.getPrimaryDisplay().workArea;

  let bottom = area.y + area.height - STACK_MARGIN;

  for (const popup of openPopups) {
    const win = popup.window;

    if (win.isDestroyed())
      continue;

    const bounds = win.getBounds();
    const x = Math.round(area.x + area.width - bounds.width - STACK_MARGIN);
    const y = Math.round(bottom - bounds.height);

    win.setBounds({ x, y, width: bounds.width, height: bounds.height });
    bottom = y - STACK_GAP;
  }
}

function ensurePopupIpc(): void {
  if (ipcReady)
    return;

  ipcReady = true;

  ipcMain.handle('popup:get-context', async (_event, ruleId: string) => getPopupContext(ruleId));

  ipcMain.handle('popup:submit', async (_event, payload: { ruleId: string; entries: PopupEntry[] }) => {
    await savePopupEntries(payload?.entries ?? []);
    await resolvePopup(payload?.ruleId);
    return true;
  });

  ipcMain.handle('popup:dismiss', async (_event, ruleId: string) => {
    await resolvePopup(ruleId);
    return true;
  });

  ipcMain.on('popup:resize', (event, height: number) => {
    const win = BrowserWindow.fromWebContents(event.sender);

    if (!win || win.isDestroyed())
      return;

    const nextHeight = Math.max(MIN_POPUP_HEIGHT, Math.min(Math.ceil(Number(height) || 0), MAX_POPUP_HEIGHT));
    const bounds = win.getBounds();

    if (Math.abs(bounds.height - nextHeight) < 2)
      return;

    win.setBounds({ ...bounds, height: nextHeight });
    layoutPopups();
  });
}

async function getPopupContext(ruleId: string): Promise<TimeSnapshot & {
  ruleId: string;
  type: PopupRule['type'];
  message: string;
  durationSeconds: number;
  darkMode: boolean;
}> {
  const dataSource = hosts?.getDataSource();

  if (!dataSource?.isInitialized)
    throw new Error('Database is not ready');

  const settings = await readSettings();

  if (!settings)
    throw new Error('Settings are missing');

  const rule = parsePopupRules(settings.popupRules).find(item => item.id === ruleId);

  if (!rule)
    throw new Error('Popup rule was removed');

  const snapshot = await buildTimeSnapshot(dataSource, settings);

  return {
    ruleId: rule.id,
    type: rule.type,
    message: rule.message,
    durationSeconds: rule.durationSeconds,
    darkMode: !!settings.darkMode,
    today: snapshot.today,
    previousDate: snapshot.previousDate,
    targetHours: snapshot.targetHours,
    todayHours: snapshot.todayHours,
    remainingHours: snapshot.remainingHours,
    previousTitles: snapshot.previousTitles,
    recentTitles: snapshot.recentTitles
  };
}

async function savePopupEntries(entries: PopupEntry[]): Promise<void> {
  const dataSource = hosts?.getDataSource();

  if (!dataSource?.isInitialized)
    return;

  const today = formatLocalDate(new Date());
  const repo = dataSource.getRepository(Task);
  const merged = new Map<string, number>();

  for (const entry of entries.slice(0, MAX_SAVED_ENTRIES)) {
    const title = entry?.title?.trim();
    const hours = roundHours(Number(entry?.hours) || 0);

    if (!title || hours <= 0)
      continue;

    merged.set(title, roundHours((merged.get(title) ?? 0) + hours));
  }

  for (const [title, hours] of merged) {
    const existing = await repo.findOne({ where: { date: today, title } });

    if (existing) {
      existing.hours = roundHours((Number(existing.hours) || 0) + hours);
      existing.adoWorkItemId = await adoWorkItemIdForTitle(dataSource, title) ?? existing.adoWorkItemId ?? null;
      await repo.save(existing);
    } else {
      await repo.save(repo.create({
        title,
        description: '',
        date: today,
        hours,
        adoWorkItemId: await adoWorkItemIdForTitle(dataSource, title)
      }));
    }
  }
}

async function resolvePopup(ruleId: string): Promise<void> {
  if (!ruleId)
    return;

  try {
    const now = new Date();
    const resolvedOn = formatLocalDate(now);

    await markResolved(ruleId, resolvedOn);
  } catch (resolveError) {
    console.error('Could not remember that this popup was resolved', resolveError);
  }

  closePopupWindow(ruleId);
}

function closePopupWindow(ruleId: string): void {
  const record = openPopups.find(popup => popup.ruleId === ruleId);

  if (!record || record.window.isDestroyed())
    return;

  record.resolved = true;

  if (record.dismissTimer)
    clearTimeout(record.dismissTimer);

  record.window.close();
}

async function markResolved(ruleId: string, date: string): Promise<void> {
  const dataSource = hosts?.getDataSource();

  if (!dataSource?.isInitialized)
    return;

  const repo = dataSource.getRepository(Setting);
  const settings = await repo.findOne({ where: { id: 1 } });

  if (!settings)
    return;

  const rules = parsePopupRules(settings.popupRules);
  const rule = rules.find(item => item.id === ruleId);

  if (!rule)
    return;

  if (rule.intervalMinutes > 0) {
    rule.lastTriggeredAt = new Date().toISOString();
  } else {
    if (rule.lastResolvedDate === date)
      return;

    rule.lastResolvedDate = date;
  }

  settings.popupRules = JSON.stringify(rules);
  await repo.save(settings);
}

function popupAlreadyHandledToday(rule: PopupRule, today: string, now: Date): boolean {
  if (rule.intervalMinutes > 0)
    return intervalStillWaiting(rule, now);

  return rule.lastResolvedDate === today;
}

function intervalStillWaiting(rule: PopupRule, now: Date): boolean {
  if (!rule.lastTriggeredAt)
    return false;

  const triggeredAt = Date.parse(rule.lastTriggeredAt);

  if (Number.isNaN(triggeredAt))
    return false;

  const elapsedMs = now.getTime() - triggeredAt;

  return elapsedMs < rule.intervalMinutes * MINUTES_PER_HOUR * 1000;
}

function closeAllPopups(suppressResolve: boolean): void {
  for (const popup of [...openPopups]) {
    popup.suppressResolve = suppressResolve;
    popup.resolved = suppressResolve;

    if (popup.dismissTimer)
      clearTimeout(popup.dismissTimer);

    if (!popup.window.isDestroyed())
      popup.window.close();
  }
}

async function readSettings(): Promise<Setting | null> {
  const dataSource = hosts?.getDataSource();

  if (!dataSource?.isInitialized)
    return null;

  return dataSource.getRepository(Setting).findOne({ where: { id: 1 } });
}

async function buildTimeSnapshot(dataSource: DataSource, settings: Setting): Promise<TimeSnapshot> {
  const today = formatLocalDate(new Date());
  const targetHours = dailyTargetHours(settings.maxHoursEnabled !== false, Number(settings.maxHoursPerDay) || FALLBACK_MAX_HOURS);
  const taskRepo = dataSource.getRepository(Task);
  const todayTasks = await taskRepo.find({ where: { date: today } });
  const todayHours = roundHours(todayTasks.reduce((sum, task) => sum + (Number(task.hours) || 0), 0));
  const previous = await taskRepo
    .createQueryBuilder('task')
    .where('task.date < :today', { today })
    .orderBy('task.date', 'DESC')
    .getOne();
  const previousDate = previous?.date ?? null;

  let previousTitles: string[] = [];

  if (previousDate) {
    const previousTasks = await taskRepo.find({
      where: { date: previousDate },
      order: { created_at: 'ASC' }
    });

    previousTitles = uniqueTitles(previousTasks);
  }

  const since = new Date();

  since.setDate(since.getDate() - RECENT_DAY_WINDOW);

  const recentTasks = await taskRepo
    .createQueryBuilder('task')
    .where('task.date >= :since AND task.date <= :today', { since: formatLocalDate(since), today })
    .orderBy('task.date', 'DESC')
    .addOrderBy('task.created_at', 'DESC')
    .getMany();
  const adoItems = await dataSource.getRepository(AdoWorkItem).find();
  const adoTitles = adoItems
    .filter(item => !!item.activeOn && !!item.title?.trim())
    .map(item => loggingTitle(item.adoId, item.title))
    .slice(0, 10);

  return {
    today,
    previousDate,
    targetHours,
    todayHours,
    remainingHours: roundHours(Math.max(0, targetHours - todayHours)),
    previousTitles,
    recentTitles: uniqueStrings([...adoTitles, ...uniqueTitles(recentTasks)])
  };
}

function uniqueTitles(tasks: Task[]): string[] {
  return uniqueStrings(tasks.map(task => task.title?.trim() ?? ''));
}

function uniqueStrings(values: string[]): string[] {
  const titles: string[] = [];

  for (const title of values) {
    if (title && !titles.includes(title))
      titles.push(title);
  }

  return titles;
}
