# Skill: Recording Workflow

## Amaç
Uygulamanın ekran kaydı özelliklerini modüler ve genişletilebilir şekilde tasarlamak.

## Temel hedefler
1. Kullanıcı tüm ekran, pencere veya bölge kaydı başlatabilmeli.
2. Kayıt başlat, durdur ve gerektiğinde pause/resume akışları net olmalı.
3. Video çıktısı güvenli şekilde dosyaya kaydedilmeli.
4. Screenshot mimarisi ile recording mimarisi birbirine karışmamalı.
5. Recording özellikleri performans ve hata yönetimi düşünülerek tasarlanmalı.

## Tasarım ilkeleri
- Recording logic ayrı modülde tutulmalı.
- Source selection açık ve test edilebilir olmalı.
- Ses kaynakları ayrı ayrı ele alınmalı.
- Kayıt kontrolleri UI'dan bağımsız düşünülmeli.
- Hata durumlarında güvenli fallback olmalı.

## V1 kapsamı
- ekran veya pencere kaydı
- başlat / durdur
- video dosyasını kaydetme

## V1.5 kapsamı
- bölge kaydı
- mikrofon desteği
- pause / resume

## Beklenen çıktı
- recording veri akışı
- source selection yaklaşımı
- state modeli
- export/kayıt yaklaşımı
- edge case listesi
- test adımları