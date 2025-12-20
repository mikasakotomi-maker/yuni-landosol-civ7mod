/**
 * @file diplomacy-model-override.js
 * @description Diplomacy Model Override: Main entry point for the modular diplomacy model override system
 */

// 加载新的模块化系统（兼容 game/shell 路径差异）
(function() {
	// 如果主模块已加载则跳过
	if (window.DiplomacyConfig && window.DiplomacyCoreOverrides) {
		console.error('[Diplomacy Model Override] Modular system already loaded, skip.');
		return;
	}

	// 仅尝试与图片同根的路径（最可靠）
	const targetUrl = 'fs://game/leader-fallback/ui/diplomacy/diplomacy-main.js';

	function loadScript(url) {
		const script = document.createElement('script');
		script.src = url;
		script.onload = function() {
			console.error('[Diplomacy Model Override] New modular system loaded successfully from', url);
		};
		script.onerror = function(err) {
			console.error('[Diplomacy Model Override] Failed to load modular system from', url, err);
		};
		document.head.appendChild(script);
	}

	loadScript(targetUrl);
})();