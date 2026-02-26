# AGENTS.md - Rubick Development Guide

## Project Overview

Rubick is an open-source plugin-based desktop efficiency toolbox built with Vue 3 + Electron. Plugins are npm-based, supporting WebDAV sync and intranet deployment.

## Build/Lint/Test Commands

### Development

```bash
npm run serve          # Vue development server
npm run electron:serve # Electron development mode with hot reload
```

### Build & Release

```bash
npm run build          # Build Vue app
npm run electron:build # Build Electron app
npm run release        # Release Electron app (alias to electron:build)
```

### Linting

```bash
npm run lint           # Run ESLint with Vue CLI
```

### Single Test

> **Note**: This project currently has no test suite. Do not write test code without first establishing tests.

### Dependencies

```bash
npm install            # Install dependencies
```

---

## Code Style Guidelines

### General Principles

- Use Vue 3 Composition API with `<script setup>` syntax for Vue components
- Prefer functional patterns over class-based patterns in renderer
- Main process uses class-based patterns (see `src/main/common/api.ts`)

### Formatting (Prettier)

- 2 spaces for indentation
- Single quotes for strings
- Semicolons required
- Trailing commas (es5 style)
- 80 character line width
- Arrow functions: always use parentheses for params

### TypeScript

- Strict mode enabled in tsconfig.json
- Use explicit types; avoid `any` when possible
- Path aliases: use `@/*` to import from `src/*`

```typescript
// Good
import PluginHandler from '@/core/plugin-handler';
import { AdapterInfo } from '@/core/plugin-handler/types';

// Avoid
import PluginHandler from '../../../core/plugin-handler';
```

### Naming Conventions

- **Components/Files**: PascalCase (e.g., `SearchBar.vue`, `pluginHandler.ts`)
- **Classes**: PascalCase (e.g., `class API`, `class AdapterHandler`)
- **Functions/Variables**: camelCase (e.g., `initPlugins`, `searchValue`)
- **Constants**: UPPER_SNAKE_CASE or camelCase (e.g., `PLUGIN_HISTORY`, `baseDir`)
- **Private methods**: prefix with underscore (e.g., `_init()`)

### Imports

1. Vue/External imports first
2. Relative imports (`@/` path aliases) second
3. Local relative imports last
4. Group by: imports, then blank line, then exports

```typescript
import { ref, watch, toRaw } from 'vue';
import { message } from 'ant-design-vue';
import Result from './components/result.vue';
import Search from './components/search.vue';
import getWindowHeight from '@/common/utils/getWindowHeight';
import createPluginManager from './plugins-manager';
import { PLUGIN_HISTORY } from '@/common/constans/renderer';
import localConfig from './confOp';
```

### Vue Components

- Use `<script setup lang="ts">` for all Vue components
- Use `<style lang="less">` for styles
- Define props with `defineProps<{}>()` or `withDefaults`
- Emit with `defineEmits<{}>()`

```vue
<template>
  <div @click="handleClick">{{ message }}</div>
</template>

<script setup lang="ts">
interface Props {
  title: string;
  count?: number;
}

const props = withDefaults(defineProps<Props>(), {
  count: 0,
});

const emit = defineEmits<{
  (e: 'update', value: string): void;
}>();

const message = 'Hello';
const handleClick = () => emit('update', message);
</script>

<style lang="less">
.foo {
  color: red;
}
</style>
```

### Error Handling

- Use try-catch for async operations
- Return error objects with code and message for API responses

```typescript
try {
  const data = await someAsyncOperation();
  return { code: 0, data };
} catch (e) {
  console.error(e);
  return { code: -1, msg: 'Operation failed' };
}

// For file operations, sanitize inputs
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
```

### File Organization

- `src/main/` - Electron main process code
- `src/renderer/` - Vue renderer code (UI, components)
- `src/core/` - Core business logic (plugins, DB, screen capture)
- `src/common/` - Shared utilities and constants
- Type definitions: `src/*/@types/*.d.ts`

### Electron-Specific

- Use `electron` for main process APIs
- Use `@electron/remote` for renderer to access main process
- IPC communication via `ipcMain.on` and `ipcRenderer.sendSync`
- BrowserWindow created via factory functions in `src/main/browsers/`

### ESLint Rules (extends)

- `plugin:vue/vue3-essential`
- `eslint:recommended`
- `@vue/typescript/recommended`
- `@vue/prettier`

---

## Common Patterns

### Accessing Main Process from Renderer

```typescript
const remote = window.require('@electron/remote');
remote.getGlobal('SOME_GLOBAL');
window.rubick.someApiMethod();
```

### Plugin Management

- Plugins installed in `PLUGIN_INSTALL_DIR` (see `@/common/constans/main`)
- Use `AdapterHandler` class from `@/core/plugin-handler` for plugin operations
- Plugin info stored in `plugin.json` within plugin package

### Database

- Uses PouchDB (`src/core/db/`)
- WebDAV sync support in `src/core/db/webdav.ts`
- Access via `window.rubick.db.get()` / `window.rubick.db.set()`

---

## Important Files

| Path                            | Purpose                                  |
| ------------------------------- | ---------------------------------------- |
| `src/main/index.ts`             | Electron app entry, lifecycle management |
| `src/main/common/api.ts`        | Main API exposed to renderer             |
| `src/core/plugin-handler/`      | Plugin management system                 |
| `src/renderer/App.vue`          | Main Vue app component                   |
| `src/renderer/plugins-manager/` | Plugin manager for renderer              |
| `src/common/constans/`          | Shared constants                         |
