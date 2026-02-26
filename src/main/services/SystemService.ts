import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

const execAsync = promisify(exec);

interface LaunchResult {
  code: 0 | -1;
  msg?: string;
}

export class SystemService {
  private readonly ALLOWED_APP_DIRS: Map<string, string[]> = new Map([
    [
      'darwin',
      [
        '/Applications',
        '/System/Applications',
        '/System/Applications/Utilities',
        '/usr/bin',
        '/usr/local/bin',
        '/opt/homebrew/bin',
        path.join(app.getPath('home'), 'Applications'),
      ],
    ],
    [
      'win32',
      [
        'C:\\Program Files',
        'C:\\Program Files (x86)',
        'C:\\Windows\\System32',
        'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs',
      ],
    ],
    [
      'linux',
      [
        '/usr/bin',
        '/usr/local/bin',
        '/opt',
        path.join(app.getPath('home'), '.local', 'share', 'applications'),
      ],
    ],
  ]);

  private readonly DANGEROUS_PATTERNS = [
    /;\s*rm\s+-rf/i,
    /;\s*del\s+/i,
    /;\s*format/i,
    /;\s*mkfs/i,
    /\|\s*sh/i,
    /&&\s*rm/i,
    /\$\(/,
    /`.*rm/i,
    />\s*\/dev\/sd/i,
    /dd\s+if=/i,
  ];

  async launchApp(action: string): Promise<LaunchResult> {
    try {
      const sanitizedAction = this.sanitizeAction(action);
      if (!sanitizedAction) {
        return { code: -1, msg: '无效的应用启动命令' };
      }

      const appPath = this.extractAppPath(sanitizedAction);
      if (!appPath) {
        return { code: -1, msg: '无法解析应用路径' };
      }

      if (!this.isPathAllowed(appPath)) {
        return { code: -1, msg: '不允许启动此应用' };
      }

      const platform = process.platform;
      let command: string;

      if (platform === 'darwin') {
        command = `open "${appPath.replace(/"/g, '\\"')}"`;
      } else if (platform === 'win32') {
        command = `start "" "${appPath}"`;
      } else {
        command = `xdg-open "${appPath}"`;
      }

      await execAsync(command);
      return { code: 0 };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : '启动应用失败';
      return { code: -1, msg: errMsg };
    }
  }

  private sanitizeAction(action: string): string | null {
    if (!action || typeof action !== 'string') {
      return null;
    }

    const trimmed = action.trim();
    if (trimmed.length === 0 || trimmed.length > 1000) {
      return null;
    }

    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(trimmed)) {
        console.warn(`[SystemService] Blocked dangerous pattern: ${pattern}`);
        return null;
      }
    }

    return trimmed;
  }

  private extractAppPath(action: string): string {
    const platform = process.platform;

    if (platform === 'darwin') {
      const openMatch = action.match(/open\s+(.+)/);
      if (openMatch) {
        return openMatch[1].trim().replace(/\\ /g, ' ');
      }
    } else if (platform === 'win32') {
      const startMatch = action.match(/start\s+""\s+"(.+)"/);
      if (startMatch) {
        return startMatch[1].trim();
      }
      const directMatch = action.match(/^"(.+)"$/) || action.match(/^(.+)$/);
      if (directMatch) {
        return directMatch[1].trim();
      }
    } else {
      const xdgMatch = action.match(/xdg-open\s+(.+)/);
      if (xdgMatch) {
        return xdgMatch[1].trim().replace(/\\ /g, ' ');
      }
    }

    return action;
  }

  private isPathAllowed(appPath: string): boolean {
    const platform = process.platform;
    const allowedDirs = this.ALLOWED_APP_DIRS.get(platform) || [];

    const normalizedPath = path.normalize(appPath);

    for (const dir of allowedDirs) {
      const normalizedDir = path.normalize(dir);
      if (normalizedPath.startsWith(normalizedDir)) {
        if (fs.existsSync(normalizedPath)) {
          return true;
        }
      }
    }

    if (platform === 'darwin' && normalizedPath.endsWith('.app')) {
      return fs.existsSync(normalizedPath);
    }

    return false;
  }

  async getFileIcon(filePath: string): Promise<string | null> {
    try {
      const { app } = await import('electron');
      const icon = await app.getFileIcon(filePath, { size: 'normal' });
      return icon.toDataURL();
    } catch (error) {
      console.error('[SystemService] Failed to get file icon:', error);
      return null;
    }
  }
}

export default new SystemService();
