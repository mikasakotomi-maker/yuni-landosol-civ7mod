/**
 * @file panel-override-utils.js
 * @description Panel Override Utils: Common utility functions for panel override modules
 */

// 等待依赖加载
function waitForDependencies() {
	return new Promise((resolve) => {
		if (window.CustomLeaderConfig && window.LeaderOverlayImage) {
			resolve();
			return;
		}
		
		let attempts = 0;
		const maxAttempts = 50; // 最多等待5秒
		const checkInterval = setInterval(() => {
			attempts++;
			if (window.CustomLeaderConfig && window.LeaderOverlayImage) {
				clearInterval(checkInterval);
				resolve();
			} else if (attempts >= maxAttempts) {
				clearInterval(checkInterval);
				resolve(); // 即使失败也resolve，避免阻塞
			}
		}, 100);
	});
}

// 获取当前领袖ID
async function getCurrentLeaderID() {
	try {
		const createGameModelModule = await import("/core/ui/shell/create-panels/create-game-model.js");
		const CreateGameModel = createGameModelModule.CreateGameModel;
		
		if (CreateGameModel && CreateGameModel.selectedLeader) {
			const leaderID = CreateGameModel.selectedLeader.leaderID || null;
			return leaderID;
		}
	} catch (error) {
		// Failed to import CreateGameModel
	}
	
	// 备用方法：尝试从UI元素或全局状态获取
	try {
		const leaderInfo = document.querySelector(".game-creator-leader-info-name")?.textContent || document.querySelector("[data-leader-id]")?.getAttribute("data-leader-id");
		if (leaderInfo && leaderInfo.startsWith("LEADER_")) {
			return leaderInfo;
		}
	} catch (error) {
		// Fallback UI query failed
	}
	
	return null;
}

// 导出函数供其他模块使用
window.PanelOverrideUtils = {
	waitForDependencies,
	getCurrentLeaderID
};

