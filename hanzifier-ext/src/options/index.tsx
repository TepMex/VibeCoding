import {
	Box,
	Button,
	Checkbox,
	Divider,
	FormControlLabel,
	Stack,
	Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { getSettings, setEnabledLists } from "../utils";

const LIST_COUNT = 30;

const listMeta = Array.from({ length: LIST_COUNT }, (_, index) => {
	const listNumber = index + 1;
	const start = index * 100 + 1;
	const end = listNumber * 100;
	return {
		listNumber,
		label: `List ${listNumber} (${start}-${end})`,
	};
});

const OptionsApp = () => {
	const [enabledLists, setEnabledListsState] = useState<number[]>([]);

	const normalizeLists = (lists: number[]) => {
		const cleaned = lists.filter(
			(item) => Number.isInteger(item) && item >= 1 && item <= LIST_COUNT,
		);
		return Array.from(new Set(cleaned)).sort((a, b) => a - b);
	};

	const applyEnabledLists = (next: number[]) => {
		const normalized = normalizeLists(next);
		setEnabledListsState(normalized);
		setEnabledLists(normalized);
	};

	useEffect(() => {
		getSettings().then((settings) => {
			applyEnabledLists(settings.enabledLists);
		});
	}, []);

	const enabledSet = useMemo(() => new Set(enabledLists), [enabledLists]);

	const handleToggle = (listNumber: number) => {
		const next = enabledSet.has(listNumber)
			? enabledLists.filter((item) => item !== listNumber)
			: [...enabledLists, listNumber];
		applyEnabledLists(next);
	};

	const handleSelectAll = () => {
		applyEnabledLists(listMeta.map((item) => item.listNumber));
	};

	const handleClearAll = () => {
		applyEnabledLists([]);
	};

	return (
		<Box padding={3}>
			<Stack spacing={2}>
				<Typography variant="h5">Hanzifier Settings</Typography>
				<Typography variant="body2" color="text.secondary">
					Choose frequency lists to enable. Changes apply immediately to open
					pages.
				</Typography>
				<Divider />
				<Stack direction="row" spacing={1}>
					<Button size="small" variant="outlined" onClick={handleSelectAll}>
						Select all
					</Button>
					<Button size="small" variant="outlined" onClick={handleClearAll}>
						Clear all
					</Button>
				</Stack>
				<Stack spacing={1}>
					{listMeta.map(({ listNumber, label }) => (
						<FormControlLabel
							key={listNumber}
							control={
								<Checkbox
									checked={enabledSet.has(listNumber)}
									onChange={() => handleToggle(listNumber)}
								/>
							}
							label={label}
						/>
					))}
				</Stack>
				<Typography variant="body2" color="text.secondary">
					Active lists: {enabledLists.length || 0} / {LIST_COUNT}
				</Typography>
			</Stack>
		</Box>
	);
};

const container = document.getElementById("root");

if (container) {
	const root = createRoot(container);
	root.render(<OptionsApp />);
}
