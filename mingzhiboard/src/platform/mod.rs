use std::sync::mpsc::{self, Receiver, Sender};

#[derive(Debug, Clone)]
pub struct PlatformStatus {
    pub listener: String,
    pub hotkeys: String,
}

#[derive(Debug, Clone, Copy)]
pub enum PlatformEvent {
    PasteRequested,
}

pub struct PlatformHooks {
    pub status: PlatformStatus,
    event_rx: Receiver<PlatformEvent>,
}

impl PlatformHooks {
    pub fn new() -> Self {
        let (event_tx, event_rx) = mpsc::channel();
        let status = init(event_tx);
        Self { status, event_rx }
    }

    pub fn next_event(&self) -> Option<PlatformEvent> {
        self.event_rx.try_recv().ok()
    }
}

#[cfg(target_os = "windows")]
mod windows;
#[cfg(target_os = "macos")]
mod macos;

pub fn init(event_tx: Sender<PlatformEvent>) -> PlatformStatus {
    #[cfg(target_os = "windows")]
    {
        return windows::init(event_tx);
    }
    #[cfg(target_os = "macos")]
    {
        return macos::init(event_tx);
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        PlatformStatus {
            listener: "unsupported platform".to_string(),
            hotkeys: "unsupported platform".to_string(),
        }
    }
}

pub fn simulate_paste() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        return windows::simulate_paste();
    }
    #[cfg(target_os = "macos")]
    {
        return macos::simulate_paste();
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        Err("paste injection not supported on this platform".to_string())
    }
}
