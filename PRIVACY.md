# Gizlilik Politikası — Shotırs

> 🇬🇧 English version below — see [PRIVACY.en](#shotirs-privacy-policy-english)

**Son güncelleme:** 2026-05-09

> **⚠️ Yasal uyarı:** Bu doküman bir şablondur ve avukat tarafından
> hukuki olarak gözden geçirilmemiştir. Ticari kullanım veya gerçek
> kullanıcılara dağıtım öncesi bir hukuk profesyoneline danışın.

## Toplanan Veriler

Shotırs **kullanıcı kaydı, telemetri veya analitik içermez**. Aşağıdaki
veriler yalnızca kullanıcının açık eylemi sonucu aktarılır:

### 1) Yerel veri (cihazında kalır)
Aşağıdaki veriler **yalnızca cihazında** saklanır, bizim sunucularımıza
gönderilmez:
- Ekran görüntüleri ve ekran kayıtları (kullanıcının seçtiği klasörde)
- Geçmiş kayıtları (`%APPDATA%/Shotırs/history.json` — son 100 dosya)
- Uygulama ayarları (`%APPDATA%/Shotırs/settings.json`)
- Hata logları (`%APPDATA%/Shotırs/logs/app.log` — maks. 1 MB, döner)
- Geçici kayıt dosyaları (`%APPDATA%/Shotırs/recording-temp/` — finalize
  ya da kullanıcı discard edene kadar)

### 2) Üçüncü taraf hizmetler

Kullanıcı **paylaş** düğmesini kullandığında dosya bir uzak sunucuya
yüklenir:

#### Litterbox (varsayılan)
- **Sağlayıcı:** Catbox (https://litterbox.catbox.moe)
- **Saklama süresi:** 72 saat (Litterbox'un kendi politikası)
- **Aktarım:** HTTPS
- **Veri tipi:** Yalnızca kullanıcının paylaşmaya karar verdiği dosya
- **Geri çekme:** Litterbox'un 72 saatlik otomatik silmesi tek mekanizma

#### Custom upload server (opsiyonel)
Settings → Advanced → Upload Server URL kısmından kullanıcının kendi
sunucusunu girebileceği özellik. Bu durumda dosya kullanıcının kendi
sunucusuna gider; veri saklama o sunucunun politikasına tabidir.
Shotırs **HTTPS dışındaki sunuculara yüklemeyi reddeder** (defense-in-depth).

#### OCR — Tesseract.js trained data
Tesseract.js dil modelleri (`eng.traineddata`, `tur.traineddata`)
uygulama paketiyle birlikte gelir. Tesseract.js modelleri yerel olarak
yüklenir; OCR işlemi tamamen offline'dır.

İlk açılışta yerel model bulunmazsa (paketlemede sorun olursa),
Tesseract.js bunları kendi CDN'inden çeker — bu durumda HTTP isteği
`tessdata.projectnaptha.com` adresine gider. Modeller bir kez indirildikten
sonra tekrar internet gerekmez.

#### Otomatik güncelleme
Uygulama açılışta GitHub'a (https://github.com/saholand/shotirs/releases)
HTTPS isteği yapar. Sadece versiyon numaraları döner, kullanıcı bilgisi
gönderilmez.

## Kameraya / Mikrofona / Ekrana erişim

Tarayıcı izinleri:
- **Ekran:** `desktopCapturer` API — yalnızca kullanıcının **Kayda Başla**
  düğmesine ya da PrintScreen kısayoluna basmasıyla
- **Mikrofon:** Yalnızca kullanıcı recording'de "Mikrofon" toggle'ını açtığında
- **Kamera:** Yalnızca kullanıcı "Webcam" toggle'ını açtığında

Hiçbir ses/görüntü akışı arka planda kayıt yapmaz.

## Veri silme

Kullanıcı şu yöntemlerle veri silebilir:
- **History panel → Sil:** seçilen geçmiş kaydını siler (dosyanın kendisi
  kullanıcının kayıt klasöründe kalır — orayı da elle silmek gerekir)
- **History panel → Temizle:** tüm geçmiş JSON kaydını siler
- **Uygulamayı kaldır:** `%APPDATA%/Shotırs/` klasörünü manuel sil

Litterbox'a yüklenen dosyalar 72 saat sonra otomatik silinir; daha erken
silmek için Litterbox'un kendi yöntemi yoktur.

## Çocuklar

Shotırs 13 yaşın altındaki çocuklara yönelik değildir. Kullanıcı kaydı
gerektirmediği için yaş doğrulaması yapılmaz.

## Politika değişiklikleri

Bu politika güncellendiğinde tarih en üstteki "Son güncelleme" alanına
yazılır. Önemli değişiklikler README'de duyurulur.

## İletişim

Soru veya silme talepleri için: **alihanaydin.media@gmail.com**

---

## Shotırs Privacy Policy (English)

**Last updated:** 2026-05-09

> **⚠️ Legal disclaimer:** This document is a template and has NOT been
> reviewed by a lawyer. Consult legal counsel before commercial use or
> distribution to real users.

### Data we collect

Shotırs has **no user accounts, telemetry, or analytics**. The following
data only leaves your device through explicit user action:

#### 1) Local data (stays on your device)
- Screenshots and recordings (saved to your chosen folder)
- History records (`%APPDATA%/Shotırs/history.json` — last 100 entries)
- Settings (`%APPDATA%/Shotırs/settings.json`)
- Error logs (`%APPDATA%/Shotırs/logs/app.log` — max 1 MB, rotated)
- Temp recording files (`%APPDATA%/Shotırs/recording-temp/` — until finalized
  or discarded)

#### 2) Third-party services

When you click **Share**, the file is uploaded to a remote server:

##### Litterbox (default)
- **Provider:** Catbox (https://litterbox.catbox.moe)
- **Retention:** 72 hours (Litterbox's own policy)
- **Transport:** HTTPS
- **Data type:** Only the file you explicitly chose to share
- **Removal:** Litterbox's 72-hour auto-delete is the only mechanism

##### Custom upload server (optional)
Under Settings → Advanced → Upload Server URL you can route uploads to
your own server. Retention is governed by that server's policy.
Shotırs **refuses to upload over plain HTTP** (defense in depth).

##### OCR — Tesseract.js trained data
Language models (`eng.traineddata`, `tur.traineddata`) ship inside the
app package. OCR runs fully offline.

If local models are missing (packaging error), Tesseract.js falls back
to its CDN at `tessdata.projectnaptha.com`. After the first download,
no further internet is required.

##### Auto-update
On startup the app makes one HTTPS request to GitHub
(https://github.com/saholand/shotirs/releases) for version info. Only
version numbers come back; no user data leaves the device.

### Camera / microphone / screen access

Browser permissions:
- **Screen:** via `desktopCapturer` — only when the user clicks
  **Start Recording** or hits the screenshot hotkey
- **Microphone:** only when the user toggles "Microphone" in recording
- **Camera:** only when the user toggles "Webcam"

No audio/video stream is captured in the background.

### Data removal

You can remove data by:
- **History panel → Delete:** removes a single history entry (the file
  itself stays in your save folder — you have to delete it manually)
- **History panel → Clear:** wipes the history JSON entirely
- **Uninstall:** delete `%APPDATA%/Shotırs/` manually

Files uploaded to Litterbox are auto-deleted after 72 hours; Litterbox
provides no early-deletion mechanism.

### Children

Shotırs is not directed at children under 13. We don't verify age
because we don't collect user accounts.

### Policy changes

When this policy changes, the "Last updated" date at the top is updated.
Material changes will be announced in the README.

### Contact

Questions or deletion requests: **alihanaydin.media@gmail.com**
