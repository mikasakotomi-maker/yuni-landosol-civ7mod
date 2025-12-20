/**
 * @file leader-select-model-override.js
 * @description Leader Select Model Override: Override LeaderSelectModelManager methods to prevent 3D model loading for image leaders
 */

// 等待配置系统加载
function waitForConfig() {
	return new Promise((resolve) => {
		if (window.CustomLeaderConfig) {
			resolve();
			return;
		}
		
		let attempts = 0;
		const maxAttempts = 50; // 最多等待5秒
		const checkInterval = setInterval(() => {
			attempts++;
			if (window.CustomLeaderConfig) {
				clearInterval(checkInterval);
				resolve();
			} else if (attempts >= maxAttempts) {
				clearInterval(checkInterval);
				resolve(); // 即使失败也resolve，避免阻塞
			}
		}, 100);
	});
}

// 重写 showLeaderModels 函数
async function overrideShowLeaderModels() {
	await waitForConfig();
	
	try {
		// 动态导入 LeaderSelectModelManager
		const modelManagerModule = await import("/core/ui/shell/leader-select/leader-select-model-manager.chunk.js");
		const LeaderSelectModelManager = modelManagerModule.LeaderSelectModelManager || modelManagerModule.L;
		
		if (!LeaderSelectModelManager) {
			return false;
		}
		
		// 检查是否已经重写过
		if (LeaderSelectModelManager.showLeaderModels._isOverridden) {
			return true;
		}
		
		// 保存原始函数
		const originalShowLeaderModels = LeaderSelectModelManager.showLeaderModels.bind(LeaderSelectModelManager);
		
		// 重写函数
		LeaderSelectModelManager.showLeaderModels = function(leaderId) {
			// 检查是否为图片领袖
			if (window.CustomLeaderConfig && window.CustomLeaderConfig.isImageLeader(leaderId)) {
				
				// 对于图片领袖，我们需要：
				// 1. 激活相机（保持界面一致性）
				// 2. 清理之前的3D模型
				// 3. 不加载新的3D模型
				
				this.isVoPlaying = false;
				this.activateLeaderSelectCamera();
				
				// 清理之前的模型
				if (!this.isLeaderPicked && (leaderId == "" || this.currentLeaderAssetName == leaderId)) {
					return;
				}
				
				this.isLeaderPicked = false;
				this.currentLeaderAssetName = leaderId;
				
				// 清理模型组
				this.leaderSelectModelGroup?.clear();
				this.leaderPedestalModelGroup?.clear();
				this.leader3DModel = null;
				this._isRandomLeader = false;
				
				// 不加载3D模型，直接返回
				// 图片覆盖层会在 swapLeaderInfo 中处理
				return;
			}
			
			// 对于非图片领袖，正常调用原始函数
			return originalShowLeaderModels.call(this, leaderId);
		};
		
		// 标记已重写
		LeaderSelectModelManager.showLeaderModels._isOverridden = true;

		return true;
	} catch (error) {
		return false;
	}
}

// 重写 pickLeader 函数
async function overridePickLeader() {
	await waitForConfig();
	
	try {
		// 动态导入 LeaderSelectModelManager
		const modelManagerModule = await import("/core/ui/shell/leader-select/leader-select-model-manager.chunk.js");
		const LeaderSelectModelManager = modelManagerModule.LeaderSelectModelManager || modelManagerModule.L;
		
		if (!LeaderSelectModelManager) {
			return false;
		}
		
		// 检查是否已经重写过
		if (LeaderSelectModelManager.pickLeader._isOverridden) {
			return true;
		}
		
		// 保存原始函数
		const originalPickLeader = LeaderSelectModelManager.pickLeader.bind(LeaderSelectModelManager);
		
		// 重写函数
		LeaderSelectModelManager.pickLeader = function() {
			// 检查当前领袖是否为图片领袖
			if (window.CustomLeaderConfig && window.CustomLeaderConfig.isImageLeader(this.currentLeaderAssetName)) {
				
				// 对于图片领袖：
				// 1. 标记为已选择
				// 2. 清理3D模型
				// 3. 跳过动画序列
				// 4. 处理相机切换（如果需要）
				
				this.isLeaderPicked = true;
				
				// 清理模型组
				this.leaderSelectModelGroup?.clear();
				this.leaderPedestalModelGroup?.clear();
				this.leader3DModel = null;
				
				// 对于图片领袖，不需要动画序列
				// 但可能需要处理相机切换
				const isMobileViewExperience = UI.getViewExperience() == UIViewExperience.Mobile;
				if (!isMobileViewExperience) {
					// 可以保持当前相机或切换到确认视图的相机
					// 暂时保持当前相机
				}
				
				// 不调用原始函数，直接返回
				return;
			}
			
			// 对于非图片领袖，正常调用原始函数
			return originalPickLeader.call(this);
		};
		
		// 标记已重写
		LeaderSelectModelManager.pickLeader._isOverridden = true;

		return true;
	} catch (error) {
		return false;
	}
}

// 初始化函数
async function initializeModelOverride() {
	
	// 等待必要的模块加载
	await waitForConfig();
	
	// 等待 LeaderSelectModelManager 可用
	let attempts = 0;
	const maxAttempts = 50;
	const checkInterval = setInterval(async () => {
		attempts++;
		
		try {
			const modelManagerModule = await import("/core/ui/shell/leader-select/leader-select-model-manager.chunk.js");
			const LeaderSelectModelManager = modelManagerModule.LeaderSelectModelManager || modelManagerModule.L;
			
			if (LeaderSelectModelManager) {
				clearInterval(checkInterval);
				
				// 重写函数
				const success1 = await overrideShowLeaderModels();
				const success2 = await overridePickLeader();
				
				// Model override initialization completed
			}
		} catch (error) {
			// 模块可能还未加载，继续等待
		}
		
		if (attempts >= maxAttempts) {
			clearInterval(checkInterval);
		}
	}, 100);
}

// 立即执行初始化
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initializeModelOverride);
} else {
	initializeModelOverride();
}

