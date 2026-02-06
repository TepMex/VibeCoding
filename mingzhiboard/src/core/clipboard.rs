use std::collections::VecDeque;

use super::ClipboardMode;

pub struct ClipboardHistory {
    stack: Vec<String>,
    queue: VecDeque<String>,
    increment_text: Option<String>,
    max_items: usize,
}

impl ClipboardHistory {
    pub fn new(max_items: usize) -> Self {
        Self {
            stack: Vec::new(),
            queue: VecDeque::new(),
            increment_text: None,
            max_items: max_items.max(1),
        }
    }

    pub fn record_copy(&mut self, text: &str, mode: ClipboardMode) {
        match mode {
            ClipboardMode::Stack => {
                self.stack.push(text.to_string());
                self.trim_stack();
            }
            ClipboardMode::Queue => {
                self.queue.push_back(text.to_string());
                self.trim_queue();
            }
            ClipboardMode::Increment => {
                self.increment_text = Some(text.to_string());
            }
        }
    }

    pub fn next_paste(&mut self, mode: ClipboardMode) -> Option<String> {
        match mode {
            ClipboardMode::Stack => self.stack.pop(),
            ClipboardMode::Queue => self.queue.pop_front(),
            ClipboardMode::Increment => {
                let current = self.increment_text.as_deref()?;
                let next = increment_numbers(current);
                self.increment_text = Some(next.clone());
                Some(next)
            }
        }
    }

    pub fn stack_len(&self) -> usize {
        self.stack.len()
    }

    pub fn queue_len(&self) -> usize {
        self.queue.len()
    }

    pub fn increment_text(&self) -> Option<&str> {
        self.increment_text.as_deref()
    }

    fn trim_stack(&mut self) {
        if self.stack.len() > self.max_items {
            let overflow = self.stack.len() - self.max_items;
            self.stack.drain(0..overflow);
        }
    }

    fn trim_queue(&mut self) {
        while self.queue.len() > self.max_items {
            self.queue.pop_front();
        }
    }
}

fn increment_numbers(text: &str) -> String {
    let mut output = String::with_capacity(text.len());
    let mut chars = text.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch.is_ascii_digit() {
            let mut digits = String::new();
            digits.push(ch);
            while let Some(next) = chars.peek().copied() {
                if next.is_ascii_digit() {
                    digits.push(next);
                    chars.next();
                } else {
                    break;
                }
            }

            match digits.parse::<u64>() {
                Ok(value) => {
                    let incremented = value + 1;
                    let width = digits.len();
                    let mut rendered = incremented.to_string();
                    if rendered.len() < width {
                        rendered = format!("{:0width$}", incremented, width = width);
                    }
                    output.push_str(&rendered);
                }
                Err(_) => output.push_str(&digits),
            }
        } else {
            output.push(ch);
        }
    }

    output
}
