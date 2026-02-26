# Rubick 重构计划

> 基于架构分析、安全修复和插件系统改进的综合重构方案

---

## 一、问题总结

### 1.1 项目当前状态

Rubick 是一个基于 Vue 3 + Electron 的桌面效率工具，采用插件化架构。当前项目存在以下问题：

### 1.2 识别的问题

| 序号 | 问题类别 | 问题描述                                                   | 严重程度 |
| ---- | -------- | ---------------------------------------------------------- | -------- |
| 1    | 架构设计 | `api.ts` 职责过重（467行），混合了窗口、插件、剪贴板等功能 | 🔴 高    |
| 2    | 架构设计 | 渲染进程与主进程耦合严重，直接调用 `ipcRenderer`           | 🔴 高    |
| 3    | 架构设计 | 插件逻辑分散在主进程和渲染进程，无统一管理                 | 🟡 中    |
| 4    | 性能问题 | 8处同步 IPC 调用（`sendSync`），阻塞渲染进程               | 🔴 高    |
| 5    | 安全风险 | 渲染进程直接执行系统命令 `exec(plugin.action)`             | 🔴 高    |
| 6    | 安全风险 | `executeJavaScript` 注入风险                               | 🟡 中    |
| 7    | 架构设计 | 插件直接使用 npm 安装，存在安全风险（可执行 postinstall）  | 🔴 高    |
| 8    | 扩展性   | 缺少状态管理，使用散乱的 `reactive()`                      | 🟡 中    |
| 9    | 扩展性   | 插件格式依赖 npm，企业场景受限                             | 🟡 中    |

---

## 二、重构目标

1. **架构分层** - 实现清晰的职责分离，主进程/渲染进程/核心逻辑分层
2. **性能优化** - 移除同步 IPC 调用，改用异步模式
3. **安全加固** - 渲染进程不直接执行系统命令，所有操作通过安全 IPC
4. **插件系统重构** - 设计独立插件格式，中心化管理
5. **可维护性提升** - 完善类型定义，统一状态管理

---

## 三、重构方案

### 3.1 整体架构

```
src/
├── main/                      # Electron 主进程
│   ├── index.ts              # 应用入口
│   ├── core/                  # 核心模块
│   │   ├── PluginHost.ts     # 插件宿主管理
│   │   ├── WindowManager.ts  # 窗口管理
│   │   ├── IPCHandler.ts     # IPC 统一处理
│   │   └── TrayManager.ts    # 托盘管理
│   ├── services/             # 服务层
│   │   ├── PluginService.ts
│   │   ├── DatabaseService.ts
│   │   ├── SearchService.ts
│   │   └── SystemService.ts  # 新增：系统操作服务
│   └── preload.ts            # 预加载脚本
│
├── renderer/                  # Vue 3 渲染进程
│   ├── stores/               # Pinia 状态管理
│   │   ├── plugin.ts
│   │   ├── search.ts
│   │   └── config.ts
│   ├── composables/          # 组合式函数
│   └── components/           # UI 组件
│
├── shared/                    # 共享类型和接口
│   ├── types/
│   └── constants/
│
└── core/                     # 纯业务逻辑
    ├── PluginHandler.ts
    ├── Database.ts
    └── AppFinder.ts
```

### 3.2 IPC 通信设计

```typescript
// 旧：sendSync (阻塞)
// 新：ipcMain.handle + ipcRenderer.invoke (异步)

// preload.ts - 暴露安全 API
contextBridge.exposeInMainWorld('rubick', {
  plugin: {
    install: (name: string) => ipcRenderer.invoke('plugin:install', name),
    list: () => ipcRenderer.invoke('plugin:list'),
  },
  system: {
    launchApp: (action: string) =>
      ipcRenderer.invoke('system:launchApp', action),
  },
  window: {
    setSize: (w: number, h: number) =>
      ipcRenderer.invoke('window:setSize', w, h),
  },
});
```

### 3.3 安全修复

| 问题              | 修复方案                                |
| ----------------- | --------------------------------------- |
| 渲染进程执行 exec | 移除 exec 调用，改用 IPC 委托主进程执行 |
| 路径验证          | 主进程添加应用路径白名单验证            |
| npm 脚本执行      | 插件安装时使用 `--ignore-scripts`       |
| executeJavaScript | 使用 contextBridge 替代                 |

### 3.4 插件系统

```
┌─────────────────────────────────────────────────────────────┐
│                      插件管理后端                            │
│  - 插件上传/审核                                             │
│  - GitHub 仓库拉取                                          │
│  - 自动编译构建                                              │
│  - 版本管理                                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Rubick 客户端                          │
│  - 插件下载器                                               │
│  - 插件加载器 (沙箱)                                        │
│  - 本地缓存                                                 │
└─────────────────────────────────────────────────────────────┘
```

**插件格式**：

```
rubick-plugin-demo-v1.0.0.zip
├── plugin.json      # 清单
├── dist/           # 预编译 JS
└── static/        # 静态资源
```

---

## 四、详细任务清单

### 阶段一：基础设施 (第1-2周)

#### 1.1 项目结构重组

- [ ] 1.1.1 创建 `shared/types/` 目录，定义 IPC 类型
- [ ] 1.1.2 创建 `main/services/` 目录
- [ ] 1.1.3 创建 `main/core/` 目录，移动核心模块
- [ ] 1.1.4 创建 `renderer/stores/` 目录 (Pinia)

#### 1.2 IPC 通信层

- [ ] 1.2.1 创建 `main/core/IPCHandler.ts` 统一处理 IPC
- [ ] 1.2.2 定义 IPC 通道常量
- [ ] 1.2.3 改造 `preload.ts` 使用 `contextBridge`
- [ ] 1.2.4 移除所有直接 `ipcRenderer` 调用

#### 1.3 类型定义

- [ ] 1.3.1 创建 `shared/types/ipc.ts`
- [ ] 1.3.2 创建 `shared/types/plugin.ts`
- [ ] 1.3.3 创建 `shared/types/config.ts`

---

### 阶段二：安全修复 (第2-3周)

#### 2.1 系统命令执行

- [ ] 2.1.1 创建 `main/services/SystemService.ts`
- [ ] 2.1.2 实现应用路径白名单验证
- [ ] 2.1.3 移除 `renderer/plugins-manager/index.ts` 中的 `exec` 调用
- [ ] 2.1.4 改造为 `window.rubick.system.launchApp()`

#### 2.2 插件安装安全

- [ ] 2.2.1 修改 `plugin-handler` 使用 `--ignore-scripts`
- [ ] 2.2.2 添加插件包完整性校验

#### 2.3 API 权限控制

- [ ] 2.3.1 设计插件权限系统
- [ ] 2.3.2 实现 `main/services/PermissionService.ts`

---

### 阶段三：性能优化 (第3-4周)

#### 3.1 异步 IPC 迁移

- [ ] 3.1.1 迁移 `sendSubInputChangeEvent` 为异步 + 防抖
- [ ] 3.1.2 迁移 `getFileIcon` 为异步
- [ ] 3.1.3 迁移其他 `sendSync` 调用
- [ ] 3.1.4 添加防抖/节流处理

#### 3.2 渲染进程优化

- [ ] 3.2.1 创建 Pinia store 替换 `reactive` 状态
- [ ] 3.2.2 实现 `renderer/stores/pluginStore.ts`
- [ ] 3.2.3 实现 `renderer/stores/searchStore.ts`

---

### 阶段四：插件系统重构 (第4-6周)

#### 4.1 插件格式设计

- [ ] 4.1.1 设计 `plugin.json` 清单格式
- [ ] 4.1.2 创建插件打包规范
- [ ] 4.1.3 实现插件解压和加载逻辑

#### 4.2 插件加载器

- [ ] 4.2.1 创建 `main/core/PluginLoader.ts`
- [ ] 4.2.2 实现插件沙箱环境
- [ ] 4.2.3 实现权限控制

#### 4.3 插件下载器

- [ ] 4.3.1 创建 `main/services/PluginDownloader.ts`
- [ ] 4.3.2 实现本地缓存管理
- [ ] 4.3.3 实现增量更新

---

### 阶段五：后端服务设计 (第6-8周)

> 此阶段为可选实现，取决于是否需要中心化管理

#### 5.1 后端 API

- [ ] 5.1.1 设计 RESTful API 接口
- [ ] 5.1.2 实现插件 CRUD
- [ ] 5.1.3 实现插件下载接口

#### 5.2 自动构建服务

- [ ] 5.2.1 设计构建工作流
- [ ] 5.2.2 实现 Git 仓库拉取
- [ ] 5.2.3 实现安全扫描
- [ ] 5.2.4 实现打包分发

#### 5.3 插件市场

- [ ] 5.3.1 设计前端界面
- [ ] 5.3.2 实现搜索和分类
- [ ] 5.3.3 实现插件审核流程

---

## 五、实施顺序

```
阶段一：基础设施 (1-2周)
  ├── 1.1 项目结构重组
  ├── 1.2 IPC 通信层
  └── 1.3 类型定义
            │
            ▼
阶段二：安全修复 (2-3周) 🔴 高优先级
  ├── 2.1 系统命令执行
  ├── 2.2 插件安装安全
  └── 2.3 API 权限控制
            │
            ▼
阶段三：性能优化 (3-4周)
  ├── 3.1 异步 IPC 迁移
  └── 3.2 渲染进程优化
            │
            ▼
阶段四：插件系统重构 (4-6周)
  ├── 4.1 插件格式设计
  ├── 4.2 插件加载器
  └── 4.3 插件下载器
            │
            ▼
阶段五：后端服务 (6-8周) - 可选
  ├── 5.1 后端 API
  ├── 5.2 自动构建
  └── 5.3 插件市场
```

---

## 六、风险与注意事项

### 6.1 兼容性风险

- 改动 IPC 通信可能影响现有插件
- 需要提供向后兼容层

### 6.2 回归测试

- 每个阶段完成后需要进行功能测试
- 重点测试：插件安装/卸载、主窗口操作、搜索功能

### 6.3 渐进式迁移

- 建议保留旧接口，逐步迁移
- 新旧接口并存期间做好日志记录

---

## 七、预期收益

| 指标         | 当前     | 重构后       |
| ------------ | -------- | ------------ |
| API 响应时间 | 可能阻塞 | < 16ms       |
| 安全漏洞数   | 3个高危  | 0            |
| 代码可维护性 | 低       | 高           |
| 插件安全性   | 低 (npm) | 高 (预编译)  |
| 状态可预测性 | 散乱     | 统一 (Pinia) |

---

> 计划生成时间：2026-02-26
> 预计总工期：8周 (可并行推进)
