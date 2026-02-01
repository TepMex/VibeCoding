import { Button, FormControlLabel, Stack, Switch, Typography } from "@mui/material";
import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";
import { STORAGE_KEYS, getSettings, setEnabled } from "../utils";

export function App() {
	const [enabled, setEnabledState] = useState<boolean>(true);

	useEffect(() => {
		getSettings().then((settings) => setEnabledState(settings.enabled));
		const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
			changes,
			area,
		) => {
			if (area !== "sync") return;
			if (changes[STORAGE_KEYS.enabled]) {
				setEnabledState(Boolean(changes[STORAGE_KEYS.enabled].newValue));
			}
		};
		chrome.storage.onChanged.addListener(listener);
		return () => chrome.storage.onChanged.removeListener(listener);
	}, []);

	const handleToggle = async (_: ChangeEvent<HTMLInputElement>, value: boolean) => {
		setEnabledState(value);
		await setEnabled(value);
	};

	const openSettings = () => {
		chrome.runtime.openOptionsPage();
	};

	return (
		<Stack spacing={2} padding={3} width={320}>
			<Typography variant="h6">Hanzifier</Typography>
			<FormControlLabel
				control={<Switch checked={enabled} onChange={handleToggle} />}
				label={enabled ? "Enabled" : "Disabled"}
			/>
			<Button variant="outlined" onClick={openSettings}>
				Open Settings
			</Button>
		</Stack>
	);
}
