window.CustomLeaderConfig.registerImageLeader("LEADER_YUNI","fs://game/yuni/texture/fbl_yuni.png");

if (typeof engine !== "undefined" && engine.whenReady) {
	engine.whenReady.then(() => {
		window.CustomLeaderConfig.registerImageLeader("LEADER_YUNI", "fs://game/yuni/textures/fbl_yuni.png");
	});
}

