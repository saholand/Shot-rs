# Technical Specification

## Önerilen stack
- Electron
- React
- TypeScript

## Ana mimari
- main process
- preload
- renderer
- shared types / utils

## Ana modüller
1. screenshot capture
2. selection overlay
3. annotation engine
4. recording workflow
5. export/save
6. clipboard
7. settings
8. history

## Mimari ilkeler
- main, preload ve renderer ayrımı korunmalı
- screenshot ve recording modülleri ayrı tutulmalı
- ortak yardımcı fonksiyonlar shared alanda olmalı
- güvenlik sınırları korunmalı

## V1 screenshot akışı
1. kullanıcı screenshot modunu başlatır
2. overlay açılır
3. alan seçilir
4. görsel PNG olarak alınır
5. clipboard veya dosyaya kaydedilir

## V1 recording akışı
1. kullanıcı recording modunu başlatır
2. ekran veya pencere seçer
3. kayıt başlar
4. kayıt durdurulur
5. video dosyası kaydedilir

## Riskler
- multi-monitor koordinatları
- DPI scaling
- global hotkey çakışmaları
- recording performansı
- export hataları