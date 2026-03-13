# Proje: Shotline — Masaüstü Screenshot ve Screen Recording Uygulaması

## Amaç
Bu proje (Shotline), hızlı ve hafif çalışan bir masaüstü ekran yakalama uygulaması üretir.

İlk hedef:
- global kısayol ile açılma
- ekrandan alan seçme
- seçilen alanı PNG olarak alma
- panoya kopyalama
- dosyaya kaydetme
- ekran veya pencere kaydı başlatma
- video kaydetme

Daha sonra:
- anotasyon araçları
- blur
- geçmiş
- upload / paylaşım linki
- OCR
- ayarlar

## Ürün modülleri
Bu proje iki ana yakalama modülüne sahiptir:
1. Screenshot
2. Screen Recording

Her modül kendi akışı ve durum yönetimi ile ele alınmalıdır.

Ortak alanlar:
- source selection
- save/export
- history
- settings

## Temel çalışma kuralları
1. Her yeni özellikte önce plan çıkar.
2. Doğrudan büyük çaplı refactor yapma.
3. Önce minimal çalışan çözüm üret, sonra iyileştir.
4. Main, preload ve renderer sorumluluklarını karıştırma.
5. Renderer tarafına doğrudan Node erişimi verme.
6. Güvenlik sınırlarını koru.
7. Her görev sonunda:
   - değişen dosyaları listele
   - ne yaptığını özetle
   - test adımlarını yaz
   - bilinen limitleri belirt

## Kodlama yaklaşımı
- TypeScript strict mode tercih edilir.
- Modüler yapı korunur.
- Küçük ve anlaşılır dosyalar tercih edilir.
- Gerekmedikçe yeni bağımlılık eklenmez.
- UI hızlı ve sade tutulur.

## Öncelik sırası
1. Screenshot capture
2. Screenshot annotation
3. Screen recording core
4. Recording enhancements
5. History / share / OCR / blur

## Mimari kural
Screenshot ve recording kodları birbirine karıştırılmamalıdır.
Ortak utility'ler shared modüllerde tutulmalıdır.

## Görev disiplini
Her feature için şu sırayı izle:
1. Etkilenecek dosyaları belirt
2. Uygulama planını yaz
3. Edge case'leri yaz
4. Test planını yaz
5. Sonra implementasyona geç

## Yasaklar / guardrails
- Kullanıcı onayı olmadan yıkıcı komut çalıştırma
- Büyük dosya silme / taşıma işlemlerini tek seferde yapma
- Secrets, .env ve private config dosyalarını ifşa etme
- Aynı anda çok fazla mimari karar verme

## Beklenen çıktı formatı
Her görev sonunda şu başlıklarla rapor ver:
- Yapılan değişiklikler
- Değişen dosyalar
- Test adımları
- Açık riskler
- Sonraki önerilen adım