/**
 * @file diplomacy-main.js
 * @description Diplomacy Main: Main entry point for diplomacy model overrides system
 */

// 全局变量 - 定义为window属性，确保所有模块都可以访问
window.LeaderModelManagerClass = null;

/**
 * 初始化外交模型重写系统
 */
async function initializeDiplomacyOverride() {
	try {
		// 等待配置系统加载
		try {
			// Civ7 中脚本加载顺序不确定，这里必须先确认 DiplomacyConfig 是否已就绪
			if (typeof window !== "undefined" &&
				window.DiplomacyConfig &&
				typeof window.DiplomacyConfig.waitForConfig === "function") {
				await window.DiplomacyConfig.waitForConfig();
			}
		} catch (error) {
			// 配置等待失败时，不阻塞后续流程，依赖各模块内部的安全降级逻辑
			console.error("[Diplomacy Main] waitForConfig failed or not available:", error);
		}

		// 动态导入外交管理器模块
		let diplomacyModule;
		try {
			diplomacyModule = await import("/base-standard/ui/diplomacy/diplomacy-manager.js");
		} catch (error) {
			return;
		}

		if (!diplomacyModule) {
			return;
		}

		// 获取类和实例
		const LeaderModelManagerInstance = diplomacyModule.L; // 这是导出的实例
		window.LeaderModelManagerClass = LeaderModelManagerInstance?.constructor || diplomacyModule.LeaderModelManager;

		if (!LeaderModelManagerInstance) {
			return;
		}

		if (!window.LeaderModelManagerClass) {
			return;
		}

		// 应用所有重写
		applyAllOverrides(LeaderModelManagerInstance, window.LeaderModelManagerClass);
	} catch (error) {
	}
}

/**
 * 应用所有重写函数
 */
function applyAllOverrides(instance, classRef) {
	try {
		// 应用序列重写
		if (window.DiplomacySequenceHandlers) {
			try {
				window.DiplomacySequenceHandlers.overrideShowLeadersFirstMeet(instance, classRef);
			} catch (error) {
			}

			try {
				window.DiplomacySequenceHandlers.overrideShowLeadersDeclareWar(instance, classRef);
			} catch (error) {
			}

			try {
				window.DiplomacySequenceHandlers.overrideShowLeadersAcceptPeace(instance, classRef);
			} catch (error) {
			}

			try {
				window.DiplomacySequenceHandlers.overrideShowLeadersRejectPeace(instance, classRef);
			} catch (error) {
			}

			try {
				window.DiplomacySequenceHandlers.overrideShowLeadersDefeat(instance, classRef);
			} catch (error) {
			}

			try {
				window.DiplomacySequenceHandlers.overrideShowLeaderModels(instance, classRef);
			} catch (error) {
			}

			try {
				window.DiplomacySequenceHandlers.overrideShowLeftLeaderModel(instance, classRef);
			} catch (error) {
			}

			try {
				window.DiplomacySequenceHandlers.overrideShowRightLeaderModel(instance, classRef);
			} catch (error) {
			}

			// 应用玩家选择后的状态变化处理
			try {
				window.DiplomacySequenceHandlers.overrideBeginAcknowledgePlayerSequence(instance, classRef);
			} catch (error) {
			}

			try {
				window.DiplomacySequenceHandlers.overrideBeginHostileAcknowledgePlayerSequence(instance, classRef);
			} catch (error) {
			}

			try {
				window.DiplomacySequenceHandlers.overrideBeginAcknowledgePositiveOtherSequence(instance, classRef);
			} catch (error) {
			}

			try {
				window.DiplomacySequenceHandlers.overrideBeginAcknowledgeNegativeOtherSequence(instance, classRef);
			} catch (error) {
			}

			try {
				window.DiplomacySequenceHandlers.overrideBeginAcknowledgeOtherSequence(instance, classRef);
			} catch (error) {
			}
		}

		// 应用原型方法重写
		if (window.DiplomacyCoreOverrides) {
			try {
				window.DiplomacyCoreOverrides.overrideClear();
			} catch (error) {
			}

			try {
				window.DiplomacyCoreOverrides.overrideExitSimpleDiplomacyScene();
			} catch (error) {
			}
		}
	} catch (error) {
	}
}

// 启动初始化
engine.whenReady.then(() => {
	initializeDiplomacyOverride();
});
