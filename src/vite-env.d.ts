/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API sunucusu ayrı bir alan adındaysa tam adres. Boşsa aynı köken kullanılır. */
  readonly VITE_API_BASE?: string
  /** Ekran paylaşımı için TURN sunucusu (kısıtlı ağlarda gerekir). Ör. turn:turn.ornek.com:3478 */
  readonly VITE_TURN_URL?: string
  readonly VITE_TURN_USERNAME?: string
  readonly VITE_TURN_CREDENTIAL?: string
}
