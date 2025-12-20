/**
 * @file leader-select-panel-override.js
 * @description Leader Select Panel Override: Override swapLeaderInfo to show image overlay for image leaders
 */

// 使用公共工具函数
const waitForDependencies = window.PanelOverrideUtils?.waitForDependencies || (() => Promise.resolve());
const getCurrentLeaderID = window.PanelOverrideUtils?.getCurrentLeaderID || (async () => null);

/**
 * 检查图片是否成功加载（仅用于领袖选择界面）
 * @param {string} imageUrl - 图片URL
 * @returns {Promise<boolean>} 图片是否成功加载
 */
function checkImageLoaded(imageUrl) {
	return new Promise((resolve) => {
		if (!imageUrl) {
			resolve(false);
			return;
		}
		
		const img = new Image();
		let resolved = false;
		
		const cleanup = () => {
			if (!resolved) {
				resolved = true;
				img.onload = null;
				img.onerror = null;
			}
		};
		
		img.onload = () => {
			cleanup();
			resolve(true);
		};
		
		img.onerror = () => {
			cleanup();
			resolve(false);
		};
		
		// 设置超时（5秒）
		setTimeout(() => {
			if (!resolved) {
				cleanup();
				resolve(false);
			}
		}, 5000);
		
		img.src = imageUrl;
	});
}

/**
 * 验证并重试创建图片覆盖层（仅用于领袖选择界面）
 * @param {object} context - 面板上下文
 * @param {string} leaderID - 领袖ID
 * @param {number} maxRetries - 最大重试次数
 * @param {number} retryDelay - 重试延迟（毫秒）
 */
async function verifyAndRetryImageOverlay(context, leaderID, maxRetries = 3, retryDelay = 500) {
	if (!window.LeaderOverlayImage || !window.CustomLeaderConfig) {
		return;
	}
	
	// 确保只在领袖选择界面执行检查（避免影响其他界面）
	const currentPanelType = window.CustomLeaderConfig?.detectCurrentPanel?.();
	if (currentPanelType !== "leader-select") {
		return; // 不是领袖选择界面，不执行检查
	}
	
	// 获取图片路径
	const imageUrl = window.CustomLeaderConfig.getImagePath(leaderID);
	if (!imageUrl) {
		console.warn(`[Leader Select Panel] No image path found for leader: ${leaderID}`);
		return;
	}
	
	// 检查图片是否成功加载
	const isLoaded = await checkImageLoaded(imageUrl);
	
	if (!isLoaded) {
		console.warn(`[Leader Select Panel] Image failed to load: ${imageUrl}, retrying...`);
		
		// 重试创建覆盖层
		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
			
			// 再次检查图片是否加载
			const retryLoaded = await checkImageLoaded(imageUrl);
			if (retryLoaded) {
				console.log(`[Leader Select Panel] Image loaded successfully on retry ${attempt}`);
				// 重新创建覆盖层
				window.LeaderOverlayImage.tryRemoveImageOverlay(context, 0, "center");
				window.LeaderOverlayImage.tryCreateImageOverlay(context, 50, leaderID, "leader-select");
				return;
			}
		}
		
		console.error(`[Leader Select Panel] Failed to load image after ${maxRetries} retries: ${imageUrl}`);
	} else {
		// 图片加载成功，验证覆盖层是否存在
		setTimeout(() => {
			const container = window.LeaderOverlayImage?.getContainer?.(context) || 
			                  document.querySelector(".game-creator-leader-info-content");
			if (container) {
				const overlayBlock = container.querySelector(".leader-overlay-image-block");
				if (!overlayBlock) {
					console.warn(`[Leader Select Panel] Overlay block not found, recreating...`);
					window.LeaderOverlayImage.tryCreateImageOverlay(context, 50, leaderID, "leader-select");
				}
			}
		}, 200);
	}
}

// 重写 swapLeaderInfo 函数
async function overrideSwapLeaderInfo() {
	await waitForDependencies();
	
	// 尝试通过 Controls 获取 LeaderSelectPanel 类定义
	const definition = Controls?.getDefinition?.("leader-select-panel");
	if (!definition || !definition.createInstance) {
		console.error("Leader Select Panel Override: Cannot find LeaderSelectPanel class definition");
		return false;
	}
	
	const LeaderSelectPanelClass = definition.createInstance;
	
	// 检查类是否有 swapLeaderInfo 方法
	if (!LeaderSelectPanelClass.prototype || !LeaderSelectPanelClass.prototype.swapLeaderInfo) {
		return false;
	}
	
	// 保存原始函数
	const originalSwapLeaderInfo = LeaderSelectPanelClass.prototype.swapLeaderInfo;
	
	// 检查是否已经重写过（避免重复重写）
	if (originalSwapLeaderInfo._isOverridden) {
		return true;
	}
	
	// 重写函数
	LeaderSelectPanelClass.prototype.swapLeaderInfo = function() {
		// 先调用原始函数，保持原有逻辑
		const result = originalSwapLeaderInfo.call(this);
		
		// 在原始函数执行后，检查是否为图片领袖并显示/移除覆盖层
		setTimeout(async () => {
			const leaderID = await getCurrentLeaderID();
			
			if (!leaderID) {
				// 如果没有领袖ID，移除覆盖层
				if (window.LeaderOverlayImage) {
					window.LeaderOverlayImage.tryRemoveImageOverlay(this, 0);
				}
				return;
			}
			
			// 检查是否为图片领袖
			if (window.CustomLeaderConfig && window.CustomLeaderConfig.isImageLeader(leaderID)) {
				// 先移除旧的覆盖层（如果存在），然后创建新的
				if (window.LeaderOverlayImage) {
					// 先移除旧的覆盖层（立即移除，无延迟）
					window.LeaderOverlayImage.tryRemoveImageOverlay(this, 0, "center");
					// 然后创建新的图片覆盖层（显式传递 panelType）
					// 传递leaderID和panelType，让图片覆盖层模块从配置系统获取图片路径和显示配置
					window.LeaderOverlayImage.tryCreateImageOverlay(this, 50, leaderID, "leader-select");
					
					// 仅在领袖选择界面添加图片加载检查机制
					// 延迟检查，确保覆盖层已创建
					setTimeout(() => {
						verifyAndRetryImageOverlay(this, leaderID, 3, 500);
					}, 300);
				}
			} else {
				// 不是图片领袖，移除覆盖层（如果存在，立即移除）
				if (window.LeaderOverlayImage) {
					window.LeaderOverlayImage.tryRemoveImageOverlay(this, 0, "center");
				}
			}
		}, 50);
		
		return result;
	};
	
	// 标记已重写
	LeaderSelectPanelClass.prototype.swapLeaderInfo._isOverridden = true;
	
	console.log("Leader Select Panel Override: swapLeaderInfo function overridden");
	return true;
}

// 初始化函数
async function initializePanelOverride() {
	
	// 等待依赖加载
	await waitForDependencies();
	
	// 等待 Controls 对象和 LeaderSelectPanel 类可用
	const checkControls = setInterval(async () => {
		if (typeof Controls !== "undefined" && Controls.getDefinition) {
			const definition = Controls.getDefinition("leader-select-panel");
			if (definition && definition.createInstance) {
				clearInterval(checkControls);
				
				// 确保类已完全加载
				setTimeout(async () => {
					const success = await overrideSwapLeaderInfo();
				if (!success) {
					return;
				}
				}, 200);
			}
		}
	}, 100);
	
	// 最多等待10秒
	setTimeout(() => {
		clearInterval(checkControls);
		if (typeof Controls !== "undefined" && Controls.getDefinition) {
			overrideSwapLeaderInfo().then(success => {
				if (!success) {
					console.error("Leader Select Panel Override: Initialization failed - Cannot find LeaderSelectPanel");
				}
			});
		}
	}, 10000);
}

// 立即执行初始化
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initializePanelOverride);
} else {
	initializePanelOverride();
}

