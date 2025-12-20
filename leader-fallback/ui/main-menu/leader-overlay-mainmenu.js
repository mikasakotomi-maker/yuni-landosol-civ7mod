/**
 * @file leader-overlay-mainmenu.js
 * @description Leader Overlay Main Menu: Override main menu build3DScene function and add image overlay
 */

// 从asset名称提取领袖ID
function extractLeaderIDFromAssetName(assetName) {
	if (!assetName) {
		return null;
	}
	
	// asset名称格式通常是 "LEADER_ID_GAME_ASSET"
	// 移除 "_GAME_ASSET" 后缀
	if (assetName.endsWith("_GAME_ASSET")) {
		return assetName.replace("_GAME_ASSET", "");
	}
	
	// 如果已经是领袖ID格式，直接返回
	if (assetName.startsWith("LEADER_")) {
		return assetName;
	}
	
	return null;
}

// 检查是否应该显示覆盖层
function shouldShowOverlay(leaderID) {
	return leaderID === "LEADER_YUNI";
}

// TODO: 实现主菜单的领袖模型追踪
// 需要追踪的函数：
// 1. MainMenu.build3DScene() - 构建3D场景
// 2. MainMenu.clear3DScene() - 清理3D场景
// 
// 注意：主菜单显示过早的问题可能是因为追踪时机不对，需要找到正确的时机

// 初始化函数（延迟初始化，只在需要时执行）
function initializeMainMenuMod() {
	// 检查是否在主菜单界面
	const checkMainMenuAvailable = () => {
		// 检查Controls和MainMenu类是否可用
		if (typeof Controls === "undefined" || !Controls.getDefinition) {
			return false;
		}
		
		const definition = Controls.getDefinition("main-menu");
		if (!definition || !definition.createInstance) {
			return false;
		}
		
		// 检查其他必要的模块
		if (!window.LeaderOverlayImage) {
			return false;
		}
		
		return true;
	};
	
	// 如果模块已经可用，立即初始化
	if (checkMainMenuAvailable()) {
		console.log("Leader Overlay Main Menu: Mod initialization - TODO: implement function tracking");
		return;
	}
	
	// 如果模块不可用，等待一段时间后重试（但不报错）
	let retryCount = 0;
	const maxRetries = 50; // 最多重试5秒（50 * 100ms）
	
	const retryInterval = setInterval(() => {
		retryCount++;
		
		if (checkMainMenuAvailable()) {
			clearInterval(retryInterval);
			console.log("Leader Overlay Main Menu: Mod initialization - TODO: implement function tracking");
		} else if (retryCount >= maxRetries) {
			// 达到最大重试次数，静默退出（不报错）
			// 因为不在主菜单界面时，这些模块可能根本不存在
			clearInterval(retryInterval);
			// 不输出错误日志，因为这是正常情况
		}
	}, 100);
}

// 延迟执行初始化，给其他模块时间加载
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", () => {
		setTimeout(initializeMainMenuMod, 500);
	});
} else {
	setTimeout(initializeMainMenuMod, 500);
}
