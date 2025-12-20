/**
 * @file game-setup-panel-override.js
 * @description Game Setup Panel Override: Adjust image overlay position and size for game setup panel
 */

// 使用公共工具函数
const waitForDependencies = window.PanelOverrideUtils?.waitForDependencies || (() => Promise.resolve());
const getCurrentLeaderID = window.PanelOverrideUtils?.getCurrentLeaderID || (async () => null);

// 调整图片覆盖层以适应游戏设置面板
async function adjustOverlayForGameSetupPanel() {
	const leaderID = await getCurrentLeaderID();

	if (!leaderID) {
		return;
	}

	if (!window.CustomLeaderConfig || !window.CustomLeaderConfig.isImageLeader(leaderID)) {
		return;
	}
	// 调整覆盖层位置和大小
	if (window.LeaderOverlayImage?.adjustOverlayForPanel) {
		window.LeaderOverlayImage.adjustOverlayForPanel(leaderID, "game-setup");
	}
}

// 重写 onAttach 方法
async function overrideOnAttach() {
	await waitForDependencies();
	
	const definition = Controls?.getDefinition?.("game-setup-panel");
	if (!definition || !definition.createInstance) {
		return false;
	}
	
	const GameSetupPanelClass = definition.createInstance;
	
	if (!GameSetupPanelClass.prototype || !GameSetupPanelClass.prototype.onAttach) {
		return false;
	}
	
	const originalOnAttach = GameSetupPanelClass.prototype.onAttach;
	
	// 检查是否已经重写过
	if (originalOnAttach._isOverridden) {
		return true;
	}
	
	GameSetupPanelClass.prototype.onAttach = function() {
		const result = originalOnAttach.call(this);
		
		// 在面板附加后，调整图片覆盖层
		setTimeout(() => {
			adjustOverlayForGameSetupPanel();
		}, 100);
		
		return result;
	};
	
	originalOnAttach._isOverridden = true;

	return true;
}

// 重写 onInitialize 方法
async function overrideOnInitialize() {
	await waitForDependencies();
	
	const definition = Controls?.getDefinition?.("game-setup-panel");
	if (!definition || !definition.createInstance) {
		return false;
	}
	
	const GameSetupPanelClass = definition.createInstance;
	
	if (!GameSetupPanelClass.prototype || !GameSetupPanelClass.prototype.onInitialize) {
		return false;
	}
	
	const originalOnInitialize = GameSetupPanelClass.prototype.onInitialize;
	
	// 检查是否已经重写过
	if (originalOnInitialize._isOverridden) {
		console.log("Game Setup Panel Override: onInitialize already overridden");
		return true;
	}
	
	GameSetupPanelClass.prototype.onInitialize = function() {
		console.log("Game Setup Panel Override: onInitialize executed");
		const result = originalOnInitialize.call(this);
		
		// 在初始化后，buildLeaderBox已调用，调整图片覆盖层
		setTimeout(() => {
			adjustOverlayForGameSetupPanel();
		}, 150);
		
		return result;
	};
	
	originalOnInitialize._isOverridden = true;
	
	console.log("Game Setup Panel Override: onInitialize function overridden");
	return true;
}

// 重写 refreshGameOptions 方法（选项更新时可能影响领袖显示）
async function overrideRefreshGameOptions() {
	await waitForDependencies();
	
	const definition = Controls?.getDefinition?.("game-setup-panel");
	if (!definition || !definition.createInstance) {
		return false;
	}
	
	const GameSetupPanelClass = definition.createInstance;
	
	if (!GameSetupPanelClass.prototype || !GameSetupPanelClass.prototype.refreshGameOptions) {
		console.error("Game Setup Panel Override: GameSetupPanel does not have refreshGameOptions method");
		return false;
	}
	
	const originalRefreshGameOptions = GameSetupPanelClass.prototype.refreshGameOptions;
	
	// 检查是否已经重写过
	if (originalRefreshGameOptions._isOverridden) {
		console.log("Game Setup Panel Override: refreshGameOptions already overridden");
		return true;
	}
	
	GameSetupPanelClass.prototype.refreshGameOptions = function() {
		console.log("Game Setup Panel Override: refreshGameOptions executed");
		const result = originalRefreshGameOptions.call(this);
		
		// 刷新选项后，调整图片覆盖层（以防容器变化）
		setTimeout(() => {
			adjustOverlayForGameSetupPanel();
		}, 100);
		
		return result;
	};
	
	originalRefreshGameOptions._isOverridden = true;
	
	console.log("Game Setup Panel Override: refreshGameOptions function overridden");
	return true;
}

// 重写 updateLeaderBox 方法
async function overrideUpdateLeaderBox() {
	await waitForDependencies();
	
	const definition = Controls?.getDefinition?.("game-setup-panel");
	if (!definition || !definition.createInstance) {
		return false;
	}
	
	const GameSetupPanelClass = definition.createInstance;
	
	// 检查类是否有 updateLeaderBox 方法（可能在基类中）
	if (!GameSetupPanelClass.prototype || !GameSetupPanelClass.prototype.updateLeaderBox) {
		// 如果没有，尝试从基类获取
		try {
			const GameCreationPanelBaseModule = await import("/core/ui/shell/create-panels/game-creation-panel-base.chunk.js");
			const GameCreationPanelBase = GameCreationPanelBaseModule.GameCreationPanelBase;
			
			if (!GameCreationPanelBase || !GameCreationPanelBase.prototype || !GameCreationPanelBase.prototype.updateLeaderBox) {
				console.warn("Game Setup Panel Override: Base class updateLeaderBox not found");
				return false;
			}
			
			const originalUpdateLeaderBox = GameCreationPanelBase.prototype.updateLeaderBox;
			
			if (originalUpdateLeaderBox._isOverriddenForGameSetupPanel) {
				console.log("Game Setup Panel Override: updateLeaderBox already overridden in base");
				return true;
			}
			
			GameCreationPanelBase.prototype.updateLeaderBox = function() {
				const result = originalUpdateLeaderBox.call(this);
				
				// 检查当前面板是否是游戏设置面板（通过tagName或class）
				const panelElement = this.Root || document.querySelector("game-setup-panel");
				if (panelElement && (panelElement.tagName === "GAME-SETUP-PANEL" || panelElement.classList.contains("game-setup-panel"))) {
					console.log("Game Setup Panel Override: updateLeaderBox in game-setup context");
					// 更新领袖盒子后，调整图片覆盖层
					setTimeout(() => {
						adjustOverlayForGameSetupPanel();
					}, 50);
				}
				
				return result;
			};
			
			originalUpdateLeaderBox._isOverriddenForGameSetupPanel = true;
			
			console.log("Game Setup Panel Override: updateLeaderBox function overridden in base");
			return true;
		} catch (error) {
			console.warn("Game Setup Panel Override: Failed to override updateLeaderBox", error);
			return false;
		}
	}
	
	// 如果类本身有 updateLeaderBox 方法，直接重写
	const originalUpdateLeaderBox = GameSetupPanelClass.prototype.updateLeaderBox;
	
	if (originalUpdateLeaderBox._isOverridden) {
		return true;
	}
	
	GameSetupPanelClass.prototype.updateLeaderBox = function() {
		console.log("Game Setup Panel Override: updateLeaderBox executed in class");
		const result = originalUpdateLeaderBox.call(this);
		
		// 更新领袖盒子后，调整图片覆盖层
		setTimeout(() => {
			adjustOverlayForGameSetupPanel();
		}, 50);
		
		return result;
	};
	
	originalUpdateLeaderBox._isOverridden = true;
	
	console.log("Game Setup Panel Override: updateLeaderBox function overridden in class");
	return true;
}

// 初始化函数
async function initializeGameSetupPanelOverride() {
	console.log("Game Setup Panel Override: Initialization started");
	
	await waitForDependencies();
	
	const checkControls = setInterval(async () => {
		if (typeof Controls !== "undefined" && Controls.getDefinition) {
			const definition = Controls.getDefinition("game-setup-panel");
			if (definition && definition.createInstance) {
				clearInterval(checkControls);
				
				setTimeout(async () => {
					const success1 = await overrideOnAttach();
					const success2 = await overrideOnInitialize();
					const success3 = await overrideRefreshGameOptions();
					const success4 = await overrideUpdateLeaderBox();
					
					if (success1 || success2 || success3 || success4) {
						console.log("Game Setup Panel Override: Initialization successful");
					} else {
						console.warn("Game Setup Panel Override: No overrides succeeded");
					}
				}, 200);
			}
		}
	}, 100);
	
	setTimeout(() => {
		clearInterval(checkControls);
		if (typeof Controls !== "undefined" && Controls.getDefinition) {
			overrideOnAttach();
			overrideOnInitialize();
			overrideRefreshGameOptions();
			overrideUpdateLeaderBox();
		}
	}, 10000);
}

// 立即执行初始化
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initializeGameSetupPanelOverride);
} else {
	initializeGameSetupPanelOverride();
}
