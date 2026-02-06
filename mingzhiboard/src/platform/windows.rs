use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::Sender;
use std::sync::OnceLock;
use std::thread;

use windows::Win32::Foundation::{HINSTANCE, LPARAM, LRESULT, WPARAM};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    GetAsyncKeyState, SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYBD_EVENT_FLAGS,
    KEYEVENTF_KEYUP, VK_CONTROL, VK_MENU, VK_Q, VK_V,
};
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, DispatchMessageW, GetMessageW, SetWindowsHookExW, TranslateMessage,
    UnhookWindowsHookEx, KBDLLHOOKSTRUCT, MSG, WH_KEYBOARD_LL, WM_KEYDOWN, WM_KEYUP,
    WM_SYSKEYDOWN, WM_SYSKEYUP,
};

use super::{PlatformEvent, PlatformStatus};

static EVENT_SENDER: OnceLock<Sender<PlatformEvent>> = OnceLock::new();
static INJECTING_PASTE: AtomicBool = AtomicBool::new(false);

pub fn init(event_tx: Sender<PlatformEvent>) -> PlatformStatus {
    let _ = EVENT_SENDER.set(event_tx);

    thread::spawn(|| unsafe {
        let hook = match SetWindowsHookExW(
            WH_KEYBOARD_LL,
            Some(keyboard_hook),
            Some(HINSTANCE::default()),
            0,
        ) {
            Ok(handle) => handle,
            Err(_) => return,
        };

        let mut message = MSG::default();
        while GetMessageW(&mut message, None, 0, 0).as_bool() {
            TranslateMessage(&message);
            DispatchMessageW(&message);
        }

        let _ = UnhookWindowsHookEx(hook);
    });

    PlatformStatus {
        listener: "active (WH_KEYBOARD_LL)".to_string(),
        hotkeys: "Alt+Q".to_string(),
    }
}

pub fn simulate_paste() -> Result<(), String> {
    let mut inputs = Vec::with_capacity(6);
    let alt_down = unsafe { GetAsyncKeyState(VK_MENU.0 as i32) } as u16 & 0x8000 != 0;
    if alt_down {
        inputs.push(key_input(VK_MENU, KEYEVENTF_KEYUP));
        std::thread::sleep(std::time::Duration::from_millis(10));
    }
    inputs.push(key_input(VK_CONTROL, KEYBD_EVENT_FLAGS(0)));
    inputs.push(key_input(VK_V, KEYBD_EVENT_FLAGS(0)));
    inputs.push(key_input(VK_V, KEYEVENTF_KEYUP));
    inputs.push(key_input(VK_CONTROL, KEYEVENTF_KEYUP));

    INJECTING_PASTE.store(true, Ordering::Release);
    let sent = unsafe { SendInput(&inputs, std::mem::size_of::<INPUT>() as i32) };
    if sent == inputs.len() as u32 {
        Ok(())
    } else {
        INJECTING_PASTE.store(false, Ordering::Release);
        Err("SendInput failed".to_string())
    }
}

fn key_input(
    vk: windows::Win32::UI::Input::KeyboardAndMouse::VIRTUAL_KEY,
    flags: KEYBD_EVENT_FLAGS,
) -> INPUT {
    INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: vk,
                wScan: 0,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    }
}

unsafe extern "system" fn keyboard_hook(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code < 0 {
        return CallNextHookEx(None, code, wparam, lparam);
    }

    let hook = *(lparam.0 as *const KBDLLHOOKSTRUCT);
    let vk_code = hook.vkCode as u32;
    let msg = wparam.0 as u32;
    let is_keydown = msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN;
    let is_keyup = msg == WM_KEYUP || msg == WM_SYSKEYUP;

    if INJECTING_PASTE.load(Ordering::Acquire) {
        if vk_code == VK_V.0 as u32 && is_keyup {
            INJECTING_PASTE.store(false, Ordering::Release);
        }
        return CallNextHookEx(None, code, wparam, lparam);
    }

    if is_keydown && vk_code == VK_Q.0 as u32 {
        let alt = (GetAsyncKeyState(VK_MENU.0 as i32) as u16 & 0x8000) != 0;
        if alt {
            if let Some(sender) = EVENT_SENDER.get() {
                let _ = sender.send(PlatformEvent::PasteRequested);
            }
            return LRESULT(1);
        }
    }

    CallNextHookEx(None, code, wparam, lparam)
}
