# Recoru

Akor sitelerinde (hakoru.com, repertuarim.com) şarkı çalarken ses kayıtlarını yerel olarak sakla.

## Kurulum (3 adım)

1. `chrome://extensions` adresini aç
2. Sağ üstteki **Developer mode** toggleını aç
3. **Load unpacked** butonuna tıkla → `recoru/` klasörünü seç

## Kullanım

- hakoru.com veya repertuarim.com'da bir akor sayfası aç
- Sağ üstteki **Recoru** ikonuna tıkla
- Kaydın adını yaz → **Kayıt Başlat** → çal → **Durdur**
- Tüm kayıtlar tarayıcında yerel olarak saklanır, hiçbir şey internete gitmez

## Desteklenen Siteler

| Site | URL Formatı |
|------|------------|
| hakoru.com | `/akorlar/{slug}` |
| repertuarim.com | `/akor/{slug}.html` |
