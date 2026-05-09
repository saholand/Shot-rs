/**
 * Mini i18n for the main process.
 *
 * Renderer i18n lives in `src/shared/i18n/`, but the main process can't
 * call into renderer state. Instead we keep a tiny TR/EN map here and
 * read the current language from settings on every lookup so changes
 * apply without restarting.
 *
 * Used for:
 *  - Native dialog titles (showSaveDialog, showOpenDialog)
 *  - IPC error messages that the renderer surfaces directly to the user
 *  - System notifications (OCR completion / failure)
 */

import { getSetting } from './settings-store'

type Lang = 'tr' | 'en'

const TR: Record<string, string> = {
  // Dialogs
  'dialog.saveRecording': 'Kaydı Kaydet',
  'dialog.recoverRecording': 'Kaydı Kurtar',
  'dialog.trimAndSave': 'Kes ve Kaydet',
  'dialog.selectDefaultSaveDir': 'Varsayılan kayıt klasörünü seç',
  'dialog.saveScreenshot': 'Ekran Görüntüsünü Kaydet',

  // Errors surfaced from main → renderer
  'error.fileNotFound': 'Dosya bulunamadı. Silinmiş veya taşınmış olabilir.',
  'error.fileNotFoundShort': 'Dosya bulunamadı',
  'error.imageUnreadable': 'Görüntü okunamadı',
  'error.copyFailed': 'Kopyalama hatası',
  'error.saveCancelled': 'Kaydetme iptal edildi',
  'error.saveError': 'Kaydetme hatası',
  'error.tempFileFailed': 'Geçici dosya oluşturulamadı',
  'error.captureFailed': 'Ekran yakalanamadı',
  'error.ocrNotReady': 'OCR hazır değil',
  'error.ocrError': 'OCR hatası',
  'error.textNotFound': 'Metin bulunamadı',
  'error.ocrImageTooLarge': 'Görüntü OCR için çok büyük (maks. {limit} MB)',

  // OCR notifications
  'ocr.notifyDoneTitle': 'OCR Tamamlandı',
  'ocr.notifyErrorTitle': 'OCR Hatası',
  'ocr.copiedToClipboard': 'Metin kopyalandı! ({chars} karakter)',

  // Upload
  'upload.httpsRequired': 'Özel yükleme sunucusu HTTPS olmalı',
  'upload.invalidUrl': 'Yükleme sunucusu adresi geçersiz',
  'upload.tooLargeScreenshot': 'Ekran görüntüsü çok büyük (maks. {limit} MB)',
  'upload.tooLargeRecording': 'Kayıt çok büyük (maks. {limit} MB)',
  'upload.failed': 'Upload başarısız',
  'upload.timedOut': 'Bağlantı zaman aşımına uğradı',
  'upload.cantReach': 'Sunucuya bağlanılamadı — adres ve bağlantınızı kontrol edin',
  'upload.disconnected': 'Bağlantı kesildi — tekrar deneyin',
  'upload.badRequest': 'Geçersiz istek',
  'upload.serverLimit': 'Dosya boyutu sunucu limitini aşıyor',
  'upload.rateLimited': 'Çok fazla istek — biraz bekleyip tekrar deneyin',
  'upload.serverError': 'Sunucu hatası — daha sonra tekrar deneyin',
  'upload.unexpectedHttp': 'Beklenmeyen hata (HTTP {status})',
  'upload.invalidDataUrl': 'Geçersiz data URL',
  'upload.cantReadFile': 'Dosya okunamadı'
}

const EN: Record<string, string> = {
  // Dialogs
  'dialog.saveRecording': 'Save Recording',
  'dialog.recoverRecording': 'Recover Recording',
  'dialog.trimAndSave': 'Trim and Save',
  'dialog.selectDefaultSaveDir': 'Choose default save folder',
  'dialog.saveScreenshot': 'Save Screenshot',

  // Errors
  'error.fileNotFound': 'File not found. It may have been deleted or moved.',
  'error.fileNotFoundShort': 'File not found',
  'error.imageUnreadable': 'Could not read image',
  'error.copyFailed': 'Copy failed',
  'error.saveCancelled': 'Save cancelled',
  'error.saveError': 'Save error',
  'error.tempFileFailed': 'Could not create temp file',
  'error.captureFailed': 'Screen capture failed',
  'error.ocrNotReady': 'OCR not ready',
  'error.ocrError': 'OCR error',
  'error.textNotFound': 'No text found',
  'error.ocrImageTooLarge': 'Image is too large for OCR (max {limit} MB)',

  // OCR notifications
  'ocr.notifyDoneTitle': 'OCR Complete',
  'ocr.notifyErrorTitle': 'OCR Error',
  'ocr.copiedToClipboard': 'Text copied! ({chars} characters)',

  // Upload
  'upload.httpsRequired': 'Custom upload server must use HTTPS',
  'upload.invalidUrl': 'Upload server URL is invalid',
  'upload.tooLargeScreenshot': 'Screenshot too large (max {limit} MB)',
  'upload.tooLargeRecording': 'Recording too large (max {limit} MB)',
  'upload.failed': 'Upload failed',
  'upload.timedOut': 'Connection timed out',
  'upload.cantReach': 'Could not reach the server — check the URL and your connection',
  'upload.disconnected': 'Connection lost — try again',
  'upload.badRequest': 'Bad request',
  'upload.serverLimit': 'File exceeds server size limit',
  'upload.rateLimited': 'Too many requests — wait a bit and try again',
  'upload.serverError': 'Server error — try again later',
  'upload.unexpectedHttp': 'Unexpected error (HTTP {status})',
  'upload.invalidDataUrl': 'Invalid data URL',
  'upload.cantReadFile': 'Could not read file'
}

function getLang(): Lang {
  const lang = getSetting('language')
  return lang === 'en' ? 'en' : 'tr'
}

/**
 * Translate a key for the main process. Falls back to TR if a key is
 * missing in EN, and to the literal key if it's missing everywhere.
 * `params` substitutes `{name}` placeholders in the result.
 */
export function tMain(key: string, params?: Record<string, string | number>): string {
  const dict = getLang() === 'en' ? EN : TR
  let text = dict[key] ?? TR[key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v))
    }
  }
  return text
}
