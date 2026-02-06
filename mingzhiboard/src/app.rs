use std::time::{Duration, Instant};

use arboard::Clipboard;
use eframe::egui;

use crate::core::{ClipboardHistory, ClipboardMode};
use crate::platform::{PlatformEvent, PlatformHooks};

pub struct MingzhiBoardApp {
    mode: ClipboardMode,
    history: ClipboardHistory,
    clipboard: Option<Clipboard>,
    last_clipboard_text: Option<String>,
    last_written_text: Option<String>,
    suppress_next_record: bool,
    last_paste_preview: Option<String>,
    last_poll: Instant,
    poll_interval: Duration,
    clipboard_error: Option<String>,
    platform: PlatformHooks,
}

impl MingzhiBoardApp {
    pub fn new(_cc: &eframe::CreationContext<'_>) -> Self {
        let clipboard = Clipboard::new().ok();

        Self {
            mode: ClipboardMode::Stack,
            history: ClipboardHistory::new(200),
            clipboard,
            last_clipboard_text: None,
            last_written_text: None,
            suppress_next_record: false,
            last_paste_preview: None,
            last_poll: Instant::now(),
            poll_interval: Duration::from_millis(500),
            clipboard_error: None,
            platform: PlatformHooks::new(),
        }
    }

    fn poll_clipboard(&mut self) {
        if self.last_poll.elapsed() < self.poll_interval {
            return;
        }
        self.last_poll = Instant::now();

        let Some(clipboard) = self.clipboard.as_mut() else {
            self.clipboard_error = Some("Clipboard unavailable".to_string());
            return;
        };

        match clipboard.get_text() {
            Ok(text) => {
                if self.suppress_next_record {
                    if self.last_written_text.as_deref() == Some(text.as_str()) {
                        self.last_clipboard_text = Some(text);
                        self.clipboard_error = None;
                        self.suppress_next_record = false;
                        return;
                    }
                    self.suppress_next_record = false;
                }
                if self.last_clipboard_text.as_deref() != Some(text.as_str()) {
                    self.history.record_copy(&text, self.mode);
                    self.last_clipboard_text = Some(text);
                    self.clipboard_error = None;
                }
            }
            Err(err) => {
                self.clipboard_error = Some(format!("Clipboard read error: {err}"));
            }
        }
    }

    fn handle_platform_events(&mut self) {
        while let Some(event) = self.platform.next_event() {
            match event {
                PlatformEvent::PasteRequested => self.handle_paste_request(),
            }
        }
    }

    fn handle_paste_request(&mut self) {
        let Some(text) = self.history.next_paste(self.mode) else {
            self.last_paste_preview = None;
            return;
        };

        let Some(clipboard) = self.clipboard.as_mut() else {
            self.clipboard_error = Some("Clipboard unavailable".to_string());
            return;
        };

        if let Err(err) = clipboard.set_text(text.clone()) {
            self.clipboard_error = Some(format!("Clipboard write error: {err}"));
            return;
        }

        self.last_clipboard_text = Some(text.clone());
        self.last_written_text = Some(text.clone());
        self.suppress_next_record = true;
        self.last_paste_preview = Some(text);
        self.clipboard_error = None;

        if let Err(err) = crate::platform::simulate_paste() {
            self.clipboard_error = Some(format!("Paste inject error: {err}"));
        }
    }
}

impl eframe::App for MingzhiBoardApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        self.poll_clipboard();
        self.handle_platform_events();
        ctx.request_repaint_after(self.poll_interval);

        egui::CentralPanel::default().show(ctx, |ui| {
            ui.heading("MingzhiBoard");
            ui.add_space(4.0);
            ui.label("Native Rust clipboard helper (bootstrap)");

            ui.separator();
            ui.horizontal(|ui| {
                ui.label("Mode:");
                ui.radio_value(&mut self.mode, ClipboardMode::Stack, "Stack");
                ui.radio_value(&mut self.mode, ClipboardMode::Queue, "Queue");
                ui.radio_value(&mut self.mode, ClipboardMode::Increment, "Increment");
            });

            ui.separator();
            ui.label(format!(
                "Listener: {}",
                self.platform.status.listener
            ));
            ui.label(format!(
                "Hotkeys: {}",
                self.platform.status.hotkeys
            ));
            ui.label(format!(
                "Polling: {} ms",
                self.poll_interval.as_millis()
            ));

            ui.separator();
            ui.label(format!(
                "Last clipboard item: {}",
                self.last_clipboard_text
                    .as_deref()
                    .unwrap_or("<empty>")
            ));

            ui.label(format!(
                "Stack items: {}, Queue items: {}",
                self.history.stack_len(),
                self.history.queue_len()
            ));

            if let Some(text) = self.history.increment_text() {
                ui.label(format!("Increment base: {text}"));
            } else {
                ui.label("Increment base: <empty>");
            }

            if let Some(error) = &self.clipboard_error {
                ui.colored_label(egui::Color32::YELLOW, error);
            }

            ui.separator();
            if ui.button("Simulate paste").clicked() {
                self.handle_paste_request();
            }

            ui.label(format!(
                "Paste preview: {}",
                self.last_paste_preview
                    .as_deref()
                    .unwrap_or("<none>")
            ));
        });
    }
}
