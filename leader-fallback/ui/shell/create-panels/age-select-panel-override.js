/**
 * @file age-select-panel-override.js
 * @description Age Select Panel Override: Adjust image overlay position and size for age selection panel
 */

// 使用公共工具函数
const waitForDependencies = window.PanelOverrideUtils?.waitForDependencies || (() => Promise.resolve());
const getCurrentLeaderID = window.PanelOverrideUtils?.getCurrentLeaderID || (async () => null);

// 调整图片覆盖层以适应时代选择面板
async function adjustOverlayForAgePanel() {
	const leaderID = await getCurrentLeaderID();
	
	if (!leaderID || !window.CustomLeaderConfig || !window.CustomLeaderConfig.isImageLeader(leaderID)) {
		return;
	}
	
	// 调整覆盖层位置和大小
	if (window.LeaderOverlayImage?.adjustOverlayForPanel) {
		window.LeaderOverlayImage.adjustOverlayForPanel(leaderID, "age-select");
	}
}

// 重写 onAttach 方法
async function overrideOnAttach() {
	await waitForDependencies();
	
	const definition = Controls?.getDefinition?.("age-select-panel");
	if (!definition || !definition.createInstance) {
		console.error("Age Select Panel Override: Cannot find AgeSelectPanel class definition");
		return false;
	}
	
	const AgeSelectPanelClass = definition.createInstance;
	
	if (!AgeSelectPanelClass.prototype || !AgeSelectPanelClass.prototype.onAttach) {
		console.error("Age Select Panel Override: AgeSelectPanel does not have onAttach method");
		return false;
	}
	
	const originalOnAttach = AgeSelectPanelClass.prototype.onAttach;
	
	// 检查是否已经重写过
	if (originalOnAttach._isOverridden) {
		return true;
	}
	
	AgeSelectPanelClass.prototype.onAttach = function() {
		const result = originalOnAttach.call(this);
		
		// 在面板附加后，调整图片覆盖层
		setTimeout(() => {
			adjustOverlayForAgePanel();
		}, 100);
		
		return result;
	};
	
	originalOnAttach._isOverridden = true;
	
	return true;
}

// 重写 selectAge 方法（当选择时代时也可能需要调整）
async function overrideSelectAge() {
	await waitForDependencies();
	
	const definition = Controls?.getDefinition?.("age-select-panel");
	if (!definition || !definition.createInstance) {
		return false;
	}
	
	const AgeSelectPanelClass = definition.createInstance;
	
	if (!AgeSelectPanelClass.prototype || !AgeSelectPanelClass.prototype.selectAge) {
		return false;
	}
	
	const originalSelectAge = AgeSelectPanelClass.prototype.selectAge;
	
	if (originalSelectAge._isOverridden) {
		return true;
	}
	
	AgeSelectPanelClass.prototype.selectAge = function(ageButton) {
		const result = originalSelectAge.call(this, ageButton);
		
		// 选择时代后，调整图片覆盖层（以防容器大小变化）
		setTimeout(() => {
			adjustOverlayForAgePanel();
		}, 50);
		
		return result;
	};
	
	originalSelectAge._isOverridden = true;
	
	return true;
}

// 初始化函数
async function initializeAgePanelOverride() {
	console.log("Age Select Panel Override: Initialization started");
	
	await waitForDependencies();
	
	const checkControls = setInterval(async () => {
		if (typeof Controls !== "undefined" && Controls.getDefinition) {
			const definition = Controls.getDefinition("age-select-panel");
			if (definition && definition.createInstance) {
				clearInterval(checkControls);
				
				setTimeout(async () => {
					const success1 = await overrideOnAttach();
					const success2 = await overrideSelectAge();
					
					if (success1 || success2) {
						console.log("Age Select Panel Override: Initialization successful");
					}
				}, 200);
			}
		}
	}, 100);
	
	setTimeout(() => {
		clearInterval(checkControls);
		if (typeof Controls !== "undefined" && Controls.getDefinition) {
			overrideOnAttach();
			overrideSelectAge();
		}
	}, 10000);
}

// 立即执行初始化
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initializeAgePanelOverride);
} else {
	initializeAgePanelOverride();
}

