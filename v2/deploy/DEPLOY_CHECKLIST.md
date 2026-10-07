# Palmiye Home 2027 Website — DEPLOY CHECKLIST

> **Bu yalnız bir kontrol listesidir. Bu paket deploy EDİLMEDİ — Ali onayı olmadan hiçbir dosya yüklenmez.** Final `v1.0.0` ancak Helpy final QA'dan sonra oluşturulur; canlıya yalnız final paket çıkar.
> Sürüm / commit: `..\VERSION.txt` · Paket: `..\publish\` · Bütünlük: `..\checksums\SHA256SUMS.txt` · FileZilla adımları: `FILEZILLA_DEPLOY.md`
> Upload kaynağı yalnız `PalmiyeHome_2027_RELEASES\<APPROVED_VERSION>\publish` — asla `PalmiyeHome_Pro\publish`, `v2\public`, `CanliDosyalar` veya `_PalmiyeHome_2027_BASELINE\v2-build`.

## Sunucu yerleşimi (cPanel / GoDaddy)

| Ne | Nereye | Not |
|---|---|---|
| `publish\` **içeriği** (`.htaccess` dahil) | `/home/<cpanel-user>/public_html/` | Web kökü |
| Gerçek secret dosyası | `/home/<cpanel-user>/palmiye-secrets/.env.php` | **Web kökü DIŞI**, `chmod 600`, klasör `chmod 700`. Şablon: `env.example.php` |
| Selftest fixture'ları | `/home/<cpanel-user>/palmiye-release/selftest-fixtures/` | Web kökü dışı; yalnız test için |
| `SHA256SUMS.txt` | `/home/<cpanel-user>/palmiye-release/SHA256SUMS.txt` | Upload sonrası bütünlük kontrolü |
| Otomatik oluşanlar | `palmiye-secrets/telegram-state.json`, `palmiye-secrets/availability-cache/` | PHP oluşturur; yazılabilir olmalı |

`<cpanel-user>` gerçek kullanıcı adıyla değiştirilir. Aşağıdaki komutlarda `~` = `/home/<cpanel-user>`.

---

## Sıra

- [ ] **1. Mevcut canlı sunucunun tam yedeği (bitmeden upload YOK)**
  Canlı web kökünün tamamı FileZilla ile `D:\ProjelerFinal\WebProjesi\PalmiyeHome_2027_LIVE_BACKUPS\<YYYY-MM-DD>_before_<VERSION>` klasörüne indirilir (gizli dosyalar dahil); dosya sayısı + SHA-256 listesi kaydedilir — bkz. `FILEZILLA_DEPLOY.md` §1. Ek olarak mevcut secret klasörü. Veritabanı yok. `D:\ProjelerFinal\CanliDosyalar` legacy referanstır, kullanılmaz/değiştirilmez.

- [ ] **2. Gerçek Booking.com ICS secret provisioning**
  Booking extranet → Fiyatlar ve Müsaitlik → Takvim senkronizasyonu → **Dışa aktar** linki → `.env.php` içinde `PALMIYE_ICAL_BOOKING`. Link hiçbir yere (chat, e-posta, repo) yapıştırılmaz.

- [ ] **3. Gerçek Airbnb ICS secret provisioning**
  Airbnb → İlan → Müsaitlik → Takvimleri bağla → **Dışa aktar** → `PALMIYE_ICAL_AIRBNB`.
  (Üçüncü/Direct takvim YOK. WhatsApp/direct rezervasyon Booking veya Airbnb'de bloke edilir.)

- [ ] **4. Telegram token rotasyonu**
  @BotFather → `/revoke` (eski token eski sunucu dosyalarında ve yedekte vardı) → yeni token → `TELEGRAM_BOT_TOKEN`; `TELEGRAM_CHAT_ID` aynı.

- [ ] **5. Owner parola hash'i**
  `php -r "echo password_hash('UZUN-BIR-PAROLA', PASSWORD_DEFAULT), PHP_EOL;"` → çıktı `PALMIYE_AVAILABILITY_ADMIN_HASH`. Parolanın kendisi hiçbir dosyaya yazılmaz.
  Opsiyonel: `PALMIYE_GEOIP_DB` / `PALMIYE_GEOIP_READER` (yoksa Telegram'da "Konum bilinmiyor").

- [ ] **6. PHP syntax testi**
  ```
  php -v
  for f in $(find ~/public_html/api -name '*.php'); do php -l "$f"; done
  ```
  Beklenen: her dosya için `No syntax errors detected`. PHP ≥ 7.0; `curl`, `openssl`, `json`, `mbstring`, `session` eklentileri.
  (Yerelde PHP 8.3.35 ve 7.4.33 ile `v2/tools/test_php_local.py` 54/54 geçti; sunucunun kendi PHP sürümü yine burada doğrulanır.)

- [ ] **7. Availability selftest**
  ```
  php ~/public_html/api/availability-sync.php --selftest --fixtures=$HOME/palmiye-release/selftest-fixtures
  ```
  Beklenen: tüm satırlar `PASS`, son satır `SELFTEST OK` (son kontrol: `palmiye-secrets/availability-cache` yazılabilir).

- [ ] **8. Gerçek ICS sync**
  ```
  php ~/public_html/api/availability-sync.php --force
  ```
  Beklenen çıktı: `synced`. Sonra `ls -l ~/palmiye-secrets/availability-cache/state.json`.

- [ ] **9. Cron kurulumu**
  cPanel → Cron Jobs → her 20 dakika:
  `*/20 * * * * /usr/local/bin/php /home/<cpanel-user>/public_html/api/availability-sync.php >/dev/null 2>&1`
  (PHP yolu `which php` / cPanel'deki MultiPHP yoluna göre.) Doğrulama: 25 dk sonra `state.json` değişiklik zamanı ilerlemiş olmalı; health sayfasında "son başarılı" ≤ 20 dk.

- [ ] **10. Owner health kontrolü**
  `https://palmiyehomekemer.com/api/availability-health.php` → parola → Booking.com **OK**, Airbnb **OK**, son senkron birkaç dakika, durum `fresh`. "Şimdi senkronize et" çalışıyor. Sayfa linklenmez, arama motorunda görünmez (`noindex`).

- [ ] **11. Public availability endpoint**
  ```
  curl -sS -D - https://palmiyehomekemer.com/api/availability.json
  ```
  Beklenen: `200`, `Content-Type: application/json`, `Cache-Control: public, max-age=300…`, `ETag`; gövdede yalnız `version, status, last_successful_sync, booking_window, closed, ranges`. `status` = `fresh`, `booking_window` = `2027-01-01 → 2027-12-31`.
  Ek: `curl -o /dev/null -w "%{http_code}\n" https://palmiyehomekemer.com/api/availability-sync.php` → `404`.

- [ ] **12. Telegram tek gerçek mesaj smoke testi**
  Gizli pencereden siteyi bir kez aç → tek mesaj: `🌴 Yeni ziyaret · <şehir>, <ülke> · <DİL> · Ana sayfa`. Mesajda IP **yok**. 1 dk içinde ikinci ziyaret mesaj üretmemeli (sonraki mesajda `+N`).

- [ ] **13. Google Maps / Business link kontrolü**
  Place ID `ChIJUSR6qwe5wxQRbI8VsFX5buE` 2026-10-06'da doğrulandı (Palmiye Home · Günlük Kiralık Daire, 3270 Sokak, Göynük). Canlıda 4 dilde "Google Maps'te gör" → işletme kaydı, "Yol tarifi al" → varış "Palmiye Home"; harita yalnız "Haritayı göster" tıklamasıyla yükleniyor. Sitedeki kamu adresi (RC3'ten beri) GBP ile aynı: "3270 Sokak, Göynük, 07980 Kemer/Antalya" (kapı/blok ayrıntısı yayımlanmaz).

- [ ] **14. Basic Consent production testi**
  Temiz tarayıcı profili + DevTools Network: onay vermeden **Google'a 0 istek**, `_ga`/`_gcl` çerezi yok. "Kabul et" → gtag.js yüklenir. "Reddet" → çerezler silinir.

- [ ] **15. GA4 / Ads Tag Assistant**
  `AW-17307806485`, `G-6NK46VG4DY`. Kabul sonrası: WhatsApp / Booking / Airbnb tıklamaları → GA4 event + Ads dönüşümü (3 etiket). `booking_review_click`, `review_source_click`, `availability_check` → yalnız GA4. Ads panelinde değişiklik yapılmaz.

- [ ] **16. CSP / `.htaccess`**
  ```
  curl -sSI https://palmiyehomekemer.com/ | grep -iE "content-security|x-frame|x-content-type|referrer-policy|permissions-policy"
  curl -o /dev/null -w "%{http_code}\n" https://palmiyehomekemer.com/api/_lib/settings.json        # 403
  curl -o /dev/null -w "%{http_code}\n" https://palmiyehomekemer.com/api/_lib/bootstrap.php         # 403
  curl -sSI "https://palmiyehomekemer.com/?lang=tr" | grep -i location                             # /tr/ (301)
  curl -sSI https://palmiyehomekemer.com/assets/img/hero-pool-mountain-1200.avif | grep -i content-type   # image/avif
  ```
  Consent kabulünden sonra konsolda CSP ihlali olmamalı (gtag / Ads / GA4 / Maps).

- [ ] **16b. Booking window + havuz politikası**
  Takvimde 2027-01-01 … 2027-12-31 günleri feed'lere göre müsait/dolu; 2028-01-01 "henüz açılmadı" (yalnız çıkış günü olarak seçilebilir). Bugün booking window'dan önceyse takvim **Ocak 2027 + Şubat 2027** ile açılır (daha önceki aya geri gidilemez); pencere içindeyse içinde bulunulan ay. **Tarih seçilmeden** Booking/Airbnb linklerinde `checkin/checkout` · `check_in/check_out` parametresi YOK; giriş+çıkış seçilince yalnız seçilen tarihler + kişi sayısı eklenir. Havuz metni 4 dilde: sezonluk, 1 Haziran referans açılış tarihi (garanti değil), koşullar uygunsa daha erken açılabilir, rezervasyon öncesi güncel durum sorulabilir, daire yıl boyu rezerve edilebilir. OTA açıklamaları rapordaki "OTA POOL CONSISTENCY ACTION" metinleriyle uyumlu hale getirilir (Ali/Helpy, panelde). Havuz erken açılırsa: `config → pool.confirmed_opening_date` (+ `status: open`) → rebuild → yeni RC. Havuz bakımı/daire kapanışı Booking/Airbnb'de bloke edilir; sitede kod değişmez.

- [ ] **17. EN/TR/DE/RU smoke**
  `/`, `/tr/`, `/de/`, `/ru/` ve `privacy` sayfaları. Kök sayfa yönlendirme YAPMAZ (yalnız dil önerisi). Hero, 9.4 / 10, CTA → takvim, yorumlar, Maps, kanallar, footer.

- [ ] **18. Mobil test**
  Gerçek telefon (iOS Safari + Android Chrome): consent hero CTA'sını örtmüyor, menü, takvim seçimi, WhatsApp mesajına tarih geçişi. Türkiye'den (VPN kapalı) kanal sırası WhatsApp → Airbnb → Booking + not, yorumlar bölümünde "Tüm yorumları Booking.com'da okuyun" altında küçük erişim notu; `?ph_market=intl` ile nötr sıra ve not yok. Plaj: yalnız "Yaklaşık 2 km" (yürüme süresi vaadi yok).

- [ ] **19. PageSpeed**
  https://pagespeed.web.dev — mobil + masaüstü: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1.

- [ ] **20. Secret exposure scan**
  ```
  cd ~/palmiye-release && (cd ~/public_html && sha256sum -c ~/palmiye-release/SHA256SUMS.txt) | grep -v ': OK$'   # boş olmalı
  grep -rlE "PALMIYE_ICAL_[A-Z]+', *'https|TELEGRAM_BOT_TOKEN', *'[0-9]" ~/public_html                        # boş olmalı
  curl -s https://palmiyehomekemer.com/api/availability.json | grep -Ei "ical|hoteladmin|calendar/ical|@|\+90"  # boş olmalı
  ls -la ~/public_html | grep -i "env"                                                                          # .env.php OLMAMALI
  ```

- [ ] **21. Legacy server cleanup — YALNIZ 1–20 PASS olduktan sonra**
  Ayrı onayla: eski `/lang/`, `/cgi-bin/`, eski ziyaretçi/IP ve kilit dosyaları, eski 9.6 görselleri, eski `data/bookings.js`, eski `api/config/` secret kopyaları. Silmeden önce yedek (madde 1) doğrulanmış olmalı.

---

## Final release'e terfi (yalnız hepsi PASS ise)

Final `v1.0.0`, Helpy'nin onayladığı RC ile **aynı commit** ve **byte-identical site** olmalıdır. Kod/metin değişirse yeni RC gerekir.

1. Helpy final visual QA PASS (onaylanan RC: örn. `v1.0.0-rc4`).
2. Aynı commit'te (çalışma ağacı temiz, `v2/src/BUILD_DATE` = RC'nin build tarihi):
   ```
   python v2/tools/package_release.py --version 1.0.0 --date 2026-10-07 --root D:\ProjelerFinal\WebProjesi\PalmiyeHome_2027_RELEASES --same-as D:\ProjelerFinal\WebProjesi\PalmiyeHome_2027_RELEASES\2026-10-07_v1.0.0-rc4
   ```
   `--same-as`: yeni `SHA256SUMS.txt` onaylı RC ile byte-identical değilse paket silinir ve işlem durur.
   Hedef: `D:\ProjelerFinal\WebProjesi\PalmiyeHome_2027_RELEASES\2026-10-07_v1.0.0\publish`
3. Annotated local tag `palmiye-home-2027-v1.0.0` (aynı commit). Push ayrıca kararlaştırılır.
4. Deploy: `FILEZILLA_DEPLOY.md`. Sonra `DEPLOYMENT_HISTORY.md` (append) + `PRODUCTION_POINTER.json`.
