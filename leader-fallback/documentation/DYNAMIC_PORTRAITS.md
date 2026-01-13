# 动态立绘切换功能

## 简介

本模组支持在外交对话过程中根据不同的场景和对话类型，动态切换领袖的立绘图片。这使得 2D 图片领袖可以像 3D 模型一样展示不同的表情和姿态。

## 支持的状态类型

### 基础状态
| 状态 | 说明 | 触发场景 |
|------|------|----------|
| `neutral` | 默认中立状态 | 普通外交对话、无特定场景时 |
| `friendly` | 友好状态 | 友好关系的领袖、友好对话 |
| `hostile` | 敌对状态 | 敌对关系的领袖、战争中 |

### 响应状态
| 状态 | 说明 | 触发场景 |
|------|------|----------|
| `response_positive` | 正面回应 | 接受提议、同意交易 |
| `response_negative` | 负面回应 | 拒绝提议、拒绝交易 |

### 特定场景状态
| 状态 | 说明 | 触发场景 |
|------|------|----------|
| `meeting` | 首次见面 | 第一次遇到该领袖时 |
| `declaring_war` | 宣战 | 主动或被动宣战时 |
| `defeated` | 被击败 | 领袖被击败投降时 |
| `accepting_peace` | 接受和平 | 接受和平条约时 |
| `rejecting_peace` | 拒绝和平 | 拒绝和平条约时 |

## 配置方法

### 方法一：自动推断模式（推荐）

只需提供基础立绘路径，系统会自动根据文件命名约定寻找状态立绘：

```javascript
// 简单注册 - 系统自动推断状态立绘
window.CustomLeaderConfig.registerImageLeader("LEADER_YOUR_LEADER", 
    "fs://game/mods/your-mod/textures/your_leader.png"
);
```

**命名约定：** 只需将状态立绘放在相同目录下，使用以下后缀命名：

| 状态 | 自动尝试的后缀（按优先级） |
|------|--------------------------|
| `declaring_war` / `hostile` | `_angry`, `_hostile`, `_war` |
| `friendly` | `_happy`, `_friendly`, `_smile` |
| `defeated` | `_defeated`, `_sad`, `_lose` |
| `accepting_peace` | `_peace`, `_happy`, `_friendly` |
| `rejecting_peace` | `_angry`, `_hostile`, `_reject` |
| `response_positive` | `_happy`, `_friendly`, `_positive` |
| `response_negative` | `_angry`, `_hostile`, `_negative` |

**示例：**
```
textures/
├── your_leader.png         ← 基础立绘（必需）
├── your_leader_angry.png   ← 宣战/敌对时自动使用
├── your_leader_happy.png   ← 友好/接受时自动使用
└── your_leader_sad.png     ← 战败时自动使用
```

系统会首先尝试 `_angry` 后缀，如果找不到会尝试 `_hostile`，以此类推。

### 方法二：显式配置模式

如果需要更精细的控制，或文件命名不符合约定，可以显式配置：

```javascript
window.CustomLeaderConfig.registerImageLeader("LEADER_YOUR_LEADER", {
    // 基础立绘（用于非外交场景或无状态匹配时）
    imagePath: "fs://game/mods/your-mod/textures/your_leader.png",
    
    // 设置为 false 可禁用自动推断，只使用下面显式配置的状态
    autoInferPaths: false,
    
    // 外交状态立绘（显式配置优先于自动推断）
    diplomacyStates: {
        // 基础状态
        "neutral": "fs://game/mods/your-mod/textures/your_leader_neutral.png",
        "friendly": "fs://game/mods/your-mod/textures/your_leader_friendly.png",
        "hostile": "fs://game/mods/your-mod/textures/your_leader_hostile.png",
        
        // 响应状态
        "response_positive": "fs://game/mods/your-mod/textures/your_leader_happy.png",
        "response_negative": "fs://game/mods/your-mod/textures/your_leader_angry.png",
        
        // 特定场景状态
        "meeting": "fs://game/mods/your-mod/textures/your_leader_greeting.png",
        "declaring_war": "fs://game/mods/your-mod/textures/your_leader_war.png",
        "defeated": "fs://game/mods/your-mod/textures/your_leader_defeated.png",
        "accepting_peace": "fs://game/mods/your-mod/textures/your_leader_peace.png",
        "rejecting_peace": "fs://game/mods/your-mod/textures/your_leader_reject.png"
    },
    
    // 可选：显示参数覆盖
    displayOverrides: {
        "diplomacy-left": {
            widthMultiplier: 2.5,
            leftOffsetMultiplier: 0.1,
            topOffsetMultiplier: 0.15
        },
        "diplomacy-right": {
            widthMultiplier: 2.5,
            leftOffsetMultiplier: 0.25,
            topOffsetMultiplier: 0.15
        }
    }
});
```

### 方法三：混合配置

可以同时使用自动推断和显式配置。显式配置的状态优先，未配置的状态使用自动推断：

```javascript
window.CustomLeaderConfig.registerImageLeader("LEADER_YOUR_LEADER", {
    imagePath: "fs://game/mods/your-mod/textures/your_leader.png",
    
    // 不设置 autoInferPaths 或设置为 true，启用自动推断
    
    // 只显式配置特殊状态，其他状态让系统自动推断
    diplomacyStates: {
        // 战败使用特殊图片（覆盖自动推断）
        "defeated": "fs://game/mods/your-mod/textures/your_leader_special_defeat.png"
    }
});
```

## 状态回退机制

如果某个状态没有配置对应的立绘，系统会自动回退到相近的状态：

```
declaring_war → hostile → neutral → imagePath
defeated → hostile → neutral → imagePath
rejecting_peace → hostile → neutral → imagePath
accepting_peace → friendly → neutral → imagePath
meeting → neutral → imagePath
response_positive → friendly → neutral → imagePath
response_negative → hostile → neutral → imagePath
```

## 手动更新立绘（高级用法）

如果需要在自定义场景中手动切换立绘，可以使用以下 API：

```javascript
// 方法1：通过领袖ID更新
window.DiplomacySequenceHandlers.updateLeaderPortrait(
    "LEADER_YOUR_LEADER",  // 领袖ID
    "right",               // 位置: "left" 或 "right"
    "hostile"              // 新状态
);

// 方法2：通过玩家ID更新（自动转换为领袖ID）
window.DiplomacySequenceHandlers.updatePlayerLeaderPortrait(
    playerID,    // 玩家ID (数字)
    "right",     // 位置
    "friendly"   // 新状态
);

// 方法3：直接使用 DiplomacyConfig
window.DiplomacyConfig.updateLeaderPortraitState(
    "LEADER_YOUR_LEADER",
    "left",
    "response_positive"
);
```

## 调试

### 查看当前状态

打开浏览器开发者工具（F12），在控制台中查看日志：

```
[Diplomacy Config] Sequence type "WAR" mapped to state "declaring_war"
[Diplomacy Config] Updated leader LEADER_ELAINA portrait to state "declaring_war" at position "right"
```

### 检查注册信息

```javascript
// 查看已注册的领袖
console.log(window.CustomLeaderConfig.getRegisteredLeaders());

// 检查特定领袖的配置
const config = window.CustomLeaderConfig.getLeaderConfig("LEADER_YOUR_LEADER");
console.log(config);
```

## 注意事项

1. **图片路径**：确保所有图片路径都是有效的，使用 `fs://game/mods/` 前缀
2. **图片尺寸**：建议所有状态的立绘使用相同的尺寸和比例，避免切换时的跳动
3. **透明背景**：推荐使用透明背景的 PNG 图片
4. **状态数量**：不需要配置所有状态，系统会自动回退到可用的状态
5. **性能**：立绘切换使用 CSS 背景图片替换，性能开销很小

## 版本历史

- **1.0.0**: 初始版本，支持基础的状态切换
- **1.1.0**: 添加更多状态类型（meeting, declaring_war, defeated, accepting_peace, rejecting_peace）
- **1.2.0**: 添加状态回退机制，优化 API
- **1.3.0**: 添加自动路径推断功能，支持按命名约定自动查找状态立绘
