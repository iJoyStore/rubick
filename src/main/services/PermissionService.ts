export type PermissionType =
  | 'clipboard'
  | 'notification'
  | 'storage'
  | 'file'
  | 'shell'
  | 'window'
  | 'screenCapture';

export interface PluginPermission {
  type: PermissionType;
  allowed: boolean;
  reason?: string;
}

export interface PluginPermissions {
  [pluginName: string]: PermissionType[];
}

export class PermissionService {
  private permissions: Map<string, Set<PermissionType>> = new Map();

  private readonly DEFAULT_PERMISSIONS: PermissionType[] = [
    'clipboard',
    'notification',
    'storage',
    'window',
  ];

  private readonly DANGEROUS_PERMISSIONS: PermissionType[] = [
    'shell',
    'file',
    'screenCapture',
  ];

  registerPlugin(
    pluginName: string,
    requestedPermissions: PermissionType[] = []
  ): void {
    const permissions = new Set<PermissionType>([
      ...this.DEFAULT_PERMISSIONS,
      ...requestedPermissions.filter((p) => this.isPermissionAllowed(p)),
    ]);
    this.permissions.set(pluginName, permissions);
  }

  unregisterPlugin(pluginName: string): void {
    this.permissions.delete(pluginName);
  }

  hasPermission(pluginName: string, permission: PermissionType): boolean {
    const pluginPerms = this.permissions.get(pluginName);
    if (!pluginPerms) {
      return this.DEFAULT_PERMISSIONS.includes(permission);
    }
    return pluginPerms.has(permission);
  }

  getPluginPermissions(pluginName: string): PermissionType[] {
    const pluginPerms = this.permissions.get(pluginName);
    return pluginPerms
      ? Array.from(pluginPerms)
      : [...this.DEFAULT_PERMISSIONS];
  }

  private isPermissionAllowed(permission: PermissionType): boolean {
    return !this.DANGEROUS_PERMISSIONS.includes(permission);
  }

  checkPermission(
    pluginName: string,
    permission: PermissionType
  ): PluginPermission {
    const has = this.hasPermission(pluginName, permission);

    return {
      type: permission,
      allowed: has,
      reason: !has ? `Permission ${permission} not granted` : undefined,
    };
  }
}

export default new PermissionService();
