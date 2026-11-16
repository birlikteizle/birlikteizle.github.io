# Birlikte İzle

İki kişinin aynı videoyu gerçek zamanlı olarak birlikte izlediği ve oynatıcıyı **eşit yetkiyle**
kontrol ettiği bir web uygulaması.

- **Sıfır dış servis kurulumu:** Firebase/Auth gerekmez. Arayüz, API ve gerçek zamanlı kanal tek bir
  Node sunucusunda çalışır.
- **Gerçek senkronizasyon:** Sunucu zaman damgası + komut kimliği. Oynat/duraklat/sar/hız/video
  değişimi iki tarafta da aynı ana hizalanır.
- **Eşit kontrol:** Oda sahibi ayrıcalığı yoktur; iki taraf da oynatıcıyı yönetir.
- **Kalıcı oda:** Oda, mesajlar ve son oynatma konumu `.data/state.json` içinde saklanır.
- **Sohbet:** Oda içi mesajlar aynı gerçek zamanlı kanaldan iletilir.
- **Ekran paylaşımı (WebRTC):** Gömülü oynatmayı engelleyen sitelerden bile (Netflix, film siteleri)
  sesli-görüntülü birlikte izleme.
- **İki çalışma modu:** kendi sunucun (kalıcı) veya **sunucusuz P2P** (GitHub Pages'te çalışır).

---

## İki mod: hangisi ne zaman?

| | **Sunucu modu** (varsayılan) | **Sunucusuz P2P modu** |
| --- | --- | --- |
| Komut | `npm run build` | `npm run build:p2p` |
| Nerede çalışır | Node sunucusu (Oracle VM, kendi makinen) | Yalnızca statik dosya sunan her yer (GitHub Pages) |
| Oda/mesaj kalıcı mı | ✅ Sunucuda saklanır | ❌ Yalnızca bellek; ikisi de çıkınca biter |
| Aynı anda çevrimiçi olma | Gerekmez | **Gerekir** |
| Adres | `http://<sunucu-ip>:8787/#/room/...` | `https://<kullanıcı>.github.io/<depo>/#/room/...` |
| Kurulum | Docker/sunucu | GitHub deposu + Pages |
| Ağ gereksinimi | Sunucuya erişim | Eşler arası WebRTC (TURN gerekebilir) |

Sunucusuz modda sinyalleşme herkese açık Nostr relay'leri üzerinden yapılır (Trystero); oda verisi
ve medya **doğrudan tarayıcılar arasında** taşınır, hiçbir sunucudan geçmez.

---

## Sunucusuz sürümü GitHub Pages'te yayınlama

1. Depoyu GitHub'a push et (aşağıdaki *GitHub* bölümüne bak).
2. GitHub'da **Settings → Pages → Build and deployment → Source: GitHub Actions** seç.
3. `main` dalına her push'ta `.github/workflows/pages.yml` çalışır ve site yayınlanır.
4. Adres: `https://<KULLANICI>.github.io/<DEPO>/`

Yerelde denemek için:

```powershell
npm.cmd run build:p2p
npm.cmd run preview:p2p      # http://localhost:4173
```

> Aynı tarayıcıda iki sekme açarsan aynı kimliği paylaşırlar. Gerçek test için iki farklı cihaz
> (veya biri gizli pencere) kullan.

### Sunucusuz modun sınırları

- Oda ve mesajlar **kalıcı değildir**; sayfa yenilenince geçmiş kaybolur, partnerin varsa durumu yeniden gönderir.
- **İki taraf da aynı anda çevrimiçi olmalıdır.**
- Çok kısıtlı ağlarda (simetrik NAT, kurumsal güvenlik duvarı) doğrudan bağlantı kurulamaz;
  `VITE_TURN_*` ile bir TURN sunucusu tanımlaman gerekir.
- Ekran paylaşımı ve tam senkron için HTTPS gerekir (GitHub Pages zaten HTTPS sunar).

---

## İzleme modları

| Mod | Kaynaklar | Senkron kontrol |
| --- | --- | --- |
| **Senkron oynatıcı** | YouTube, Vimeo, doğrudan video (.mp4/.webm), HLS (.m3u8) | ✅ İki taraf da oynatır/duraklatır/sarar |
| **Gömülü sayfa (iframe)** | Gömülmeye izin veren web sayfaları (ör. Internet Archive) | ⚠️ Kontrol sitede kalır; "3-2-1 başlat" sayacı kullanılır |
| **Ekran paylaşımı** | Her şey (DRM'li servisler dahil) | ➖ Film paylaşan tarafta oynar, diğeri sesli-görüntülü izler |

### Neden her site gömülü açılamıyor?

Netflix, Disney+, çoğu film sitesi ve genel olarak birçok web sitesi `X-Frame-Options` veya
`Content-Security-Policy: frame-ancestors` başlığı gönderir. Tarayıcı, bu başlıkları yok sayan bir
sayfayı başka bir sitenin içinde göstermeyi reddeder. Bu bir güvenlik özelliğidir ve uygulama
tarafından aşılamaz. Bu tür kaynaklar için **ekran paylaşımı modu** kullanılır.

### Ekran paylaşımı notları

- Film oynatan sekmeyi paylaş: ses de gelir (tarayıcı destekliyorsa).
- Görüntü sunucudan geçmez; iki tarayıcı arasında doğrudan kurulur (P2P).
- **HTTPS gerekir.** Tarayıcılar ekran yakalamayı yalnızca güvenli bağlamda (https veya localhost)
  verir. Yayında alan adı + HTTPS kullanın (`deploy/oracle-cloud.md` bölüm 8).
- Kısıtlı ağlarda (simetrik NAT, kurumsal güvenlik duvarı) STUN yetmez; `VITE_TURN_*` değişkenleriyle
  bir TURN sunucusu tanımlanır.

---

## Hızlı başlangıç

Gereksinim: **Node.js 20+** (test edilen sürüm: 26).

```powershell
# 1) Bağımlılıklar (yalnızca arayüz derlemesi için)
npm.cmd install

# 2) Arayüzü derle
npm.cmd run build

# 3) Sunucuyu başlat (arayüz + API)
node server/index.mjs
```

Terminalde iki adres yazar:

```
http://localhost:8787        ← bu bilgisayar
http://192.168.x.x:8787      ← aynı Wi-Fi'daki diğer cihazlar
```

Arkadaşına ikinci adresi (veya oda davet bağlantısını) gönder. Aynı ağdaysanız ek kurulum
gerekmez.

> **PowerShell notu:** `npm` komutu "running scripts is disabled" hatası verirse `npm.cmd`
> kullan veya `Set-ExecutionPolicy -Scope Process Bypass` çalıştır. Doğrudan `node ...`
> komutları bu kısıtlamadan etkilenmez.

### Geliştirme modu

```powershell
node server/dev-all.mjs
```

Bu komut hem API sunucusunu (8787) hem Vite'ı (5173) başlatır. Vite `/api` isteklerini 8787'ye
yönlendirir; SSE akışı da proxy üzerinden çalışır.

---

## 7/24 yayın (Docker)

Sunucuyu bir makinede kalıcı olarak çalıştırmak için Docker imajı hazırdır:

```bash
docker compose up -d --build     # başlat / güncelle
docker compose logs -f           # günlükleri izle
docker compose down              # durdur
```

`restart: unless-stopped` sayesinde uygulama çökerse ya da makine yeniden başlarsa kendi
kendine ayağa kalkar. Oda ve mesaj verisi `./data` klasöründe kalıcıdır.

Ücretsiz ve 7/24 bir bulut sunucusunda (Oracle Cloud Always Free) yayınlamak için adım adım
rehber: **[deploy/oracle-cloud.md](deploy/oracle-cloud.md)**. Alan adı + otomatik HTTPS için
`docker-compose.https.yml` ve `deploy/Caddyfile` dosyaları kullanılabilir.

Docker istemiyorsan `deploy/birlikte-izle.service` dosyası systemd ile aynı işi yapar.

### GitHub ne işe yarar?

GitHub Pages yalnızca **statik** dosya sunar. Bu uygulama iki şekilde yayınlanabilir:

- **Sunucusuz (P2P) sürüm:** `npm run build:p2p` çıktısı GitHub Pages'te **doğrudan çalışır**
  (yukarıdaki *Sunucusuz sürümü GitHub Pages'te yayınlama* bölümü). `.github/workflows/pages.yml`
  bunu otomatik yapar.
- **Sunucu sürümü:** GitHub Pages'te çalışmaz; çünkü oda durumu ve SSE sunucu tarafında tutulur.
  Bu sürüm için Oracle VM (aşağıdaki rehber) gerekir. GitHub burada kod deposu ve **otomatik
  dağıtım tetikleyicisi** olarak kullanılır:
  `.github/workflows/deploy.yml` — `main` dalına push edince sunucu güncellenir (Actions sırları
  tanımlıysa). `deploy/auto-pull.sh` aynı işi zamanlanmış görevle yapar.

---

## Ortam değişkenleri

| Değişken | Varsayılan | Açıklama |
| --- | --- | --- |
| `NOTIFY_PORT` | `8787` | Sunucu portu |
| `NOTIFY_HOST` | `0.0.0.0` | Dinlenecek adres (LAN için `0.0.0.0`) |
| `ROOM_TTL_DAYS` | `30` | Bu süreden eski odalar durum dosyasından silinir |
| `VITE_API_BASE` | aynı köken | Arayüz ayrı alan adındaysa API adresi |
| `VITE_TURN_URL` | — | Ekran paylaşımı için TURN sunucusu (kısıtlı ağlarda) |
| `VITE_TURN_USERNAME` | — | TURN kullanıcı adı |
| `VITE_TURN_CREDENTIAL` | — | TURN parolası |

Tam liste: `.env.example`.

---

## Mimari

```
Tarayıcı (React 19 + Vite + Tailwind)
   │  fetch  →  /api/rooms/:id/playback, /messages, /join, /ping
   │  SSE    ←  /api/rooms/:id/stream   (snapshot, playback, presence, message)
   ▼
Node HTTP sunucusu (server/index.mjs)
   ├── rooms.mjs      oda/üyelik/oynatma doğrulaması
   ├── presence.mjs   SSE bağlantısına dayalı çevrimiçi durum
   └── store.mjs      .data/state.json (250 ms birleştirilmiş yazma)
```

- Oda başına **tek SSE bağlantısı** açılır; oynatma, sohbet ve üyelik hook'ları aynı kanalı
  paylaşır.
- Her oynatma komutu sunucuda doğrulanır (`provider`, süre, hız, komut kimliği) ve
  `updatedAt` sunucu saatiyle yazılır. İstemciler saat farkını `/api/time` ile ölçer.
- Çevrimiçi durum, SSE bağlantısı + 25 saniyelik ping ile belirlenir; sekme kapanınca
  sunucu `leave` olayını kaydeder.
- Oda kapasitesi iki kişidir; üçüncü katılım `409 ROOM_FULL` alır.

### API uçları

| Yöntem | Yol | Açıklama |
| --- | --- | --- |
| `GET` | `/api/health` | Sunucu durumu |
| `GET` | `/api/time` | Sunucu zamanı (saat kayması) |
| `POST` | `/api/auth/register` | Ad ile yerel oturum açar |
| `GET` | `/api/auth/me` | Token doğrular |
| `POST` | `/api/rooms` | Oda oluşturur |
| `POST` | `/api/rooms/:id/join` | Odaya katılır (kapasite 2) |
| `GET` | `/api/rooms/:id` | Oda anlık görüntüsü |
| `GET` | `/api/rooms/:id/stream?token=…` | SSE akışı |
| `POST` | `/api/rooms/:id/playback` | Oynatma komutu |
| `POST` | `/api/rooms/:id/messages` | Mesaj gönderir |
| `POST` | `/api/rooms/:id/ping` | Çevrimiçi sinyali |
| `POST` | `/api/rooms/:id/signal` | Hafif eşzamanlama sinyali (sayaç, WebRTC el sıkışması) |
| `DELETE` | `/api/rooms/:id` | Odayı kapatır (kuran kişi) |

Yetkilendirme `Authorization: Bearer <token>` ile yapılır. SSE, `EventSource` başlık
gönderemediği için token'ı sorgu parametresinde taşır.

---

## Testler

```powershell
npm.cmd test          # birim testleri (Vitest)
npm.cmd run build     # tip kontrolü + üretim derlemesi
node scripts/smoke.mjs  # sunucu çalışırken uçtan uca duman testi
```

Duman testi iki kullanıcı oluşturur, odaya ikinci kişiyi sokar, oynatma komutu ve mesaj
gönderir, SSE snapshot'ını doğrular ve üçüncü kişinin reddedildiğini kontrol eder.

---

## Sorun giderme

| Belirti | Çözüm |
| --- | --- |
| "Sunucuya ulaşılamadı" | `node server/index.mjs` çalışıyor mu? Port 8787 dolu mu? |
| Arkadaş bağlantı kuramıyor | `NOTIFY_HOST=0.0.0.0` olmalı; Windows güvenlik duvarında Node'a izin ver |
| YouTube videosu açılmıyor | Video gömülü oynatmaya izin vermiyor olabilir; başka video dene |
| `npm` çalışmıyor (PowerShell) | `npm.cmd` kullan |

---

## Bilinen sınırlamalar

- Uygulama kendi sunucunda çalışır. İnternet üzerinden izlemek için sunucuyu bir makinede
  yayınlayıp (ters proxy/tünel) `VITE_API_BASE` ayarlaman gerekir.
- DRM korumalı platformlar (Netflix, Disney+, Prime Video vb.) gömülü oynatılamaz; bunlar için
  ekran paylaşımı modunu kullan.
- `X-Frame-Options` / CSP gönderen siteler iframe olarak açılmaz; tarayıcı güvenliği gereği bu
  aşılamaz.
- Ekran paylaşımı HTTPS gerektirir ve çok kısıtlı ağlarda TURN sunucusu olmadan kurulamayabilir.
- YouTube IFrame API bazı videolarda yaş/sahiplik kısıtı nedeniyle oynatmayı engelleyebilir.
