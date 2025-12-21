/**
 * @file diplomacy-sequence-handlers.js
 * @description Diplomacy Sequence Handlers: Handle all diplomacy sequence overrides for image leaders
 */

// 不能在顶层解构 `window.DiplomacyConfig` / `window.DiplomacyCoreOverrides`，
// 因为它们在本脚本执行时可能尚未初始化。这里使用安全包装函数：

/**
 * 安全调用：判断是否为图片领袖
 * - 优先使用全局函数 `isImageLeader`
 * - 其次尝试 `window.DiplomacyConfig.isImageLeader`
 * - 出错或不可用则返回 false
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
		console.error("[Diplomacy Sequence] safeIsImageLeader failed:", error);
	}

	return false;
}

/**
 * 安全调用：从 playerID 获取领袖字符串 ID
 * - 优先使用全局函数 `getLeaderStringIDFromPlayerID`
 * - 其次尝试 `window.DiplomacyConfig.getLeaderStringIDFromPlayerID`
 * - 出错或不可用则返回 null
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
		console.error("[Diplomacy Sequence] safeGetLeaderStringIDFromPlayerID failed:", error);
	}

	return null;
}

/**
 * 安全调用：图片领袖显示处理
 * - 调用 `window.DiplomacyCoreOverrides.handleImageLeaderDisplay`
 * - 不存在时直接返回 false，不抛异常
 */
function safeHandleImageLeaderDisplay(leaderID, position, context, state = null, skipCleanup = false) {
	try {
		if (typeof window !== "undefined" &&
			window.DiplomacyCoreOverrides &&
			typeof window.DiplomacyCoreOverrides.handleImageLeaderDisplay === "function") {
			return window.DiplomacyCoreOverrides.handleImageLeaderDisplay(leaderID, position, context, state, skipCleanup);
		}
	} catch (error) {
		console.error("[Diplomacy Sequence] safeHandleImageLeaderDisplay failed:", error);
	}

	// 返回 false 表示"未处理为图片领袖"，调用方可以按普通 3D 领袖继续处理
	return false;
}

/**
 * 立即清理图片覆盖层（用于切换到3D领袖时）
 * @param {string} position - 位置 ("left", "right", 或 "center" 表示全部)
 */
function immediatelyRemoveImageOverlay(position = "center") {
	try {
		if (window.LeaderOverlayImage && typeof window.LeaderOverlayImage.tryRemoveDiplomacyImageOverlay === "function") {
			// 立即移除，不延迟
			window.LeaderOverlayImage.tryRemoveDiplomacyImageOverlay(null, position, 0);
		}
	} catch (error) {
		console.warn(`[Diplomacy Sequence] Failed to immediately remove image overlay:`, error);
	}
}

/**
 * 为图片覆盖层应用缩放效果（用于宣战序列的相机拉近效果）
 * @param {string|Array<string>} positions - 位置 ("left", "right", "center" 或数组)
 * @param {number} scale - 缩放比例（默认1.1）
 * @param {number} duration - 动画持续时间（秒，默认1.1）
 */
function zoomImageOverlays(positions, scale = 1.1, duration = 1) {
	try {
		// 确保positions是数组
		const positionArray = Array.isArray(positions) ? positions : [positions];
		
		// 获取外交容器
		const container = window.LeaderOverlayImage && typeof window.LeaderOverlayImage.getDiplomacyContainer === "function"
			? window.LeaderOverlayImage.getDiplomacyContainer()
			: document.querySelector(".diplomacy-dialog-content") || document.querySelector(".panel-diplomacy-hub");
		
		if (!container) {
			console.warn(`[Diplomacy Sequence] Cannot find diplomacy container for zoom effect`);
			return;
		}
		
		// 为每个位置应用缩放
		positionArray.forEach(position => {
			let overlayClassName = "";
			if (position === "left") {
				overlayClassName = "leader-overlay-image-block-diplomacy-left";
			} else if (position === "right") {
				overlayClassName = "leader-overlay-image-block-diplomacy-right";
			} else if (position === "center") {
				overlayClassName = "leader-overlay-image-block-diplomacy";
			}
			
			if (!overlayClassName) {
				return;
			}
			
			// 查找覆盖层元素
			const overlayElement = container.querySelector(`.${overlayClassName}`);
			if (overlayElement) {
				// 应用缩放效果
				overlayElement.style.transition = `transform ${duration}s ease-in-out`;
				overlayElement.style.transform = `scale(${scale})`;
				console.log(`[Diplomacy Sequence] Applied zoom effect to ${position} overlay (scale: ${scale})`);
			}
		});
	} catch (error) {
		console.error(`[Diplomacy Sequence] Failed to apply zoom effect to image overlays:`, error);
	}
}

/**
 * 从外交关系推断领袖状态（用于切换文明场景，不依赖序列类型）
 * @param {number} playerID - 玩家ID
 * @param {string} position - 位置 ("left" 或 "right")
 * @param {object} context - LeaderModelManager 上下文
 * @returns {string} 状态字符串 ("neutral", "friendly", "hostile")
 */
function inferLeaderStateFromDiplomacy(playerID, position, context) {
	try {
		const player = Players.get(playerID);
		if (!player) {
			return "neutral";
		}

		// 检查是否处于战争状态
		let isAtWar = false;
		if (context && typeof context.isAtWarWithPlayer === "function") {
			isAtWar = context.isAtWarWithPlayer(playerID);
		} else if (typeof GameContext !== "undefined" && GameContext.localPlayerID !== undefined) {
			// 尝试从本地玩家的外交关系检查
			const localPlayer = Players.get(GameContext.localPlayerID);
			if (localPlayer && localPlayer.Diplomacy && typeof localPlayer.Diplomacy.isAtWarWith === "function") {
				isAtWar = localPlayer.Diplomacy.isAtWarWith(playerID);
			}
		}

		// 获取外交关系
		let relationshipEnum = null;
		if (player.Diplomacy && typeof player.Diplomacy.getRelationshipEnum === "function") {
			if (typeof GameContext !== "undefined" && GameContext.localPlayerID !== undefined) {
				relationshipEnum = player.Diplomacy.getRelationshipEnum(GameContext.localPlayerID);
			}
		}

		// 使用全局配置系统的函数获取初始状态（如果可用）
		if (window.CustomLeaderConfig && window.CustomLeaderConfig.getDiplomacyInitialState) {
			return window.CustomLeaderConfig.getDiplomacyInitialState(relationshipEnum, isAtWar);
		}

		// 后备方案：手动映射
		if (isAtWar) {
			return "hostile";
		}

		if (relationshipEnum !== undefined && relationshipEnum !== null) {
			const relationshipStr = relationshipEnum?.toString() || "";
			if (relationshipStr.includes("HOSTILE") || relationshipStr.includes("UNFRIENDLY")) {
				return "hostile";
			} else if (relationshipStr.includes("FRIENDLY") || relationshipStr.includes("HELPFUL")) {
				return "friendly";
			}
		}

		// 默认返回中立
		return "neutral";
	} catch (error) {
		console.warn(`[Diplomacy Sequence] Error inferring leader state from diplomacy: ${error.message}`);
		return "neutral";
	}
}

/**
 * 重写 showLeadersFirstMeet 方法
 * 严格按照原始方法，仅跳过图片领袖的3D模型加载
 */
function overrideShowLeadersFirstMeet(instance, classRef) {
	if (!instance || !classRef) {
		return false;
	}

	if (instance.showLeadersFirstMeet && instance.showLeadersFirstMeet._isOverridden) {
		return true;
	}

	const originalMethod = instance.showLeadersFirstMeet.bind(instance);

	instance.showLeadersFirstMeet = function(params) {
		const playerID1 = params.player1;
		const playerID2 = params.player2;

		const leaderID1 = safeGetLeaderStringIDFromPlayerID(playerID1);
		const leaderID2 = safeGetLeaderStringIDFromPlayerID(playerID2);

		const isImg1 = leaderID1 && safeIsImageLeader(leaderID1);
		const isImg2 = leaderID2 && safeIsImageLeader(leaderID2);

		// 如果两个都不是图片领袖，直接调用原始方法
		if (!isImg1 && !isImg2) {
			return originalMethod(params);
		}

		// 至少有一侧是图片领袖，严格按照原始方法但跳过图片领袖的3D加载
		this.clear();

		const p1ColorPrimary = UI.Player.getPrimaryColorValueAsHex(playerID1);
		const p1ColorSecondary = UI.Player.getSecondaryColorValueAsHex(playerID1);
		const player1 = Players.get(playerID1);
		if (!player1) {
			console.error("leader-model-manager: Unable to get valid player library for player with id: " + playerID1.toString());
			return;
		}
		const leader1 = GameInfo.Leaders.lookup(player1.leaderType);
		if (!leader1) {
			console.error("leader-model-manager: Unable to get valid leader definition for player with id: " + playerID1.toString());
			return;
		}
		const civ1 = GameInfo.Civilizations.lookup(player1.civilizationType);
		if (!civ1) {
			console.error("leader-model-manager: Unable to get valid civilization definition for player with id: " + playerID1.toString());
			return;
		}

		const p2ColorPrimary = UI.Player.getPrimaryColorValueAsHex(playerID2);
		const p2ColorSecondary = UI.Player.getSecondaryColorValueAsHex(playerID2);
		const player2 = Players.get(playerID2);
		if (!player2) {
			console.error("leader-model-manager: Unable to get valid player library for player with id: " + playerID2.toString());
			return;
		}
		const leader2 = GameInfo.Leaders.lookup(player2.leaderType);
		if (!leader2) {
			console.error("leader-model-manager: Unable to get valid leader definition for player with id: " + playerID2.toString());
			return;
		}
		const civ2 = GameInfo.Civilizations.lookup(player2.civilizationType);
		if (!civ2) {
			console.error("leader-model-manager: Unable to get valid civilization definition for player with id: " + playerID2.toString());
			return;
		}

		const screenType = this.getScreenType();
		const leftModelPosition = classRef.POSITIONS[screenType][0 /* LeftModel */];
		const leftBannerPosition = classRef.POSITIONS[screenType][1 /* LeftBanner */];
		const rightModelPosition = classRef.POSITIONS[screenType][2 /* RightModel */];
		const rightBannerPosition = classRef.POSITIONS[screenType][3 /* RightBanner */];

		// 左侧处理
		this.leader3DMarkerLeft = WorldUI.createFixedMarker({ x: 0, y: 0, z: 0 });
		if (this.leader3DMarkerLeft != null) {
			this.leaderModelGroup.addModel(
				this.getLeftLightingAssetName(),
				{ marker: this.leader3DMarkerLeft, offset: leftModelPosition },
				{ angle: 0, scale: 1, foreground: true }
			);

			// 只在不是图片领袖时加载3D模型
			if (!isImg1) {
				this.leader3DModelLeft = this.leaderModelGroup.addModel(
					this.getLeaderAssetName(leader1.LeaderType.toString()),
					{ marker: this.leader3DMarkerLeft, offset: leftModelPosition },
					{
						angle: 0,
						scale: 1,
						foreground: true,
						tintColor1: p1ColorPrimary,
						tintColor2: p1ColorSecondary,
						triggerCallbacks: true
					}
				);
				if (this.leader3DModelLeft == null) {
					this.leader3DModelLeft = this.leaderModelGroup.addModel(
						this.getFallbackAssetName(),
						{ marker: this.leader3DMarkerLeft, offset: leftModelPosition },
						{
							angle: 0,
							scale: 1,
							foreground: true,
							tintColor1: p1ColorPrimary,
							tintColor2: p1ColorSecondary,
							triggerCallbacks: true
						}
					);
				}
			}

			// 旗帜始终加载
			this.leader3DBannerLeft = this.leaderModelGroup.addModel(
				this.getCivBannerName(civ1.CivilizationType.toString()),
				{ marker: this.leader3DMarkerLeft, offset: leftBannerPosition },
				{
					angle: classRef.LEFT_BANNER_ANGLE,
					scale: classRef.BANNER_SCALE,
					foreground: true,
					tintColor1: p1ColorPrimary,
					tintColor2: p1ColorSecondary,
					triggerCallbacks: true
				}
			);
			if (this.leader3DBannerLeft == null) {
				this.leader3DBannerLeft = this.leaderModelGroup.addModel(
					this.getFallbackBannerAssetName(),
					{ marker: this.leader3DMarkerLeft, offset: leftBannerPosition },
					{
						angle: classRef.LEFT_BANNER_ANGLE,
						scale: classRef.BANNER_SCALE,
						foreground: true,
						tintColor1: p1ColorPrimary,
						tintColor2: p1ColorSecondary,
						triggerCallbacks: true
					}
				);
			}
		}

		// 右侧处理
		this.leader3DMarkerRight = WorldUI.createFixedMarker({ x: 0, y: 0, z: 0 });
		if (this.leader3DMarkerRight != null) {
			this.leaderModelGroup.addModel(
				this.getRightLightingAssetName(),
				{ marker: this.leader3DMarkerRight, offset: rightModelPosition },
				{ angle: 0, scale: 1, foreground: true }
			);

			// 只在不是图片领袖时加载3D模型
			if (!isImg2) {
				this.leader3DModelRight = this.leaderModelGroup.addModel(
					this.getLeaderAssetName(leader2.LeaderType.toString()),
					{ marker: this.leader3DMarkerRight, offset: rightModelPosition },
					{
						angle: 0,
						scale: 1,
						initialState: "IDLE_WaitingOther",
						foreground: true,
						tintColor1: p2ColorPrimary,
						tintColor2: p2ColorSecondary,
						triggerCallbacks: true
					}
				);
				if (this.leader3DModelRight == null) {
					this.leader3DModelRight = this.leaderModelGroup.addModel(
						this.getFallbackAssetName(),
						{ marker: this.leader3DMarkerRight, offset: rightModelPosition },
						{
							angle: 0,
							scale: 1,
							initialState: "IDLE_WaitingOther",
							foreground: true,
							tintColor1: p2ColorPrimary,
							tintColor2: p2ColorSecondary,
							triggerCallbacks: true
						}
					);
				}
			}

			// 旗帜始终加载
			this.leader3DBannerRight = this.leaderModelGroup.addModel(
				this.getCivBannerName(civ2.CivilizationType.toString()),
				{ marker: this.leader3DMarkerRight, offset: rightBannerPosition },
				{
					angle: classRef.RIGHT_BANNER_ANGLE,
					scale: classRef.BANNER_SCALE,
					foreground: true,
					tintColor1: p2ColorPrimary,
					tintColor2: p2ColorSecondary,
					triggerCallbacks: true
				}
			);
			if (this.leader3DBannerRight == null) {
				this.leader3DBannerRight = this.leaderModelGroup.addModel(
					this.getFallbackBannerAssetName(),
					{ marker: this.leader3DMarkerRight, offset: rightBannerPosition },
					{
						angle: classRef.RIGHT_BANNER_ANGLE,
						scale: classRef.BANNER_SCALE,
						foreground: true,
						tintColor1: p2ColorPrimary,
						tintColor2: p2ColorSecondary,
						triggerCallbacks: true
					}
				);
			}
		}

		this.showDiplomaticSceneEnvironment();
		this.simpleLeaderPopUpCameraAnimation(false, this.FIRST_MEET_DELAY);

		// 对图片领袖延迟显示覆盖层（跳过清理，避免清除已加载的3D模型）
		const firstMeetDelay = this.FIRST_MEET_DELAY || 0.3;
		if (isImg1) {
			setTimeout(() => {
				safeHandleImageLeaderDisplay(leaderID1, "left", this, null, true);
			}, firstMeetDelay * 1000);
		}
		if (isImg2) {
			setTimeout(() => {
				safeHandleImageLeaderDisplay(leaderID2, "right", this, null, true);
			}, firstMeetDelay * 1000);
		}

		this.beginFirstMeetSequence();
		this.isLeaderShowing = true;
	};

	instance.showLeadersFirstMeet._isOverridden = true;
	return true;
}

/**
 * 重写 showLeadersDeclareWar 方法
 * 严格按照原始方法，仅跳过图片领袖的3D模型加载
 */
function overrideShowLeadersDeclareWar(instance, classRef) {
	if (!instance || !classRef) {
		return false;
	}

	if (instance.showLeadersDeclareWar && instance.showLeadersDeclareWar._isOverridden) {
		return true;
	}

	const originalMethod = instance.showLeadersDeclareWar.bind(instance);

	instance.showLeadersDeclareWar = function(params) {
		const playerID1 = params.player1;
		const playerID2 = params.player2;

		const leaderID1 = safeGetLeaderStringIDFromPlayerID(playerID1);
		const leaderID2 = safeGetLeaderStringIDFromPlayerID(playerID2);

		const isImg1 = leaderID1 && safeIsImageLeader(leaderID1);
		const isImg2 = leaderID2 && safeIsImageLeader(leaderID2);

		// 如果两个都不是图片领袖，直接调用原始方法
		if (!isImg1 && !isImg2) {
			return originalMethod(params);
		}

		// 至少有一侧是图片领袖，严格按照原始方法但跳过图片领袖的3D加载
		this.clear();

		const p1ColorPrimary = UI.Player.getPrimaryColorValueAsHex(playerID1);
		const p1ColorSecondary = UI.Player.getSecondaryColorValueAsHex(playerID1);
		const player1 = Players.get(playerID1);
		if (!player1) {
			console.error("leader-model-manager: Unable to get valid player library for player with id: " + playerID1.toString());
			return;
		}
		const leader1 = GameInfo.Leaders.lookup(player1.leaderType);
		if (!leader1) {
			console.error("leader-model-manager: Unable to get valid leader definition for player with id: " + playerID1.toString());
			return;
		}
		const civ1 = GameInfo.Civilizations.lookup(player1.civilizationType);
		if (!civ1) {
			console.error("leader-model-manager: Unable to get valid civilization definition for player with id: " + playerID1.toString());
			return;
		}

		const p2ColorPrimary = UI.Player.getPrimaryColorValueAsHex(playerID2);
		const p2ColorSecondary = UI.Player.getSecondaryColorValueAsHex(playerID2);
		const player2 = Players.get(playerID2);
		if (!player2) {
			console.error("leader-model-manager: Unable to get valid player library for player with id: " + playerID2.toString());
			return;
		}
		const leader2 = GameInfo.Leaders.lookup(player2.leaderType);
		if (!leader2) {
			console.error("leader-model-manager: Unable to get valid leader definition for player with id: " + playerID2.toString());
			return;
		}
		const civ2 = GameInfo.Civilizations.lookup(player2.civilizationType);
		if (!civ2) {
			console.error("leader-model-manager: Unable to get valid civilization definition for player with id: " + playerID2.toString());
			return;
		}

		const screenType = this.getScreenType();
		const leftModelPosition = classRef.POSITIONS[screenType][0 /* LeftModel */];
		const leftBannerPosition = classRef.POSITIONS[screenType][1 /* LeftBanner */];
		const rightModelPosition = classRef.POSITIONS[screenType][2 /* RightModel */];
		const rightBannerPosition = classRef.POSITIONS[screenType][3 /* RightBanner */];

		// 左侧处理
		this.leader3DMarkerLeft = WorldUI.createFixedMarker({ x: 0, y: 0, z: 0 });
		if (this.leader3DMarkerLeft != null) {
			this.leaderModelGroup.addModel(
				this.getLeftLightingAssetName(),
				{ marker: this.leader3DMarkerLeft, offset: leftModelPosition },
				{ angle: 0, scale: 1, foreground: true }
			);

			// 只在不是图片领袖时加载3D模型
			if (!isImg1) {
				this.leader3DModelLeft = this.leaderModelGroup.addModel(
					this.getLeaderAssetName(leader1.LeaderType.toString()),
					{ marker: this.leader3DMarkerLeft, offset: leftModelPosition },
					{
						angle: 0,
						scale: 1,
						foreground: true,
						tintColor1: p1ColorPrimary,
						tintColor2: p1ColorSecondary,
						triggerCallbacks: true
					}
				);
				if (this.leader3DModelLeft == null) {
					this.leader3DModelLeft = this.leaderModelGroup.addModel(
						this.getFallbackAssetName(),
						{ marker: this.leader3DMarkerLeft, offset: leftModelPosition },
						{
							angle: 0,
							scale: 1,
							foreground: true,
							tintColor1: p1ColorPrimary,
							tintColor2: p1ColorSecondary,
							triggerCallbacks: true
						}
					);
				}
			}

			// 旗帜始终加载
			this.leader3DBannerLeft = this.leaderModelGroup.addModel(
				this.getCivBannerName(civ1.CivilizationType.toString()),
				{ marker: this.leader3DMarkerLeft, offset: leftBannerPosition },
				{
					angle: classRef.LEFT_BANNER_ANGLE,
					scale: classRef.BANNER_SCALE,
					foreground: true,
					tintColor1: p1ColorPrimary,
					tintColor2: p1ColorSecondary,
					triggerCallbacks: true
				}
			);
			if (this.leader3DBannerLeft == null) {
				this.leader3DBannerLeft = this.leaderModelGroup.addModel(
					this.getFallbackBannerAssetName(),
					{ marker: this.leader3DMarkerLeft, offset: leftBannerPosition },
					{
						angle: classRef.LEFT_BANNER_ANGLE,
						scale: classRef.BANNER_SCALE,
						foreground: true,
						tintColor1: p1ColorPrimary,
						tintColor2: p1ColorSecondary,
						triggerCallbacks: true
					}
				);
			}
		}

		// 右侧处理
		this.leader3DMarkerRight = WorldUI.createFixedMarker({ x: 0, y: 0, z: 0 });
		if (this.leader3DMarkerRight != null) {
			this.leaderModelGroup.addModel(
				this.getRightLightingAssetName(),
				{ marker: this.leader3DMarkerRight, offset: rightModelPosition },
				{ angle: 0, scale: 1, foreground: true }
			);

			// 只在不是图片领袖时加载3D模型
			if (!isImg2) {
				this.leader3DModelRight = this.leaderModelGroup.addModel(
					this.getLeaderAssetName(leader2.LeaderType.toString()),
					{ marker: this.leader3DMarkerRight, offset: rightModelPosition },
					{
						angle: 0,
						scale: 1,
						foreground: true,
						tintColor1: p2ColorPrimary,
						tintColor2: p2ColorSecondary,
						triggerCallbacks: true
					}
				);
				if (this.leader3DModelRight == null) {
					this.leader3DModelRight = this.leaderModelGroup.addModel(
						this.getFallbackAssetName(),
						{ marker: this.leader3DMarkerRight, offset: rightModelPosition },
						{
							angle: 0,
							scale: 1,
							foreground: true,
							tintColor1: p2ColorPrimary,
							tintColor2: p2ColorSecondary,
							triggerCallbacks: true
						}
					);
				}
			}

			// 旗帜始终加载
			this.leader3DBannerRight = this.leaderModelGroup.addModel(
				this.getCivBannerName(civ2.CivilizationType.toString()),
				{ marker: this.leader3DMarkerRight, offset: rightBannerPosition },
				{
					angle: classRef.RIGHT_BANNER_ANGLE,
					scale: classRef.BANNER_SCALE,
					foreground: true,
					tintColor1: p2ColorPrimary,
					tintColor2: p2ColorSecondary,
					triggerCallbacks: true
				}
			);
			if (this.leader3DBannerRight == null) {
				this.leader3DBannerRight = this.leaderModelGroup.addModel(
					this.getFallbackBannerAssetName(),
					{ marker: this.leader3DMarkerRight, offset: rightBannerPosition },
					{
						angle: classRef.RIGHT_BANNER_ANGLE,
						scale: classRef.BANNER_SCALE,
						foreground: true,
						tintColor1: p2ColorPrimary,
						tintColor2: p2ColorSecondary,
						triggerCallbacks: true
					}
				);
			}
		}

		this.showDiplomaticSceneEnvironment();
		this.simpleLeaderPopUpCameraAnimation(false, 0);

		// 对图片领袖延迟显示覆盖层
		if (isImg1) {
			setTimeout(() => {
				safeHandleImageLeaderDisplay(leaderID1, "left", this, null, true);
			}, 300);
		}
		if (isImg2) {
			setTimeout(() => {
				safeHandleImageLeaderDisplay(leaderID2, "right", this, null, true);
			}, 300);
		}

		// 重写 beginDeclareWarPlayerSequence 以正确处理图片领袖
		// 根据原始逻辑：
		// - 如果 isLocalPlayerInitiator 为 true：等待左侧动画（ACTION_DwDecisionPlayer）
		// - 如果 isLocalPlayerInitiator 为 false：等待右侧动画（VO_DwAttacker）
		// 如果等待的一侧是图片领袖（3D模型为null），则不等待该侧动画
		const originalBeginDeclareWarPlayerSequence = this.beginDeclareWarPlayerSequence.bind(this);
		// 保存图片领袖状态，用于后续的缩放处理
		const savedIsImg1 = isImg1;
		const savedIsImg2 = isImg2;
		this.beginDeclareWarPlayerSequence = function() {
			// 检查哪些侧有3D模型
			const hasLeft3D = this.leader3DModelLeft != null;
			const hasRight3D = this.leader3DModelRight != null;
			
			// 保存状态，用于后续的重写方法
			const savedHasLeft3D = hasLeft3D;
			const savedHasRight3D = hasRight3D;
			
			// 重写 startDWCameraAnimations 以在调用时同时缩放图片覆盖层
			const originalStartDWCameraAnimations = this.startDWCameraAnimations.bind(this);
			this.startDWCameraAnimations = function() {
				originalStartDWCameraAnimations();
				// 确定哪些位置需要缩放
				const positionsToZoom = [];
				if (savedIsImg1 && !savedHasLeft3D) {
					positionsToZoom.push("left");
				}
				if (savedIsImg2 && !savedHasRight3D) {
					positionsToZoom.push("right");
				}
				if (positionsToZoom.length > 0) {
					zoomImageOverlays(positionsToZoom, 1.1, 1.1);
				}
			};
			
			if (this.isLocalPlayerInitiator) {
				// 本地玩家发起宣战：左侧播放 ACTION_DwDecisionPlayer（需要等待），右侧播放 IDLE_WaitingOtherBreath（不需要等待）
				this.playLeaderAnimation("ACTION_DwDecisionPlayer", "left");
				this.playLeaderAnimation("IDLE_WaitingOtherBreath", "right");
				
				// 如果左侧有3D模型，等待左侧动画；否则不等待（因为左侧是图片领袖，动画不会播放）
				if (hasLeft3D) {
					this.leaderSequenceGate.setWaitForJustLeft();
					this.leaderSequenceStepID = 1;
				} else {
					// 左侧是图片领袖，不等待左侧动画，直接进入下一步
					// 需要手动触发序列推进，因为不会有动画触发器回调
					this.leaderSequenceGate.clear();
					this.leaderSequenceStepID = 1;
					this.currentSequenceType = "WAR";
					// 重写 advanceDeclareWarPlayerSequence 以处理左侧是图片领袖的情况（包括两侧都是图片领袖）
					const originalAdvanceDeclareWarPlayerSequence = this.advanceDeclareWarPlayerSequence.bind(this);
					this.advanceDeclareWarPlayerSequence = function(id, hash) {
						// 如果是 case 1 且左侧是图片领袖（没有3D模型），直接进入 step 2
						if (this.leaderSequenceStepID === 1 && !savedHasLeft3D && this.leaderSequenceGate.isWaiting() === false) {
							// 如果右侧有3D模型，播放 VO_DwDefender；否则跳过（因为右侧也是图片领袖）
							if (savedHasRight3D) {
								this.playLeaderAnimation("VO_DwDefender", "right");
								this.leaderSequenceGate.setVOQueued();
							}
							this.leaderSequenceStepID = 2;
							// 如果两侧都是图片领袖，直接完成序列（不需要播放任何3D动画）
							if (!savedHasLeft3D && !savedHasRight3D) {
								// 两侧都是图片领袖，直接完成序列
								this.doSequenceSharedAdvance();
								this.leaderSequenceStepID = 0;
							}
							// 恢复原始方法，以便后续正常处理
							this.advanceDeclareWarPlayerSequence = originalAdvanceDeclareWarPlayerSequence;
							return;
						}
						// 否则调用原始方法
						return originalAdvanceDeclareWarPlayerSequence(id, hash);
					};
					// 使用 setTimeout 确保在下一帧触发序列推进
					setTimeout(() => {
						if (this.currentSequenceType === "WAR" && this.leaderSequenceStepID === 1) {
							this.advanceDeclareWarPlayerSequence(0, 0);
						}
					}, 0);
					return; // 提前返回，避免重复设置 currentSequenceType
				}
			} else {
				// 对方发起宣战：左侧播放 IDLE_DwPlayer（不需要等待），右侧播放 VO_DwAttacker（需要等待）
				this.playLeaderAnimation("IDLE_DwPlayer", "left");
				this.playLeaderAnimation("VO_DwAttacker", "right");
				
				// 如果右侧有3D模型，等待右侧动画；否则不等待（因为右侧是图片领袖，动画不会播放）
				if (hasRight3D) {
					this.leaderSequenceGate.setWaitForJustRight();
					this.leaderSequenceGate.setVOQueued();
					this.leaderSequenceStepID = 2;
				} else {
					// 右侧是图片领袖，不等待右侧动画，直接进入下一步
					// 需要手动触发序列推进，因为不会有动画触发器回调
					this.leaderSequenceGate.clear();
					this.leaderSequenceStepID = 2;
					this.currentSequenceType = "WAR";
					// 重写 advanceDeclareWarPlayerSequence 以处理右侧是图片领袖的情况（包括两侧都是图片领袖）
					const originalAdvanceDeclareWarPlayerSequence = this.advanceDeclareWarPlayerSequence.bind(this);
					this.advanceDeclareWarPlayerSequence = function(id, hash) {
						// 如果是 case 2 且右侧是图片领袖（没有3D模型），直接进入 step 3
						if (this.leaderSequenceStepID === 2 && !savedHasRight3D && this.leaderSequenceGate.isWaiting() === false) {
							this.doSequenceSharedAdvance();
							// 如果左侧有3D模型，播放 IDLE_DwPlayer
							if (savedHasLeft3D) {
								this.playLeaderAnimation("IDLE_DwPlayer", "left");
							}
							// 如果左侧有3D模型，播放 TRANS_DwtoDwCenterPlayer；否则跳过（因为左侧也是图片领袖）
							if (savedHasLeft3D) {
								this.playLeaderAnimation("TRANS_DwtoDwCenterPlayer", "left");
								this.startDWCameraAnimations(); // 重写的 startDWCameraAnimations 会自动处理图片覆盖层的缩放
							}
							// 如果两侧都是图片领袖，直接完成序列（不需要进入 step 3）
							if (!savedHasLeft3D && !savedHasRight3D) {
								// 两侧都是图片领袖，直接完成序列
								this.leaderSequenceStepID = 0;
							} else {
								this.leaderSequenceStepID = 3;
							}
							// 恢复原始方法，以便后续正常处理
							this.advanceDeclareWarPlayerSequence = originalAdvanceDeclareWarPlayerSequence;
							return;
						}
						// 否则调用原始方法（重写的 startDWCameraAnimations 会自动处理图片覆盖层的缩放）
						return originalAdvanceDeclareWarPlayerSequence(id, hash);
					};
					// 使用 setTimeout 确保在下一帧触发序列推进
					setTimeout(() => {
						if (this.currentSequenceType === "WAR" && this.leaderSequenceStepID === 2) {
							// 手动触发序列推进
							this.advanceDeclareWarPlayerSequence(0, 0);
						}
					}, 0);
					return; // 提前返回，避免重复设置 currentSequenceType
				}
			}
			this.currentSequenceType = "WAR";
		};

		this.beginDeclareWarPlayerSequence();
		this.isLeaderShowing = true;
	};

	instance.showLeadersDeclareWar._isOverridden = true;
	return true;
}

/**
 * 重写 showLeadersAcceptPeace 方法
 * 严格按照原始方法，仅跳过图片领袖的3D模型加载
 */
function overrideShowLeadersAcceptPeace(instance, classRef) {
	if (!instance || !classRef) {
		return false;
	}

	if (instance.showLeadersAcceptPeace && instance.showLeadersAcceptPeace._isOverridden) {
		return true;
	}

	const originalMethod = instance.showLeadersAcceptPeace.bind(instance);

	instance.showLeadersAcceptPeace = function(params) {
		const playerID1 = params.player1;
		const playerID2 = params.player2;

		const leaderID1 = safeGetLeaderStringIDFromPlayerID(playerID1);
		const leaderID2 = safeGetLeaderStringIDFromPlayerID(playerID2);

		const isImg1 = leaderID1 && safeIsImageLeader(leaderID1);
		const isImg2 = leaderID2 && safeIsImageLeader(leaderID2);

		// 如果两个都不是图片领袖，直接调用原始方法
		if (!isImg1 && !isImg2) {
			return originalMethod(params);
		}

		// 至少有一侧是图片领袖，严格按照原始方法但跳过图片领袖的3D加载
		this.clear();

		const p1ColorPrimary = UI.Player.getPrimaryColorValueAsHex(playerID1);
		const p1ColorSecondary = UI.Player.getSecondaryColorValueAsHex(playerID1);
		const player1 = Players.get(playerID1);
		if (!player1) {
			console.error("leader-model-manager: Unable to get valid player library for player with id: " + playerID1.toString());
			return;
		}
		const leader1 = GameInfo.Leaders.lookup(player1.leaderType);
		if (!leader1) {
			console.error("leader-model-manager: Unable to get valid leader definition for player with id: " + playerID1.toString());
			return;
		}
		const civ1 = GameInfo.Civilizations.lookup(player1.civilizationType);
		if (!civ1) {
			console.error("leader-model-manager: Unable to get valid civilization definition for player with id: " + playerID1.toString());
			return;
		}

		const p2ColorPrimary = UI.Player.getPrimaryColorValueAsHex(playerID2);
		const p2ColorSecondary = UI.Player.getSecondaryColorValueAsHex(playerID2);
		const player2 = Players.get(playerID2);
		if (!player2) {
			console.error("leader-model-manager: Unable to get valid player library for player with id: " + playerID2.toString());
			return;
		}
		const leader2 = GameInfo.Leaders.lookup(player2.leaderType);
		if (!leader2) {
			console.error("leader-model-manager: Unable to get valid leader definition for player with id: " + playerID2.toString());
			return;
		}
		const civ2 = GameInfo.Civilizations.lookup(player2.civilizationType);
		if (!civ2) {
			console.error("leader-model-manager: Unable to get valid civilization definition for player with id: " + playerID2.toString());
			return;
		}

		const screenType = this.getScreenType();
		const leftModelPosition = classRef.POSITIONS[screenType][0 /* LeftModel */];
		const leftBannerPosition = classRef.POSITIONS[screenType][1 /* LeftBanner */];
		const rightModelPosition = classRef.POSITIONS[screenType][2 /* RightModel */];
		const rightBannerPosition = classRef.POSITIONS[screenType][3 /* RightBanner */];

		// 左侧处理
		this.leader3DMarkerLeft = WorldUI.createFixedMarker({ x: 0, y: 0, z: 0 });
		if (this.leader3DMarkerLeft != null) {
			this.leaderModelGroup.addModel(
				this.getLeftLightingAssetName(),
				{ marker: this.leader3DMarkerLeft, offset: leftModelPosition },
				{ angle: 0, scale: 1, foreground: true }
			);

			// 只在不是图片领袖时加载3D模型
			if (!isImg1) {
				this.leader3DModelLeft = this.leaderModelGroup.addModel(
					this.getLeaderAssetName(leader1.LeaderType.toString()),
					{ marker: this.leader3DMarkerLeft, offset: leftModelPosition },
					{
						angle: 0,
						scale: 1,
						foreground: true,
						tintColor1: p1ColorPrimary,
						tintColor2: p1ColorSecondary,
						triggerCallbacks: true
					}
				);
				if (this.leader3DModelLeft == null) {
					this.leader3DModelLeft = this.leaderModelGroup.addModel(
						this.getFallbackAssetName(),
						{ marker: this.leader3DMarkerLeft, offset: leftModelPosition },
						{
							angle: 0,
							scale: 1,
							foreground: true,
							tintColor1: p1ColorPrimary,
							tintColor2: p1ColorSecondary,
							triggerCallbacks: true
						}
					);
				}
			}

			// 旗帜始终加载
			this.leader3DBannerLeft = this.leaderModelGroup.addModel(
				this.getCivBannerName(civ1.CivilizationType.toString()),
				{ marker: this.leader3DMarkerLeft, offset: leftBannerPosition },
				{
					angle: classRef.LEFT_BANNER_ANGLE,
					scale: classRef.BANNER_SCALE,
					initialState: "IDLE_ListeningPlayer",
					foreground: true,
					tintColor1: p1ColorPrimary,
					tintColor2: p1ColorSecondary,
					triggerCallbacks: true
				}
			);
			if (this.leader3DBannerLeft == null) {
				this.leader3DBannerLeft = this.leaderModelGroup.addModel(
					this.getFallbackBannerAssetName(),
					{ marker: this.leader3DMarkerLeft, offset: leftBannerPosition },
					{
						angle: classRef.LEFT_BANNER_ANGLE,
						scale: classRef.BANNER_SCALE,
						initialState: "IDLE_ListeningPlayer",
						foreground: true,
						tintColor1: p1ColorPrimary,
						tintColor2: p1ColorSecondary,
						triggerCallbacks: true
					}
				);
			}
		}

		// 右侧处理
		this.leader3DMarkerRight = WorldUI.createFixedMarker({ x: 0, y: 0, z: 0 });
		if (this.leader3DMarkerRight != null) {
			this.leaderModelGroup.addModel(
				this.getRightLightingAssetName(),
				{ marker: this.leader3DMarkerRight, offset: rightModelPosition },
				{ angle: 0, scale: 1, foreground: true }
			);

			// 只在不是图片领袖时加载3D模型
			if (!isImg2) {
				this.leader3DModelRight = this.leaderModelGroup.addModel(
					this.getLeaderAssetName(leader2.LeaderType.toString()),
					{ marker: this.leader3DMarkerRight, offset: rightModelPosition },
					{
						angle: 0,
						scale: 1,
						foreground: true,
						tintColor1: p2ColorPrimary,
						tintColor2: p2ColorSecondary,
						triggerCallbacks: true
					}
				);
				if (this.leader3DModelRight == null) {
					this.leader3DModelRight = this.leaderModelGroup.addModel(
						this.getFallbackAssetName(),
						{ marker: this.leader3DMarkerRight, offset: rightModelPosition },
						{
							angle: 0,
							scale: 1,
							foreground: true,
							tintColor1: p2ColorPrimary,
							tintColor2: p2ColorSecondary,
							triggerCallbacks: true
						}
					);
				}
			}

			// 旗帜始终加载
			this.leader3DBannerRight = this.leaderModelGroup.addModel(
				this.getCivBannerName(civ2.CivilizationType.toString()),
				{ marker: this.leader3DMarkerRight, offset: rightBannerPosition },
				{
					angle: classRef.RIGHT_BANNER_ANGLE,
					scale: classRef.BANNER_SCALE,
					initialState: "IDLE_ListeningPlayer",
					foreground: true,
					tintColor1: p2ColorPrimary,
					tintColor2: p2ColorSecondary,
					triggerCallbacks: true
				}
			);
			if (this.leader3DBannerRight == null) {
				this.leader3DBannerRight = this.leaderModelGroup.addModel(
					this.getFallbackBannerAssetName(),
					{ marker: this.leader3DMarkerRight, offset: rightBannerPosition },
					{
						angle: classRef.RIGHT_BANNER_ANGLE,
						scale: classRef.BANNER_SCALE,
						initialState: "IDLE_ListeningPlayer",
						foreground: true,
						tintColor1: p2ColorPrimary,
						tintColor2: p2ColorSecondary,
						triggerCallbacks: true
					}
				);
			}
		}

		this.showDiplomaticSceneEnvironment();
		this.simpleLeaderPopUpCameraAnimation(false, 0);

		// 对图片领袖延迟显示覆盖层
		if (isImg1) {
			setTimeout(() => {
				safeHandleImageLeaderDisplay(leaderID1, "left", this, null, true);
			}, 300);
		}
		if (isImg2) {
			setTimeout(() => {
				safeHandleImageLeaderDisplay(leaderID2, "right", this, null, true);
			}, 300);
		}

		this.beginAcceptPeaceSequence();
		this.isLeaderShowing = true;
	};

	instance.showLeadersAcceptPeace._isOverridden = true;
	return true;
}

/**
 * 重写 showLeadersRejectPeace 方法
 * 严格按照原始方法，仅跳过图片领袖的3D模型加载
 */
function overrideShowLeadersRejectPeace(instance, classRef) {
	if (!instance || !classRef) {
		return false;
	}

	if (instance.showLeadersRejectPeace && instance.showLeadersRejectPeace._isOverridden) {
		return true;
	}

	const originalMethod = instance.showLeadersRejectPeace.bind(instance);

	instance.showLeadersRejectPeace = function(params) {
		const playerID1 = params.player1;
		const playerID2 = params.player2;

		const leaderID1 = safeGetLeaderStringIDFromPlayerID(playerID1);
		const leaderID2 = safeGetLeaderStringIDFromPlayerID(playerID2);

		const isImg1 = leaderID1 && safeIsImageLeader(leaderID1);
		const isImg2 = leaderID2 && safeIsImageLeader(leaderID2);

		// 如果两个都不是图片领袖，直接调用原始方法
		if (!isImg1 && !isImg2) {
			return originalMethod(params);
		}

		// 至少有一侧是图片领袖，严格按照原始方法但跳过图片领袖的3D加载
		this.clear();

		const p1ColorPrimary = UI.Player.getPrimaryColorValueAsHex(playerID1);
		const p1ColorSecondary = UI.Player.getSecondaryColorValueAsHex(playerID1);
		const player1 = Players.get(playerID1);
		if (!player1) {
			console.error("leader-model-manager: Unable to get valid player library for player with id: " + playerID1.toString());
			return;
		}
		const leader1 = GameInfo.Leaders.lookup(player1.leaderType);
		if (!leader1) {
			console.error("leader-model-manager: Unable to get valid leader definition for player with id: " + playerID1.toString());
			return;
		}
		const civ1 = GameInfo.Civilizations.lookup(player1.civilizationType);
		if (!civ1) {
			console.error("leader-model-manager: Unable to get valid civilization definition for player with id: " + playerID1.toString());
			return;
		}

		const p2ColorPrimary = UI.Player.getPrimaryColorValueAsHex(playerID2);
		const p2ColorSecondary = UI.Player.getSecondaryColorValueAsHex(playerID2);
		const player2 = Players.get(playerID2);
		if (!player2) {
			console.error("leader-model-manager: Unable to get valid player library for player with id: " + playerID2.toString());
			return;
		}
		const leader2 = GameInfo.Leaders.lookup(player2.leaderType);
		if (!leader2) {
			console.error("leader-model-manager: Unable to get valid leader definition for player with id: " + playerID2.toString());
			return;
		}
		const civ2 = GameInfo.Civilizations.lookup(player2.civilizationType);
		if (!civ2) {
			console.error("leader-model-manager: Unable to get valid civilization definition for player with id: " + playerID2.toString());
			return;
		}

		const screenType = this.getScreenType();
		const leftModelPosition = classRef.POSITIONS[screenType][0 /* LeftModel */];
		const leftBannerPosition = classRef.POSITIONS[screenType][1 /* LeftBanner */];
		const rightModelPosition = classRef.POSITIONS[screenType][2 /* RightModel */];
		const rightBannerPosition = classRef.POSITIONS[screenType][3 /* RightBanner */];

		// 左侧处理
		this.leader3DMarkerLeft = WorldUI.createFixedMarker({ x: 0, y: 0, z: 0 });
		if (this.leader3DMarkerLeft != null) {
			this.leaderModelGroup.addModel(
				this.getLeftLightingAssetName(),
				{ marker: this.leader3DMarkerLeft, offset: leftModelPosition },
				{ angle: 0, scale: 1, foreground: true }
			);

			// 只在不是图片领袖时加载3D模型
			if (!isImg1) {
				this.leader3DModelLeft = this.leaderModelGroup.addModel(
					this.getLeaderAssetName(leader1.LeaderType.toString()),
					{ marker: this.leader3DMarkerLeft, offset: leftModelPosition },
					{
						angle: 0,
						scale: 1,
						foreground: true,
						tintColor1: p1ColorPrimary,
						tintColor2: p1ColorSecondary,
						triggerCallbacks: true
					}
				);
				if (this.leader3DModelLeft == null) {
					this.leader3DModelLeft = this.leaderModelGroup.addModel(
						this.getFallbackAssetName(),
						{ marker: this.leader3DMarkerLeft, offset: leftModelPosition },
						{
							angle: 0,
							scale: 1,
							foreground: true,
							tintColor1: p1ColorPrimary,
							tintColor2: p1ColorSecondary,
							triggerCallbacks: true
						}
					);
				}
			}

			// 旗帜始终加载
			this.leader3DBannerLeft = this.leaderModelGroup.addModel(
				this.getCivBannerName(civ1.CivilizationType.toString()),
				{ marker: this.leader3DMarkerLeft, offset: leftBannerPosition },
				{
					angle: classRef.LEFT_BANNER_ANGLE,
					scale: classRef.BANNER_SCALE,
					initialState: "IDLE_ListeningPlayer",
					foreground: true,
					tintColor1: p1ColorPrimary,
					tintColor2: p1ColorSecondary,
					triggerCallbacks: true
				}
			);
			if (this.leader3DBannerLeft == null) {
				this.leader3DBannerLeft = this.leaderModelGroup.addModel(
					this.getFallbackBannerAssetName(),
					{ marker: this.leader3DMarkerLeft, offset: leftBannerPosition },
					{
						angle: classRef.LEFT_BANNER_ANGLE,
						scale: classRef.BANNER_SCALE,
						initialState: "IDLE_ListeningPlayer",
						foreground: true,
						tintColor1: p1ColorPrimary,
						tintColor2: p1ColorSecondary,
						triggerCallbacks: true
					}
				);
			}
		}

		// 右侧处理
		this.leader3DMarkerRight = WorldUI.createFixedMarker({ x: 0, y: 0, z: 0 });
		if (this.leader3DMarkerRight != null) {
			this.leaderModelGroup.addModel(
				this.getRightLightingAssetName(),
				{ marker: this.leader3DMarkerRight, offset: rightModelPosition },
				{ angle: 0, scale: 1, foreground: true }
			);

			// 只在不是图片领袖时加载3D模型
			if (!isImg2) {
				this.leader3DModelRight = this.leaderModelGroup.addModel(
					this.getLeaderAssetName(leader2.LeaderType.toString()),
					{ marker: this.leader3DMarkerRight, offset: rightModelPosition },
					{
						angle: 0,
						scale: 1,
						foreground: true,
						tintColor1: p2ColorPrimary,
						tintColor2: p2ColorSecondary,
						triggerCallbacks: true
					}
				);
				if (this.leader3DModelRight == null) {
					this.leader3DModelRight = this.leaderModelGroup.addModel(
						this.getFallbackAssetName(),
						{ marker: this.leader3DMarkerRight, offset: rightModelPosition },
						{
							angle: 0,
							scale: 1,
							foreground: true,
							tintColor1: p2ColorPrimary,
							tintColor2: p2ColorSecondary,
							triggerCallbacks: true
						}
					);
				}
			}

			// 旗帜始终加载
			this.leader3DBannerRight = this.leaderModelGroup.addModel(
				this.getCivBannerName(civ2.CivilizationType.toString()),
				{ marker: this.leader3DMarkerRight, offset: rightBannerPosition },
				{
					angle: classRef.RIGHT_BANNER_ANGLE,
					scale: classRef.BANNER_SCALE,
					initialState: "IDLE_ListeningPlayer",
					foreground: true,
					tintColor1: p2ColorPrimary,
					tintColor2: p2ColorSecondary,
					triggerCallbacks: true
				}
			);
			if (this.leader3DBannerRight == null) {
				this.leader3DBannerRight = this.leaderModelGroup.addModel(
					this.getFallbackBannerAssetName(),
					{ marker: this.leader3DMarkerRight, offset: rightBannerPosition },
					{
						angle: classRef.RIGHT_BANNER_ANGLE,
						scale: classRef.BANNER_SCALE,
						initialState: "IDLE_ListeningPlayer",
						foreground: true,
						tintColor1: p2ColorPrimary,
						tintColor2: p2ColorSecondary,
						triggerCallbacks: true
					}
				);
			}
		}

		this.showDiplomaticSceneEnvironment();
		this.simpleLeaderPopUpCameraAnimation(false, 0);

		// 对图片领袖延迟显示覆盖层，传递状态参数
		if (isImg1) {
			setTimeout(() => {
				// 获取左侧领袖的初始状态
				const player1 = Players.get(playerID1);
				let initialState1 = "neutral";
				if (player1 && window.CustomLeaderConfig && window.CustomLeaderConfig.getDiplomacyInitialState) {
					const relationship1 = player1.Diplomacy?.getRelationshipEnum?.(playerID2);
					const isAtWar1 = this.isAtWarWithPlayer ? this.isAtWarWithPlayer(playerID2) : false;
					initialState1 = window.CustomLeaderConfig.getDiplomacyInitialState(relationship1, isAtWar1);
				}
				safeHandleImageLeaderDisplay(leaderID1, "left", this, initialState1, true);
			}, 300);
		}
		if (isImg2) {
			setTimeout(() => {
				// 获取右侧领袖的初始状态
				const player2 = Players.get(playerID2);
				let initialState2 = "neutral";
				if (player2 && window.CustomLeaderConfig && window.CustomLeaderConfig.getDiplomacyInitialState) {
					const relationship2 = player2.Diplomacy?.getRelationshipEnum?.(playerID1);
					const isAtWar2 = this.isAtWarWithPlayer ? this.isAtWarWithPlayer(playerID1) : false;
					initialState2 = window.CustomLeaderConfig.getDiplomacyInitialState(relationship2, isAtWar2);
				}
				safeHandleImageLeaderDisplay(leaderID2, "right", this, initialState2, true);
			}, 300);
		}

		this.beginRejectPeaceSequence();
		this.isLeaderShowing = true;
	};

	instance.showLeadersRejectPeace._isOverridden = true;
	return true;
}

/**
 * 重写 showLeadersDefeat 方法
 * 严格按照原始方法，仅跳过图片领袖的3D模型加载
 */
function overrideShowLeadersDefeat(instance, classRef) {
	if (!instance || !classRef) {
		return false;
	}

	if (instance.showLeadersDefeat && instance.showLeadersDefeat._isOverridden) {
		return true;
	}

	const originalMethod = instance.showLeadersDefeat.bind(instance);

	instance.showLeadersDefeat = function(params) {
		const playerID1 = params.player1;
		const playerID2 = params.player2;

		const leaderID1 = safeGetLeaderStringIDFromPlayerID(playerID1);
		const leaderID2 = safeGetLeaderStringIDFromPlayerID(playerID2);

		const isImg1 = leaderID1 && safeIsImageLeader(leaderID1);
		const isImg2 = leaderID2 && safeIsImageLeader(leaderID2);

		// 如果两个都不是图片领袖，直接调用原始方法
		if (!isImg1 && !isImg2) {
			return originalMethod(params);
		}

		// 至少有一侧是图片领袖，严格按照原始方法但跳过图片领袖的3D加载
		this.clear();

		const p1ColorPrimary = UI.Player.getPrimaryColorValueAsHex(playerID1);
		const p1ColorSecondary = UI.Player.getSecondaryColorValueAsHex(playerID1);
		const player1 = Players.get(playerID1);
		if (!player1) {
			console.error("leader-model-manager: Unable to get valid player library for player with id: " + playerID1.toString());
			return;
		}
		const leader1 = GameInfo.Leaders.lookup(player1.leaderType);
		if (!leader1) {
			console.error("leader-model-manager: Unable to get valid leader definition for player with id: " + playerID1.toString());
			return;
		}
		const civ1 = GameInfo.Civilizations.lookup(player1.civilizationType);
		if (!civ1) {
			console.error("leader-model-manager: Unable to get valid civilization definition for player with id: " + playerID1.toString());
			return;
		}

		const p2ColorPrimary = UI.Player.getPrimaryColorValueAsHex(playerID2);
		const p2ColorSecondary = UI.Player.getSecondaryColorValueAsHex(playerID2);
		const player2 = Players.get(playerID2);
		if (!player2) {
			console.error("leader-model-manager: Unable to get valid player library for player with id: " + playerID2.toString());
			return;
		}
		const leader2 = GameInfo.Leaders.lookup(player2.leaderType);
		if (!leader2) {
			console.error("leader-model-manager: Unable to get valid leader definition for player with id: " + playerID2.toString());
			return;
		}
		const civ2 = GameInfo.Civilizations.lookup(player2.civilizationType);
		if (!civ2) {
			console.error("leader-model-manager: Unable to get valid civilization definition for player with id: " + playerID2.toString());
			return;
		}

		const screenType = this.getScreenType();
		const leftModelPosition = classRef.POSITIONS[screenType][0 /* LeftModel */];
		const leftBannerPosition = classRef.POSITIONS[screenType][1 /* LeftBanner */];
		const rightModelPosition = classRef.POSITIONS[screenType][2 /* RightModel */];
		const rightBannerPosition = classRef.POSITIONS[screenType][3 /* RightBanner */];

		// 左侧处理
		this.leader3DMarkerLeft = WorldUI.createFixedMarker({ x: 0, y: 0, z: 0 });
		if (this.leader3DMarkerLeft != null) {
			this.leaderModelGroup.addModel(
				this.getLeftLightingAssetName(),
				{ marker: this.leader3DMarkerLeft, offset: leftModelPosition },
				{ angle: 0, scale: 1, foreground: true }
			);

			// 只在不是图片领袖时加载3D模型
			if (!isImg1) {
				this.leader3DModelLeft = this.leaderModelGroup.addModel(
					this.getLeaderAssetName(leader1.LeaderType.toString()),
					{ marker: this.leader3DMarkerLeft, offset: leftModelPosition },
					{
						angle: 0,
						scale: 1,
						foreground: true,
						tintColor1: p1ColorPrimary,
						tintColor2: p1ColorSecondary,
						triggerCallbacks: true
					}
				);
				if (this.leader3DModelLeft == null) {
					this.leader3DModelLeft = this.leaderModelGroup.addModel(
						this.getFallbackAssetName(),
						{ marker: this.leader3DMarkerLeft, offset: leftModelPosition },
						{
							angle: 0,
							scale: 1,
							foreground: true,
							tintColor1: p1ColorPrimary,
							tintColor2: p1ColorSecondary,
							triggerCallbacks: true
						}
					);
				}
			}

			// 旗帜始终加载
			this.leader3DBannerLeft = this.leaderModelGroup.addModel(
				this.getCivBannerName(civ1.CivilizationType.toString()),
				{ marker: this.leader3DMarkerLeft, offset: leftBannerPosition },
				{
					angle: classRef.LEFT_BANNER_ANGLE,
					scale: classRef.BANNER_SCALE,
					foreground: true,
					tintColor1: p1ColorPrimary,
					tintColor2: p1ColorSecondary,
					triggerCallbacks: true
				}
			);
			if (this.leader3DBannerLeft == null) {
				this.leader3DBannerLeft = this.leaderModelGroup.addModel(
					this.getFallbackBannerAssetName(),
					{ marker: this.leader3DMarkerLeft, offset: leftBannerPosition },
					{
						angle: classRef.LEFT_BANNER_ANGLE,
						scale: classRef.BANNER_SCALE,
						foreground: true,
						tintColor1: p1ColorPrimary,
						tintColor2: p1ColorSecondary,
						triggerCallbacks: true
					}
				);
			}
		}

		// 右侧处理
		this.leader3DMarkerRight = WorldUI.createFixedMarker({ x: 0, y: 0, z: 0 });
		if (this.leader3DMarkerRight != null) {
			this.leaderModelGroup.addModel(
				this.getRightLightingAssetName(),
				{ marker: this.leader3DMarkerRight, offset: rightModelPosition },
				{ angle: 0, scale: 1, foreground: true }
			);

			// 只在不是图片领袖时加载3D模型
			if (!isImg2) {
				this.leader3DModelRight = this.leaderModelGroup.addModel(
					this.getLeaderAssetName(leader2.LeaderType.toString()),
					{ marker: this.leader3DMarkerRight, offset: rightModelPosition },
					{
						angle: 0,
						scale: 1,
						foreground: true,
						tintColor1: p2ColorPrimary,
						tintColor2: p2ColorSecondary,
						triggerCallbacks: true
					}
				);
				if (this.leader3DModelRight == null) {
					this.leader3DModelRight = this.leaderModelGroup.addModel(
						this.getFallbackAssetName(),
						{ marker: this.leader3DMarkerRight, offset: rightModelPosition },
						{
							angle: 0,
							scale: 1,
							foreground: true,
							tintColor1: p2ColorPrimary,
							tintColor2: p2ColorSecondary,
							triggerCallbacks: true
						}
					);
				}
			}

			// 旗帜始终加载
			this.leader3DBannerRight = this.leaderModelGroup.addModel(
				this.getCivBannerName(civ2.CivilizationType.toString()),
				{ marker: this.leader3DMarkerRight, offset: rightBannerPosition },
				{
					angle: classRef.RIGHT_BANNER_ANGLE,
					scale: classRef.BANNER_SCALE,
					foreground: true,
					tintColor1: p2ColorPrimary,
					tintColor2: p2ColorSecondary,
					triggerCallbacks: true
				}
			);
			if (this.leader3DBannerRight == null) {
				this.leader3DBannerRight = this.leaderModelGroup.addModel(
					this.getFallbackBannerAssetName(),
					{ marker: this.leader3DMarkerRight, offset: rightBannerPosition },
					{
						angle: classRef.RIGHT_BANNER_ANGLE,
						scale: classRef.BANNER_SCALE,
						foreground: true,
						tintColor1: p2ColorPrimary,
						tintColor2: p2ColorSecondary,
						triggerCallbacks: true
					}
				);
			}
		}

		this.showDiplomaticSceneEnvironment();
		this.simpleLeaderPopUpCameraAnimation(false, 0);

		// 对图片领袖延迟显示覆盖层
		if (isImg1) {
			setTimeout(() => {
				safeHandleImageLeaderDisplay(leaderID1, "left", this, null, true);
			}, 300);
		}
		if (isImg2) {
			setTimeout(() => {
				safeHandleImageLeaderDisplay(leaderID2, "right", this, null, true);
			}, 300);
		}

		this.beginDefeatSequence();
		this.isLeaderShowing = true;
	};

	instance.showLeadersDefeat._isOverridden = true;
	return true;
}

/**
 * 重写 showLeaderModels 方法（普通外交协议场景）
 * 严格按照原始方法，仅跳过图片领袖的3D模型加载
 */
function overrideShowLeaderModels(instance, classRef) {
	if (!instance || !classRef) {
		return false;
	}

	if (instance.showLeaderModels && instance.showLeaderModels._isOverridden) {
		return true;
	}

	const originalMethod = instance.showLeaderModels.bind(instance);

	instance.showLeaderModels = function(playerID1, playerID2) {
		const leaderID1 = safeGetLeaderStringIDFromPlayerID(playerID1);
		const leaderID2 = safeGetLeaderStringIDFromPlayerID(playerID2);

		const isImg1 = leaderID1 && safeIsImageLeader(leaderID1);
		const isImg2 = leaderID2 && safeIsImageLeader(leaderID2);

		// 如果两个都不是图片领袖，直接调用原始方法
		if (!isImg1 && !isImg2) {
			return originalMethod(playerID1, playerID2);
		}

		// 至少有一侧是图片领袖，严格按照原始方法但跳过图片领袖的3D加载
		this.clear();

		const p1ColorPrimary = UI.Player.getPrimaryColorValueAsHex(playerID1);
		const p1ColorSecondary = UI.Player.getSecondaryColorValueAsHex(playerID1);
		const player1 = Players.get(playerID1);
		if (!player1) {
			return;
		}
		const leader1 = GameInfo.Leaders.lookup(player1.leaderType);
		if (!leader1) {
			return;
		}
		const civ1 = GameInfo.Civilizations.lookup(player1.civilizationType);
		if (!civ1) {
			return;
		}

		const screenType = this.getScreenType();
		const leftModelPosition = classRef.POSITIONS[screenType][0 /* LeftModel */];
		const leftBannerPosition = classRef.POSITIONS[screenType][1 /* LeftBanner */];
		const rightModelPosition = classRef.POSITIONS[screenType][2 /* RightModel */];
		const rightBannerPosition = classRef.POSITIONS[screenType][3 /* RightBanner */];

		// 左侧处理
		this.leader3DMarkerLeft = WorldUI.createFixedMarker({ x: 0, y: 0, z: 0 });
		if (this.leader3DMarkerLeft != null) {
			this.leaderModelGroup.addModel(
				this.getLeftLightingAssetName(),
				{ marker: this.leader3DMarkerLeft, offset: leftModelPosition },
				{ angle: 0, scale: 1, foreground: true }
			);

			// 只在不是图片领袖时加载3D模型
			if (!isImg1) {
				this.leader3DModelLeft = this.leaderModelGroup.addModel(
					this.getLeaderAssetName(leader1.LeaderType.toString()),
					{ marker: this.leader3DMarkerLeft, offset: leftModelPosition },
					{
						angle: 0,
						scale: 1,
						initialState: "IDLE_ListeningPlayer",
						foreground: true,
						tintColor1: p1ColorPrimary,
						tintColor2: p1ColorSecondary,
						triggerCallbacks: true
					}
				);
				if (this.leader3DModelLeft == null) {
					this.leader3DModelLeft = this.leaderModelGroup.addModel(
						this.getFallbackAssetName(),
						{ marker: this.leader3DMarkerLeft, offset: leftModelPosition },
						{
							angle: 0,
							scale: 1,
							initialState: "IDLE_ListeningPlayer",
							foreground: true,
							tintColor1: p1ColorPrimary,
							tintColor2: p1ColorSecondary,
							triggerCallbacks: true
						}
					);
				}
			}

			// 旗帜始终加载
			this.leader3DBannerLeft = this.leaderModelGroup.addModel(
				this.getCivBannerName(civ1.CivilizationType.toString()),
				{ marker: this.leader3DMarkerLeft, offset: leftBannerPosition },
				{
					angle: classRef.LEFT_BANNER_ANGLE,
					scale: classRef.BANNER_SCALE,
					initialState: "IDLE_ListeningPlayer",
					foreground: true,
					tintColor1: p1ColorPrimary,
					tintColor2: p1ColorSecondary,
					triggerCallbacks: true
				}
			);
			if (this.leader3DBannerLeft == null) {
				this.leader3DBannerLeft = this.leaderModelGroup.addModel(
					this.getFallbackBannerAssetName(),
					{ marker: this.leader3DMarkerLeft, offset: leftBannerPosition },
					{
						angle: classRef.LEFT_BANNER_ANGLE,
						scale: classRef.BANNER_SCALE,
						initialState: "IDLE_ListeningPlayer",
						foreground: true,
						tintColor1: p1ColorPrimary,
						tintColor2: p1ColorSecondary,
						triggerCallbacks: true
					}
				);
			}
		}

		const p2ColorPrimary = UI.Player.getPrimaryColorValueAsHex(playerID2);
		const p2ColorSecondary = UI.Player.getSecondaryColorValueAsHex(playerID2);
		const player2 = Players.get(playerID2);
		if (!player2) {
			return;
		}
		const leader2 = GameInfo.Leaders.lookup(player2.leaderType);
		if (!leader2) {
			return;
		}
		const civ2 = GameInfo.Civilizations.lookup(player2.civilizationType);
		if (!civ2) {
			return;
		}

		// 右侧处理
		this.leader3DMarkerRight = WorldUI.createFixedMarker({ x: 0, y: 0, z: 0 });
		if (this.leader3DMarkerRight != null) {
			this.leaderModelGroup.addModel(
				this.getRightLightingAssetName(),
				{ marker: this.leader3DMarkerRight, offset: rightModelPosition },
				{ angle: 0, scale: 1, foreground: true }
			);

			// 只在不是图片领袖时加载3D模型
			if (!isImg2) {
				this.leader3DModelRight = this.leaderModelGroup.addModel(
					this.getLeaderAssetName(leader2.LeaderType.toString()),
					{ marker: this.leader3DMarkerRight, offset: rightModelPosition },
					{
						angle: 0,
						scale: 1,
						initialState: "IDLE_WaitingOther",
						foreground: true,
						tintColor1: p2ColorPrimary,
						tintColor2: p2ColorSecondary,
						triggerCallbacks: true
					}
				);
				if (this.leader3DModelRight == null) {
					this.leader3DModelRight = this.leaderModelGroup.addModel(
						this.getFallbackAssetName(),
						{ marker: this.leader3DMarkerRight, offset: rightModelPosition },
						{
							angle: 0,
							scale: 1,
							initialState: "IDLE_WaitingOther",
							foreground: true,
							tintColor1: p2ColorPrimary,
							tintColor2: p2ColorSecondary,
							triggerCallbacks: true
						}
					);
				}
			}

			// 旗帜始终加载
			this.leader3DBannerRight = this.leaderModelGroup.addModel(
				this.getCivBannerName(civ2.CivilizationType.toString()),
				{ marker: this.leader3DMarkerRight, offset: rightBannerPosition },
				{
					angle: classRef.RIGHT_BANNER_ANGLE,
					scale: classRef.BANNER_SCALE,
					initialState: "IDLE_ListeningPlayer",
					foreground: true,
					tintColor1: p2ColorPrimary,
					tintColor2: p2ColorSecondary,
					triggerCallbacks: true
				}
			);
			if (this.leader3DBannerRight == null) {
				this.leader3DBannerRight = this.leaderModelGroup.addModel(
					this.getFallbackBannerAssetName(),
					{ marker: this.leader3DMarkerRight, offset: rightBannerPosition },
					{
						angle: classRef.RIGHT_BANNER_ANGLE,
						scale: classRef.BANNER_SCALE,
						initialState: "IDLE_ListeningPlayer",
						foreground: true,
						tintColor1: p2ColorPrimary,
						tintColor2: p2ColorSecondary,
						triggerCallbacks: true
					}
				);
			}
		}

		this.showDiplomaticSceneEnvironment();
		this.simpleLeaderPopUpCameraAnimation(false, 0);

		// 对图片领袖延迟显示覆盖层
		if (isImg1) {
			setTimeout(() => {
				safeHandleImageLeaderDisplay(leaderID1, "left", this, null, true);
			}, 300);
		}
		if (isImg2) {
			setTimeout(() => {
				safeHandleImageLeaderDisplay(leaderID2, "right", this, null, true);
			}, 300);
		}

		this.isLeaderShowing = true;
		const animationToPlay = "IDLE_WaitingOther";
		this.playLeaderAnimation(animationToPlay, "right");
		const animationToPlayLeft = "IDLE_ListeningPlayer";
		this.playLeaderAnimation(animationToPlayLeft, "left");
	};

	instance.showLeaderModels._isOverridden = true;
	return true;
}

/**
 * 重写 showLeftLeaderModel 方法（只显示左侧领袖）
 * 严格按照原始方法，仅跳过图片领袖的3D模型加载，但始终加载旗帜
 */
function overrideShowLeftLeaderModel(instance, classRef) {
	if (!instance || !classRef) {
		return false;
	}

	if (instance.showLeftLeaderModel && instance.showLeftLeaderModel._isOverridden) {
		return true;
	}

	const originalMethod = instance.showLeftLeaderModel.bind(instance);

	instance.showLeftLeaderModel = function(playerID) {
		const leaderID = safeGetLeaderStringIDFromPlayerID(playerID);
		const isImg = leaderID && safeIsImageLeader(leaderID);

		// 如果不是图片领袖，先清理图片覆盖层（如果存在），然后调用原始方法
		if (!isImg) {
			// 检查是否有图片覆盖层存在，如果有则立即清理
			const hasLeftOverlay = window.LeaderOverlayImage && 
				document.querySelector(".leader-overlay-image-block-diplomacy-left");
			const hasCenterOverlay = window.LeaderOverlayImage && 
				document.querySelector(".leader-overlay-image-block-diplomacy");
			
			if (hasLeftOverlay || hasCenterOverlay) {
				// 立即清理图片覆盖层，不延迟
				immediatelyRemoveImageOverlay("left");
			}
			
			// 然后调用原始方法
			return originalMethod(playerID);
		}

		// 是图片领袖，严格按照原始方法但跳过3D模型加载
		this.clear();

		const p1ColorPrimary = UI.Player.getPrimaryColorValueAsHex(playerID);
		const p1ColorSecondary = UI.Player.getSecondaryColorValueAsHex(playerID);
		const player1 = Players.get(playerID);
		if (!player1) {
			return;
		}
		const leader1 = GameInfo.Leaders.lookup(player1.leaderType);
		if (!leader1) {
			return;
		}
		const civ1 = GameInfo.Civilizations.lookup(player1.civilizationType);
		if (!civ1) {
			return;
		}

		const screenType = this.getScreenType();
		const leftModelPosition = classRef.POSITIONS[screenType][0 /* LeftModel */];
		const leftBannerPosition = classRef.POSITIONS[screenType][1 /* LeftBanner */];

		// 左侧处理
		this.leader3DMarkerLeft = WorldUI.createFixedMarker({ x: 0, y: 0, z: 0 });
		if (this.leader3DMarkerLeft != null) {
			this.leaderModelGroup.addModel(
				this.getLeftLightingAssetName(),
				{ marker: this.leader3DMarkerLeft, offset: leftModelPosition },
				{ angle: 0, scale: 1, foreground: true }
			);

			// 只在不是图片领袖时加载3D模型
			// 图片领袖跳过3D模型加载

			// 旗帜始终加载
			this.leader3DBannerLeft = this.leaderModelGroup.addModel(
				this.getCivBannerName(civ1.CivilizationType.toString()),
				{ marker: this.leader3DMarkerLeft, offset: leftBannerPosition },
				{
					angle: classRef.LEFT_BANNER_ANGLE,
					scale: classRef.BANNER_SCALE,
					initialState: "IDLE_ListeningPlayer",
					foreground: true,
					tintColor1: p1ColorPrimary,
					tintColor2: p1ColorSecondary,
					triggerCallbacks: true
				}
			);
			if (this.leader3DBannerLeft == null) {
				this.leader3DBannerLeft = this.leaderModelGroup.addModel(
					this.getFallbackBannerAssetName(),
					{ marker: this.leader3DMarkerLeft, offset: leftBannerPosition },
					{
						angle: classRef.LEFT_BANNER_ANGLE,
						scale: classRef.BANNER_SCALE,
						initialState: "IDLE_ListeningPlayer",
						foreground: true,
						tintColor1: p1ColorPrimary,
						tintColor2: p1ColorSecondary,
						triggerCallbacks: true
					}
				);
			}
		}

		this.showDiplomaticSceneEnvironment();
		this.simpleLeaderPopUpCameraAnimation(false, 0);

		// 对图片领袖延迟显示覆盖层，从外交关系推断状态
		setTimeout(() => {
			// 在切换文明场景下，从外交关系推断状态（不依赖序列类型）
			const inferredState = inferLeaderStateFromDiplomacy(playerID, "left", this);
			safeHandleImageLeaderDisplay(leaderID, "left", this, inferredState, true);
		}, 300);

		this.isLeaderShowing = true;
	};

	instance.showLeftLeaderModel._isOverridden = true;
	return true;
}

/**
 * 重写 showRightLeaderModel 方法（只显示右侧领袖）
 * 严格按照原始方法，仅跳过图片领袖的3D模型加载，但始终加载旗帜
 */
function overrideShowRightLeaderModel(instance, classRef) {
	if (!instance || !classRef) {
		return false;
	}

	if (instance.showRightLeaderModel && instance.showRightLeaderModel._isOverridden) {
		return true;
	}

	const originalMethod = instance.showRightLeaderModel.bind(instance);

	instance.showRightLeaderModel = function(playerID) {
		const leaderID = safeGetLeaderStringIDFromPlayerID(playerID);
		const isImg = leaderID && safeIsImageLeader(leaderID);

		// 如果不是图片领袖，先清理图片覆盖层（如果存在），然后调用原始方法
		if (!isImg) {
			// 检查是否有图片覆盖层存在，如果有则立即清理
			const hasRightOverlay = window.LeaderOverlayImage && 
				document.querySelector(".leader-overlay-image-block-diplomacy-right");
			const hasCenterOverlay = window.LeaderOverlayImage && 
				document.querySelector(".leader-overlay-image-block-diplomacy");
			
			if (hasRightOverlay || hasCenterOverlay) {
				// 立即清理图片覆盖层，不延迟
				immediatelyRemoveImageOverlay("right");
			}
			
			// 然后调用原始方法
			return originalMethod(playerID);
		}

		// 是图片领袖，严格按照原始方法但跳过3D模型加载
		this.clear();

		const p2ColorPrimary = UI.Player.getPrimaryColorValueAsHex(playerID);
		const p2ColorSecondary = UI.Player.getSecondaryColorValueAsHex(playerID);
		const player2 = Players.get(playerID);
		if (!player2) {
			return;
		}
		const leader2 = GameInfo.Leaders.lookup(player2.leaderType);
		if (!leader2) {
			return;
		}
		const civ2 = GameInfo.Civilizations.lookup(player2.civilizationType);
		if (!civ2) {
			return;
		}

		const screenType = this.getScreenType();
		const rightModelPosition = classRef.POSITIONS[screenType][2 /* RightModel */];
		const rightBannerPosition = classRef.POSITIONS[screenType][3 /* RightBanner */];
		let animationToPlay = "IDLE_WaitingOther";
		let modelPosition = rightModelPosition;
		const isHostile = player2.Diplomacy?.getRelationshipEnum(GameContext.localPlayerID) == DiplomacyPlayerRelationships.PLAYER_RELATIONSHIP_HOSTILE;
		if ((this.isAtWarWithPlayer && this.isAtWarWithPlayer(playerID)) || isHostile) {
			animationToPlay = "IDLE_DwCenterOther";
			this.rightAnimState = "IDLE_DwCenterOther";
			modelPosition = classRef.POSITIONS[screenType][4 /* RightModelAtWar */];
			this.isRightHostile = true;
		}

		// 右侧处理
		this.leader3DMarkerRight = WorldUI.createFixedMarker({ x: 0, y: 0, z: 0 });
		if (this.leader3DMarkerRight != null) {
			this.leaderModelGroup.addModel(
				this.getRightLightingAssetName(),
				{ marker: this.leader3DMarkerRight, offset: modelPosition },
				{ angle: 0, scale: 1, foreground: true }
			);

			// 只在不是图片领袖时加载3D模型
			// 图片领袖跳过3D模型加载

			// 旗帜始终加载
			this.leader3DBannerRight = this.leaderModelGroup.addModel(
				this.getCivBannerName(civ2.CivilizationType.toString()),
				{ marker: this.leader3DMarkerRight, offset: rightBannerPosition },
				{
					angle: classRef.RIGHT_BANNER_ANGLE,
					scale: classRef.BANNER_SCALE,
					initialState: "IDLE_ListeningPlayer",
					foreground: true,
					tintColor1: p2ColorPrimary,
					tintColor2: p2ColorSecondary,
					triggerCallbacks: true
				}
			);
			if (this.leader3DBannerRight == null) {
				this.leader3DBannerRight = this.leaderModelGroup.addModel(
					this.getFallbackBannerAssetName(),
					{ marker: this.leader3DMarkerRight, offset: rightBannerPosition },
					{
						angle: classRef.RIGHT_BANNER_ANGLE,
						scale: classRef.BANNER_SCALE,
						initialState: "IDLE_ListeningPlayer",
						foreground: true,
						tintColor1: p2ColorPrimary,
						tintColor2: p2ColorSecondary,
						triggerCallbacks: true
					}
				);
			}
		}

		this.showDiplomaticSceneEnvironment();
		this.simpleLeaderPopUpCameraAnimation(false, 0);

		// 对图片领袖延迟显示覆盖层，从外交关系推断状态
		setTimeout(() => {
			// 在切换文明场景下，从外交关系推断状态（不依赖序列类型）
			const inferredState = inferLeaderStateFromDiplomacy(playerID, "right", this);
			safeHandleImageLeaderDisplay(leaderID, "right", this, inferredState, true);
		}, 300);

		this.isLeaderShowing = true;
		this.playLeaderAnimation(animationToPlay, "right");
	};

	instance.showRightLeaderModel._isOverridden = true;
	return true;
}

/**
 * 重写 beginAcknowledgePlayerSequence 方法（玩家友好选择后的反应）
 * 在图片领袖的情况下更新图片状态
 */
function overrideBeginAcknowledgePlayerSequence(instance, classRef) {
	if (!instance || !classRef) {
		return false;
	}

	if (instance.beginAcknowledgePlayerSequence && instance.beginAcknowledgePlayerSequence._isOverridden) {
		return true;
	}

	const originalMethod = instance.beginAcknowledgePlayerSequence.bind(instance);

	instance.beginAcknowledgePlayerSequence = function() {
		// 先调用原始方法
		originalMethod.call(this);

		// 检查左侧领袖是否为图片领袖
		try {
			if (this.leader3DModelLeft === null || this.leader3DModelLeft === undefined) {
				// 左侧没有3D模型，可能是图片领袖
				// 左侧通常是本地玩家
				const leftPlayerID = typeof GameContext !== "undefined" ? GameContext.localPlayerID : null;
				if (leftPlayerID !== null && leftPlayerID !== undefined) {
					const leaderID = safeGetLeaderStringIDFromPlayerID(leftPlayerID);
					if (leaderID && safeIsImageLeader(leaderID)) {
						// 更新左侧图片为友好回应状态
						if (window.LeaderOverlayImage && typeof window.LeaderOverlayImage.tryUpdateDiplomacyImageOverlay === "function") {
							window.LeaderOverlayImage.tryUpdateDiplomacyImageOverlay(leaderID, "left", "response_positive");
						}
					}
				}
			}
		} catch (error) {
			console.warn(`[Diplomacy Sequence] Error updating image for acknowledge player sequence:`, error);
		}
	};

	instance.beginAcknowledgePlayerSequence._isOverridden = true;
	return true;
}

/**
 * 重写 beginHostileAcknowledgePlayerSequence 方法（玩家不友好选择后的反应）
 * 在图片领袖的情况下更新图片状态
 */
function overrideBeginHostileAcknowledgePlayerSequence(instance, classRef) {
	if (!instance || !classRef) {
		return false;
	}

	if (instance.beginHostileAcknowledgePlayerSequence && instance.beginHostileAcknowledgePlayerSequence._isOverridden) {
		return true;
	}

	const originalMethod = instance.beginHostileAcknowledgePlayerSequence.bind(instance);

	instance.beginHostileAcknowledgePlayerSequence = function() {
		// 先调用原始方法
		originalMethod.call(this);

		// 检查左侧领袖是否为图片领袖
		try {
			if (this.leader3DModelLeft === null || this.leader3DModelLeft === undefined) {
				// 左侧没有3D模型，可能是图片领袖
				// 左侧通常是本地玩家
				const leftPlayerID = typeof GameContext !== "undefined" ? GameContext.localPlayerID : null;
				if (leftPlayerID !== null && leftPlayerID !== undefined) {
					const leaderID = getLeaderStringIDFromPlayerID(leftPlayerID);
					if (leaderID && isImageLeader(leaderID)) {
						// 更新左侧图片为不友好回应状态
						if (window.LeaderOverlayImage && typeof window.LeaderOverlayImage.tryUpdateDiplomacyImageOverlay === "function") {
							window.LeaderOverlayImage.tryUpdateDiplomacyImageOverlay(leaderID, "left", "response_negative");
						}
					}
				}
			}
		} catch (error) {
			console.warn(`[Diplomacy Sequence] Error updating image for hostile acknowledge player sequence:`, error);
		}
	};

	instance.beginHostileAcknowledgePlayerSequence._isOverridden = true;
	return true;
}

/**
 * 重写 beginAcknowledgePositiveOtherSequence 方法（对方正面反应）
 * 在图片领袖的情况下更新图片状态
 */
function overrideBeginAcknowledgePositiveOtherSequence(instance, classRef) {
	if (!instance || !classRef) {
		return false;
	}

	if (instance.beginAcknowledgePositiveOtherSequence && instance.beginAcknowledgePositiveOtherSequence._isOverridden) {
		return true;
	}

	const originalMethod = instance.beginAcknowledgePositiveOtherSequence.bind(instance);

	instance.beginAcknowledgePositiveOtherSequence = function(forced) {
		// 先调用原始方法
		originalMethod.call(this, forced);

		// 检查右侧领袖是否为图片领袖
		try {
			if (this.leader3DModelRight === null || this.leader3DModelRight === undefined) {
				// 右侧没有3D模型，可能是图片领袖
				// 尝试从DiplomacyManager获取当前其他玩家ID
				let rightPlayerID = null;
				if (typeof DiplomacyManager !== "undefined" && DiplomacyManager.currentDiplomacyDialogData) {
					rightPlayerID = DiplomacyManager.currentDiplomacyDialogData.OtherPlayerID;
				}
				// 如果无法获取，尝试查找所有可能的playerID
				if (rightPlayerID === null || rightPlayerID === undefined) {
					if (typeof Players !== "undefined" && typeof GameContext !== "undefined") {
						const aliveIds = Players.getAliveIds();
						for (const pid of aliveIds) {
							if (pid !== GameContext.localPlayerID) {
								const testLeaderID = getLeaderStringIDFromPlayerID(pid);
								if (testLeaderID && isImageLeader(testLeaderID)) {
									rightPlayerID = pid;
									break;
								}
							}
						}
					}
				}
				if (rightPlayerID !== null && rightPlayerID !== undefined) {
					const leaderID = safeGetLeaderStringIDFromPlayerID(rightPlayerID);
					if (leaderID && safeIsImageLeader(leaderID)) {
						// 更新右侧图片为友好回应状态
						if (window.LeaderOverlayImage && typeof window.LeaderOverlayImage.tryUpdateDiplomacyImageOverlay === "function") {
							window.LeaderOverlayImage.tryUpdateDiplomacyImageOverlay(leaderID, "right", "response_positive");
						}
					}
				}
			}
		} catch (error) {
			console.warn(`[Diplomacy Sequence] Error updating image for acknowledge positive other sequence:`, error);
		}
	};

	instance.beginAcknowledgePositiveOtherSequence._isOverridden = true;
	return true;
}

/**
 * 重写 beginAcknowledgeNegativeOtherSequence 方法（对方负面反应）
 * 在图片领袖的情况下更新图片状态
 */
function overrideBeginAcknowledgeNegativeOtherSequence(instance, classRef) {
	if (!instance || !classRef) {
		return false;
	}

	if (instance.beginAcknowledgeNegativeOtherSequence && instance.beginAcknowledgeNegativeOtherSequence._isOverridden) {
		return true;
	}

	const originalMethod = instance.beginAcknowledgeNegativeOtherSequence.bind(instance);

	instance.beginAcknowledgeNegativeOtherSequence = function(forced) {
		// 先调用原始方法
		originalMethod.call(this, forced);

		// 检查右侧领袖是否为图片领袖
		try {
			if (this.leader3DModelRight === null || this.leader3DModelRight === undefined) {
				// 右侧没有3D模型，可能是图片领袖
				// 尝试从DiplomacyManager获取当前其他玩家ID
				let rightPlayerID = null;
				if (typeof DiplomacyManager !== "undefined" && DiplomacyManager.currentDiplomacyDialogData) {
					rightPlayerID = DiplomacyManager.currentDiplomacyDialogData.OtherPlayerID;
				}
				// 如果无法获取，尝试查找所有可能的playerID
				if (rightPlayerID === null || rightPlayerID === undefined) {
					if (typeof Players !== "undefined" && typeof GameContext !== "undefined") {
						const aliveIds = Players.getAliveIds();
						for (const pid of aliveIds) {
							if (pid !== GameContext.localPlayerID) {
								const testLeaderID = getLeaderStringIDFromPlayerID(pid);
								if (testLeaderID && isImageLeader(testLeaderID)) {
									rightPlayerID = pid;
									break;
								}
							}
						}
					}
				}
				if (rightPlayerID !== null && rightPlayerID !== undefined) {
					const leaderID = safeGetLeaderStringIDFromPlayerID(rightPlayerID);
					if (leaderID && safeIsImageLeader(leaderID)) {
						// 更新右侧图片为不友好回应状态
						if (window.LeaderOverlayImage && typeof window.LeaderOverlayImage.tryUpdateDiplomacyImageOverlay === "function") {
							window.LeaderOverlayImage.tryUpdateDiplomacyImageOverlay(leaderID, "right", "response_negative");
						}
					}
				}
			}
		} catch (error) {
			console.warn(`[Diplomacy Sequence] Error updating image for acknowledge negative other sequence:`, error);
		}
	};

	instance.beginAcknowledgeNegativeOtherSequence._isOverridden = true;
	return true;
}

/**
 * 重写 beginAcknowledgeOtherSequence 方法（对方一般反应）
 * 在图片领袖的情况下更新图片状态（默认使用正面反应）
 */
function overrideBeginAcknowledgeOtherSequence(instance, classRef) {
	if (!instance || !classRef) {
		return false;
	}

	if (instance.beginAcknowledgeOtherSequence && instance.beginAcknowledgeOtherSequence._isOverridden) {
		return true;
	}

	const originalMethod = instance.beginAcknowledgeOtherSequence.bind(instance);

	instance.beginAcknowledgeOtherSequence = function() {
		// 先调用原始方法
		originalMethod.call(this);

		// 检查右侧领袖是否为图片领袖
		try {
			if (this.leader3DModelRight === null || this.leader3DModelRight === undefined) {
				// 右侧没有3D模型，可能是图片领袖
				// 尝试从DiplomacyManager获取当前其他玩家ID
				let rightPlayerID = null;
				if (typeof DiplomacyManager !== "undefined" && DiplomacyManager.currentDiplomacyDialogData) {
					rightPlayerID = DiplomacyManager.currentDiplomacyDialogData.OtherPlayerID;
				}
				// 如果无法获取，尝试查找所有可能的playerID
				if (rightPlayerID === null || rightPlayerID === undefined) {
					if (typeof Players !== "undefined" && typeof GameContext !== "undefined") {
						const aliveIds = Players.getAliveIds();
						for (const pid of aliveIds) {
							if (pid !== GameContext.localPlayerID) {
								const testLeaderID = getLeaderStringIDFromPlayerID(pid);
								if (testLeaderID && isImageLeader(testLeaderID)) {
									rightPlayerID = pid;
									break;
								}
							}
						}
					}
				}
				if (rightPlayerID !== null && rightPlayerID !== undefined) {
					const leaderID = safeGetLeaderStringIDFromPlayerID(rightPlayerID);
					if (leaderID && safeIsImageLeader(leaderID)) {
						// 默认使用正面反应（可以根据上下文调整）
						if (window.LeaderOverlayImage && typeof window.LeaderOverlayImage.tryUpdateDiplomacyImageOverlay === "function") {
							window.LeaderOverlayImage.tryUpdateDiplomacyImageOverlay(leaderID, "right", "response_positive");
						}
					}
				}
			}
		} catch (error) {
			console.warn(`[Diplomacy Sequence] Error updating image for acknowledge other sequence:`, error);
		}
	};

	instance.beginAcknowledgeOtherSequence._isOverridden = true;
	return true;
}

// 导出序列处理函数
window.DiplomacySequenceHandlers = {
	overrideShowLeadersFirstMeet,
	overrideShowLeadersDeclareWar,
	overrideShowLeadersAcceptPeace,
	overrideShowLeadersRejectPeace,
	overrideShowLeadersDefeat,
	overrideShowLeaderModels,
	overrideShowLeftLeaderModel,
	overrideShowRightLeaderModel,
	overrideBeginAcknowledgePlayerSequence,
	overrideBeginHostileAcknowledgePlayerSequence,
	overrideBeginAcknowledgePositiveOtherSequence,
	overrideBeginAcknowledgeNegativeOtherSequence,
	overrideBeginAcknowledgeOtherSequence
};
