/**
 * @file civ-select-panel-override.js
 * @description Civ Select Panel Override: Adjust image overlay position and size for civilization selection panel
 */

// 使用公共工具函数
const waitForDependencies = window.PanelOverrideUtils?.waitForDependencies || (() => Promise.resolve());
const getCurrentLeaderID = window.PanelOverrideUtils?.getCurrentLeaderID || (async () => null);

// 调整图片覆盖层以适应文明选择面板
async function adjustOverlayForCivPanel() {
	const leaderID = await getCurrentLeaderID();
	
	if (!leaderID || !window.CustomLeaderConfig || !window.CustomLeaderConfig.isImageLeader(leaderID)) {
		return;
	}
	
	// 调整覆盖层位置和大小
	if (window.LeaderOverlayImage?.adjustOverlayForPanel) {
		window.LeaderOverlayImage.adjustOverlayForPanel(leaderID, "civ-select");
	}
}

// 重写 onAttach 方法
async function overrideOnAttach() {
	await waitForDependencies();
	
	const definition = Controls?.getDefinition?.("civ-select-panel");
	if (!definition || !definition.createInstance) {
		console.error("Civ Select Panel Override: Cannot find CivSelectPanel class definition");
		return false;
	}
	
	const CivSelectPanelClass = definition.createInstance;
	
	if (!CivSelectPanelClass.prototype || !CivSelectPanelClass.prototype.onAttach) {
		console.error("Civ Select Panel Override: CivSelectPanel does not have onAttach method");
		return false;
	}
	
	const originalOnAttach = CivSelectPanelClass.prototype.onAttach;
	
	// 检查是否已经重写过
	if (originalOnAttach._isOverridden) {
		return true;
	}
	
	CivSelectPanelClass.prototype.onAttach = function() {
		const result = originalOnAttach.call(this);
		
		// 在面板附加后，调整图片覆盖层
		setTimeout(() => {
			adjustOverlayForCivPanel();
		}, 100);
		
		return result;
	};
	
	originalOnAttach._isOverridden = true;

	return true;
}

// 重写 selectCivInfo 方法（当选择文明时也可能需要调整）
async function overrideSelectCivInfo() {
	await waitForDependencies();
	
	const definition = Controls?.getDefinition?.("civ-select-panel");
	if (!definition || !definition.createInstance) {
		return false;
	}
	
	const CivSelectPanelClass = definition.createInstance;
	
	if (!CivSelectPanelClass.prototype || !CivSelectPanelClass.prototype.selectCivInfo) {
		return false;
	}
	
	const originalSelectCivInfo = CivSelectPanelClass.prototype.selectCivInfo;
	
	if (originalSelectCivInfo._isOverridden) {
		return true;
	}
	
	CivSelectPanelClass.prototype.selectCivInfo = function(civButton) {
		const result = originalSelectCivInfo.call(this, civButton);
		
		// 选择文明后，调整图片覆盖层（以防容器大小变化）
		setTimeout(() => {
			adjustOverlayForCivPanel();
		}, 50);
		
		return result;
	};
	
	originalSelectCivInfo._isOverridden = true;

	return true;
}

// 重写 updateLeaderBox 方法（当更新领袖盒子时也可能需要调整）
async function overrideUpdateLeaderBox() {
	await waitForDependencies();
	
	const definition = Controls?.getDefinition?.("civ-select-panel");
	if (!definition || !definition.createInstance) {
		return false;
	}
	
	const CivSelectPanelClass = definition.createInstance;
	
	// 检查类是否有 updateLeaderBox 方法（可能在基类中）
	if (!CivSelectPanelClass.prototype || !CivSelectPanelClass.prototype.updateLeaderBox) {
		// 如果没有，尝试从基类获取
		try {
			const GameCreationPanelBaseModule = await import("/core/ui/shell/create-panels/game-creation-panel-base.chunk.js");
			const GameCreationPanelBase = GameCreationPanelBaseModule.GameCreationPanelBase;
			
			if (!GameCreationPanelBase || !GameCreationPanelBase.prototype || !GameCreationPanelBase.prototype.updateLeaderBox) {
				return false;
			}
			
			const originalUpdateLeaderBox = GameCreationPanelBase.prototype.updateLeaderBox;
			
			if (originalUpdateLeaderBox._isOverriddenForCivPanel) {
				return true;
			}
			
			GameCreationPanelBase.prototype.updateLeaderBox = function() {
				const result = originalUpdateLeaderBox.call(this);
				
				// 检查当前面板是否是文明选择面板
				if (this instanceof CivSelectPanelClass) {
					// 更新领袖盒子后，调整图片覆盖层
					setTimeout(() => {
						adjustOverlayForCivPanel();
					}, 50);
				}
				
				return result;
			};
			
			originalUpdateLeaderBox._isOverriddenForCivPanel = true;

			return true;
		} catch (error) {
			console.warn("Civ Select Panel Override: Failed to override updateLeaderBox", error);
			return false;
		}
	}
	
	// 如果类本身有 updateLeaderBox 方法，直接重写
	const originalUpdateLeaderBox = CivSelectPanelClass.prototype.updateLeaderBox;
	
	if (originalUpdateLeaderBox._isOverridden) {
		return true;
	}
	
	CivSelectPanelClass.prototype.updateLeaderBox = function() {
		const result = originalUpdateLeaderBox.call(this);
		
		// 更新领袖盒子后，调整图片覆盖层
		setTimeout(() => {
			adjustOverlayForCivPanel();
		}, 50);
		
		return result;
	};
	
	originalUpdateLeaderBox._isOverridden = true;
	
	return true;
}

// 初始化函数
async function initializeCivPanelOverride() {
	console.log("Civ Select Panel Override: Initialization started");
	
	await waitForDependencies();
	
	const checkControls = setInterval(async () => {
		if (typeof Controls !== "undefined" && Controls.getDefinition) {
			const definition = Controls.getDefinition("civ-select-panel");
			if (definition && definition.createInstance) {
				clearInterval(checkControls);
				
				setTimeout(async () => {
					const success1 = await overrideOnAttach();
					const success2 = await overrideSelectCivInfo();
					const success3 = await overrideUpdateLeaderBox();
					
					if (success1 || success2 || success3) {
						console.log("Civ Select Panel Override: Initialization successful");
					}
				}, 200);
			}
		}
	}, 100);
	
	setTimeout(() => {
		clearInterval(checkControls);
		if (typeof Controls !== "undefined" && Controls.getDefinition) {
			overrideOnAttach();
			overrideSelectCivInfo();
			overrideUpdateLeaderBox();
		}
	}, 10000);
}

// 立即执行初始化
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initializeCivPanelOverride);
} else {
	initializeCivPanelOverride();
}

