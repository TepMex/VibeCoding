mod app;
mod core;
mod platform;

use eframe::egui;

fn main() -> eframe::Result<()> {
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size(egui::vec2(520.0, 360.0)),
        ..Default::default()
    };

    eframe::run_native(
        "MingzhiBoard",
        options,
        Box::new(|cc| Box::new(app::MingzhiBoardApp::new(cc))),
    )
}
