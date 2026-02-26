export type PluginType = 'ui' | 'system' | 'app';

export interface Plugin {
  name: string;
  pluginName: string;
  version?: string;
  description?: string;
  author?: string;
  main?: string;
  logo?: string;
  icon?: string;
  indexPath?: string;
  tplPath?: string;
  pluginType?: PluginType;
  features?: Feature[];
  platform?: string[];
  permissions?: string[];
}

export interface Feature {
  code: string;
  name: string;
  type: 'text' | 'ui' | 'image';
  payload?: unknown;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: {
    name: string;
    email?: string;
  };
  icon?: string;
  main: string;
  permissions?: string[];
  features?: Feature[];
  platform?: string[];
  minRubickVersion?: string;
}

export interface PluginRuntime {
  manifest: PluginManifest;
  path: string;
  loaded: boolean;
}
