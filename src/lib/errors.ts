interface ErrorLike {
  code?: unknown
  message?: unknown
}

function readCode(error: unknown): string {
  if (error && typeof error === 'object') {
    const code = (error as ErrorLike).code
    if (typeof code === 'string') return code
  }
  if (error instanceof Error) return error.message
  return ''
}

export function mapAuthError(error: unknown): string {
  const code = readCode(error)
  switch (code) {
    case 'auth/popup-blocked':
      return 'Tarayıcı giriş penceresini engelledi. Lütfen açılır pencerelere izin verin veya yönlendirme ile giriş yapın.'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Giriş penceresi kapatıldı. Google ile giriş yapmayı tekrar deneyebilirsiniz.'
    case 'auth/unauthorized-domain':
      return 'Bu alan adı Firebase yetkili alan adları listesinde değil. Firebase Konsolu → Authentication → Settings → Authorized domains bölümüne ekleyin.'
    case 'auth/operation-not-allowed':
      return 'Google ile giriş sağlayıcısı etkin değil. Firebase Konsolu → Authentication → Sign-in method → Google bölümünden etkinleştirin.'
    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid':
      return 'Firebase API anahtarı geçersiz. .env.local dosyasındaki VITE_FIREBASE_API_KEY değerini kontrol edin.'
    case 'auth/network-request-failed':
      return 'Ağ bağlantısı kurulamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.'
    case 'auth/too-many-requests':
      return 'Çok fazla giriş denemesi yapıldı. Lütfen birkaç dakika sonra tekrar deneyin.'
    case 'auth/user-disabled':
      return 'Bu kullanıcı hesabı devre dışı bırakılmış.'
    case 'auth/account-exists-with-different-credential':
      return 'Bu e-posta adresi farklı bir giriş yöntemiyle kullanılıyor. Lütfen desteklenen yöntemle giriş yapın.'
    case 'auth/web-storage-unsupported':
      return 'Tarayıcınız oturum deposunu engelliyor. Gizli modu kapatıp tekrar deneyin veya çerezleri etkinleştirin.'
    case 'auth/internal-error':
      return 'Kimlik doğrulama sırasında beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.'
    case 'auth/redirect-cancelled-by-user':
      return 'Yönlendirmeli giriş iptal edildi.'
    default:
      if (error instanceof Error && error.message && !error.message.includes('Firebase')) {
        return error.message
      }
      return 'Giriş yapılamadı. Lütfen tekrar deneyin.'
  }
}

export function mapDatabaseError(error: unknown): string {
  const code = readCode(error)
  const normalized = code.toUpperCase()

  if (normalized.includes('PERMISSION_DENIED') || code === 'PERMISSION_DENIED') {
    return 'Bu işlem için yetkiniz yok. Odaya üye olduğunuzdan emin olun.'
  }
  if (normalized.includes('DISCONNECTED') || code === 'DISCONNECTED') {
    return 'Firebase bağlantısı kesildi. İnternet bağlantınızı kontrol edin.'
  }
  if (code === 'auth/network-request-failed' || normalized.includes('NETWORK')) {
    return 'Ağ hatası. Bağlantınızı kontrol edip tekrar deneyin.'
  }
  if (normalized.includes('INVALID_DATABASE_URL')) {
    return 'Realtime Database adresi geçersiz. VITE_FIREBASE_DATABASE_URL değerini kontrol edin.'
  }
  return 'İşlem tamamlanamadı. Lütfen tekrar deneyin.'
}

/** Sunucu (REST/SSE) hatalarını kullanıcıya gösterilecek Türkçe metne çevirir. */
export function mapApiError(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && 'status' in error) {
    const typed = error as { code?: string; message?: string; status?: number }
    switch (typed.code) {
      case 'NETWORK':
        return 'Sunucuya ulaşılamadı. Sunucunun çalıştığını ve aynı ağda olduğunu kontrol et.'
      case 'ROOM_FULL':
        return 'Oda dolu. Bu odaya yalnızca iki kişi katılabilir.'
      case 'ROOM_NOT_FOUND':
        return 'Oda bulunamadı. Davet bağlantısının doğru olduğundan emin ol.'
      case 'ROOM_CLOSED':
        return 'Bu oda kapatılmış.'
      case 'UNAUTHORIZED':
        return 'Oturumun sona ermiş. Çıkış yapıp yeniden giriş yap.'
      case 'RATE_LIMITED':
        return 'Çok fazla istek gönderildi. Birkaç saniye bekleyip tekrar dene.'
      default:
        if (typed.message) return typed.message
    }
  }

  if (error instanceof Error && error.message) return error.message
  return 'İşlem tamamlanamadı. Lütfen tekrar deneyin.'
}
