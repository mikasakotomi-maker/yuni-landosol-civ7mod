/**
 * @file leader-overlay-image.js
 * @description Leader Overlay Image: Handle image overlay display for leader selection
 */

// 默认图片路径（用于测试）
const DEFAULT_OVERLAY_IMAGE_URL = "fs://game/leader-fallback/texture/LEADER_YUNI_NEUTRAL.png";

// 获取图片路径（支持从配置系统获取）
function getImageUrl(leaderID) {
	if (window.CustomLeaderConfig) {
		const imagePath = window.CustomLeaderConfig.getImagePath(leaderID);
		if (imagePath) {
			return imagePath;
		}
	}

	// 如果没有配置，使用默认图片
	return DEFAULT_OVERLAY_IMAGE_URL;
}

// 获取容器元素（支持不同面板）
// 注意：容器现在仅用于检测面板类型和验证，不再用于定位计算
// 覆盖层使用fixed定位，直接添加到body中
function getContainer(context) {
	// 方法1: 通过 this.randomLeaderContent（GameCreationPanelBase 的属性）
	let container = context?.randomLeaderContent;

	// 方法2: 通过 DOM 查询（如果方法1失败）
	if (!container) {
		container = document.querySelector(".game-creator-leader-info-content");
	}

	// 方法3: 通过 this.Root 查找（如果方法2也失败）
	if (!container && context?.Root) {
		container = context.Root.querySelector(".game-creator-leader-info-content");
	}

	// 方法4: 查找 leader box 容器（时代选择和文明选择面板）
	if (!container) {
		container = document.querySelector(".game-creator-leader-info");
	}

	// 方法5: 通过 context.Root 查找 leader box
	if (!container && context?.Root) {
		container = context.Root.querySelector(".game-creator-leader-info");
	}

	// 方法6: game-setup-panel 特定查询
	if (!container) {
		const gameSetupPanel = document.querySelector("game-setup-panel");
		if (gameSetupPanel) {
			container = gameSetupPanel.querySelector(".game-creator-leader-info-content") || gameSetupPanel.querySelector(".game-creator-leader-info");
		}
	}

	if (!container) {
		// No container found after all methods
	}

	return container;
}

// 获取外交界面的容器元素（3D模型渲染区域）
function getDiplomacyContainer() {
	// 外交界面的3D模型渲染在全屏canvas中，使用body或全屏容器
	// 方法1: 查找全屏的world容器
	let container = document.getElementById("world");

	// 方法2: 如果找不到，使用body作为容器
	if (!container) {
		container = document.body;
	}

	return container;
}

// 获取主菜单的容器元素
function getMainMenuContainer() {
	// 主菜单的3D模型渲染也在全屏容器中
	// 方法1: 查找全屏的world容器
	let container = document.getElementById("world");

	// 方法2: 查找主菜单特定的容器
	if (!container) {
		container = document.querySelector(".screen");
	}

	// 方法3: 如果找不到，使用body作为容器
	if (!container) {
		container = document.body;
	}

	return container;
}

// 修复容器尺寸（简化版：只需要确保容器有基本尺寸，模仿3D模型的显示区域）
function fixContainerSize(container) {
	if (!container) return;

	const rect = container.getBoundingClientRect();

	// 如果容器尺寸为0，设置最小尺寸（模仿3D模型的显示区域）
	if (rect.width === 0 || rect.height === 0) {
		// 设置最小尺寸，确保覆盖层可以显示
		container.style.minWidth = "300px";
		container.style.minHeight = "400px";
		// 触发重排
		void container.offsetHeight;
	}
}

// 创建或更新图片覆盖层（支持位置参数）
function createOrUpdateImageOverlay(container, options = {}) {
	try {
		if (!container) {
			console.warn("[Leader Overlay Image] Container is null, cannot create overlay");
			return null;
		}

		// 默认选项
		const {
			position = "center", // "left", "center", "right"
			widthMultiplier = 3.5, // 宽度倍数
			leftOffsetMultiplier = -0.5, // 右侧偏移倍数（向右偏移二分之一距离）
			topOffsetMultiplier = 0, // 向下偏移倍数（默认值为0，表示无垂直偏移）
			className = "leader-overlay-image-block",
			zIndex = -1, // 设置为负值，使图片显示在文本下方（模仿3D模型在文本下方的效果）
			leaderID = null, // 领袖ID，用于获取图片路径
			imageUrl = null, // 直接指定图片URL（优先级高于leaderID）
			panelType = null // 面板类型，用于判断是否需要更新背景图片
		} = options;

		// 参数验证和清理：确保所有数值参数都是有效数字
		const safeWidthMultiplier = (typeof widthMultiplier === "number" && !isNaN(widthMultiplier) && isFinite(widthMultiplier)) ? widthMultiplier : 3.5;
		const safeLeftOffsetMultiplier = (typeof leftOffsetMultiplier === "number" && !isNaN(leftOffsetMultiplier) && isFinite(leftOffsetMultiplier)) ? leftOffsetMultiplier : -0.5;
		const safeTopOffsetMultiplier = (typeof topOffsetMultiplier === "number" && !isNaN(topOffsetMultiplier) && isFinite(topOffsetMultiplier)) ? topOffsetMultiplier : 0;

		// 确定使用的图片URL
		let finalImageUrl = imageUrl;
		if (!finalImageUrl && leaderID) {
			finalImageUrl = getImageUrl(leaderID);
		}
		if (!finalImageUrl) {
			finalImageUrl = DEFAULT_OVERLAY_IMAGE_URL;
		}

		// 容器仅用于查找和验证，不再用于定位计算
		// 根据位置生成唯一的类名
		const overlayClassName = `${className}${position !== "center" ? `-${position}` : ""}`;

		// 查找是否已存在覆盖层（使用body或world容器，因为fixed定位不依赖容器）
		const searchContainer = document.body;
		let overlayBlock = searchContainer.querySelector(`.${overlayClassName}`);

		if (!overlayBlock) {
			// 创建新的图片覆盖层
			overlayBlock = document.createElement("div");
			overlayBlock.classList.add(overlayClassName);

			let leftValue;
			let widthValue;
			let heightValue = "100vh";
			let bgPosition = "center center";
			let positionType = "fixed";
			let bgSize = "cover";

			const isDiplomacy = className.includes("diplomacy");

			if (isDiplomacy) {
				// 外交界面：fixed + vw 半屏
				// 计算偏移量（使用viewport宽度）
				// 确保数值格式正确，避免CSS calc解析问题
				const leftOffsetVw = safeLeftOffsetMultiplier * 50; // 50vw是半屏宽度
				// 格式化数值，确保小数点后不超过3位，避免CSS解析问题
				const formattedOffsetVw = parseFloat(leftOffsetVw.toFixed(3));
				if (position === "left") {
					// 左侧：向左偏移（leftOffsetMultiplier为正数时向左移动）
					// 使用calc避免双负号问题，确保结果是负数
					leftValue = `calc(0vw - ${Math.abs(formattedOffsetVw)}vw)`;
					widthValue = "50vw";
					bgPosition = "right bottom";  // 图片右对齐左半屏
				} else if (position === "right") {
					// 右侧：向右偏移（leftOffsetMultiplier为正数时向右移动）
					// 修复：确保calc表达式格式正确，使用格式化后的数值
					leftValue = `calc(50vw + ${formattedOffsetVw}vw)`;
					widthValue = "50vw";
					bgPosition = "left bottom";  // 图片左对齐右半屏
				} else {
					// 中心：全屏
					leftValue = "0vw";
					widthValue = "100vw";
					bgPosition = "center bottom";
				}
				bgSize = "cover";  // 外交界面使用cover填满半屏
			} else {
				// Shell界面：fixed + vw 全屏（与外交界面统一实现方式）
				// 计算偏移量（使用viewport宽度，基于全屏100vw）
				// 正数 = 向左偏移，负数 = 向右偏移
				const leftOffsetVw = safeLeftOffsetMultiplier * 100; // 基于全屏宽度
				// 格式化数值，确保小数点后不超过3位，避免CSS解析问题
				const formattedOffsetVw = parseFloat(leftOffsetVw.toFixed(3));

				leftValue = `calc(0vw - ${formattedOffsetVw}vw)`;
				// use vh to properly control zooming
				widthValue = `${safeWidthMultiplier * 100}vh`;
				bgPosition = "center bottom";
				bgSize = "contain";
			}

			// 计算top值（统一使用vh单位）
			let topValue = "0";
			if (safeTopOffsetMultiplier !== 0) {
				// 所有界面都使用viewport高度（vh）计算偏移
				topValue = `${100 * safeTopOffsetMultiplier}vh`;
			}

			// 验证图片URL格式
			if (!finalImageUrl || typeof finalImageUrl !== 'string') {
				console.warn(`[Leader Overlay Image] Invalid image URL for leader ${leaderID || 'unknown'}: ${finalImageUrl}`);
				return null;
			}

			// 设置样式（fixed定位不需要等待容器布局）
			overlayBlock.style.cssText = `
			position: ${positionType};
			top: ${topValue};
			left: ${leftValue};
			width: ${widthValue};
			height: ${heightValue};
			background-image: url("${finalImageUrl}");
			background-size: ${bgSize};
			background-position: ${bgPosition};
			background-repeat: no-repeat;
			z-index: ${zIndex};
			pointer-events: none;
			opacity: ${isDiplomacy ? '1' : '1'};
			transform: ${isDiplomacy ? (position === "left" ? 'translateX(-800vw) scale(1.8)' : position === "right" ? 'translateX(800vw) scale(1.8)' : 'translateY(100px) scale(1.8)') : 'scale(1)'};
			transition: ${isDiplomacy ? 'transform 0.3s ease-out' : 'none'};
			visibility: visible;
		`;

			// 验证图片是否可以加载（仅用于外交界面，避免阻塞其他界面）
			if (isDiplomacy && leaderID) {
				// 异步验证图片加载，不阻塞覆盖层创建
				const img = new Image();
				img.onerror = () => {
					console.warn(`[Leader Overlay Image] Image failed to load for leader ${leaderID}: ${finalImageUrl}`);
					// 如果图片加载失败，隐藏覆盖层但不移除，以便重试
					if (overlayBlock && overlayBlock.parentNode) {
						overlayBlock.style.opacity = '0';
						overlayBlock.style.pointerEvents = 'none';
					}
				};
				img.onload = () => {
					// 图片加载成功，确保覆盖层可见
					if (overlayBlock && overlayBlock.parentNode) {
						overlayBlock.style.opacity = overlayBlock.style.opacity || '1';
					}
				};
				img.src = finalImageUrl;
			}

			// 添加到body（fixed定位不依赖容器）
			try {
				document.body.appendChild(overlayBlock);
				// 验证是否成功添加
				if (!overlayBlock.parentNode || overlayBlock.parentNode !== document.body) {
					console.error(`[Leader Overlay Image] Overlay block appended but parent verification failed for leader ${leaderID || 'unknown'}`);
				}
			} catch (appendError) {
				console.error(`[Leader Overlay Image] Failed to append overlay block for leader ${leaderID || 'unknown'}:`, appendError);
				return null; // 返回null表示失败，但不影响其他领袖
			}

			// 对于外交覆盖层，延迟触发动画
			if (isDiplomacy) {
				setTimeout(() => {
					try {
						if (overlayBlock && overlayBlock.parentNode) {
							// 从屏幕外由近及远进入：
							// 左侧从左侧屏幕外（translateX(-100vw)）进入，右侧从右侧屏幕外（translateX(100vw)）进入
							// 同时从较大（scale(1.2)）缩小到正常大小（scale(1)），模拟由近及远的效果
							overlayBlock.style.transform = 'translateX(0) translateY(0) scale(1)';
						}
					} catch (animationError) {
						console.warn(`[Leader Overlay Image] Failed to trigger animation for leader ${leaderID || 'unknown'}:`, animationError);
					}
				}, 10);
			}
		} else {
			// 更新现有覆盖层的位置和大小
			try {
				// 更新位置和尺寸（使用viewport单位，不需要容器）
				updateOverlayPositionAndSize(overlayBlock, {
					position,
					widthMultiplier: safeWidthMultiplier,
					leftOffsetMultiplier: safeLeftOffsetMultiplier,
					topOffsetMultiplier: safeTopOffsetMultiplier,
					isDiplomacy
				});

				// 对于setup-panels（age-select, civ-select, game-setup），不更新背景图片
				// 只更新位置和大小，保持原有图片
				// 只有在leader-select界面或图片URL确实改变时才更新背景图片
				const isSetupPanel = panelType === "age-select" || panelType === "civ-select" || panelType === "game-setup" || panelType === "setup-panels";

				if (!isSetupPanel) {
					// 检查并更新背景图片（如果需要）
					const currentBackgroundImage = overlayBlock.style.backgroundImage;
					const newBackgroundImage = `url("${finalImageUrl}")`;
					if (currentBackgroundImage !== newBackgroundImage) {
						overlayBlock.style.backgroundImage = newBackgroundImage;
					}
				}
			} catch (updateError) {
				console.warn(`[Leader Overlay Image] Failed to update overlay for leader ${leaderID || 'unknown'}:`, updateError);
			}
		}

		return overlayBlock;
	} catch (error) {
		// 捕获所有错误，确保单个领袖失败不影响其他部分
		console.error(`[Leader Overlay Image] Error creating/updating overlay for leader ${options.leaderID || 'unknown'}:`, error);
		return null; // 返回null表示失败，但不抛出异常
	}
}

// 更新覆盖层的位置和大小（使用viewport单位）
function updateOverlayPositionAndSize(overlayBlock, options = {}) {
	if (!overlayBlock) {
		return;
	}

	const {
		position = "center",
		widthMultiplier = 3.5,
		leftOffsetMultiplier = -0.5,
		topOffsetMultiplier = 0,
		isDiplomacy = false
	} = options;

	// 参数验证和清理：确保所有数值参数都是有效数字
	const safeWidthMultiplier = (typeof widthMultiplier === "number" && !isNaN(widthMultiplier) && isFinite(widthMultiplier)) ? widthMultiplier : 3.5;
	const safeLeftOffsetMultiplier = (typeof leftOffsetMultiplier === "number" && !isNaN(leftOffsetMultiplier) && isFinite(leftOffsetMultiplier)) ? leftOffsetMultiplier : -0.5;
	const safeTopOffsetMultiplier = (typeof topOffsetMultiplier === "number" && !isNaN(topOffsetMultiplier) && isFinite(topOffsetMultiplier)) ? topOffsetMultiplier : 0;

	// 使用viewport单位更新位置和尺寸
	let leftValue;
	let widthValue;
	let bgPosition = "center center";

	if (isDiplomacy) {
		// 外交界面：fixed + vw 半屏
		const leftOffsetVw = safeLeftOffsetMultiplier * 50; // 50vw是半屏宽度
		const formattedOffsetVw = parseFloat(leftOffsetVw.toFixed(3));
		if (position === "left") {
			leftValue = `calc(0vw - ${Math.abs(formattedOffsetVw)}vw)`;
			widthValue = "50vw";
			bgPosition = "right center";
		} else if (position === "right") {
			leftValue = `calc(50vw + ${formattedOffsetVw}vw)`;
			widthValue = "50vw";
			bgPosition = "left center";
		} else {
			leftValue = "0vw";
			widthValue = "100vw";
			bgPosition = "center center";
		}
	} else {
		// Shell界面：fixed + vw 全屏
		// 正数 = 向左偏移，负数 = 向右偏移
		const leftOffsetVw = safeLeftOffsetMultiplier * 100; // 基于全屏宽度
		const formattedOffsetVw = parseFloat(leftOffsetVw.toFixed(3));

		if (position === "left") {
			// 左侧：正数向左偏移，负数向右偏移
			leftValue = `calc(0vw - ${formattedOffsetVw}vw)`;
			widthValue = `${safeWidthMultiplier * 100}vw`;
			bgPosition = "right center";
		} else if (position === "right") {
			// 右侧：正数向左偏移，负数向右偏移
			leftValue = `calc(50vw + ${formattedOffsetVw}vw)`;
			widthValue = `${safeWidthMultiplier * 100}vw`;
			bgPosition = "left center";
		} else {
			// 居中：从屏幕中心计算
			// 正数向左偏移（减去正数），负数向右偏移（减去负数 = 加上正数）
			const centerOffsetVw = safeWidthMultiplier * 50; // 宽度的一半
			leftValue = `calc(50vw - ${centerOffsetVw}vw - ${formattedOffsetVw}vw)`;
			widthValue = `${safeWidthMultiplier * 100}vw`;
			bgPosition = "center center";
		}
	}

	overlayBlock.style.left = leftValue;
	overlayBlock.style.width = widthValue;
	overlayBlock.style.height = "100vh";
	overlayBlock.style.backgroundPosition = bgPosition;
	// Shell界面使用contain实现缩放而不是裁剪，外交界面使用cover
	overlayBlock.style.backgroundSize = isDiplomacy ? "cover" : "contain";

	// 更新top值（使用vh单位）
	if (safeTopOffsetMultiplier !== 0) {
		overlayBlock.style.top = `${100 * safeTopOffsetMultiplier}vh`;
	} else {
		overlayBlock.style.top = "0";
	}
}

// 尝试创建图片覆盖层
function tryCreateImageOverlay(context, delay = 300, leaderID = null, panelType = null) {
	try {
		const tryCreateBlock = (attempt = 0) => {
			try {
				// 容器仅用于检测面板类型，不再用于定位
				const container = getContainer(context);

				if (container || attempt >= 5) {
					// 即使找不到容器也尝试创建（fixed定位不依赖容器）
					// 容器主要用于检测面板类型
					createImageOverlayWithConfig(container, leaderID, panelType);
				} else if (attempt < 5) {
					// 如果找不到容器，再等待一下（减少重试次数，因为不再依赖容器）
					setTimeout(() => tryCreateBlock(attempt + 1), 200);
				} else {
					console.warn(`[Leader Overlay Image] Container not found after ${attempt} attempts for leader ${leaderID || 'unknown'}, creating overlay anyway`);
					createImageOverlayWithConfig(null, leaderID, panelType);
				}
			} catch (error) {
				console.error(`[Leader Overlay Image] Error in tryCreateBlock attempt ${attempt} for leader ${leaderID || 'unknown'}:`, error);
				// 如果还有重试机会，继续重试
				if (attempt < 5) {
					setTimeout(() => tryCreateBlock(attempt + 1), 200);
				}
			}
		};

		// 开始尝试创建图片覆盖层
		setTimeout(() => tryCreateBlock(0), delay);
	} catch (error) {
		console.error(`[Leader Overlay Image] Error in tryCreateImageOverlay for leader ${leaderID || 'unknown'}:`, error);
		// 不抛出异常，让其他领袖可以正常显示
	}
}

// 使用配置创建图片覆盖层
function createImageOverlayWithConfig(container, leaderID, panelType = null) {
	try {
		if (!container) {
			console.warn(`[Leader Overlay Image] Container is null for leader ${leaderID || 'unknown'}`);
			return;
		}

		let options = {};

		// 检测面板类型（如果未提供）
		if (!panelType && window.CustomLeaderConfig) {
			try {
				panelType = window.CustomLeaderConfig.detectCurrentPanel();
			} catch (detectError) {
				console.warn(`[Leader Overlay Image] Failed to detect panel type:`, detectError);
			}
		}

		// 如果提供了leaderID，尝试从配置系统获取显示配置
		if (leaderID && window.CustomLeaderConfig) {
			try {
				const displayConfig = window.CustomLeaderConfig.getImageDisplayConfig(leaderID, panelType);
				if (displayConfig) {
					options.widthMultiplier = displayConfig.widthMultiplier;
					options.leftOffsetMultiplier = displayConfig.leftOffsetMultiplier;
					options.topOffsetMultiplier = displayConfig.topOffsetMultiplier;
					options.position = displayConfig.position;
				}
			} catch (configError) {
				console.warn(`[Leader Overlay Image] Failed to get display config for leader ${leaderID}:`, configError);
			}
			options.leaderID = leaderID;
		}

		// 传递panelType，用于判断是否需要更新背景图片
		if (panelType) {
			options.panelType = panelType;
		}

		const result = createOrUpdateImageOverlay(container, options);
		if (!result) {
			console.warn(`[Leader Overlay Image] Failed to create overlay for leader ${leaderID || 'unknown'}`);
		}
	} catch (error) {
		console.error(`[Leader Overlay Image] Error creating overlay with config for leader ${leaderID || 'unknown'}:`, error);
		// 不抛出异常，让其他领袖可以正常显示
	}
}

// 调整现有覆盖层以适应新面板
function adjustOverlayForPanel(leaderID, panelType = null) {
	if (!leaderID || !window.CustomLeaderConfig || !window.CustomLeaderConfig.isImageLeader(leaderID)) {
		return;
	}

	// 检测面板类型（如果未提供）
	if (!panelType) {
		panelType = window.CustomLeaderConfig.detectCurrentPanel();
	}

	// 获取新面板的配置
	const displayConfig = window.CustomLeaderConfig.getImageDisplayConfig(leaderID, panelType);
	if (!displayConfig) {
		return;
	}

	// 查找所有可能的容器（去重）
	const containerSet = new Set();
	const containersToCheck = [
		document.querySelector(".game-creator-leader-info-content"),
		document.querySelector(".game-creator-leader-info"),
		document.querySelector("leader-select-panel")?.querySelector(".game-creator-leader-info-content"),
		document.querySelector("age-select-panel")?.querySelector(".game-creator-leader-info"),
		document.querySelector("civ-select-panel")?.querySelector(".game-creator-leader-info"),
		document.querySelector("game-setup-panel")?.querySelector(".game-creator-leader-info-content"),
		document.querySelector("game-setup-panel")?.querySelector(".game-creator-leader-info"),
		document.querySelector(".game-creator-leader-info-name")?.closest(".game-creator-leader-info"),
		document.querySelector(".game-creator-leader-info-name")?.closest(".game-creator-leader-info-content")
	];

	// 去重容器
	for (const container of containersToCheck) {
		if (container) {
			containerSet.add(container);
		}
	}

	const containers = Array.from(containerSet);

	// 查找并更新覆盖层（覆盖层现在在body中，使用fixed定位）
	// 对于setup-panels（age-select, civ-select, game-setup），只更新位置和大小，不重新加载图片
	let foundOverlay = false;

	// 使用更安全的方式查找覆盖层：查找所有可能的类名变体
	const possibleClassNames = [
		"leader-overlay-image-block",
		"leader-overlay-image-block-center",
		"leader-overlay-image-block-left",
		"leader-overlay-image-block-right"
	];

	for (const className of possibleClassNames) {
		if (foundOverlay) break;

		try {
			const overlayBlocks = document.body.querySelectorAll(`.${className}`);
			for (const overlayBlock of overlayBlocks) {
				// 检查是否为shell界面的覆盖层（不是外交界面）
				if (overlayBlock.className.includes("diplomacy")) {
					continue;
				}

				// 只更新位置和大小，不重新加载图片（不更新backgroundImage）
				updateOverlayPositionAndSize(overlayBlock, {
					position: displayConfig.position,
					widthMultiplier: displayConfig.widthMultiplier,
					leftOffsetMultiplier: displayConfig.leftOffsetMultiplier,
					topOffsetMultiplier: displayConfig.topOffsetMultiplier,
					isDiplomacy: false
				});
				foundOverlay = true;
				break; // 找到第一个后立即退出
			}
		} catch (error) {
			// Error querying selector
		}
	}

	// 对于setup-panels（age-select, civ-select, game-setup），如果找不到现有覆盖层，也不创建新的
	// 因为这些界面应该从leader-select界面继承覆盖层，只需要调整大小
	// 只有在leader-select界面才创建新的覆盖层
	const isSetupPanel = panelType === "age-select" || panelType === "civ-select" || panelType === "game-setup" || panelType === "setup-panels";

	if (!foundOverlay && !isSetupPanel) {
		// 只有在非setup-panels界面且找不到现有覆盖层时，才尝试创建新的
		// 尝试找到当前活动的面板上下文（分别查找，避免复杂选择器）
		let activePanel = null;
		const leaderPanel = document.querySelector("leader-select-panel");
		const agePanel = document.querySelector("age-select-panel");
		const civPanel = document.querySelector("civ-select-panel");
		const gameSetupPanel = document.querySelector("game-setup-panel");

		// 检查哪个面板是可见的
		if (leaderPanel && leaderPanel.offsetParent !== null && !leaderPanel.hasAttribute("hidden")) {
			activePanel = leaderPanel;
		} else if (agePanel && agePanel.offsetParent !== null && !agePanel.hasAttribute("hidden")) {
			activePanel = agePanel;
		} else if (civPanel && civPanel.offsetParent !== null && !civPanel.hasAttribute("hidden")) {
			activePanel = civPanel;
		} else if (gameSetupPanel && gameSetupPanel.offsetParent !== null && !gameSetupPanel.hasAttribute("hidden")) {
			activePanel = gameSetupPanel;
		}

		if (activePanel) {
			// 延迟一点，确保容器已准备好
			setTimeout(() => {
				const container = getContainer(activePanel);
				if (container) {
					createImageOverlayWithConfig(container, leaderID, panelType);
				}
			}, 200);
		}
	}
}

// 尝试移除图片覆盖层
function tryRemoveImageOverlay(context, delay = 0, position = "center") {
	try {
		const tryRemoveBlock = () => {
			try {
				// 覆盖层现在在body中（fixed定位）
				const overlayClassName = `leader-overlay-image-block${position !== "center" ? `-${position}` : ""}`;
				const overlayBlock = document.body.querySelector(`.${overlayClassName}`);
				if (overlayBlock) {
					// 检查是否为shell界面的覆盖层（不是外交界面）
					if (!overlayBlock.className.includes("diplomacy")) {
						try {
							overlayBlock.remove();
						} catch (removeError) {
							console.warn(`[Leader Overlay Image] Failed to remove overlay block:`, removeError);
						}
					}
				}
			} catch (error) {
				console.warn(`[Leader Overlay Image] Error in tryRemoveBlock:`, error);
			}
		};

		// 延迟一点（如果delay为0则立即执行）
		if (delay > 0) {
			setTimeout(() => tryRemoveBlock(), delay);
		} else {
			tryRemoveBlock();
		}
	} catch (error) {
		console.error(`[Leader Overlay Image] Error in tryRemoveImageOverlay:`, error);
		// 不抛出异常，让其他操作可以正常执行
	}
}

/**
 * 尝试创建外交界面的图片覆盖层
 * @param {string} leaderID - 领袖ID
 * @param {string} position - 位置 ("left", "right", "center")
 * @param {number} delay - 延迟时间（毫秒），通常为0（立即执行）
 * @param {string} state - 可选的状态参数（预留接口，用于将来的状态映射）
 */
function tryCreateDiplomacyImageOverlay(leaderID, position = "center", delay = 300, state = null) {
	try {
		// 参数验证
		if (!leaderID) {
			console.error(`[Leader Overlay Image] tryCreateDiplomacyImageOverlay: leaderID is null or undefined`);
			return;
		}

		// 检查配置系统是否可用
		if (!window.CustomLeaderConfig) {
			console.error(`[Leader Overlay Image] CustomLeaderConfig not available when creating overlay for leader ${leaderID}`);
			return;
		}

		// 检查是否为图片领袖
		if (!window.CustomLeaderConfig.isImageLeader(leaderID)) {
			// 不是图片领袖，正常返回（不记录错误）
			return;
		}

		// 立即执行，无延迟（忽略delay参数）
		const container = getDiplomacyContainer();

		if (!container) {
			console.error(`[Leader Overlay Image] Diplomacy container not found for leader ${leaderID}. Cannot create overlay.`);
			return;
		}

		// 从配置系统获取显示配置
		const panelType = position === "left" ? "diplomacy-left" : "diplomacy-right";
		let displayConfig = null;
		try {
			if (typeof window.CustomLeaderConfig.getImageDisplayConfig !== "function") {
				console.error(`[Leader Overlay Image] CustomLeaderConfig.getImageDisplayConfig is not a function for leader ${leaderID}`);
			} else {
				displayConfig = window.CustomLeaderConfig.getImageDisplayConfig(leaderID, panelType);
			}
		} catch (configError) {
			console.error(`[Leader Overlay Image] Failed to get display config for leader ${leaderID}:`, configError);
			// 使用默认配置继续执行
		}

		// 默认参数：外交依赖CSS，不用倍数
		let widthMultiplier = 1.0;
		let leftOffsetMultiplier = 0;
		let topOffsetMultiplier = 0;

		if (displayConfig) {
			// 确保参数是数字类型，使用 !== undefined 检查以避免0值被替换
			widthMultiplier = (typeof displayConfig.widthMultiplier === "number" && displayConfig.widthMultiplier !== undefined) ? displayConfig.widthMultiplier : 1.0;
			leftOffsetMultiplier = (typeof displayConfig.leftOffsetMultiplier === "number" && displayConfig.leftOffsetMultiplier !== undefined) ? displayConfig.leftOffsetMultiplier : 0;
			topOffsetMultiplier = (typeof displayConfig.topOffsetMultiplier === "number" && displayConfig.topOffsetMultiplier !== undefined) ? displayConfig.topOffsetMultiplier : 0;
		}

		// 获取图片路径（预留状态参数接口，当前不实现状态映射）
		// 将来可以扩展为：window.CustomLeaderConfig.getImagePath(leaderID, state)
		let imagePath = null;
		try {
			if (typeof window.CustomLeaderConfig.getImagePath !== "function") {
				console.error(`[Leader Overlay Image] CustomLeaderConfig.getImagePath is not a function for leader ${leaderID}`);
				return;
			}
			imagePath = window.CustomLeaderConfig.getImagePath(leaderID, state);
		} catch (pathError) {
			console.error(`[Leader Overlay Image] Failed to get image path for leader ${leaderID}:`, pathError);
			return; // 如果没有图片路径，无法创建覆盖层
		}

		if (!imagePath) {
			console.error(`[Leader Overlay Image] No image path found for leader ${leaderID}. Cannot create overlay.`);
			return;
		}

		// 先移除旧覆盖层（精确位置）
		try {
			tryRemoveDiplomacyImageOverlay(leaderID, position, 0);
		} catch (removeError) {
			console.error(`[Leader Overlay Image] Failed to remove old overlay for leader ${leaderID}:`, removeError);
			// 继续执行，尝试创建新覆盖层
		}

		// 立即创建（状态参数已预留，但当前不使用）
		let overlayResult = null;
		try {
			overlayResult = createOrUpdateImageOverlay(container, {
				position: position,
				widthMultiplier: widthMultiplier,
				leftOffsetMultiplier: leftOffsetMultiplier,
				topOffsetMultiplier: topOffsetMultiplier,
				className: "leader-overlay-image-block-diplomacy",
				zIndex: -1,
				leaderID: leaderID,
				imageUrl: imagePath
			});
		} catch (createError) {
			console.error(`[Leader Overlay Image] Exception while creating overlay for leader ${leaderID} at position ${position}:`, createError);
			return;
		}

		if (!overlayResult) {
			console.error(`[Leader Overlay Image] Failed to create overlay for leader ${leaderID} at position ${position}. createOrUpdateImageOverlay returned null.`);
		} else {
			// 验证覆盖层是否成功添加到DOM
			if (!overlayResult.parentNode) {
				console.error(`[Leader Overlay Image] Overlay created for leader ${leaderID} but not attached to DOM`);
			}
		}
	} catch (error) {
		// 捕获所有错误，确保单个领袖失败不影响其他部分
		console.error(`[Leader Overlay Image] Fatal error creating diplomacy overlay for leader ${leaderID || 'unknown'}:`, error);
		console.error(`[Leader Overlay Image] Error stack:`, error.stack);
		// 不抛出异常，让其他领袖可以正常显示
	}
}

/**
 * 尝试更新外交界面的图片覆盖层（用于状态变化）
 * @param {string} leaderID - 领袖ID
 * @param {string} position - 位置 ("left", "right", "center")
 * @param {string} newState - 新状态 ("neutral", "friendly", "hostile", "response_positive", "response_negative")
 */
function tryUpdateDiplomacyImageOverlay(leaderID, position = "center", newState = null) {
	try {
		if (!leaderID || !newState) {
			console.warn(`[Leader Overlay Image] Invalid parameters for update: leaderID=${leaderID}, newState=${newState}`);
			return;
		}

		// 检查是否为图片领袖
		if (!window.CustomLeaderConfig || !window.CustomLeaderConfig.isImageLeader(leaderID)) {
			return;
		}

		// 获取新状态的图片路径
		let newImagePath = null;
		if (window.CustomLeaderConfig && window.CustomLeaderConfig.getImagePath) {
			newImagePath = window.CustomLeaderConfig.getImagePath(leaderID, newState);
		}

		if (!newImagePath) {
			console.warn(`[Leader Overlay Image] No image path found for leader ${leaderID} with state ${newState}`);
			return;
		}

		// 查找现有的覆盖层
		const container = getDiplomacyContainer();
		if (!container) {
			console.warn(`[Leader Overlay Image] Diplomacy container not found for update`);
			return;
		}

		// 根据位置确定类名
		const overlayClassName = position !== "center"
			? `leader-overlay-image-block-diplomacy-${position}`
			: "leader-overlay-image-block-diplomacy";

		// 查找覆盖层元素
		const overlayBlock = container.querySelector(`.${overlayClassName}`);
		if (overlayBlock) {
			// 更新背景图片
			overlayBlock.style.backgroundImage = `url("${newImagePath}")`;
			console.log(`[Leader Overlay Image] Updated overlay for leader ${leaderID} at position ${position} to state ${newState}`);
		} else {
			// 如果找不到现有覆盖层，尝试创建新的
			console.warn(`[Leader Overlay Image] Overlay block not found for update, creating new one`);
			const panelType = position === "left" ? "diplomacy-left" : "diplomacy-right";
			tryCreateDiplomacyImageOverlay(leaderID, position, 0, newState);
		}
	} catch (error) {
		console.error(`[Leader Overlay Image] Error updating diplomacy overlay for leader ${leaderID || 'unknown'}:`, error);
	}
}

// 尝试移除外交界面的图片覆盖层
function tryRemoveDiplomacyImageOverlay(leaderID = null, position = "center", delay = 100) {
	// 立即执行，无延迟
	const tryRemoveBlock = () => {
		// 全局搜索所有diplomacy覆盖层，确保移除
		const possibleClassNames = [
			"leader-overlay-image-block-diplomacy",
			"leader-overlay-image-block-diplomacy-left",
			"leader-overlay-image-block-diplomacy-right"
		];

		let overlayBlocksToRemove = [];
		let targetClass = "";

		// 收集需要移除的覆盖层
		if (position !== "center" && leaderID) {
			targetClass = `leader-overlay-image-block-diplomacy-${position}`;
			const overlayBlocks = document.querySelectorAll(`.${targetClass}`);
			overlayBlocks.forEach(overlayBlock => {
				overlayBlocksToRemove.push(overlayBlock);
			});
		} else {
			// 移除所有
			for (const className of possibleClassNames) {
				const overlayBlocks = document.querySelectorAll(`.${className}`);
				overlayBlocks.forEach(overlayBlock => {
					overlayBlocksToRemove.push(overlayBlock);
				});
			}
		}

		// 对每个覆盖层执行退出动画（与进入动画反向）
		overlayBlocksToRemove.forEach(overlayBlock => {
			// 确定位置（左侧或右侧）
			let exitPosition = "center";
			if (overlayBlock.classList.contains("leader-overlay-image-block-diplomacy-left")) {
				exitPosition = "left";
			} else if (overlayBlock.classList.contains("leader-overlay-image-block-diplomacy-right")) {
				exitPosition = "right";
			}

			// 设置退出动画的transition（与进入动画时长一致：0.3s）
			overlayBlock.style.transition = 'transform 0.3s ease-out';

			// 立即触发退出动画：从正常位置和大小移动到屏幕外并放大
			// 左侧：移动到左侧屏幕外（translateX(-800vw)）并放大（scale(1.8)）
			// 右侧：移动到右侧屏幕外（translateX(800vw)）并放大（scale(1.8)）
			// 直接设置 transform，确保与旗帜同步退出
			if (exitPosition === "left") {
				overlayBlock.style.transform = 'translateX(-800vw) scale(1.8)';
			} else if (exitPosition === "right") {
				overlayBlock.style.transform = 'translateX(800vw) scale(1.8)';
			} else {
				// 中心位置：使用垂直退出
				overlayBlock.style.transform = 'translateY(100px) scale(1.8)';
			}

			// 等待动画完成后移除元素（0.3s动画时间）
			setTimeout(() => {
				if (overlayBlock._resizeTimeout) {
					clearTimeout(overlayBlock._resizeTimeout);
					overlayBlock._resizeTimeout = null;
				}
				if (overlayBlock._resizeObserver) {
					overlayBlock._resizeObserver.disconnect();
				}
				if (overlayBlock.parentNode) {
					overlayBlock.remove();
				}
			}, 300);  // 0.3秒后移除（与进入动画时长一致）
		});
	};

	tryRemoveBlock();  // 立即调用
}

// 尝试创建主菜单的图片覆盖层
function tryCreateMainMenuImageOverlay(leaderID, delay = 300) {
	const shouldShowOverlay = leaderID === "LEADER_CONFUCIUS";
	if (!shouldShowOverlay) {
		return;
	}

	const tryCreateBlock = (attempt = 0) => {
		const container = getMainMenuContainer();

		if (container) {
			createOrUpdateImageOverlay(container, {
				position: "center",
				widthMultiplier: 3.5,
				leftOffsetMultiplier: -0.5,
				className: "leader-overlay-image-block-mainmenu",
				zIndex: -1
			});
		} else if (attempt < 10) {
			setTimeout(() => tryCreateBlock(attempt + 1), 200);
		}
	};

	setTimeout(() => tryCreateBlock(0), delay);
}

// 尝试移除主菜单的图片覆盖层
function tryRemoveMainMenuImageOverlay(delay = 100) {
	const tryRemoveBlock = (attempt = 0) => {
		const container = getMainMenuContainer();

		if (container) {
			const overlayBlock = container.querySelector(".leader-overlay-image-block-mainmenu");
			if (overlayBlock) {
				if (overlayBlock._resizeTimeout) {
					clearTimeout(overlayBlock._resizeTimeout);
					overlayBlock._resizeTimeout = null;
				}
				if (overlayBlock._resizeObserver) {
					overlayBlock._resizeObserver.disconnect();
				}
				overlayBlock.remove();
			}
		} else if (attempt < 5) {
			setTimeout(() => tryRemoveBlock(attempt + 1), 100);
		}
	};

	setTimeout(() => tryRemoveBlock(0), delay);
}

// 验证导出的函数是否完整
function validateExports() {
	const requiredFunctions = [
		'tryCreateImageOverlay',
		'tryRemoveImageOverlay',
		'tryCreateDiplomacyImageOverlay',
		'tryUpdateDiplomacyImageOverlay',
		'tryRemoveDiplomacyImageOverlay',
		'tryCreateMainMenuImageOverlay',
		'tryRemoveMainMenuImageOverlay',
		'adjustOverlayForPanel',
		'updateOverlayPositionAndSize',
		'getContainer',
		'getDiplomacyContainer',
		'getMainMenuContainer'
	];

	const exports = {
		tryCreateImageOverlay,
		tryRemoveImageOverlay,
		tryCreateDiplomacyImageOverlay,
		tryUpdateDiplomacyImageOverlay,
		tryRemoveDiplomacyImageOverlay,
		tryCreateMainMenuImageOverlay,
		tryRemoveMainMenuImageOverlay,
		adjustOverlayForPanel,
		updateOverlayPositionAndSize,
		getContainer,
		getDiplomacyContainer,
		getMainMenuContainer
	};

	// 验证所有必需函数是否存在且为函数类型
	const missingFunctions = [];
	const invalidFunctions = [];

	for (const funcName of requiredFunctions) {
		if (!(funcName in exports)) {
			missingFunctions.push(funcName);
		} else if (typeof exports[funcName] !== 'function') {
			invalidFunctions.push(funcName);
		}
	}

	if (missingFunctions.length > 0 || invalidFunctions.length > 0) {
		console.error(`[Leader Overlay Image] Export validation failed:`);
		if (missingFunctions.length > 0) {
			console.error(`[Leader Overlay Image] Missing functions: ${missingFunctions.join(', ')}`);
		}
		if (invalidFunctions.length > 0) {
			console.error(`[Leader Overlay Image] Invalid functions (not callable): ${invalidFunctions.join(', ')}`);
		}
		return false;
	}

	return true;
}

// 导出函数供主脚本使用
window.LeaderOverlayImage = {
	tryCreateImageOverlay,
	tryRemoveImageOverlay,
	tryCreateDiplomacyImageOverlay,
	tryUpdateDiplomacyImageOverlay,
	tryRemoveDiplomacyImageOverlay,
	tryCreateMainMenuImageOverlay,
	tryRemoveMainMenuImageOverlay,
	adjustOverlayForPanel,
	updateOverlayPositionAndSize,
	getContainer,
	getDiplomacyContainer,
	getMainMenuContainer
};

// 验证导出是否成功
if (validateExports()) {
	console.error("[Leader Overlay Image] Module loaded successfully, all exports validated");
} else {
	console.error("[Leader Overlay Image] Module loaded but export validation failed!");
}

// 添加全局标记，表示模块已加载
window.LeaderOverlayImage._isLoaded = true;
window.LeaderOverlayImage._loadTimestamp = Date.now();

