# 领袖选择界面改写实现说明

## 概述

本模组在原有测试mod基础上，实现了完整的领袖选择界面改写功能。对于图片领袖，系统会：
1. **阻止3D模型加载**：不加载3D模型，避免资源浪费和显示冲突
2. **显示图片覆盖层**：在3D模型区域显示图片，替代3D模型
3. **处理确认选择**：确保图片领袖在确认选择时也能正常工作

## 文件结构

### 核心模块

1. **`ui/shell/leader-select/custom-leader-config.js`**
   - 图片领袖识别系统
   - 提供 `isImageLeader(leaderID)` 判断是否为图片领袖
   - 提供 `getImagePath(leaderID)` 获取图片路径
   - 提供 `getImageDisplayConfig(leaderID)` 获取显示配置
   - **测试配置**：使用 `LEADER_YUNI` 和 `LEADER_YUNI_NEUTRAL.png` 进行测试

2. **`ui/shell/leader-select/leader-select-model-override.js`**
   - 重写 `LeaderSelectModelManager.showLeaderModels()`：对图片领袖跳过3D模型加载
   - 重写 `LeaderSelectModelManager.pickLeader()`：处理图片领袖的确认选择逻辑

3. **`ui/shell/create-panels/leader-select-panel-override.js`**
   - 重写 `LeaderSelectPanel.swapLeaderInfo()`：在图片领袖时显示图片覆盖层

4. **`ui/shell/create-panels/leader-overlay-image.js`**（已优化）
   - 支持从配置系统获取图片路径和显示配置
   - 改进的容器查找逻辑
   - 响应式调整支持

### 旧文件（保留用于兼容性）

- `ui/shell/create-panels/leader-overlay-test.js` - 已标记为遗留文件，功能已迁移

## 工作原理

### 1. 图片领袖识别

通过注册系统识别图片领袖。领袖通过 `registerImageLeader()` 函数注册到 `REGISTERED_IMAGE_LEADERS` 中。

测试领袖在 `leader-overlay-test.js` 中通过注册系统注册：
```javascript
window.CustomLeaderConfig.registerImageLeader(
  "LEADER_YUNI",
  "fs://game/leader-fallback/texture/LEADER_YUNI_NEUTRAL.png"
);
```
注意：偏移量由面板配置控制，不需要在注册时指定。

### 2. 阻止3D模型加载

在 `leader-select-model-override.js` 中：
- 重写 `showLeaderModels()`：检测到图片领袖时，清理之前的模型，激活相机，但不加载新模型
- 重写 `pickLeader()`：检测到图片领袖时，跳过动画序列和3D模型加载

### 3. 显示图片覆盖层

在 `leader-select-panel-override.js` 中：
- 重写 `swapLeaderInfo()`：在原始函数执行后，检测是否为图片领袖
- 如果是图片领袖：调用 `tryCreateImageOverlay()` 显示图片
- 如果不是图片领袖：调用 `tryRemoveImageOverlay()` 移除图片（如果存在）

### 4. 图片路径和配置

`leader-overlay-image.js` 现在支持：
- 从配置系统获取图片路径（通过 `getImageUrl(leaderID)`）
- 从配置系统获取显示配置（宽度倍数、偏移等）
- 如果没有配置，使用默认图片和配置

## 加载顺序

在 `leader-overlay-test.modinfo` 中，脚本按以下顺序加载：
1. `custom-leader-config.js` - 配置系统（必须首先加载）
2. `leader-overlay-image.js` - 图片覆盖层模块
3. `leader-select-model-override.js` - 模型管理器重写
4. `leader-select-panel-override.js` - 面板重写

## 使用方法

1. **测试当前实现**：
   - 在游戏中选择 `LEADER_YUNI`
   - 应该看到图片覆盖层显示，而不是3D模型

2. **添加新的图片领袖**：
   - 调用 `window.CustomLeaderConfig.registerImageLeader(leaderID, imagePath)`
   - 提供图片路径（偏移量由面板配置控制，不需要在注册时指定）
   - 将图片文件放入 `texture/` 目录
   - 示例：`leader-overlay-test.js` 中注册测试领袖的方式

3. **实现前缀识别**（未来）：
   - 修改 `isImageLeader()` 函数，使用前缀匹配
   - 实现 `getImagePath()` 函数，基于前缀生成图片路径

## 技术要点

1. **模块化设计**：各模块职责清晰，易于维护和扩展
2. **向后兼容**：保留旧文件，避免破坏现有功能
3. **配置驱动**：通过配置系统管理图片领袖，易于添加新领袖
4. **错误处理**：各模块都有完善的错误处理和日志记录

## 待实现功能

1. **前缀识别**：实现基于前缀的图片领袖识别
2. **自动路径查找**：实现基于前缀的图片路径自动查找逻辑
3. **更多界面支持**：扩展外交界面和主菜单的图片显示支持

## 调试

打开浏览器开发者工具（F12），查看控制台输出：
- `CustomLeaderConfig: ...` - 配置系统相关日志
- `Leader Select Model Override: ...` - 模型管理器重写相关日志
- `Leader Select Panel Override: ...` - 面板重写相关日志
- `Leader Overlay Image: ...` - 图片覆盖层相关日志

