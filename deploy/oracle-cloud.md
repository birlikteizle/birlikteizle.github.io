# Oracle Cloud "Always Free" sunucusunda 7/24 yayın

Bu rehber, uygulamayı **ücretsiz ve süresiz** olarak Oracle Cloud'da çalıştırır. Sonuç:
bilgisayarın kapalı olsa bile site internetten erişilebilir olur.

- Süre: 15-25 dakika (ilk kez yapıyorsan 30-40 dakika)
- Ücret: Always Free kaynaklar için **0 TL**. Kart yalnızca kimlik doğrulaması için istenir.
- Sonuç adres: `http://<sunucu-ip>:8787` (alan adı bağlarsan `https://izle.ornek.com`)

> ⚠️ **Önemli:** Oracle bazen "Always Free" dışında kaynak oluşturur ve ücret yansıtır.
> Aşağıdaki adımlarda shape ve disk seçimini **Always Free eligible** olarak seçtiğinden
> emin ol. Emniyet için hesabında bir **bütçe uyarısı** (Budget → Alert) kur: harcama
> 1 TL olduğunda e-posta gelsin.

---

## 1. Hesap aç

1. <https://signup.cloud.oracle.com> adresinden hesap oluştur.
2. "Home Region" olarak sana en yakın bölgeyi seç (ör. Germany Central / Frankfurt).
   **Bu seçim sonradan değiştirilemez**, Always Free kaynaklar bu bölgede kalır.
3. Kart ile kimlik doğrulaması istenir. Always Free kaynaklar için ücret alınmaz.

---

## 2. Sanal makine (instance) oluştur

Menü: **Compute → Instances → Create instance**

| Alan | Seçim |
| --- | --- |
| Name | `birlikte-izle` |
| Image | **Ubuntu 24.04** (veya 22.04) |
| Shape | **VM.Standard.E2.1.Micro** (Always Free) — *veya* `VM.Standard.A1.Flex` (ARM, 1 OCPU / 6 GB) |
| Primary VNIC | Genel IP ata: **Assign a public IPv4 address** = ✅ |
| SSH keys | **Generate a key pair for me** → özel anahtarı indir (`.key`) |
| Boot volume | Varsayılan (Always Free sınırları içinde kalsın) |

> `A1.Flex` seçersen "Out of host capacity" hatası çok yaygındır. Farklı bir
> **Availability Domain** (AD-1/AD-2/AD-3) dene ya da `E2.1.Micro` ile devam et. Bu
> uygulama 1 GB RAM ile rahat çalışır.

Oluşturduktan sonra instance sayfasındaki **Public IP address** değerini not al.

---

## 3. Ağı aç (iki ayrı yer!)

Yeni başlayanların %90'ı bu adımı atladığı için site açılmaz. **İki katman** var:

### 3a) Oracle güvenlik listesi (bulut tarafı)

**Networking → Virtual Cloud Networks → (VCN'ın) → Security Lists → Default Security List
→ Add Ingress Rules**

| Alan | Değer |
| --- | --- |
| Source Type | CIDR |
| Source CIDR | `0.0.0.0/0` |
| IP Protocol | TCP |
| Destination Port Range | `8787` |

(Alan adı + HTTPS kullanacaksan `80` ve `443` için de aynı kuralı ekle.)

### 3b) Sunucunun kendi güvenlik duvarı

Oracle'ın Ubuntu imajları, sen istemeden **iptables** ile her şeyi bloklar. SSH ile bağlan
ve şunu çalıştır:

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 8787 -j ACCEPT
sudo netfilter-persistent save
```

Ubuntu 24.04 imajlarında ayrıca `ufw` yoksa bu kadar yeterlidir. HTTPS ekleyeceksen:

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

### SSH ile bağlanma (Windows)

PowerShell'de:

```powershell
ssh -i "$env:USERPROFILE\Downloads\ssh-key-2026-11-16.key" ubuntu@<SUNUCU_IP>
```

`Permissions are too open` hatası alırsan:

```powershell
icacls "$env:USERPROFILE\Downloads\ssh-key-2026-11-16.key" /inheritance:r /grant:r "$($env:USERNAME):(R)"
```

---

## 4. Proje dosyalarını sunucuya yükle

`node_modules`, `dist` ve `.data` klasörlerini **göndermene gerek yok** (derleme sunucuda
yapılır). En kolay yol WinSCP:

1. WinSCP indir → **New Session** → protokol **SFTP**, host `<SUNUCU_IP>`, kullanıcı `ubuntu`,
   kimlik doğrulama: indirdiğin `.key` dosyası.
2. Solda bilgisayarındaki proje klasörü, sağda `/home/ubuntu`.
3. `birlikte-izle` klasörünü sağ tarafa sürükle (proje **kökü** değil, kökü `/home/ubuntu/birlikte-izle` olacak şekilde).

Alternatif (yerel PowerShell'den, proje kökünde):

```powershell
scp -i "$env:USERPROFILE\Downloads\ssh-key.key" -r `
  .\package.json,.\package-lock.json,.\tsconfig.json,.\tsconfig.app.json,.\tsconfig.node.json, `
  .\vite.config.ts,.\tailwind.config.js,.\postcss.config.js,.\index.html,.\Dockerfile, `
  .\docker-compose.yml,.\.dockerignore,.\src,.\public,.\server,.\deploy `
  ubuntu@<SUNUCU_IP>:/home/ubuntu/birlikte-izle/
```

### 4b) GitHub üzerinden kurulum (önerilir)

Kodu GitHub'da tutmak, sunucuyu **uzaktan güncelleyebilmeni** sağlar: bilgisayarını
açmadan, hatta telefondan bile depoyu değiştirip siteyi güncelleyebilirsin.

1. Projeyi GitHub'da bir depoya koy (private olması önerilir; `.data/` ve `.env.local`
   zaten `.gitignore` içinde, sızan bir şey olmaz).
2. Sunucuda depoyu klonla:

```bash
cd ~
git clone https://github.com/<KULLANICI>/<DEPO>.git birlikte-izle
cd birlikte-izle
```

Private depo için: GitHub → Settings → Developer settings → **Personal access token**
(scope: `repo`) oluştur ve klonlarken parola olarak kullan. Alternatif olarak depoya
**deploy key** (salt okunur SSH anahtarı) ekleyip `git@github.com:...` ile klonla.

> ⚠️ **GitHub tek başına sunucu değildir.** GitHub Pages yalnızca statik dosya sunar;
> bu uygulama gerçek zamanlı kanal (SSE) ve sunucu tarafı oda durumu kullandığı için
> GitHub Pages'te **çalışmaz**. GitHub burada kod deposu + otomatik dağıtım tetikleyicisi
> olarak kullanılır; uygulamayı çalıştıran şey yine sunucudur.

---

## 5. Docker kur ve başlat

```bash
# Docker + compose eklentisi
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker

cd ~/birlikte-izle
docker compose up -d --build
```

Kontrol:

```bash
docker compose ps          # STATUS: healthy olmalı
docker compose logs -f     # canlı günlük (Ctrl+C ile çık)
curl -s localhost:8787/api/health
```

---

## 6. Erişim

Tarayıcıda: `http://<SUNUCU_IP>:8787`

Bunu arkadaşınla paylaş. Oda oluşturup **davet bağlantısını** göndermen en pratiği
(`http://<SUNUCU_IP>:8787/oda/<ODA_KODU>`).

---

## 7. Güncelleme ve yönetim

```bash
cd ~/birlikte-izle
# Yeni dosyaları yükledikten sonra:
docker compose up -d --build

# Durdur / başlat / yeniden başlat
docker compose down
docker compose up -d
docker compose restart

# Durum verisi (odalar, mesajlar) ana makinede:
cat data/state.json | head -c 400

# Tamamen sil (durum verisi kalır)
docker compose down --rmi local
```

`restart: unless-stopped` sayesinde:

- Sunucu çökerse Docker 3 saniye içinde yeniden başlatır.
- Makine yeniden başlarsa uygulama otomatik ayağa kalkar.
- Yani bir kez kurduktan sonra **ilgilenmene gerek kalmaz**.

### GitHub ile otomatik güncelleme (isteğe bağlı)

Sunucuyu GitHub'dan güncellemek için iki yol var; birini seç yeter.

**A) GitHub Actions (push anında güncellenir)**

Depoda `.github/workflows/deploy.yml` hazır. GitHub'da **Settings → Secrets and variables →
Actions** altına üç sır ekle:

| Sır | Değer |
| --- | --- |
| `SSH_HOST` | Sunucunun genel IP adresi |
| `SSH_USER` | `ubuntu` |
| `SSH_KEY` | SSH özel anahtarının tamamı |

Sonra `main` dalına her push'ta sunucu kendini günceller. Sırları eklemezsen iş akışı
hata vermez, sadece atlanır.

**B) Sunucuda zamanlanmış görev (en basiti)**

```bash
chmod +x ~/birlikte-izle/deploy/auto-pull.sh
crontab -e
# Şu satırı ekle: her 5 dakikada bir depoyu kontrol eder
*/5 * * * * /home/ubuntu/birlikte-izle/deploy/auto-pull.sh >> /home/ubuntu/auto-pull.log 2>&1
```

Push yaptıktan sonra en fazla 5 dakika içinde site güncellenir. Günlüğü
`~/auto-pull.log` dosyasından izleyebilirsin.

---

## 8. (Opsiyonel) Alan adı + HTTPS

Bir alan adın varsa:

1. DNS'te alan adının **A kaydını** sunucunun genel IP'sine yönlendir (ör. `izle.ornek.com`).
2. `deploy/Caddyfile` içindeki `izle.ornek.com` yazan yeri kendi alan adınla değiştir.
3. HTTPS katmanını da başlat:

```bash
docker compose -f docker-compose.yml -f docker-compose.https.yml up -d
```

Caddy, Let's Encrypt sertifikasını otomatik alır ve 90 günde bir yeniler.

> Not: HTTP'de kamera/mikrofon gibi tarayıcı özellikleri kısıtlanır; **ekran paylaşımı
> modunu** kullanacaksan HTTPS şiddetle önerilir (Caddy adımı bunu çözer). Alan adın yoksa
> ücretsiz bir alt alan adı sağlayıcısı kullanabilirsin.

---

## 9. Sık karşılaşılan sorunlar

| Belirti | Sebep / Çözüm |
| --- | --- |
| `http://IP:8787` açılmıyor | 3a **veya** 3b adımı eksik. İkisini de yaptığından emin ol. |
| `docker: command not found` | `newgrp docker` sonrası yeni terminal aç veya oturumu kapat/aç. |
| `permission denied` (docker) | `sudo usermod -aG docker $USER && newgrp docker` |
| Derleme hatası: `npm ci` | `package-lock.json` yüklenmemiş demektir; adım 4'ü tekrarla. |
| `docker compose ps` unhealthy | `docker compose logs` çıktısına bak; `dist` klasörü oluşmadıysa derleme başarısızdır. |
| Sayfa açılıyor ama oda bağlanmıyor | Tarayıcı konsolunda `/api/rooms/.../stream` hatası var mı? Caddy kullanıyorsan `flush_interval -1` satırı `Caddyfile`'da olmalı. |
| Sunucu bir süre sonra duruyor | `docker compose logs` + `docker events`. Compose dosyasındaki `restart: unless-stopped` silinmiş olabilir. |

---

## 10. Güvenlik notları

- Uygulamanın girişi **ad tabanlı** ve oda kapasitesi **2 kişi**. Oda kodunu bilen biri
  odaya girebilir; kodu yalnızca arkadaşınla paylaş.
- `8787` portu internete açık olacak. Alan adı + HTTPS (bölüm 8) önerilir.
- `.data/state.json` içinde kullanıcı oturum token'larının **hash**'leri tutulur (düz metin
  değil). Yine de bu dosyayı kimseyle paylaşma.
