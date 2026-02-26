export type IPCChannel =
  | 'plugin:install'
  | 'plugin:uninstall'
  | 'plugin:list'
  | 'plugin:getInfo'
  | 'plugin:update'
  | 'system:launchApp'
  | 'system:getFileIcon'
  | 'db:get'
  | 'db:put'
  | 'db:remove'
  | 'db:bulkDocs'
  | 'db:allDocs'
  | 'window:setSize'
  | 'window:show'
  | 'window:hide'
  | 'window:openDialog'
  | 'window:saveDialog'
  | 'clipboard:readText'
  | 'clipboard:writeText'
  | 'clipboard:readImage'
  | 'clipboard:writeImage'
  | 'clipboard:readFile';

export interface IPCRequest {
  channel: IPCChannel;
  data?: unknown;
}

export interface IPCResponse<T = unknown> {
  code: 0 | -1;
  data?: T;
  msg?: string;
}

export interface IPCInvokeHandler {
  (
    event: Electron.IpcMainInvokeEvent,
    ...args: unknown[]
  ): Promise<IPCResponse>;
}
