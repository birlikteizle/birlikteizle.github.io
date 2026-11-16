/**
 * Çalışma modu.
 *
 * - `server`: oda durumu kendi Node sunucunda tutulur (REST + SSE).
 * - `p2p`: sunucu yoktur; iki tarayıcı WebRTC ile doğrudan konuşur. GitHub Pages
 *   gibi yalnızca statik dosya sunan ortamlarda çalışır.
 *
 * Mod derleme zamanında sabitlenir (`VITE_P2P=1`), böylece hook'lar güvenle
 * moda göre seçilebilir.
 */
export const isP2P = import.meta.env.VITE_P2P === '1'

/** P2P odalarında eşzamanlama mesajlarının boyut sınırı (Trystero: 16 KB/frame). */
export const P2P_HISTORY_LIMIT = 12