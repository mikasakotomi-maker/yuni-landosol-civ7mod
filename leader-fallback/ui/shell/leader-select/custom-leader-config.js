/**
 * @file custom-leader-config.js
 * @description Custom Leader Config: Configuration system for image-based leaders
 */

// 图片领袖ID前缀（用于识别图片领袖）
// 如果领袖ID以此前缀开头，则认为是图片领袖
const IMAGE_LEADER_PREFIX = "LEADER_"; // 暂时使用所有LEADER_前缀作为测试，后续可以改为特定前缀如 "LEADER_CUSTOM_"

// 面板特定的显示配置（不同面板中模型位置和大小不同）
// 注意：age-select、civ-select、game-setup 会自动映射到 setup-panels（见 getImageDisplayConfig 函数）
const PANEL_DISPLAY_CONFIGS = {
	"leader-select": {
		widthMultiplier: 0.8,
		leftOffsetMultiplier: -0.56,  // 左对齐时，0表示图片左边缘在屏幕左边缘
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
 *   - 如果是字符串：简单模式，只设置图片路径
 *   - 如果是对象：完整模式，包含以下字段：
 *     - imagePath: {string} 基础图片路径（用于非外交界面或默认状态）
 *     - displayOverrides: {object} 可选，特定面板的显示参数覆盖
 *       - "leader-select": {widthMultiplier, leftOffsetMultiplier, topOffsetMultiplier}
 *       - "setup-panels": {widthMultiplier, leftOffsetMultiplier, topOffsetMultiplier}
 *       - "diplomacy-left": {widthMultiplier, leftOffsetMultiplier, topOffsetMultiplier}
 *       - "diplomacy-right": {widthMultiplier, leftOffsetMultiplier, topOffsetMultiplier}
 *     - diplomacyStates: {object} 可选，外交状态差分图片
 *       - "neutral": {string} 中立关系图片
 *       - "friendly": {string} 友好关系图片
 *       - "hostile": {string} 敌对关系图片
 *       - "response_positive": {string} 友好回应图片
 *       - "response_negative": {string} 不友好回应图片
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
		const validStates = ["neutral", "friendly", "hostile", "response_positive", "response_negative"];
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
 * 获取图片路径
 * @param {string} leaderID - 领袖ID
 * @param {string} state - 可选，外交状态（"neutral", "friendly", "hostile", "response_positive", "response_negative"）
 * @returns {string|null} 图片路径，如果不是图片领袖则返回null
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

	// 如果提供了state，优先查找状态图片
	if (state && registeredConfig.diplomacyStates && registeredConfig.diplomacyStates[state]) {
		return registeredConfig.diplomacyStates[state];
	}

	// 如果state没有设置图片，回退到 "neutral" 状态
	if (state && state !== "neutral" && registeredConfig.diplomacyStates && registeredConfig.diplomacyStates["neutral"]) {
		return registeredConfig.diplomacyStates["neutral"];
	}

	// 回退到基础图片路径
	if (registeredConfig.imagePath) {
		return registeredConfig.imagePath;
	}

	return null;
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

