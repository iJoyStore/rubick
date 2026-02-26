import { ipcMain, BrowserWindow, IpcMainInvokeEvent } from 'electron';
import DBInstance from '../common/db';
import SystemService from '../services/SystemService';
import { runner, detach } from '../browsers';
import { screenCapture } from '@/core';
import getCopyFiles from '@/common/utils/getCopyFiles';
import getWinPosition from '../common/getWinPosition';
import { copyFilesToWindowsClipboard } from '../common/windowsClipboard';
import plist from 'plist';
import ks from 'node-key-sender';
import path from 'path';
import { PLUGIN_INSTALL_DIR as baseDir } from '@/common/constans/main';
import common from '@/common/utils/commonConst';
import fs from 'fs';

interface IPCResponse {
  code: 0 | -1;
  data?: unknown;
  msg?: string;
}

const sanitizeInputFiles = (input: unknown): string[] => {
  const candidates = Array.isArray(input)
    ? input
    : typeof input === 'string'
    ? [input]
    : [];
  return candidates
    .map((filePath) => (typeof filePath === 'string' ? filePath.trim() : ''))
    .filter((filePath) => {
      if (!filePath) return false;
      try {
        return fs.existsSync(filePath);
      } catch {
        return false;
      }
    });
};

const runnerInstance = runner();
const detachInstance = detach();

export class IPCHandler {
  private mainWindow: BrowserWindow | null = null;

  init(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;

    ipcMain.handle('msg-trigger', async (event, arg) => {
      const window = arg.winId ? BrowserWindow.fromId(arg.winId) : mainWindow;
      const action = arg?.type;

      const handler = this.getHandler(action);
      if (!handler) {
        return { code: -1, msg: `unknown api action: ${String(action)}` };
      }

      try {
        const data = await handler.call(this, arg, window, event);
        return { code: 0, data };
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[IPCHandler] ${action} error:`, error);
        return { code: -1, msg };
      }
    });

    this.setupMainWindowHooks(mainWindow);
  }

  private getHandler(
    action: string
  ):
    | ((arg: any, window: BrowserWindow, event: IpcMainInvokeEvent) => unknown)
    | null {
    const handlers: Record<
      string,
      (arg: any, window: BrowserWindow, event: IpcMainInvokeEvent) => unknown
    > = {
      dbGet: this.dbGet,
      dbPut: this.dbPut,
      dbRemove: this.dbRemove,
      dbBulkDocs: this.dbBulkDocs,
      dbAllDocs: this.dbAllDocs,
      getPath: this.getPath,
      showNotification: this.showNotification,
      copyImage: this.copyImage,
      copyText: this.copyText,
      copyFile: this.copyFile,
      getFeatures: this.getFeatures,
      setFeature: this.setFeature,
      removeFeature: this.removeFeature,
      screenCapture: this.screenCapture,
      getCopyFiles: this.getCopyFiles,
      simulateKeyboardTap: this.simulateKeyboardTap,
      getLocalId: this.getLocalId,
      shellShowItemInFolder: this.shellShowItemInFolder,
      shellBeep: this.shellBeep,
      getFileIcon: this.getFileIcon,
      launchApp: this.launchApp,
      loadPlugin: this.loadPlugin,
      openPlugin: this.openPlugin,
      removePlugin: this.removePlugin,
      openPluginDevTools: this.openPluginDevTools,
      hideMainWindow: this.hideMainWindow,
      showMainWindow: this.showMainWindow,
      showOpenDialog: this.showOpenDialog,
      showSaveDialog: this.showSaveDialog,
      setExpendHeight: this.setExpendHeight,
      setSubInput: this.setSubInput,
      removeSubInput: this.removeSubInput,
      setSubInputValue: this.setSubInputValue,
      subInputBlur: this.subInputBlur,
      sendSubInputChangeEvent: this.sendSubInputChangeEvent,
      detachPlugin: this.detachPlugin,
      detachInputChange: this.detachInputChange,
      addLocalStartPlugin: this.addLocalStartPlugin,
      removeLocalStartPlugin: this.removeLocalStartPlugin,
      windowMoving: this.windowMoving,
    };

    return handlers[action] || null;
  }

  private setupMainWindowHooks(mainWindow: BrowserWindow): void {
    mainWindow.on('show', () => {
      runnerInstance.executeHooks('Show', null);
    });

    mainWindow.on('hide', () => {
      runnerInstance.executeHooks('Hide', null);
    });

    mainWindow.webContents.on('before-input-event', (event, input) => {
      this.handleEscapeKey(event, input, mainWindow);
    });
  }

  private handleEscapeKey(
    event: Electron.Input,
    input: Electron.Input,
    mainWindow: BrowserWindow
  ): void {
    if (input.type !== 'keyDown') return;
    if (!(input.meta || input.control || input.shift || input.alt)) {
      if (input.key === 'Escape') {
        if (this.getCurrentPlugin()) {
          this.removePlugin(null, mainWindow);
        } else {
          mainWindow.hide();
        }
      }
    }
  }

  private getCurrentPlugin(): unknown {
    return (this as unknown as { currentPlugin: unknown }).currentPlugin;
  }

  private setCurrentPlugin(plugin: unknown): void {
    (this as unknown as { currentPlugin: unknown }).currentPlugin = plugin;
  }

  private dbGet(arg: { data: { id: string } }): unknown {
    return DBInstance.get('rubick', arg.data.id);
  }

  private dbPut(arg: { data: unknown }): unknown {
    return DBInstance.put('rubick', arg.data as any);
  }

  private dbRemove(arg: { doc: unknown }): unknown {
    return DBInstance.remove('rubick', arg.doc as any);
  }

  private dbBulkDocs(arg: { docs: unknown[] }): unknown {
    return DBInstance.bulkDocs('rubick', arg.docs as any[]);
  }

  private dbAllDocs(arg: { key?: string | string[] }): unknown {
    return DBInstance.allDocs('rubick', arg.key);
  }

  private getPath(_arg: unknown, _window: BrowserWindow): string {
    const { app } = require('electron');
    return app.getPath('home');
  }

  private showNotification(arg: { data: { body: string } }): void {
    const { Notification } = require('electron');
    const plugin = this.getCurrentPlugin() as {
      pluginName?: string;
      logo?: string;
    } | null;
    if (!Notification.isSupported()) return;
    const body =
      typeof arg.data.body === 'string' ? arg.data.body : String(arg.data.body);
    const notify = new Notification({
      title: plugin?.pluginName || null,
      body,
      icon: plugin?.logo || null,
    });
    notify.show();
  }

  private copyImage(arg: { data: { img: string } }): void {
    const { nativeImage, clipboard } = require('electron');
    const image = nativeImage.createFromDataURL(arg.data.img);
    clipboard.writeImage(image);
  }

  private copyText(arg: { data: { text: unknown } }): boolean {
    const { clipboard } = require('electron');
    clipboard.writeText(String(arg.data.text));
    return true;
  }

  private copyFile(arg: { data?: { file?: unknown } }): boolean {
    const targetFiles = sanitizeInputFiles(arg.data?.file);
    if (!targetFiles.length) return false;

    const { clipboard } = require('electron');
    const platform = process.platform;

    if (platform === 'darwin') {
      try {
        clipboard.writeBuffer(
          'NSFilenamesPboardType',
          Buffer.from(plist.build(targetFiles))
        );
        return true;
      } catch {
        return false;
      }
    }

    if (platform === 'win32') {
      return copyFilesToWindowsClipboard(targetFiles);
    }

    return false;
  }

  private getFeatures(): unknown {
    const plugin = this.getCurrentPlugin() as { features?: unknown } | null;
    return plugin?.features;
  }

  private setFeature(
    arg: { data: { feature: unknown } },
    window: BrowserWindow
  ): boolean {
    const plugin = this.getCurrentPlugin() as { features?: unknown[] };
    this.setCurrentPlugin({
      ...plugin,
      features: (() => {
        let has = false;
        plugin.features?.some((feature: any) => {
          has = feature.code === arg.data.feature.code;
          return has;
        });
        if (!has) {
          return [...(plugin.features || []), arg.data.feature];
        }
        return plugin.features;
      })(),
    });
    window.webContents.executeJavaScript(
      `window.updatePlugin(${JSON.stringify({
        currentPlugin: this.getCurrentPlugin(),
      })})`
    );
    return true;
  }

  private removeFeature(
    arg: { data: { code: unknown } },
    window: BrowserWindow
  ): boolean {
    const plugin = this.getCurrentPlugin() as { features?: unknown[] };
    this.setCurrentPlugin({
      ...plugin,
      features: plugin.features?.filter((feature: any) => {
        if (arg.data.code?.type) {
          return feature.code?.type !== arg.data.code.type;
        }
        return feature.code !== arg.data.code;
      }),
    });
    window.webContents.executeJavaScript(
      `window.updatePlugin(${JSON.stringify({
        currentPlugin: this.getCurrentPlugin(),
      })})`
    );
    return true;
  }

  private screenCapture(arg: unknown, window: BrowserWindow): void {
    screenCapture(window, (img: string) => {
      runnerInstance.executeHooks('ScreenCapture', { data: img });
    });
  }

  private getCopyFiles(): unknown {
    return getCopyFiles();
  }

  private simulateKeyboardTap(arg: {
    data: { key: string; modifier?: string[] };
  }): void {
    let keys = [arg.data.key.toLowerCase()];
    if (
      arg.data.modifier &&
      Array.isArray(arg.data.modifier) &&
      arg.data.modifier.length > 0
    ) {
      keys = arg.data.modifier.concat(keys);
      ks.sendCombination(keys);
    } else {
      ks.sendKeys(keys);
    }
  }

  private getLocalId(): string {
    const { app } = require('electron');
    return encodeURIComponent(app.getPath('home'));
  }

  private shellShowItemInFolder(arg: { data: { path: string } }): boolean {
    const { shell } = require('electron');
    shell.showItemInFolder(arg.data.path);
    return true;
  }

  private shellBeep(): boolean {
    const { shell } = require('electron');
    shell.beep();
    return true;
  }

  private async getFileIcon(arg: {
    data: { path: string };
  }): Promise<string | null> {
    return SystemService.getFileIcon(arg.data.path);
  }

  private async launchApp(arg: {
    data?: { action?: string };
  }): Promise<IPCResponse> {
    if (!arg?.data?.action) {
      return { code: -1, msg: 'Missing action parameter' };
    }
    return SystemService.launchApp(arg.data.action);
  }

  private loadPlugin(arg: { data: unknown }, window: BrowserWindow): void {
    const plugin = arg.data as { name?: string };
    window.webContents.executeJavaScript(
      `window.loadPlugin(${JSON.stringify(plugin)})`
    );
    this.openPlugin(arg, window);
  }

  private openPlugin(arg: { data: unknown }, window: BrowserWindow): void {
    const plugin = arg.data as {
      name?: string;
      platform?: string[];
      main?: string;
      logo?: string;
      indexPath?: string;
      pluginName?: string;
    };

    if (plugin.platform && !plugin.platform.includes(process.platform)) {
      const { Notification } = require('electron');
      new Notification({
        title: `插件不支持当前 ${process.platform} 系统`,
        body: `插件仅支持 ${plugin.platform.join(',')}`,
        icon: plugin.logo,
      }).show();
      return;
    }

    window.setSize(window.getSize()[0], 60);
    this.removePlugin(null, window);

    if (!plugin.main) {
      plugin.indexPath = common.dev()
        ? 'http://localhost:8083/#/'
        : `file://${__static}/tpl/index.html`;
    }

    if (plugin.name === 'rubick-system-feature') {
      plugin.logo = plugin.logo || `file://${__static}/logo.png`;
      plugin.indexPath = common.dev()
        ? 'http://localhost:8081/#/'
        : `file://${__static}/feature/index.html`;
    } else if (!plugin.indexPath) {
      const pluginPath = path.resolve(
        baseDir,
        'node_modules',
        plugin.name || ''
      );
      plugin.indexPath = `file://${path.join(
        pluginPath,
        './',
        plugin.main || ''
      )}`;
    }

    runnerInstance.init(plugin as any, window);
    this.setCurrentPlugin(plugin);
    window.webContents.executeJavaScript(
      `window.setCurrentPlugin(${JSON.stringify({
        currentPlugin: this.getCurrentPlugin(),
      })})`
    );
    window.show();

    const view = runnerInstance.getView();
    if (view && !view.inited) {
      view.webContents.on('before-input-event', (event, input) => {
        this.handleEscapeKey(event, input, window);
      });
    }
  }

  private removePlugin(_arg: unknown, window: BrowserWindow | null): void {
    if (!window) return;
    runnerInstance.removeView(window);
    this.setCurrentPlugin(null);
  }

  private openPluginDevTools(): void {
    const view = runnerInstance.getView();
    if (view) {
      view.webContents.openDevTools({ mode: 'detach' });
    }
  }

  private hideMainWindow(_arg: unknown, window: BrowserWindow): void {
    window.hide();
  }

  private showMainWindow(_arg: unknown, window: BrowserWindow): void {
    window.show();
  }

  private showOpenDialog(
    arg: { data: unknown },
    window: BrowserWindow
  ): unknown {
    const { dialog } = require('electron');
    return dialog.showOpenDialogSync(window, arg.data as any);
  }

  private showSaveDialog(
    arg: { data: unknown },
    window: BrowserWindow
  ): unknown {
    const { dialog } = require('electron');
    return dialog.showSaveDialogSync(window, arg.data as any);
  }

  private setExpendHeight(
    arg: { data: { height: number } },
    window: BrowserWindow
  ): void {
    const targetHeight = arg.data.height;
    window.setSize(window.getSize()[0], targetHeight);

    const { screen } = require('electron');
    const screenPoint = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(screenPoint);
    const position =
      window.getPosition()[1] + targetHeight > display.bounds.height
        ? targetHeight - 60
        : 0;
    window.webContents.executeJavaScript(
      `window.setPosition && typeof window.setPosition === "function" && window.setPosition(${position})`
    );
  }

  private setSubInput(
    arg: { data: { placeholder?: string } },
    window: BrowserWindow
  ): void {
    window.webContents.executeJavaScript(
      `window.setSubInput(${JSON.stringify({
        placeholder: arg.data.placeholder,
      })})`
    );
  }

  private removeSubInput(_arg: unknown, window: BrowserWindow): void {
    window.webContents.executeJavaScript('window.removeSubInput()');
  }

  private setSubInputValue(
    arg: { data: { text: string } },
    window: BrowserWindow
  ): void {
    window.webContents.executeJavaScript(
      `window.setSubInputValue(${JSON.stringify({ value: arg.data.text })})`
    );
    this.sendSubInputChangeEvent({ data: { text: arg.data.text } }, window);
  }

  private subInputBlur(): void {
    const view = runnerInstance.getView();
    if (view) {
      view.webContents.focus();
    }
  }

  private sendSubInputChangeEvent(
    arg: { data: { text?: string } },
    _window: BrowserWindow
  ): void {
    runnerInstance.executeHooks('SubInputChange', arg.data);
  }

  private detachPlugin(_arg: unknown, window: BrowserWindow): void {
    const plugin = this.getCurrentPlugin();
    if (!plugin) return;

    const view = window.getBrowserView();
    if (!view) return;

    window.setBrowserView(null);
    window.webContents
      .executeJavaScript('window.getMainInputInfo()')
      .then((res: unknown) => {
        detachInstance.init(
          { ...(plugin as object), subInput: res } as any,
          window.getBounds(),
          view
        );
        window.webContents.executeJavaScript('window.initRubick()');
        window.setSize(window.getSize()[0], 60);
        this.setCurrentPlugin(null);
      });
  }

  private detachInputChange(arg: { data: unknown }): void {
    this.sendSubInputChangeEvent(
      { data: arg.data as { text: string } },
      null as any
    );
  }

  private addLocalStartPlugin(
    arg: { data: { plugin: unknown } },
    window: BrowserWindow
  ): void {
    window.webContents.executeJavaScript(
      `window.addLocalStartPlugin(${JSON.stringify({
        plugin: arg.data.plugin,
      })})`
    );
  }

  private removeLocalStartPlugin(
    arg: { data: { plugin: unknown } },
    window: BrowserWindow
  ): void {
    window.webContents.executeJavaScript(
      `window.removeLocalStartPlugin(${JSON.stringify({
        plugin: arg.data.plugin,
      })})`
    );
  }

  private windowMoving(
    arg: {
      data: { mouseX: number; mouseY: number; width: number; height: number };
    },
    window: BrowserWindow,
    event: Electron.IpcMainEvent
  ): void {
    const { screen } = require('electron');
    const { x, y } = screen.getCursorScreenPoint();
    let originWindow = BrowserWindow.fromWebContents(event.sender);
    if (originWindow !== window) originWindow = detachInstance.getWindow();
    if (!originWindow) return;
    originWindow.setBounds({
      x: x - arg.data.mouseX,
      y: y - arg.data.mouseY,
      width: arg.data.width,
      height: arg.data.height,
    });
    getWinPosition.setPosition(x - arg.data.mouseX, y - arg.data.mouseY);
  }
}

export default new IPCHandler();
