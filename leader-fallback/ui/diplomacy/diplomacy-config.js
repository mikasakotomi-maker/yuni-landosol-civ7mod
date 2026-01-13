/**
 * @file diplomacy-config.js
 * @description Diplomacy Configuration: Configuration system and utility functions for diplomacy model overrides
 */

// ============================================================================
// 配置系统（在game scope中独立实现，不依赖shell scope的CustomLeaderConfig）
// ============================================================================

// 共享存储键：与 shell scope 保持一致，用于读取已注册的领袖
const SHARED_REGISTRY_STORAGE_KEY = "LeaderOverlayImageRegistryV1";

/**
 * 自动立绘后缀模板配置（与 shell scope 保持一致）
 * 当mod没有明确配置diplomacyStates时，系统会自动根据基础图片路径尝试这些后缀
 */
const AUTO_PORTRAIT_SUFFIX_TEMPLATES = {
	"declaring_war": ["_angry", "_hostile", "_war", "_declaring_war"],
	"hostile": ["_angry", "_hostile"],
	"friendly": ["_happy", "_friendly", "_smile"],
	"defeated": ["_defeated", "_sad", "_lose"],
	"accepting_peace": ["_peace", "_happy", "_friendly"],
	"rejecting_peace": ["_angry", "_hostile", "_reject"],
	"response_positive": ["_happy", "_friendly", "_positive"],
	"response_negative": ["_angry", "_hostile", "_negative"],
	"meeting": ["_meeting", "_neutral"],
	"neutral": []
};

// 已验证存在的自动推断路径缓存
const AUTO_INFERRED_PATH_CACHE = {};

// 测试配置：使用现有领袖和图片进行测试
const DIPLOMACY_TEST_IMAGE_LEADERS = {
	"LEADER_YUNI": {
		imagePath: "fs://game/leader-fallback/texture/LEADER_YUNI_NEUTRAL.png"
	}
};

// 将共享注册表（localStorage / shell 注册）合并到本地表
function loadSharedRegistryIntoLocal() {
	let merged = false;
	// 1) 尝试读取 localStorage（shell scope 持久化的注册表）
	try {
		if (typeof localStorage !== "undefined") {
			const raw = localStorage.getItem(SHARED_REGISTRY_STORAGE_KEY);
			if (raw) {
				const parsed = JSON.parse(raw);
				if (parsed && typeof parsed === "object") {
					for (const leaderID of Object.keys(parsed)) {
						if (!DIPLOMACY_TEST_IMAGE_LEADERS.hasOwnProperty(leaderID)) {
							DIPLOMACY_TEST_IMAGE_LEADERS[leaderID] = parsed[leaderID];
							merged = true;
						}
					}
				}
			}
		}
	} catch (error) {
		console.error("[Diplomacy Config] Failed to load shared registry from storage:", error);
	}

	// 2) 尝试从 shell scope 的 CustomLeaderConfig 直接合并（如果同窗口可访问）
	try {
		if (window.CustomLeaderConfig && window.CustomLeaderConfig.REGISTERED_IMAGE_LEADERS) {
			const shared = window.CustomLeaderConfig.REGISTERED_IMAGE_LEADERS;
			for (const leaderID of Object.keys(shared)) {
				if (!DIPLOMACY_TEST_IMAGE_LEADERS.hasOwnProperty(leaderID)) {
					DIPLOMACY_TEST_IMAGE_LEADERS[leaderID] = shared[leaderID];
					merged = true;
				}
			}
		}
	} catch (error) {
		console.error("[Diplomacy Config] Failed to merge registry from CustomLeaderConfig:", error);
	}

	if (merged) {
		console.error("[Diplomacy Config] Shared registry merged into game scope. Total leaders:", Object.keys(DIPLOMACY_TEST_IMAGE_LEADERS).length);
	}
}

// 初始化时加载共享注册表（确保新游戏时能复用 shell 注册的数据）
loadSharedRegistryIntoLocal();

/**
 * 判断是否为图片领袖（game scope独立实现）
 * @param {string} leaderID - 领袖ID
 * @returns {boolean} 是否为图片领袖
 */
function diplomacyIsImageLeader(leaderID) {
	if (!leaderID || leaderID === "" || leaderID === "RANDOM") {
		return false;
	}

	// 首先尝试使用全局配置系统（如果可用）
	if (window.CustomLeaderConfig && window.CustomLeaderConfig.isImageLeader) {
		return window.CustomLeaderConfig.isImageLeader(leaderID);
	}

	// 否则使用本地配置
	return DIPLOMACY_TEST_IMAGE_LEADERS.hasOwnProperty(leaderID);
}

/**
 * 获取图片路径（game scope独立实现，支持状态回退机制 + 自动路径推断）
 * @param {string} leaderID - 领袖ID
 * @param {string} state - 可选，外交状态
 *   支持的状态: "neutral", "friendly", "hostile", "response_positive", "response_negative",
 *               "meeting", "declaring_war", "defeated", "accepting_peace", "rejecting_peace"
 * @returns {string|null} 图片路径，如果不是图片领袖则返回null
 */
function diplomacyGetImagePath(leaderID, state = null) {
	if (!diplomacyIsImageLeader(leaderID)) {
		return null;
	}

	// 首先尝试使用全局配置系统（如果可用）
	if (window.CustomLeaderConfig && window.CustomLeaderConfig.getImagePath) {
		const path = window.CustomLeaderConfig.getImagePath(leaderID, state);
		if (path) return path;
	}

	// 否则使用本地配置（带回退机制 + 自动推断）
	const config = DIPLOMACY_TEST_IMAGE_LEADERS[leaderID];
	if (!config) {
		return null;
	}

	const basePath = config.imagePath || null;

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
		if (config.diplomacyStates && config.diplomacyStates[fallbackState]) {
			return config.diplomacyStates[fallbackState];
		}

		// 2. 尝试自动推断路径
		const inferredPath = diplomacyTryInferStatePath(leaderID, basePath, fallbackState, config);
		if (inferredPath) {
			return inferredPath;
		}
	}

	// 最后回退到基础图片路径
	return basePath;
}

/**
 * 尝试根据基础路径和状态自动推断状态立绘路径（game scope版本）
 * @param {string} leaderID - 领袖ID
 * @param {string} basePath - 基础图片路径
 * @param {string} state - 目标状态
 * @param {object} config - 领袖配置
 * @returns {string|null} 推断出的路径，如果无法推断则返回null
 */
function diplomacyTryInferStatePath(leaderID, basePath, state, config) {
	if (!basePath || !state) {
		return null;
	}

	// 检查是否禁用了自动推断（默认启用）
	if (config && config.autoInferPaths === false) {
		return null;
	}

	// 检查缓存
	const cacheKey = `${leaderID}_${state}`;
	if (AUTO_INFERRED_PATH_CACHE[cacheKey] !== undefined) {
		return AUTO_INFERRED_PATH_CACHE[cacheKey];
	}

	// 获取该状态的后缀模板
	const suffixTemplates = AUTO_PORTRAIT_SUFFIX_TEMPLATES[state];
	if (!suffixTemplates || suffixTemplates.length === 0) {
		return null;
	}

	// 解析基础路径
	const lastSlashIndex = basePath.lastIndexOf('/');
	const lastDotIndex = basePath.lastIndexOf('.');
	
	if (lastSlashIndex === -1 || lastDotIndex === -1 || lastDotIndex <= lastSlashIndex) {
		return null;
	}

	const directory = basePath.substring(0, lastSlashIndex + 1);
	const fileName = basePath.substring(lastSlashIndex + 1, lastDotIndex);
	const extension = basePath.substring(lastDotIndex);

	// 返回第一个候选路径
	const inferredPath = `${directory}${fileName}${suffixTemplates[0]}${extension}`;
	
	// 缓存结果
	AUTO_INFERRED_PATH_CACHE[cacheKey] = inferredPath;
	
	console.log(`[Diplomacy Config] Auto-inferred path for ${leaderID}/${state}: ${inferredPath}`);
	
	return inferredPath;
}

// 等待配置系统加载（现在主要用于等待LeaderOverlayImage）
function waitForConfig() {
	return new Promise((resolve) => {
		// 检查 LeaderOverlayImage 是否已加载
		if (window.LeaderOverlayImage) {
			// 验证关键函数是否存在
			if (typeof window.LeaderOverlayImage.tryCreateDiplomacyImageOverlay === "function" &&
				typeof window.LeaderOverlayImage.tryRemoveDiplomacyImageOverlay === "function") {
				console.error("[Diplomacy Model Override] LeaderOverlayImage already available with required functions");
				resolve();
				return;
			} else {
				console.error("[Diplomacy Model Override] LeaderOverlayImage exists but missing required functions");
			}
		}

		console.error("[Diplomacy Model Override] Waiting for LeaderOverlayImage to load...");

		let attempts = 0;
		const maxAttempts = 50; // 5秒
		const checkInterval = setInterval(() => {
			attempts++;
			
			// 检查 LeaderOverlayImage 是否存在且包含必要的函数
			if (window.LeaderOverlayImage) {
				if (typeof window.LeaderOverlayImage.tryCreateDiplomacyImageOverlay === "function" &&
					typeof window.LeaderOverlayImage.tryRemoveDiplomacyImageOverlay === "function") {
					clearInterval(checkInterval);
					console.error(`[Diplomacy Model Override] LeaderOverlayImage loaded successfully after ${attempts} attempts`);
					resolve();
					return;
				} else {
					// LeaderOverlayImage 存在但缺少必要函数
					if (attempts === 1 || attempts % 10 === 0) {
						console.error(`[Diplomacy Model Override] LeaderOverlayImage exists but missing required functions (attempt ${attempts}/${maxAttempts})`);
					}
				}
			}
			
			if (attempts >= maxAttempts) {
				clearInterval(checkInterval);
				console.error(`[Diplomacy Model Override] LeaderOverlayImage not available after ${maxAttempts} attempts (${maxAttempts * 100}ms). This may cause overlay creation to fail.`);
				console.error(`[Diplomacy Model Override] Current state: window.LeaderOverlayImage = ${window.LeaderOverlayImage ? 'exists' : 'undefined'}`);
				if (window.LeaderOverlayImage) {
					console.error(`[Diplomacy Model Override] Available functions:`, Object.keys(window.LeaderOverlayImage));
				}
				// 执行诊断
				if (window.DiplomacyConfig && typeof window.DiplomacyConfig.diagnoseSystemHealth === 'function') {
					const diagnosis = window.DiplomacyConfig.diagnoseSystemHealth();
					console.error(`[Diplomacy Model Override] System diagnosis:`, diagnosis);
				}
				resolve(); // 即使失败也resolve，避免阻塞，但会在后续重试机制中处理
			}
		}, 100);
	});
}

// 从playerID获取领袖字符串ID（如 "LEADER_YUNI"）
function getLeaderStringIDFromPlayerID(playerID) {
	try {
		console.log(`[Diplomacy Model Override] getLeaderStringIDFromPlayerID called with playerID=${playerID}`);

		// 检查必要的对象是否可用
		if (typeof Players === "undefined" || !Players || typeof Players.get !== "function") {
			console.log(`[Diplomacy Model Override] Players object not available`);
			return null;
		}

		if (typeof GameInfo === "undefined" || !GameInfo || !GameInfo.Leaders || !GameInfo.Leaders.lookup) {
			console.log(`[Diplomacy Model Override] GameInfo.Leaders not available`);
			return null;
		}

		const player = Players.get(playerID);
		if (!player) {
			console.log(`[Diplomacy Model Override] Player not found for playerID=${playerID}`);
			return null;
		}

		console.log(`[Diplomacy Model Override] Player found: playerID=${playerID}, leaderType=${player.leaderType}`);

		const leader = GameInfo.Leaders.lookup(player.leaderType);
		if (!leader || !leader.LeaderType) {
			console.log(`[Diplomacy Model Override] Leader not found for leaderType=${player.leaderType}`);
			return null;
		}

		const leaderStringID = leader.LeaderType.toString();
		console.log(`[Diplomacy Model Override] Leader string ID: ${leaderStringID}`);

		// 返回字符串ID（如 "LEADER_YUNI"）
		return leaderStringID;
	} catch (error) {
		console.error(`[Diplomacy Model Override] Error getting leader string ID from player ID: ${error.message}`, error);
		return null;
	}
}

// 检查是否为图片领袖（使用本地实现）
function isImageLeader(leaderID) {
	if (!leaderID) {
		console.error(`[Diplomacy Model Override] isImageLeader: leaderID is null/undefined`);
		return false;
	}

	const result = diplomacyIsImageLeader(leaderID);
	console.log(`[Diplomacy Model Override] isImageLeader(${leaderID}) = ${result}`);
	return result;
}

/**
 * 根据序列类型和playerID推断领袖状态
 * @param {number} playerID - 玩家ID
 * @param {string} sequenceType - 序列类型 ("MEET", "WAR", "ACCEPT_PEACE", "REJECT_PEACE", "DEFEAT", "ACKNOWLEDGE_PLAYER", "ACKNOWLEDGE_HOSTILE_PLAYER", "ACKNOWLEDGE_OTHER_POSITIVE", "ACKNOWLEDGE_OTHER_NEGATIVE", "ACKNOWLEDGE_OTHER")
 * @param {string} position - 位置 ("left" 或 "right")
 * @param {object} context - LeaderModelManager 上下文
 * @returns {string} 状态字符串 ("neutral", "friendly", "hostile", "response_positive", "response_negative")
 */
function getLeaderStateFromSequence(playerID, sequenceType, position, context) {
	if (!playerID || !sequenceType) {
		return "neutral"; // 默认状态
	}

	try {
		// 检查变体状态（玩家选择后的反应）
		if (sequenceType === "ACKNOWLEDGE_PLAYER") {
			return "response_positive"; // 玩家友好选择
		}
		if (sequenceType === "ACKNOWLEDGE_HOSTILE_PLAYER") {
			return "response_negative"; // 玩家不友好选择
		}
		if (sequenceType === "ACKNOWLEDGE_OTHER_POSITIVE") {
			return "response_positive"; // 对方正面反应
		}
		if (sequenceType === "ACKNOWLEDGE_OTHER_NEGATIVE") {
			return "response_negative"; // 对方负面反应
		}
		if (sequenceType === "ACKNOWLEDGE_OTHER") {
			// 根据上下文决定，默认使用正面反应
			return "response_positive";
		}

		const player = Players.get(playerID);
		if (!player) {
			return "neutral";
		}

		// 检查是否处于战争状态
		let isAtWar = false;
		if (context && typeof context.isAtWarWithPlayer === "function") {
			isAtWar = context.isAtWarWithPlayer(playerID);
		}

		// 获取外交关系
		let relationshipEnum = null;
		if (player.Diplomacy && typeof player.Diplomacy.getRelationshipEnum === "function") {
			if (typeof GameContext !== "undefined" && GameContext.localPlayerID !== undefined) {
				relationshipEnum = player.Diplomacy.getRelationshipEnum(GameContext.localPlayerID);
			}
		}

		// 使用全局配置系统的函数获取初始状态（如果可用）
		if (window.CustomLeaderConfig && window.CustomLeaderConfig.getDiplomacyInitialState) {
			return window.CustomLeaderConfig.getDiplomacyInitialState(relationshipEnum, isAtWar);
		}

		// 后备方案：手动映射
		if (isAtWar) {
			return "hostile";
		}

		if (relationshipEnum !== undefined && relationshipEnum !== null) {
			const relationshipStr = relationshipEnum?.toString() || "";
			if (relationshipStr.includes("HOSTILE") || relationshipStr.includes("UNFRIENDLY")) {
				return "hostile";
			} else if (relationshipStr.includes("FRIENDLY") || relationshipStr.includes("HELPFUL")) {
				return "friendly";
			}
		}

		// 默认返回中立
		return "neutral";
	} catch (error) {
		console.warn(`[Diplomacy Model Override] Error getting leader state: ${error.message}`);
		return "neutral";
	}
}

/**
 * 诊断函数：检查系统健康状态
 * @returns {object} 诊断结果
 */
function diagnoseSystemHealth() {
	const diagnosis = {
		timestamp: Date.now(),
		leaderOverlayImage: {
			exists: !!window.LeaderOverlayImage,
			isLoaded: window.LeaderOverlayImage?._isLoaded || false,
			loadTimestamp: window.LeaderOverlayImage?._loadTimestamp || null,
			availableFunctions: window.LeaderOverlayImage ? Object.keys(window.LeaderOverlayImage).filter(key => typeof window.LeaderOverlayImage[key] === 'function') : [],
			missingFunctions: []
		},
		customLeaderConfig: {
			exists: !!window.CustomLeaderConfig,
			isLoaded: window.CustomLeaderConfig?._isLoaded || false,
			availableFunctions: window.CustomLeaderConfig ? Object.keys(window.CustomLeaderConfig).filter(key => typeof window.CustomLeaderConfig[key] === 'function') : []
		}
	};
	
	// 检查必需的函数
	const requiredFunctions = [
		'tryCreateDiplomacyImageOverlay',
		'tryRemoveDiplomacyImageOverlay'
	];
	
	if (window.LeaderOverlayImage) {
		for (const funcName of requiredFunctions) {
			if (typeof window.LeaderOverlayImage[funcName] !== 'function') {
				diagnosis.leaderOverlayImage.missingFunctions.push(funcName);
			}
		}
	} else {
		diagnosis.leaderOverlayImage.missingFunctions = requiredFunctions;
	}
	
	return diagnosis;
}

// 导出配置相关的函数和常量
window.DiplomacyConfig = {
	diplomacyIsImageLeader,
	diplomacyGetImagePath,
	isImageLeader,
	getLeaderStringIDFromPlayerID,
	getLeaderStateFromSequence,
	waitForConfig,
	diagnoseSystemHealth,
	DIPLOMACY_TEST_IMAGE_LEADERS
};
