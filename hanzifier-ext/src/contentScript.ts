import { STORAGE_KEYS, type HanzifierSettings, getSettings } from "./utils";

type HanziListItem = {
	hanzi: string;
	meanings: string[];
};

type MeaningEntry = {
	hanzi: string;
	suffix: string;
};

const LIST_PATH_PREFIX = "data/processed/lists";
const LIST_CACHE = new Map<number, HanziListItem[]>();
const ORIGINAL_TEXT = new WeakMap<Text, string>();
const SKIP_TAGS = new Set([
	"SCRIPT",
	"STYLE",
	"NOSCRIPT",
	"TEXTAREA",
	"INPUT",
	"CODE",
	"PRE",
]);

const wordRegex = /\p{L}+/gu;

const isSkippableNode = (node: Text) => {
	const parent = node.parentElement;
	if (!parent) return true;
	if (SKIP_TAGS.has(parent.tagName)) return true;
	if (parent.closest("[contenteditable=''],[contenteditable='true']")) return true;
	return false;
};

const resolveExtensionBaseUrl = () => {
	const base = chrome.runtime.getURL("");
	if (!base.includes("chrome-extension://invalid/")) {
		return base;
	}
	const runtimeId = chrome.runtime.id;
	if (runtimeId) {
		return `chrome-extension://${runtimeId}/`;
	}
	return base;
};

const listUrl = (listNumber: number) => {
	const padded = String(listNumber).padStart(3, "0");
	const base = resolveExtensionBaseUrl();
	return `${base}${LIST_PATH_PREFIX}/list_${padded}.json`;
};

const loadList = async (listNumber: number) => {
	if (LIST_CACHE.has(listNumber)) {
		return LIST_CACHE.get(listNumber) ?? [];
	}
	const url = listUrl(listNumber);
	try {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}
		const data = (await response.json()) as HanziListItem[];
		LIST_CACHE.set(listNumber, data);
		return data;
	} catch (error) {
		console.error("Hanzifier list fetch failed", { url, error });
		return [];
	}
};

const parseMeaning = (meaning: string) => {
	const hashIndex = meaning.indexOf("#");
	if (hashIndex === -1) {
		return { key: meaning.toLowerCase(), suffix: "" };
	}
	const base = meaning.slice(0, hashIndex);
	const suffix = meaning.slice(hashIndex + 1);
	return { key: `${base}${suffix}`.toLowerCase(), suffix };
};

const buildLookup = async (enabledLists: number[]) => {
	const lookup = new Map<string, MeaningEntry>();
	const lists = [...enabledLists].sort((a, b) => a - b);

	for (const listNumber of lists) {
		const items = await loadList(listNumber);
		for (const item of items) {
			for (const meaning of item.meanings) {
				const { key, suffix } = parseMeaning(meaning);
				if (!key || lookup.has(key)) continue;
				lookup.set(key, { hanzi: item.hanzi, suffix });
			}
		}
	}

	return lookup;
};

const replaceWord = (word: string, lookup: Map<string, MeaningEntry>) => {
	const entry = lookup.get(word.toLowerCase());
	if (!entry) return word;
	const suffixLength = entry.suffix.length;
	const suffix =
		suffixLength > 0 && word.length >= suffixLength
			? word.slice(-suffixLength)
			: "";
	return `${entry.hanzi}${suffix}`;
};

const replaceText = (text: string, lookup: Map<string, MeaningEntry>) => {
	let result = "";
	let lastIndex = 0;

	for (const match of text.matchAll(wordRegex)) {
		const matchText = match[0];
		const matchIndex = match.index ?? 0;
		result += text.slice(lastIndex, matchIndex);
		result += replaceWord(matchText, lookup);
		lastIndex = matchIndex + matchText.length;
	}

	result += text.slice(lastIndex);
	return result;
};

const applyToNode = (node: Text, lookup: Map<string, MeaningEntry>) => {
	if (isSkippableNode(node)) return;
	const current = node.nodeValue ?? "";
	const storedOriginal = ORIGINAL_TEXT.get(node);
	const expected = storedOriginal ? replaceText(storedOriginal, lookup) : null;

	if (storedOriginal && expected && current !== expected) {
		ORIGINAL_TEXT.set(node, current);
	}

	const base = ORIGINAL_TEXT.get(node) ?? current;
	const replaced = replaceText(base, lookup);
	if (replaced !== current) {
		ORIGINAL_TEXT.set(node, base);
		node.nodeValue = replaced;
	}
};

const restoreNode = (node: Text) => {
	const original = ORIGINAL_TEXT.get(node);
	if (!original || node.nodeValue === original) return;
	node.nodeValue = original;
};

const walkTextNodes = (root: Node, handler: (node: Text) => void) => {
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
		acceptNode: (node) => {
			const text = node.nodeValue ?? "";
			if (!text.trim()) return NodeFilter.FILTER_REJECT;
			return NodeFilter.FILTER_ACCEPT;
		},
	});

	let currentNode = walker.nextNode();
	while (currentNode) {
		handler(currentNode as Text);
		currentNode = walker.nextNode();
	}
};

let latestSettings: HanzifierSettings | null = null;
let isApplying = false;

const applySettings = async (settings: HanzifierSettings) => {
	latestSettings = settings;
	if (isApplying) return;
	isApplying = true;

	try {
		if (!settings.enabled) {
			walkTextNodes(document.body, restoreNode);
			return;
		}

		const lookup = await buildLookup(settings.enabledLists);
		walkTextNodes(document.body, (node) => applyToNode(node, lookup));
	} finally {
		isApplying = false;
	}
};

const handleMutations = (mutations: MutationRecord[]) => {
	if (!latestSettings?.enabled || isApplying) return;
	const settings = latestSettings;

	const nodes: Node[] = [];
	for (const mutation of mutations) {
		mutation.addedNodes.forEach((node) => nodes.push(node));
		if (mutation.type === "characterData" && mutation.target) {
			nodes.push(mutation.target);
		}
	}

	if (nodes.length === 0) return;

	buildLookup(settings.enabledLists).then((lookup) => {
		for (const node of nodes) {
			if (node.nodeType === Node.TEXT_NODE) {
				applyToNode(node as Text, lookup);
				continue;
			}
			if (node.nodeType === Node.ELEMENT_NODE) {
				walkTextNodes(node, (textNode) => applyToNode(textNode, lookup));
			}
		}
	});
};

const observer = new MutationObserver(handleMutations);
observer.observe(document.documentElement, {
	childList: true,
	subtree: true,
	characterData: true,
});

const init = async () => {
	const settings = await getSettings();
	await applySettings(settings);

	chrome.runtime.onMessage.addListener((message) => {
		if (message?.type === "hanzifier:toggle") {
			applySettings({
				enabled: Boolean(message.enabled),
				enabledLists: latestSettings?.enabledLists ?? settings.enabledLists,
			});
		}
	});

	chrome.storage.onChanged.addListener((changes, area) => {
		if (area !== "sync") return;
		const nextSettings = {
			enabled: changes[STORAGE_KEYS.enabled]?.newValue ?? latestSettings?.enabled ?? true,
			enabledLists:
				changes[STORAGE_KEYS.enabledLists]?.newValue ??
				latestSettings?.enabledLists ??
				[1],
		};
		applySettings(nextSettings);
	});
};

void init();
