/**
 * @file diplomacy-core-overrides.js
 * @description Diplomacy Core Overrides: Core override functions for basic leader model management
 */

// 由于 Civ7 中脚本加载顺序和速度不可预期，这里**绝不能**
// 在顶层直接解构 `window.DiplomacyConfig`，否则在其尚未初始化时会抛错。
// 改为通过安全包装函数，在真正需要时再去读取全局对象。

/**
 * 安全调用：判断是否为图片领袖
 * - 优先使用全局函数 `isImageLeader`（由 diplomacy-config.js 定义）
 * - 其次尝试 `window.DiplomacyConfig.isImageLeader`
 * - 任一途径不存在或出错则返回 false，不抛异常
 */
function safeIsImageLeader(leaderID) {
	try {
		if (!leaderID) {
			return false;
		}

		if (typeof isImageLeader === "function") {
			return isImageLeader(leaderID);
		}

		if (typeof window !== "undefined" &&
			window.DiplomacyConfig &&
			typeof window.DiplomacyConfig.isImageLeader === "function") {
			return window.DiplomacyConfig.isImageLeader(leaderID);
		}
	} catch (error) {
		console.error("[Diplomacy Core] safeIsImageLeader failed:", error);
	}

	return false;
}

/**
 * 安全调用：从 playerID 获取领袖字符串 ID
 * - 优先使用全局函数 `getLeaderStringIDFromPlayerID`
 * - 其次尝试 `window.DiplomacyConfig.getLeaderStringIDFromPlayerID`
 * - 任一途径不存在或出错则返回 null，不抛异常
 */
function safeGetLeaderStringIDFromPlayerID(playerID) {
	try {
		if (typeof getLeaderStringIDFromPlayerID === "function") {
			return getLeaderStringIDFromPlayerID(playerID);
		}

		if (typeof window !== "undefined" &&
			window.DiplomacyConfig &&
			typeof window.DiplomacyConfig.getLeaderStringIDFromPlayerID === "function") {
			return window.DiplomacyConfig.getLeaderStringIDFromPlayerID(playerID);
		}
	} catch (error) {
		console.error("[Diplomacy Core] safeGetLeaderStringIDFromPlayerID failed:", error);
	}

	return null;
}

/**
 * 安全调用：根据外交序列推断领袖状态
 * - 优先使用全局函数 `getLeaderStateFromSequence`
 * - 其次尝试 `window.DiplomacyConfig.getLeaderStateFromSequence`
 * - 任一途径不存在或出错则返回 "neutral"
 */
function safeGetLeaderStateFromSequence(playerID, sequenceType, position, context) {
	try {
		if (typeof getLeaderStateFromSequence === "function") {
			return getLeaderStateFromSequence(playerID, sequenceType, position, context);
		}

		if (typeof window !== "undefined" &&
			window.DiplomacyConfig &&
			typeof window.DiplomacyConfig.getLeaderStateFromSequence === "function") {
			return window.DiplomacyConfig.getLeaderStateFromSequence(playerID, sequenceType, position, context);
		}
	} catch (error) {
		console.warn("[Diplomacy Core] safeGetLeaderStateFromSequence failed, fallback to neutral:", error);
	}

	// 出错或不可用时统一回退到中立状态，避免打断外交流程
	return "neutral";
}

/**
 * 处理图片领袖的显示逻辑（显示图片覆盖层）
 * @param {string} leaderID - 领袖ID
 * @param {string} position - 位置 ("left" 或 "right")
 * @param {object} context - LeaderModelManager 上下文
 * @param {string} state - 可选的状态参数（预留接口，用于将来的状态映射）
 * @param {boolean} skipCleanup - 是否跳过清理步骤（用于首次见面场景）
 * @returns {boolean} 是否成功处理
 */
function handleImageLeaderDisplay(leaderID, position, context, state = null, skipCleanup = false) {
	try {
		// 配置系统可能尚未就绪，这里使用安全包装函数
		if (!leaderID || !safeIsImageLeader(leaderID)) {
			return false;
		}

		// 先立即移除指定位置的旧覆盖层（带安全检查）
		if (window.LeaderOverlayImage && typeof window.LeaderOverlayImage.tryRemoveDiplomacyImageOverlay === "function") {
			try {
				window.LeaderOverlayImage.tryRemoveDiplomacyImageOverlay(leaderID, position, 0);
			} catch (removeError) {
				console.error(`[Diplomacy Core] Failed to remove old overlay for leader ${leaderID}:`, removeError);
				// 继续执行，尝试创建新覆盖层
			}
		} else if (!window.LeaderOverlayImage) {
			console.error(`[Diplomacy Core] LeaderOverlayImage not available when trying to remove overlay for leader ${leaderID}`);
		}

		// 只有在需要时才进行清理（避免清除已加载的3D模型）
		if (!skipCleanup) {
			try {
				// 清理之前的模型
				if (typeof context.clear === "function") {
					context.clear();
				}

				// 显示环境
				if (typeof context.showDiplomaticSceneEnvironment === "function") {
					context.showDiplomaticSceneEnvironment();
				}

				// 激活相机
				if (typeof context.simpleLeaderPopUpCameraAnimation === "function") {
					context.simpleLeaderPopUpCameraAnimation(false, 0);
				}

				context.isLeaderShowing = true;
			} catch (cleanupError) {
				console.warn(`[Diplomacy Core] Failed to cleanup for leader ${leaderID}:`, cleanupError);
				// 继续执行，尝试显示图片覆盖层
			}
		}

		// 显示图片覆盖层，传递状态参数（带重试机制）
		const attemptCreateOverlay = (retryCount = 0) => {
			const maxRetries = 10; // 最多重试10次
			const retryDelay = 200; // 每次重试间隔200ms
			
			if (window.LeaderOverlayImage && typeof window.LeaderOverlayImage.tryCreateDiplomacyImageOverlay === "function") {
				// 对于单侧显示（如只有左侧或右侧），添加延迟以匹配渐现效果
				const creationDelay = (position === "left" || position === "right") ? 300 : 0;
				setTimeout(() => {
					try {
						// 如果已经提供了state，直接使用；否则从序列类型和上下文推断
						let finalState = state;
						if (!finalState && context) {
							// 尝试从context获取playerID
							let playerID = null;
							if (position === "left") {
								playerID = typeof GameContext !== "undefined" ? GameContext.localPlayerID : null;
							} else {
								// 右侧：尝试从DiplomacyManager获取
								if (typeof DiplomacyManager !== "undefined" && DiplomacyManager.currentDiplomacyDialogData) {
									playerID = DiplomacyManager.currentDiplomacyDialogData.OtherPlayerID;
								}
							}
							
							// 如果有 playerID 和序列类型，使用安全函数推断状态
							if (playerID && context.currentSequenceType) {
								finalState = safeGetLeaderStateFromSequence(playerID, context.currentSequenceType, position, context);
							} else {
								// 否则使用默认状态
								finalState = "neutral";
							}
						}
						
						// 如果还是没有state，使用默认值
						if (!finalState) {
							finalState = "neutral";
						}
						
						console.error(`[Diplomacy Core] Creating overlay for ${leaderID} at ${position} with state: ${finalState}`);
						window.LeaderOverlayImage.tryCreateDiplomacyImageOverlay(leaderID, position, 0, finalState);
					} catch (createError) {
						console.error(`[Diplomacy Core] Failed to create overlay for leader ${leaderID}:`, createError);
						// 不抛出异常，让其他领袖可以正常显示
					}
				}, creationDelay);
			} else if (retryCount < maxRetries) {
				// LeaderOverlayImage 不可用，等待后重试
				console.error(`[Diplomacy Core] LeaderOverlayImage not available for leader ${leaderID}, retrying (${retryCount + 1}/${maxRetries})...`);
				setTimeout(() => attemptCreateOverlay(retryCount + 1), retryDelay);
			} else {
				// 达到最大重试次数，记录错误
				console.error(`[Diplomacy Core] LeaderOverlayImage not available after ${maxRetries} retries for leader ${leaderID}. Overlay creation failed.`);
			}
		};
		
		// 开始尝试创建覆盖层
		attemptCreateOverlay();

		return true;
	} catch (error) {
		console.error(`[Diplomacy Core] Error handling image leader display for leader ${leaderID || 'unknown'}:`, error);
		return false; // 返回false表示失败，但不抛出异常
	}
}

// 重写 showRightLeaderModel 函数（重写类原型方法）
function overrideShowRightLeaderModel() {
	if (!window.LeaderModelManagerClass) {
		return false;
	}

	// 检查是否已经重写过
	if (window.LeaderModelManagerClass.prototype.showRightLeaderModel._isOverridden) {
		return true;
	}

	// 保存原始函数
	const originalShowRightLeaderModel = window.LeaderModelManagerClass.prototype.showRightLeaderModel;

	// 重写原型方法（保留作为备用，但主要使用实例方法）
	window.LeaderModelManagerClass.prototype.showRightLeaderModel = function(playerID) {
		try {
			const leaderID = safeGetLeaderStringIDFromPlayerID(playerID);

			// 如果是图片领袖，处理图片显示并返回
			if (leaderID && safeIsImageLeader(leaderID) && handleImageLeaderDisplay(leaderID, "right", this)) {
				return;
			}

			// 对于非图片领袖，正常调用原始函数
			return originalShowRightLeaderModel.call(this, playerID);
		} catch (error) {
			console.error(`[Diplomacy Core] Error in showRightLeaderModel for player ${playerID}:`, error);
			// 发生错误时，尝试调用原始函数作为后备方案
			try {
				return originalShowRightLeaderModel.call(this, playerID);
			} catch (fallbackError) {
				console.error(`[Diplomacy Core] Fallback also failed:`, fallbackError);
				// 如果原始函数也失败，至少不抛出异常，让其他领袖可以正常显示
			}
		}
	};

	// 标记已重写
	window.LeaderModelManagerClass.prototype.showRightLeaderModel._isOverridden = true;

	return true;
}

// 重写 showLeftLeaderModel 函数（重写类原型方法）
function overrideShowLeftLeaderModel() {
	if (!window.LeaderModelManagerClass) {
		return false;
	}

	if (window.LeaderModelManagerClass.prototype.showLeftLeaderModel._isOverridden) {
		return true;
	}

	const originalShowLeftLeaderModel = window.LeaderModelManagerClass.prototype.showLeftLeaderModel;

	window.LeaderModelManagerClass.prototype.showLeftLeaderModel = function(playerID) {
		try {
			const leaderID = safeGetLeaderStringIDFromPlayerID(playerID);

			// 如果是图片领袖，处理图片显示并返回
			if (leaderID && safeIsImageLeader(leaderID) && handleImageLeaderDisplay(leaderID, "left", this)) {
				return;
			}

			return originalShowLeftLeaderModel.call(this, playerID);
		} catch (error) {
			console.error(`[Diplomacy Core] Error in showLeftLeaderModel for player ${playerID}:`, error);
			// 发生错误时，尝试调用原始函数作为后备方案
			try {
				return originalShowLeftLeaderModel.call(this, playerID);
			} catch (fallbackError) {
				console.error(`[Diplomacy Core] Fallback also failed:`, fallbackError);
				// 如果原始函数也失败，至少不抛出异常，让其他领袖可以正常显示
			}
		}
	};

	window.LeaderModelManagerClass.prototype.showLeftLeaderModel._isOverridden = true;

	return true;
}

// 重写 showLeaderModels 函数（同时显示两个领袖，重写类原型方法）
function overrideShowLeaderModels() {
	if (!window.LeaderModelManagerClass) {
		return false;
	}

	if (window.LeaderModelManagerClass.prototype.showLeaderModels._isOverridden) {
		return true;
	}

	const originalShowLeaderModels = window.LeaderModelManagerClass.prototype.showLeaderModels;

	window.LeaderModelManagerClass.prototype.showLeaderModels = function(playerID1, playerID2) {
		try {
			// 获取两个领袖的字符串ID
			const leaderID1 = safeGetLeaderStringIDFromPlayerID(playerID1);
			const leaderID2 = safeGetLeaderStringIDFromPlayerID(playerID2);

			const isImageLeader1 = leaderID1 && safeIsImageLeader(leaderID1);
			const isImageLeader2 = leaderID2 && safeIsImageLeader(leaderID2);

			// 如果至少有一个是图片领袖
			if (isImageLeader1 || isImageLeader2) {
				try {
					// 清理、显示环境、激活相机
					if (typeof this.clear === "function") {
						this.clear();
					}
					if (typeof this.showDiplomaticSceneEnvironment === "function") {
						this.showDiplomaticSceneEnvironment();
					}
					if (typeof this.simpleLeaderPopUpCameraAnimation === "function") {
						this.simpleLeaderPopUpCameraAnimation(false, 0);
					}
					this.isLeaderShowing = true;
				} catch (setupError) {
					console.warn(`[Diplomacy Core] Failed to setup scene for leaders ${leaderID1}/${leaderID2}:`, setupError);
					// 继续执行，尝试显示图片覆盖层
				}

				// 显示图片覆盖层（每个领袖独立处理，一个失败不影响另一个，带重试机制）
				if (isImageLeader1) {
					const attemptCreateLeftOverlay = (retryCount = 0) => {
						const maxRetries = 10;
						const retryDelay = 200;
						
						if (window.LeaderOverlayImage && typeof window.LeaderOverlayImage.tryCreateDiplomacyImageOverlay === "function") {
							try {
								window.LeaderOverlayImage.tryCreateDiplomacyImageOverlay(leaderID1, "left", 300);
							} catch (overlay1Error) {
								console.error(`[Diplomacy Core] Failed to create overlay for left leader ${leaderID1}:`, overlay1Error);
							}
						} else if (retryCount < maxRetries) {
							console.error(`[Diplomacy Core] LeaderOverlayImage not available for left leader ${leaderID1}, retrying (${retryCount + 1}/${maxRetries})...`);
							setTimeout(() => attemptCreateLeftOverlay(retryCount + 1), retryDelay);
						} else {
							console.error(`[Diplomacy Core] LeaderOverlayImage not available after ${maxRetries} retries for left leader ${leaderID1}. Overlay creation failed.`);
						}
					};
					attemptCreateLeftOverlay();
				}
				
				if (isImageLeader2) {
					const attemptCreateRightOverlay = (retryCount = 0) => {
						const maxRetries = 10;
						const retryDelay = 200;
						
						if (window.LeaderOverlayImage && typeof window.LeaderOverlayImage.tryCreateDiplomacyImageOverlay === "function") {
							try {
								window.LeaderOverlayImage.tryCreateDiplomacyImageOverlay(leaderID2, "right", 300);
							} catch (overlay2Error) {
								console.error(`[Diplomacy Core] Failed to create overlay for right leader ${leaderID2}:`, overlay2Error);
							}
						} else if (retryCount < maxRetries) {
							console.error(`[Diplomacy Core] LeaderOverlayImage not available for right leader ${leaderID2}, retrying (${retryCount + 1}/${maxRetries})...`);
							setTimeout(() => attemptCreateRightOverlay(retryCount + 1), retryDelay);
						} else {
							console.error(`[Diplomacy Core] LeaderOverlayImage not available after ${maxRetries} retries for right leader ${leaderID2}. Overlay creation failed.`);
						}
					};
					attemptCreateRightOverlay();
				}

				// 如果两个都是图片领袖，不调用原始函数
				if (isImageLeader1 && isImageLeader2) {
					return;
				}

				// 如果只有一个图片领袖，调用原始函数（重写的 showLeftLeaderModel 和 showRightLeaderModel 会处理图片领袖）
				// 但这里我们需要手动处理混合情况
				if (isImageLeader1 && !isImageLeader2) {
					// 左侧是图片领袖，右侧不是，需要显示右侧的3D模型
					try {
						if (typeof this.showRightLeaderModel === "function") {
							this.showRightLeaderModel(playerID2);
						}
					} catch (rightError) {
						console.error(`[Diplomacy Core] Failed to show right leader model:`, rightError);
					}
					return;
				}
				if (!isImageLeader1 && isImageLeader2) {
					// 右侧是图片领袖，左侧不是，需要显示左侧的3D模型
					try {
						if (typeof this.showLeftLeaderModel === "function") {
							this.showLeftLeaderModel(playerID1);
						}
					} catch (leftError) {
						console.error(`[Diplomacy Core] Failed to show left leader model:`, leftError);
					}
					return;
				}
			}

			// 对于非图片领袖或混合情况，调用原始函数
			return originalShowLeaderModels.call(this, playerID1, playerID2);
		} catch (error) {
			console.error(`[Diplomacy Core] Error in showLeaderModels for players ${playerID1}/${playerID2}:`, error);
			// 发生错误时，尝试调用原始函数作为后备方案
			try {
				return originalShowLeaderModels.call(this, playerID1, playerID2);
			} catch (fallbackError) {
				console.error(`[Diplomacy Core] Fallback also failed:`, fallbackError);
				// 如果原始函数也失败，至少不抛出异常，让其他领袖可以正常显示
			}
		}
	};

	window.LeaderModelManagerClass.prototype.showLeaderModels._isOverridden = true;

	return true;
}

// 重写 clear 函数（清理时也清理图片覆盖层，重写类原型方法）
function overrideClear() {
	if (!window.LeaderModelManagerClass) {
		return false;
	}

	if (window.LeaderModelManagerClass.prototype.clear._isOverridden) {
		return true;
	}

	const originalClear = window.LeaderModelManagerClass.prototype.clear;

	window.LeaderModelManagerClass.prototype.clear = function() {
		try {
			// 清理图片领袖VO自动完成定时器（如果存在）
			if (this._imageLeaderVoTimeoutId) {
				clearTimeout(this._imageLeaderVoTimeoutId);
				this._imageLeaderVoTimeoutId = null;
			}

			// 检查是否有外交图片覆盖层存在（表示正在显示图片领袖）
			const hasDiplomacyOverlay = window.LeaderOverlayImage && 
				(document.querySelector(".leader-overlay-image-block-diplomacy-left") ||
				 document.querySelector(".leader-overlay-image-block-diplomacy-right") ||
				 document.querySelector(".leader-overlay-image-block-diplomacy"));
			
			// 如果有图片覆盖层
			if (hasDiplomacyOverlay) {
				// 如果正在退出场景（isClosing为true），退出动画已经在exitSimpleDiplomacyScene中触发，这里不需要再次触发
				// 只有在切换领袖等非退出场景的情况下，才需要立即移除覆盖层
				if (!this.isClosing) {
					// 立即移除图片覆盖层（不延迟，不等待动画）
					if (window.LeaderOverlayImage && typeof window.LeaderOverlayImage.tryRemoveDiplomacyImageOverlay === "function") {
						try {
							window.LeaderOverlayImage.tryRemoveDiplomacyImageOverlay(null, "center", 0);
						} catch (removeError) {
							console.error(`[Diplomacy Core] Failed to remove diplomacy overlay during clear:`, removeError);
						}
					} else if (!window.LeaderOverlayImage) {
						console.error(`[Diplomacy Core] LeaderOverlayImage not available when trying to clear diplomacy overlay`);
					}
				}
				// 注意：退出场景时，覆盖层会在动画完成后自动移除（由tryRemoveDiplomacyImageOverlay中的setTimeout处理）
				
				// 立即调用原始清理函数，不延迟
				// 这样可以确保3D模型和标记被立即清理，为后续加载做准备
				return originalClear.call(this);
			} else {
				// 没有图片覆盖层，说明是在显示新领袖时清理旧模型，立即清理
				return originalClear.call(this);
			}
		} catch (error) {
			// 如果出错，立即调用原始函数
			return originalClear.call(this);
		}
	};

	window.LeaderModelManagerClass.prototype.clear._isOverridden = true;

	return true;
}

// 重写 exitSimpleDiplomacyScene 函数，在摄像机退出动画开始时立即触发2D图片的退出动画
function overrideExitSimpleDiplomacyScene() {
	if (!window.LeaderModelManagerClass) {
		return false;
	}

	if (window.LeaderModelManagerClass.prototype.exitSimpleDiplomacyScene._isOverridden) {
		return true;
	}

	const originalExitSimpleDiplomacyScene = window.LeaderModelManagerClass.prototype.exitSimpleDiplomacyScene;

	window.LeaderModelManagerClass.prototype.exitSimpleDiplomacyScene = function() {
		// 清理图片领袖VO自动完成定时器（如果存在）
		if (this._imageLeaderVoTimeoutId) {
			clearTimeout(this._imageLeaderVoTimeoutId);
			this._imageLeaderVoTimeoutId = null;
		}

		// 在摄像机退出动画开始前，立即触发2D图片的退出动画，与旗帜同步
		if (window.LeaderOverlayImage && typeof window.LeaderOverlayImage.tryRemoveDiplomacyImageOverlay === "function") {
			try {
				// 立即触发退出动画，不延迟
				window.LeaderOverlayImage.tryRemoveDiplomacyImageOverlay(null, "center", 0);
			} catch (removeError) {
				console.error(`[Diplomacy Core] Failed to trigger exit animation for image leaders:`, removeError);
			}
		}

		// 调用原始函数，触发摄像机退出动画和清理
		return originalExitSimpleDiplomacyScene.call(this);
	};

	window.LeaderModelManagerClass.prototype.exitSimpleDiplomacyScene._isOverridden = true;

	return true;
}

// 导出核心重写函数
window.DiplomacyCoreOverrides = {
	handleImageLeaderDisplay,
	overrideShowRightLeaderModel,
	overrideShowLeftLeaderModel,
	overrideShowLeaderModels,
	overrideClear,
	overrideExitSimpleDiplomacyScene
};
