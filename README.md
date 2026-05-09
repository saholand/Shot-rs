# Shotırs

Hızlı ve hafif Windows masaüstü ekran görüntüsü ve ekran kaydı uygulaması.
Electron + React + TypeScript.

> 🇬🇧 English version: see [README.en.md](README.en.md)

---

## Özellikler

### 📸 Ekran Görüntüsü
- **Alan seçme** — fare ile seçim, magnifier loupe ile pixel-perfect
- **Anotasyon** — kalem, ok, kutu, çizgi, metin, fosforlu, blur/cover, eraser, drag, eyedropper
- **OCR** — seçtiğin alandaki yazıyı panoya kopyala (TR + EN)
- **Panoya kopyala / dosyaya kaydet / paylaş**

### 🎥 Ekran Kaydı
- **Tam ekran ya da bölge seçimi** ile kayıt
- **Sistem sesi + mikrofon** (sistem sesi Windows-only)
- **Webcam picture-in-picture** — sürüklenebilir, yeniden boyutlandırılabilir
- **Canlı çizim** — kayıt sırasında ekrana not düş
- **Click ripple, cursor spotlight (sinematik tint + glow), fluorescent cursor** — Loom/Cap-style efektler
- **Crash recovery** — beklenmedik kapanmada kayıt geri yüklenebilir

### 🛠 Diğer
- **Türkçe + İngilizce** UI
- **Global kısayollar** — PrintScreen, Ctrl+Alt+R, Ctrl+Shift+D, Ctrl+Shift+O
- **History** — son 100 yakalama, bulk delete, paylaşım linki
- **Tray menüsü** — pencere kapansa da arka planda çalışır
- **Otomatik güncelleme** — GitHub Releases üzerinden

---

## Kurulum

### Son sürümü indir
[GitHub Releases](https://github.com/saholand/Shot-rs/releases) sayfasından
en son `Shotirs-Setup-x.y.z.exe` (kurulumlu) ya da `Shotirs-x.y.z-portable.exe`
(taşınabilir) dosyasını indir.

> ⚠️ Code-signed olmadığı için Windows SmartScreen "Bilinmeyen yayıncı"
> uyarısı verebilir. **More info → Run anyway** ile devam et.

### Kaynaktan derleme
```bash
git clone https://github.com/saholand/Shot-rs.git
cd shotirs
npm install
npm run dev          # geliştirme modu
npm run dist         # Windows installer + portable üret
```

---

## Kısayollar (varsayılan)

| Kısayol | İşlev |
|---|---|
| `PrintScreen` | Ekran görüntüsü al |
| `Ctrl+Alt+R` | Ekran kaydı başlat / durdur |
| `Ctrl+Shift+D` | Kayıt sırasında çizim modunu aç/kapat |
| `Ctrl+Shift+O` | OCR — seçtiğin alandaki yazıyı kopyala |

Kısayollar Settings → Kısayollar bölümünden değiştirilebilir.

---

## Mimari

```
src/
  main/         Electron main process (windows, IPC, services)
    windows/    Pencere lifecycle (overlay, annotation, webcam, vs.)
    ipc/        IPC handler'ları (recording, screenshot, settings, OCR)
    services/   Tray, hotkey, settings store, logger, updater
    recording/  MediaRecorder pipeline, temp file, mouse hook
    screenshot/ Capture + export
  preload/      contextBridge API (renderer → main köprüsü)
  renderer/     React UI
    overlay/    Selection + editing canvas
    recording/  Live annotation toolbar/canvas, recording panel
    settings/   Settings panel
    history/    Geçmiş + bulk delete
    annotation/ Annotation primitives (paylaşılan)
  shared/       Sabitler, i18n, type'lar (main+renderer paylaşımı)
share-server/   Custom upload backend (opsiyonel, Express + S3)
```

### Güvenlik
- `contextIsolation: true`, `nodeIntegration: false`
- `local-media://` protokolü allowlist + extension filter ile sandboxlanmış
- Custom upload server URL'si HTTPS zorunlu
- Tüm renderer pencerelerinde CSP

### i18n
- TR + EN. `src/shared/i18n/{tr,en}.ts` — anahtar tabanlı dictionary
- Her renderer pencere kendi process'inde olduğu için entry'lerde
  startup'ta `setLanguage()` ile senkron alıyor
- Main process tarafı için `src/main/services/i18n-main.ts`
  (dialog title'ları, IPC error mesajları, OCR notification)

---

## Sürüm yayınlama

```bash
# 1. version'u bump et
npm version patch    # ya da minor / major

# 2. tag'i push et
git push --follow-tags
```

GitHub Actions [`release.yml`](.github/workflows/release.yml) workflow'u
otomatik olarak Windows installer + portable build edip GitHub Release'e
yükler. Kurulu uygulamalar bir sonraki açılışta auto-updater ile yeni
sürümü algılar.

---

## Yasal

- **Privacy policy:** [PRIVACY.md](PRIVACY.md)
- **Lisans:** TBD (sahibi henüz lisans seçmedi)

## Katkı

Issue ve PR açabilirsin. Major değişiklikler için önce issue ile tartış.

---

Made with ❤ — Shotırs
