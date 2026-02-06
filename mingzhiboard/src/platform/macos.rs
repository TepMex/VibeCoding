use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::Sender;
use std::sync::OnceLock;
use std::thread;

use core_foundation::runloop::CFRunLoop;
use core_graphics::event::{
    CallbackResult, CGEvent, CGEventFlags, CGEventTap, CGEventTapLocation, CGEventTapOptions,
    CGEventTapPlacement, CGEventType, EventField, KeyCode,
};
use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};

use super::{PlatformEvent, PlatformStatus};

static EVENT_SENDER: OnceLock<Sender<PlatformEvent>> = OnceLock::new();
static INJECTING_PASTE: AtomicBool = AtomicBool::new(false);

pub fn init(event_tx: Sender<PlatformEvent>) -> PlatformStatus {
    let _ = EVENT_SENDER.set(event_tx);

    thread::spawn(|| {
        let tap = CGEventTap::with_enabled(
            CGEventTapLocation::HID,
            CGEventTapPlacement::HeadInsertEventTap,
            CGEventTapOptions::Default,
            vec![CGEventType::KeyDown],
            |_proxy, _event_type, event| {
                if INJECTING_PASTE.load(Ordering::Acquire) {
                    return CallbackResult::Keep;
                }

                let keycode =
                    event.get_integer_value_field(EventField::KEYBOARD_EVENT_KEYCODE) as u64;
                if keycode == KeyCode::ANSI_V as u64 {
                    let flags = event.flags();
                    let has_cmd = flags.contains(CGEventFlags::CGEventFlagCommand);
                    if has_cmd {
                        if let Some(sender) = EVENT_SENDER.get() {
                            let _ = sender.send(PlatformEvent::PasteRequested);
                        }
                        return CallbackResult::Drop;
                    }
                }

                CallbackResult::Keep
            },
            || CFRunLoop::run_current(),
        );

        let _ = tap;
    });

    PlatformStatus {
        listener: "active (CGEventTap)".to_string(),
        hotkeys: "Command+V".to_string(),
    }
}

pub fn simulate_paste() -> Result<(), String> {
    let source = CGEventSource::new(CGEventSourceStateID::CombinedSessionState)
        .map_err(|_| "CGEventSourceCreate failed".to_string())?;

    let mut key_down = CGEvent::new_keyboard_event(source.clone(), KeyCode::ANSI_V, true)
        .ok_or_else(|| "CGEventCreateKeyboardEvent failed".to_string())?;
    key_down.set_flags(CGEventFlags::CGEventFlagCommand);

    let mut key_up = CGEvent::new_keyboard_event(source, KeyCode::ANSI_V, false)
        .ok_or_else(|| "CGEventCreateKeyboardEvent failed".to_string())?;
    key_up.set_flags(CGEventFlags::CGEventFlagCommand);

    INJECTING_PASTE.store(true, Ordering::Release);
    key_down.post(CGEventTapLocation::HID);
    key_up.post(CGEventTapLocation::HID);
    INJECTING_PASTE.store(false, Ordering::Release);

    Ok(())
}
