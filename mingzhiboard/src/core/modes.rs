#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub enum ClipboardMode {
    Stack,
    Queue,
    Increment,
}

impl ClipboardMode {
    pub fn as_str(self) -> &'static str {
        match self {
            ClipboardMode::Stack => "stack",
            ClipboardMode::Queue => "queue",
            ClipboardMode::Increment => "increment",
        }
    }
}
