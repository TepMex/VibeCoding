import { STORAGE_KEYS, getSettings, setEnabled } from "./utils";

const setBadge = async (enabled: boolean) => {
	await chrome.action.setBadgeBackgroundColor({ color: enabled ? "#2f855a" : "#9ca3af" });
	await chrome.action.setBadgeText({ text: enabled ? "ON" : "OFF" });
	await chrome.action.setTitle({ title: enabled ? "Hanzifier is ON" : "Hanzifier is OFF" });
};

const ensureDefaults = async () => {
	const result = await chrome.storage.sync.get({
		[STORAGE_KEYS.enabled]: true,
		[STORAGE_KEYS.enabledLists]: [1],
	});

	await chrome.storage.sync.set(result);
	await setBadge(Boolean(result[STORAGE_KEYS.enabled]));
};

chrome.runtime.onInstalled.addListener(async () => {
	await ensureDefaults();
});

chrome.action.onClicked.addListener(async () => {
	const { enabled } = await getSettings();
	const nextEnabled = !enabled;

	await setEnabled(nextEnabled);
	await setBadge(nextEnabled);

	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	if (tab?.id) {
		chrome.tabs.sendMessage(tab.id, {
			type: "hanzifier:toggle",
			enabled: nextEnabled,
		});
	}
});
