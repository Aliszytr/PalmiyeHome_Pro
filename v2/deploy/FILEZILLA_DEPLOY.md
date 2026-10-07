# Palmiye Home 2027 — FILEZILLA DEPLOY

> **Bu belge yalnız prosedürdür. Bu belgeyi içeren paket kendiliğinden deploy EDİLMEZ.**
> Upload yalnız: Helpy final QA PASS + Ali'nin açık onayı + final `v1.0.0` paketi oluşturulduktan sonra yapılır.
> Bu paketin sürümü / commit'i: `..\VERSION.txt` · Bütünlük: `..\checksums\SHA256SUMS.txt`

## 0. Tek kural: upload kaynağı

Production upload **yalnız** onaylı immutable release klasöründen yapılır:

```
D:\ProjelerFinal\WebProjesi\PalmiyeHome_2027_RELEASES\<APPROVED_VERSION>\publish
```

Upload kaynağı **ASLA** şunlar değildir:

| Klasör | Neden |
|---|---|
| `D:\ProjelerFinal\WebProjesi\PalmiyeHome_Pro\publish` | Legacy V1 yayın klasörü |
| `D:\ProjelerFinal\WebProjesi\PalmiyeHome_Pro\v2\public` | Kaynak/build çalışma alanı (değişebilir, test edilmiş paket değil) |
| `D:\ProjelerFinal\CanliDosyalar` | Eski canlı kopya — yalnız legacy/referans, dokunulmaz |
| `D:\ProjelerFinal\WebProjesi\_PalmiyeHome_2027_BASELINE\v2-build` | QA arşivi, kaynak değil |
| `PalmiyeHome_2027_RELEASES\...-rcN\publish` | Release candidate; final terfi edilmeden canlıya çıkmaz |

## 1. PRE-DEPLOY — canlı sitenin TAM yedeği (bitmeden upload YOK)

1. Yedek klasörünü oluştur (tarih = deploy günü, sürüm = yüklenecek sürüm):

   ```
   D:\ProjelerFinal\WebProjesi\PalmiyeHome_2027_LIVE_BACKUPS\<YYYY-MM-DD>_before_<VERSION>
   ```
   Örnek: `D:\ProjelerFinal\WebProjesi\PalmiyeHome_2027_LIVE_BACKUPS\2026-10-07_before_v1.0.0`

2. FileZilla → sunucuya bağlan → sağ panelde canlı web kökünü aç (mevcut canlı `index.html`'in bulunduğu dizin, cPanel'de genelde `/public_html`).
   Sol panelde 1. adımdaki boş yedek klasörünü aç.
3. FileZilla ayarı: **Görünüm → Gizli dosyaları göster** açık (`.htaccess` dahil olsun). Aktarım türü: **Binary** (Aktarım → Aktarım türü → İkili).
4. Sağ panelde web kökünün **içindeki her şeyi** seç (Ctrl+A) → **İndir**.
5. Aktarım kuyruğunda **Başarısız aktarım = 0** olmalı. Başarısız varsa tekrar indir.
6. Yedeği kaydet (PowerShell, yedek klasöründe):

   ```powershell
   $b = "D:\ProjelerFinal\WebProjesi\PalmiyeHome_2027_LIVE_BACKUPS\<YYYY-MM-DD>_before_<VERSION>"
   (Get-ChildItem $b -Recurse -File -Force | Measure-Object Length -Sum) | Format-List Count,Sum
   Get-ChildItem $b -Recurse -File -Force | Get-FileHash -Algorithm SHA256 |
     ForEach-Object { "{0}  {1}" -f $_.Hash.ToLower(), $_.Path.Substring($b.Length + 1).Replace('\','/') } |
     Set-Content "$b.SHA256SUMS.txt" -Encoding utf8
   ```
   Dosya sayısını FileZilla'daki sunucu dosya sayısıyla karşılaştır (sağ panel alt satırı). `DEPLOYMENT_HISTORY.md`'ye yedek yolunu, dosya sayısını ve toplam boyutu yaz.
7. **Yedek tamamlanıp kaydedilmeden upload başlatma.**

Eski `D:\ProjelerFinal\CanliDosyalar` klasörü silinmez/değiştirilmez; yeni deploylarda her zaman tarihli yeni yedek kullanılır.

## 2. UPLOAD

Final onaydan sonra bu iki satır doldurulur ve Ali'ye **tek bakışta** gösterilir:

```
FILEZILLA LOCAL SOURCE:
D:\ProjelerFinal\WebProjesi\PalmiyeHome_2027_RELEASES\2026-10-07_v1.0.0\publish

REMOTE TARGET:
palmiyehomekemer.com mevcut web kökü (mevcut canlı index.html'in bulunduğu dizin, örn. /public_html)
```

1. Sol panel: **FILEZILLA LOCAL SOURCE** klasörünün **içi** (`index.html`, `.htaccess`, `assets`, `api`, `tr`, `de`, `ru`, … görünmeli).
2. Sağ panel: **REMOTE TARGET** (canlı `index.html`'in olduğu dizin).
3. Sol panelde **publish'in içindeki her şeyi** seç → **Yükle**. Aynı ad sorulursa: **Üzerine yaz** (+ "Her zaman bu işlemi kullan").

> **ÖNEMLİ:** `publish` KLASÖRÜNÜN KENDİSİNİ yükleme (yanlış sonuç: `/public_html/publish/index.html`).
> `publish` klasörünün **İÇERİĞİNİ** web köküne yükle (doğru sonuç: `/public_html/index.html`).

4. Kuyrukta **Başarısız aktarım = 0**.
5. Secret dosyası (`palmiye-secrets/.env.php`) web kökünün **dışına** ayrı yüklenir — bkz. `DEPLOY_CHECKLIST.md` (yerleşim tablosu). `deployment\` klasörü web köküne yüklenmez.
6. Bu aşamada **eski dosyalar silinmez** (legacy temizlik en sonda, ayrı onayla).

## 3. POST-DEPLOY kontrolleri

Ayrıntılı komutlar: `DEPLOY_CHECKLIST.md`. Hepsi PASS olmalı:

- [ ] Ana sayfa açılıyor (`https://palmiyehomekemer.com/`), yeni sürüm (footer/sitemap `lastmod` = paket build tarihi)
- [ ] EN `/` · TR `/tr/` · DE `/de/` · RU `/ru/`
- [ ] Privacy: `/privacy`, `/tr/privacy`, `/de/privacy`, `/ru/privacy`
- [ ] Assets: hero görseli, CSS, JS, favicon (DevTools Network'te 404 yok)
- [ ] API: `/api/availability.json` → 200 JSON; `/api/availability-sync.php` → 404; `/api/_lib/settings.json` → 403
- [ ] Maps: "Google Maps'te gör" / "Yol tarifi al" → Palmiye Home işletme kaydı; harita yalnız tıklayınca yükleniyor
- [ ] Availability: takvim Ocak 2027'den açılıyor (2027 öncesi), gerçek feed'ler; tarih seçmeden Booking/Airbnb linklerinde tarih parametresi yok
- [ ] Consent: onay öncesi Google'a 0 istek, `_ga`/`_gcl` çerezi yok; kabul sonrası gtag
- [ ] Booking / Airbnb / WhatsApp butonları doğru hedefe gidiyor (tarih seçiliyken doğru tarih + kişi)
- [ ] PHP health: `/api/availability-health.php` → Booking OK, Airbnb OK, `fresh`
- [ ] Cron: 20 dk'da bir sync çalışıyor (25 dk sonra `state.json` zamanı ilerlemiş)
- [ ] Secret scan (sunucuda `.env` web kökünde yok, JSON'da ICS/token yok)
- [ ] Checksum: sunucudaki dosyalar `checksums\SHA256SUMS.txt` ile aynı (`sha256sum -c` → yalnız `OK`)

## 4. Kayıt

Hepsi PASS olduktan sonra:
1. `D:\ProjelerFinal\WebProjesi\PalmiyeHome_2027_RELEASES\DEPLOYMENT_HISTORY.md` → **sona** yeni kayıt ekle (eski kayıtlar değiştirilmez).
2. `D:\ProjelerFinal\WebProjesi\PalmiyeHome_2027_RELEASES\PRODUCTION_POINTER.json` → yeni canlı sürümle güncelle (`production_version`, `production_tag`, `production_commit`, `release_root`, `publish_path`, `deployed_at`, `pre_deploy_backup_path`, `post_deploy_checksum_status`).

## 5. Legacy temizlik — EN SON

Eski dosyalar (`/lang/`, `/cgi-bin/`, eski kilit/IP dosyaları, eski `data/bookings.js`, eski `api/config/` secret kopyaları, eski görseller) **yalnız** yeni production'ın tüm post-deploy kontrolleri PASS olduktan ve yedek doğrulandıktan sonra, ayrı onayla silinir.

## Geri dönüş (rollback)

Bir sorun çıkarsa: 1. adımdaki tarihli yedek klasörünün **içeriği** aynı yöntemle web köküne geri yüklenir; `DEPLOYMENT_HISTORY.md`'ye rollback kaydı eklenir ve `PRODUCTION_POINTER.json` önceki sürüme döndürülür.
