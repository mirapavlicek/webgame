// Na Windows release buildu schovej konzoli
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    nettycoon_lib::run()
}
