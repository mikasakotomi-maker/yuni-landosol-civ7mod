/**
 * @file custom-leader-config.js
 * @description Custom Leader Config: Configuration system for image-based leaders
 */

// 图片领袖ID前缀（用于识别图片领袖）
// 如果领袖ID以此前缀开头，则认为是图片领袖
const IMAGE_LEADER_PREFIX = "LEADER_"; // 暂时使用所有LEADER_前缀作为测试，后续可以改为特定前缀如 "LEADER_CUSTOM_"

/**
 * 自动立绘后缀模板配置
 * 当mod没有明确配置diplomacyStates时，系统会自动根据基础图片路径尝试这些后缀
 * 
 * 例如基础路径为: fs://game/xxx/textures/portraits/fbl_Leader.png
 * 对于 "declaring_war" 状态，系统会按顺序尝试:
 *   1. fs://game/xxx/textures/portraits/fbl_Leader_angry.png
 *   2. fs://game/xxx/textures/portraits/fbl_Leader_hostile.png
 *   3. fs://game/xxx/textures/portraits/fbl_Leader_war.png
 * 
 * 如果都找不到，会回退到状态回退链的下一个状态
 */
const AUTO_PORTRAIT_SUFFIX_TEMPLATES = {
	// 宣战状态: 尝试 _angry, _hostile, _war, _declaring_war
	"declaring_war": ["_angry", "_hostile", "_war", "_declaring_war"],
	
	// 敌对状态: 尝试 _angry, _hostile
	"hostile": ["_angry", "_hostile"],
	
	// 友好状态: 尝试 _happy, _friendly, _smile
	"friendly": ["_happy", "_friendly", "_smile"],
	
	// 战败状态: 尝试 _defeated, _sad, _lose
	"defeated": ["_defeated", "_sad", "_lose"],
	
	// 接受和平: 尝试 _peace, _happy, _friendly
	"accepting_peace": ["_peace", "_happy", "_friendly"],
	
	// 拒绝和平: 尝试 _angry, _hostile, _reject
	"rejecting_peace": ["_angry", "_hostile", "_reject"],
	
	// 正面回应: 尝试 _happy, _friendly, _positive
	"response_positive": ["_happy", "_friendly", "_positive"],
	
	// 负面回应: 尝试 _angry, _hostile, _negative
	"response_negative": ["_angry", "_hostile", "_negative"],
	
	// 会面: 尝试 _meeting, _neutral
	"meeting": ["_meeting", "_neutral"],
	
	// 中立: 不需要后缀（使用基础图片）
	"neutral": []
};

// 已验证存在的自动推断路径缓存 (避免重复验证)
// 注意: 游戏中无法真正验证文件是否存在，这个缓存用于存储已知有效的路径
const AUTO_INFERRED_PATH_CACHE = {};

// 面板特定的显示配置（不同面板中模型位置和大小不同）
// 注意：age-select、civ-select、game-setup 会自动映射到 setup-panels（见 getImageDisplayConfig 函数）
const PANEL_DISPLAY_CONFIGS = {
	"leader-select": {
		widthMultiplier: 0.8,
		leftOffsetMultiplier: -0.58,  // 左对齐时，0表示图片左边缘在屏幕左边缘
		topOffsetMultiplier: -0.02, 
		position: "center"  
	},
	"setup-panels": {
		widthMultiplier: 1.25,  // 时代、文明和游戏设置选择面板中模型更大且在中间（统一配置）
		leftOffsetMultiplier: -0.21,  // 左对齐时，0表示图片左边缘在屏幕左边缘
		topOffsetMultiplier: 0.2,  
		position: "center"  
	},
	"diplomacy-left": {
		widthMultiplier: 2.75,  // 外交界面左侧
		leftOffsetMultiplier: 0.1,
		topOffsetMultiplier: 0.2,  
		position: "left"
	},
	"diplomacy-right": {
		widthMultiplier: 2.75,  // 外交界面右侧
		leftOffsetMultiplier: 0.25,
		topOffsetMultiplier: 0.2,  
		position: "right"
	}
};

// 测试配置已移除 - 现在使用注册法进行测试领袖注册
// 所有测试领袖应通过registerImageLeader函数注册

// 注册表：存储其他模组注册的图片领袖映射
const REGISTERED_IMAGE_LEADERS = {};
// 共享存储键：用于在 shell 与 game scope 之间共享注册信息
const SHARED_REGISTRY_STORAGE_KEY = "LeaderOverlayImageRegistryV1";

// 将注册表持久化到 localStorage，供 game scope 读取
function persistSharedRegistry() {
	try {
		if (typeof localStorage === "undefined") return;
		localStorage.setItem(SHARED_REGISTRY_STORAGE_KEY, JSON.stringify(REGISTERED_IMAGE_LEADERS));
	} catch (error) {
		console.warn("[Custom Leader Config] Failed to persist shared registry:", error);
	}
}

// 从 localStorage 读取并合并到当前注册表（避免重复覆盖）
function loadSharedRegistry() {
	try {
		if (typeof localStorage === "undefined") return;
		const raw = localStorage.getItem(SHARED_REGISTRY_STORAGE_KEY);
		if (!raw) return;
		const parsed = JSON.parse(raw);
		if (parsed && typeof parsed === "object") {
			for (const leaderID of Object.keys(parsed)) {
				if (!REGISTERED_IMAGE_LEADERS.hasOwnProperty(leaderID)) {
					REGISTERED_IMAGE_LEADERS[leaderID] = parsed[leaderID];
				}
			}
		}
	} catch (error) {
		console.warn("[Custom Leader Config] Failed to load shared registry:", error);
	}
}

/**
 * 注册图片领袖
 * @param {string} leaderID - 领袖ID（如 "LEADER_YUNI"）
 * @param {string|object} config - 配置参数
 *   - 如果是字符串：简单模式，只设置图片路径（自动推断其他状态立绘）
 *   - 如果是对象：完整模式，包含以下字段：
 *     - imagePath: {string} 基础图片路径（用于非外交界面或默认状态）
 *     - autoInferPaths: {boolean} 可选，是否自动推断状态立绘路径（默认为 true）
 *       设置为 false 可禁用自动推断，只使用 diplomacyStates 中明确配置的路径
 *     - displayOverrides: {object} 可选，特定面板的显示参数覆盖
 *       - "leader-select": {widthMultiplier, leftOffsetMultiplier, topOffsetMultiplier}
 *       - "setup-panels": {widthMultiplier, leftOffsetMultiplier, topOffsetMultiplier}
 *       - "diplomacy-left": {widthMultiplier, leftOffsetMultiplier, topOffsetMultiplier}
 *       - "diplomacy-right": {widthMultiplier, leftOffsetMultiplier, topOffsetMultiplier}
 *     - diplomacyStates: {object} 可选，外交状态差分图片（明确配置优先于自动推断）
 *       - "neutral": {string} 中立关系图片
 *       - "friendly": {string} 友好关系图片
 *       - "hostile": {string} 敌对关系图片
 *       - "declaring_war": {string} 宣战时图片
 *       - "defeated": {string} 战败时图片
 *       - "accepting_peace": {string} 接受和平时图片
 *       - "rejecting_peace": {string} 拒绝和平时图片
 *       - "response_positive": {string} 友好回应图片
 *       - "response_negative": {string} 不友好回应图片
 *       - "meeting": {string} 会面时图片
 * 
 * 自动推断说明:
 *   如果没有配置 diplomacyStates 或特定状态，系统会自动尝试寻找带后缀的立绘文件
 *   例如基础路径为 fbl_Leader.png，宣战时会自动尝试:
 *     - fbl_Leader_angry.png
 *     - fbl_Leader_hostile.png
 *     - fbl_Leader_war.png
 *   详见 AUTO_PORTRAIT_SUFFIX_TEMPLATES 配置
 * 
 * @returns {boolean} 是否注册成功
 */
function registerImageLeader(leaderID, config) {
	if (!leaderID || leaderID === "" || leaderID === "RANDOM") {
		return false;
	}

	// 向后兼容：如果config是字符串，转换为对象格式
	let configObj;
	if (typeof config === "string") {
		configObj = {
			imagePath: config
		};
	} else if (typeof config === "object" && config !== null) {
		configObj = config;
	} else {
		return false;
	}

	// 验证 imagePath
	if (!configObj.imagePath || typeof configObj.imagePath !== "string") {
		return false;
	}

	// 验证 displayOverrides（如果提供）
	if (configObj.displayOverrides !== undefined) {
		if (typeof configObj.displayOverrides !== "object" || configObj.displayOverrides === null) {
			return false;
		}
		// 验证每个面板配置的数值参数
		const validPanels = ["leader-select", "setup-panels", "diplomacy-left", "diplomacy-right"];
		for (const panelKey of Object.keys(configObj.displayOverrides)) {
			if (!validPanels.includes(panelKey)) {
				console.warn(`[Custom Leader Config] Invalid panel key: ${panelKey}, skipping`);
				continue;
			}
			const panelConfig = configObj.displayOverrides[panelKey];
			if (typeof panelConfig !== "object" || panelConfig === null) {
				console.warn(`[Custom Leader Config] Invalid panel config for ${panelKey}, skipping`);
				continue;
			}
			// 验证数值参数
			if (panelConfig.widthMultiplier !== undefined && 
				(typeof panelConfig.widthMultiplier !== "number" || isNaN(panelConfig.widthMultiplier) || !isFinite(panelConfig.widthMultiplier))) {
				console.warn(`[Custom Leader Config] Invalid widthMultiplier for ${panelKey}, using default`);
				delete panelConfig.widthMultiplier;
			}
			if (panelConfig.leftOffsetMultiplier !== undefined && 
				(typeof panelConfig.leftOffsetMultiplier !== "number" || isNaN(panelConfig.leftOffsetMultiplier) || !isFinite(panelConfig.leftOffsetMultiplier))) {
				console.warn(`[Custom Leader Config] Invalid leftOffsetMultiplier for ${panelKey}, using default`);
				delete panelConfig.leftOffsetMultiplier;
			}
			if (panelConfig.topOffsetMultiplier !== undefined && 
				(typeof panelConfig.topOffsetMultiplier !== "number" || isNaN(panelConfig.topOffsetMultiplier) || !isFinite(panelConfig.topOffsetMultiplier))) {
				console.warn(`[Custom Leader Config] Invalid topOffsetMultiplier for ${panelKey}, using default`);
				delete panelConfig.topOffsetMultiplier;
			}
		}
	}

	// 验证 diplomacyStates（如果提供）
	if (configObj.diplomacyStates !== undefined) {
		if (typeof configObj.diplomacyStates !== "object" || configObj.diplomacyStates === null) {
			return false;
		}
		// 验证每个状态的图片路径
		const validStates = [
			"neutral", "friendly", "hostile", 
			"response_positive", "response_negative",
			"meeting", "declaring_war", "defeated",
			"accepting_peace", "rejecting_peace"
		];
		for (const stateKey of Object.keys(configObj.diplomacyStates)) {
			if (!validStates.includes(stateKey)) {
				console.warn(`[Custom Leader Config] Invalid state key: ${stateKey}, skipping`);
				continue;
			}
			const statePath = configObj.diplomacyStates[stateKey];
			if (typeof statePath !== "string" || statePath === "") {
				console.warn(`[Custom Leader Config] Invalid image path for state ${stateKey}, skipping`);
				delete configObj.diplomacyStates[stateKey];
			}
		}
	}
	
	// 注册到注册表
	REGISTERED_IMAGE_LEADERS[leaderID] = configObj;
	// 持久化到共享存储，便于 game scope 读取
	persistSharedRegistry();
	
	return true;
}

/**
 * 判断是否为图片领袖
 * @param {string} leaderID - 领袖ID
 * @returns {boolean} 是否为图片领袖
 */
function isImageLeader(leaderID) {
	if (!leaderID || leaderID === "" || leaderID === "RANDOM") {
		return false;
	}

	// 仅检查注册表中的领袖
	if (REGISTERED_IMAGE_LEADERS.hasOwnProperty(leaderID)) {
		return true;
	}

	// 基于前缀判断（暂时不使用，因为所有领袖都是LEADER_开头）
	// if (leaderID.startsWith(IMAGE_LEADER_PREFIX)) {
	// 	return true;
	// }

	return false;
}

/**
 * 获取图片路径（支持状态回退机制 + 自动路径推断）
 * @param {string} leaderID - 领袖ID
 * @param {string} state - 可选，外交状态
 *   支持的状态: "neutral", "friendly", "hostile", "response_positive", "response_negative",
 *               "meeting", "declaring_war", "defeated", "accepting_peace", "rejecting_peace"
 * @returns {string|null} 图片路径，如果不是图片领袖则返回null
 * 
 * 查找优先级:
 *   1. 首先检查 diplomacyStates 中是否有明确配置
 *   2. 如果没有配置，尝试自动推断路径（基于 AUTO_PORTRAIT_SUFFIX_TEMPLATES）
 *   3. 最后使用状态回退链
 * 
 * 自动推断示例:
 *   基础路径: fs://game/xxx/textures/portraits/fbl_Leader.png
 *   宣战状态: 自动尝试 fbl_Leader_angry.png, fbl_Leader_hostile.png 等
 * 
 * 回退机制:
 *   - declaring_war → hostile → neutral → imagePath
 *   - defeated → hostile → neutral → imagePath
 *   - accepting_peace → friendly → neutral → imagePath
 *   - rejecting_peace → hostile → neutral → imagePath
 *   - response_positive → friendly → neutral → imagePath
 *   - response_negative → hostile → neutral → imagePath
 *   - meeting → neutral → imagePath
 *   - friendly → neutral → imagePath
 *   - hostile → neutral → imagePath
 */
function getImagePath(leaderID, state = null) {
	if (!isImageLeader(leaderID)) {
		return null;
	}

	// 从注册表获取
	const registeredConfig = REGISTERED_IMAGE_LEADERS[leaderID];
	if (!registeredConfig) {
		return null;
	}

	const basePath = registeredConfig.imagePath || null;

	// 如果没有提供 state，直接返回基础图片
	if (!state) {
		return basePath;
	}

	// 定义状态回退链
	const stateFallbackChains = {
		"declaring_war": ["declaring_war", "hostile", "neutral"],
		"defeated": ["defeated", "hostile", "neutral"],
		"accepting_peace": ["accepting_peace", "friendly", "neutral"],
		"rejecting_peace": ["rejecting_peace", "hostile", "neutral"],
		"response_positive": ["response_positive", "friendly", "neutral"],
		"response_negative": ["response_negative", "hostile", "neutral"],
		"meeting": ["meeting", "neutral"],
		"friendly": ["friendly", "neutral"],
		"hostile": ["hostile", "neutral"],
		"neutral": ["neutral"]
	};

	// 获取回退链
	const fallbackChain = stateFallbackChains[state] || [state, "neutral"];

	// 按顺序查找可用的状态图片
	for (const fallbackState of fallbackChain) {
		// 1. 首先检查是否有明确配置的 diplomacyStates
		if (registeredConfig.diplomacyStates && registeredConfig.diplomacyStates[fallbackState]) {
			return registeredConfig.diplomacyStates[fallbackState];
		}

		// 2. 尝试自动推断路径
		const inferredPath = tryInferStatePath(leaderID, basePath, fallbackState);
		if (inferredPath) {
			return inferredPath;
		}
	}

	// 最后回退到基础图片路径
	return basePath;
}

/**
 * 尝试根据基础路径和状态自动推断状态立绘路径
 * @param {string} leaderID - 领袖ID
 * @param {string} basePath - 基础图片路径
 * @param {string} state - 目标状态
 * @returns {string|null} 推断出的路径，如果无法推断则返回null
 * 
 * 推断逻辑:
 *   1. 从基础路径提取目录和文件名
 *   2. 根据 AUTO_PORTRAIT_SUFFIX_TEMPLATES 尝试各种后缀
 *   3. 返回第一个匹配的路径（或使用缓存的已知有效路径）
 */
function tryInferStatePath(leaderID, basePath, state) {
	if (!basePath || !state) {
		return null;
	}

	// 检查缓存
	const cacheKey = `${leaderID}_${state}`;
	if (AUTO_INFERRED_PATH_CACHE[cacheKey] !== undefined) {
		return AUTO_INFERRED_PATH_CACHE[cacheKey]; // 可能是 null（表示已知不存在）
	}

	// 获取该状态的后缀模板
	const suffixTemplates = AUTO_PORTRAIT_SUFFIX_TEMPLATES[state];
	if (!suffixTemplates || suffixTemplates.length === 0) {
		// neutral 状态没有后缀，直接返回 null（将使用基础路径）
		return null;
	}

	// 解析基础路径
	// 例如: "fs://game/xxx/textures/portraits/fbl_Leader.png"
	// 分解为: 目录 = "fs://game/xxx/textures/portraits/", 文件名 = "fbl_Leader", 扩展名 = ".png"
	const lastSlashIndex = basePath.lastIndexOf('/');
	const lastDotIndex = basePath.lastIndexOf('.');
	
	if (lastSlashIndex === -1 || lastDotIndex === -1 || lastDotIndex <= lastSlashIndex) {
		// 无法解析路径
		return null;
	}

	const directory = basePath.substring(0, lastSlashIndex + 1);
	const fileName = basePath.substring(lastSlashIndex + 1, lastDotIndex);
	const extension = basePath.substring(lastDotIndex);

	// 生成候选路径列表
	const candidatePaths = [];
	for (const suffix of suffixTemplates) {
		candidatePaths.push(`${directory}${fileName}${suffix}${extension}`);
	}

	// 由于游戏中无法直接检测文件是否存在，我们返回第一个候选路径
	// 如果文件不存在，游戏会显示空白或错误，用户需要确保文件命名正确
	// 
	// 注意: 如果mod没有提供对应的立绘文件，建议mod作者：
	//   1. 使用 diplomacyStates 明确指定状态立绘
	//   2. 或者按照命名约定放置立绘文件
	//   3. 或者设置 autoInferPaths: false 禁用自动推断
	
	// 检查是否禁用了自动推断（默认启用）
	const registeredConfig = REGISTERED_IMAGE_LEADERS[leaderID];
	if (registeredConfig && registeredConfig.autoInferPaths === false) {
		return null;
	}

	// 返回第一个候选路径
	const inferredPath = candidatePaths[0];
	
	// 缓存结果
	AUTO_INFERRED_PATH_CACHE[cacheKey] = inferredPath;
	
	console.log(`[Custom Leader Config] Auto-inferred path for ${leaderID}/${state}: ${inferredPath}`);
	
	return inferredPath;
}

/**
 * 获取图片显示配置
 * @param {string} leaderID - 领袖ID
 * @param {string} panelType - 面板类型 ("leader-select", "age-select", "civ-select", "game-setup", "setup-panels", "diplomacy-left", "diplomacy-right")
 * @returns {object|null} 显示配置对象，包含widthMultiplier、leftOffsetMultiplier、topOffsetMultiplier和position
 */
function getImageDisplayConfig(leaderID, panelType = "leader-select") {
	if (!isImageLeader(leaderID)) {
		return null;
	}

	// 面板类型映射：age-select, civ-select, game-setup 统一映射到 setup-panels
	let mappedPanelType = panelType;
	if (panelType === "age-select" || panelType === "civ-select" || panelType === "game-setup") {
		mappedPanelType = "setup-panels";
	}

	// 获取全局面板配置（默认值）
	const globalPanelConfig = PANEL_DISPLAY_CONFIGS[mappedPanelType] || PANEL_DISPLAY_CONFIGS["leader-select"];

	// 检查是否有领袖特定的显示参数覆盖
	const registeredConfig = REGISTERED_IMAGE_LEADERS[leaderID];
	let leaderSpecificConfig = null;
	if (registeredConfig && registeredConfig.displayOverrides && registeredConfig.displayOverrides[mappedPanelType]) {
		leaderSpecificConfig = registeredConfig.displayOverrides[mappedPanelType];
	}

	// 合并配置：领袖特定配置优先，缺失的参数使用全局默认值
	return {
		widthMultiplier: leaderSpecificConfig?.widthMultiplier !== undefined 
			? leaderSpecificConfig.widthMultiplier 
			: (globalPanelConfig.widthMultiplier || 3.5),
		leftOffsetMultiplier: leaderSpecificConfig?.leftOffsetMultiplier !== undefined 
			? leaderSpecificConfig.leftOffsetMultiplier 
			: (globalPanelConfig.leftOffsetMultiplier !== undefined ? globalPanelConfig.leftOffsetMultiplier : 0.5),
		topOffsetMultiplier: leaderSpecificConfig?.topOffsetMultiplier !== undefined 
			? leaderSpecificConfig.topOffsetMultiplier 
			: (globalPanelConfig.topOffsetMultiplier !== undefined ? globalPanelConfig.topOffsetMultiplier : 0),
		position: leaderSpecificConfig?.position || globalPanelConfig.position || "center"
	};
}

/**
 * 根据外交关系类型获取初始状态
 * @param {number} relationshipEnum - 外交关系枚举值（DiplomacyPlayerRelationships）
 * @param {boolean} isAtWar - 是否处于战争状态
 * @returns {string} 初始状态字符串 ("neutral", "friendly", "hostile")
 */
function getDiplomacyInitialState(relationshipEnum, isAtWar = false) {
	// 如果处于战争状态，返回敌对
	if (isAtWar) {
		return "hostile";
	}

	// 检查关系类型（需要导入 DiplomacyPlayerRelationships）
	// 使用字符串比较作为后备方案
	const relationshipStr = relationshipEnum?.toString() || "";

	if (relationshipStr.includes("HOSTILE") || relationshipStr.includes("UNFRIENDLY")) {
		return "hostile";
	} else if (relationshipStr.includes("FRIENDLY") || relationshipStr.includes("HELPFUL")) {
		return "friendly";
	} else {
		return "neutral";
	}
}

/**
 * 检测当前面板类型
 * @returns {string} 面板类型 ("leader-select", "age-select", "civ-select", "unknown")
 */
function detectCurrentPanel() {
	// 通过查找当前活动的面板元素来判断
	if (document.querySelector("leader-select-panel")?.offsetParent !== null) {
		return "leader-select";
	}
	if (document.querySelector("age-select-panel")?.offsetParent !== null) {
		return "age-select";
	}
	if (document.querySelector("civ-select-panel")?.offsetParent !== null) {
		return "civ-select";
	}
	if (document.querySelector("game-setup-panel")?.offsetParent !== null) {
		return "game-setup";
	}
	
	// 通过URL或上下文判断（备用方法）
	const context = ContextManager?.currentContext;
	if (context) {
		if (context.name === "leader-select-panel") return "leader-select";
		if (context.name === "age-select-panel") return "age-select";
		if (context.name === "civ-select-panel") return "civ-select";
		if (context.name === "game-setup-panel") return "game-setup";
	}
	
	return "unknown";
}

// 导出函数供其他模块使用
// 确保在shell和game scope中都能正确导出
(function() {
	// 如果已经存在，先保留现有配置（避免覆盖）
	const existingConfig = window.CustomLeaderConfig;
	
	window.CustomLeaderConfig = {
		isImageLeader,
		getImagePath,
		getImageDisplayConfig,
		getDiplomacyInitialState,
		detectCurrentPanel,
		registerImageLeader,
		IMAGE_LEADER_PREFIX,
		REGISTERED_IMAGE_LEADERS, // 只读，用于调试
		PANEL_DISPLAY_CONFIGS
	};
	
	// 如果之前已经存在配置且已注册了领袖，合并注册表
	if (existingConfig && existingConfig.REGISTERED_IMAGE_LEADERS) {
		const existingLeaders = existingConfig.REGISTERED_IMAGE_LEADERS;
		for (const leaderID in existingLeaders) {
			if (existingLeaders.hasOwnProperty(leaderID) && !REGISTERED_IMAGE_LEADERS.hasOwnProperty(leaderID)) {
				REGISTERED_IMAGE_LEADERS[leaderID] = existingLeaders[leaderID];
			}
		}
	}
	
	// 尝试从共享存储加载（shell->game 共享）
	loadSharedRegistry();
	
	// 标记配置系统已加载
	window.CustomLeaderConfig._isLoaded = true;
	// 导出共享键，供其他 scope 读取
	window.CustomLeaderConfig.SHARED_REGISTRY_STORAGE_KEY = SHARED_REGISTRY_STORAGE_KEY;
	
	console.log("[Custom Leader Config] Configuration system initialized. Registered leaders:", Object.keys(REGISTERED_IMAGE_LEADERS).length);
	
	// 初始化后立即持久化一次（覆盖旧格式）
	persistSharedRegistry();
})();

