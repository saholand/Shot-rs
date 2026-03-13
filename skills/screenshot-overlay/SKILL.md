# Skill: Screenshot Overlay

## Amaç
Fullscreen seçim ekranını doğru ve test edilebilir şekilde kurmak.

## Gereksinimler
1. Kullanıcı sürükleyerek dikdörtgen alan seçebilmeli.
2. Seçim dışı alan karartılmalı.
3. ESC iptal etmeli.
4. Enter geçerli seçim varsa onaylamalı.
5. Koordinatlar ekran uzayında doğru dönmeli.

## Tasarım ilkeleri
- Overlay kodu anotasyondan ayrı olsun.
- Seçim mantığı sade tutulmalı.
- Multi-monitor ve DPI senaryoları düşünülmeli.
- Mouse olayları tek merkezden yönetilmeli.

## Çıktı beklentisi
- veri modeli
- event akışı
- coordinate açıklaması
- edge case listesi
- test adımları