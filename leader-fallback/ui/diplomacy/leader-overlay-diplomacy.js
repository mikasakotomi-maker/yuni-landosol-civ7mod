/**
 * @file leader-overlay-diplomacy.js
 * @description Leader Overlay Diplomacy: Override diplomacy leader model display functions and add image overlay
 */

// 获取领袖ID从playerID
function getLeaderIDFromPlayerID(playerID) {
	try {
		const player = Players.get(playerID);
		if (!player) {
			return null;
		}
		return player.leaderType || null;
	} catch (error) {
		console.error("Leader Overlay Diplomacy: Error getting leader ID from player ID", error);
		return null;
	}
}

// 检查是否应该显示覆盖层
function shouldShowOverlay(leaderID) {
	return leaderID === "LEADER_YUNI";
}

// 获取LeaderModelManager实例（通过动态导入）
let cachedLeaderModelManager = null;
async function getLeaderModelManager() {
	if (cachedLeaderModelManager) {
		return cachedLeaderModelManager;
	}
	
	try {
		// 尝试动态导入外交管理器模块
		const diplomacyModule = await import("/base-standard/ui/diplomacy/diplomacy-manager.js");
		if (diplomacyModule && diplomacyModule.L) {
			cachedLeaderModelManager = diplomacyModule.L;
			return cachedLeaderModelManager;
		}
	} catch (error) {
		console.warn("Leader Overlay Diplomacy: Failed to import diplomacy-manager", error);
	}
	
	// 如果动态导入失败，尝试从全局对象获取（某些情况下可能被挂载到window）
	if (typeof LeaderModelManager !== "undefined" && LeaderModelManager) {
		cachedLeaderModelManager = LeaderModelManager;
		return cachedLeaderModelManager;
	}
	
	return null;
}

// TODO: 实现外交界面的领袖模型追踪
// 需要追踪的函数：
// 1. LeaderModelManager.showLeaderModels(playerID1, playerID2) - 同时显示两个领袖
// 2. LeaderModelManager.showLeadersFirstMeet(params) - 首次见面场景
// 3. LeaderModelManager.showRightLeaderModel(playerID) - 显示右侧领袖（最常见）
// 4. LeaderModelManager.showLeftLeaderModel(playerID) - 显示左侧领袖
// 5. OtherPlayerDiplomacyActionPanel.onSelectedPlayerChanged() - 玩家切换事件
// 
// 注意：showRightIndLeaderModel() 用于独立城邦，使用单位模型而非特定领袖模型，不需要实现

// 初始化函数（延迟初始化，只在需要时执行）
async function initializeDiplomacyMod() {
	// 检查其他必要的模块
	if (typeof Players === "undefined" || !window.LeaderOverlayImage) {
		// 如果基础模块不可用，等待一段时间后重试
		let retryCount = 0;
		const maxRetries = 50; // 最多重试5秒
		
		const retryInterval = setInterval(() => {
			retryCount++;
			
			if (typeof Players !== "undefined" && window.LeaderOverlayImage) {
				clearInterval(retryInterval);
				// 基础模块已加载，继续初始化
				setTimeout(() => initializeDiplomacyMod(), 100);
			} else if (retryCount >= maxRetries) {
				clearInterval(retryInterval);
				// 静默退出，不报错
			}
		}, 100);
		
		return;
	}
	
	// TODO: 实现外交界面的函数追踪
	console.log("Leader Overlay Diplomacy: Mod initialization - TODO: implement function tracking");
}

// 延迟执行初始化，给其他模块时间加载
// 使用setTimeout确保在DOM加载后再检查
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", () => {
		setTimeout(initializeDiplomacyMod, 500);
	});
} else {
	setTimeout(initializeDiplomacyMod, 500);
}
