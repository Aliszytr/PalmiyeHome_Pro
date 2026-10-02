# 🚀 DEPLOY REHBERİ — palmiyehomekemer.com
**Tarih:** 2026-04-24
**Sprint:** 1 (Conversion tracking) + 1.5 (Consent Mode v2) + 2a (SEO meta) + 2b (Sitemap)

---

## 🎯 ÖZET — Ne Değişti?

| Dosya | Durum | Özet |
|---|---|---|
| `tracking.js` | **YENİ** | Google Ads conversion tracking modülü |
| `index.html` | Güncel | gtag + Consent Mode v2 <head>, tracking.js <body> |
| `privacy.html` | Güncel | gtag + Consent Mode v2 <head>, tracking.js <body> |
| `404.html` | Güncel | gtag + Consent Mode v2 <head>, tracking.js <body> |
| `script.js` | Güncel | Dinamik meta güncelleme + Consent Mode v2 update on accept/decline |
| `sitemap.xml` | Güncel | 5 URL (EN+TR+RU+DE+privacy), lastmod 2026-04-24 |
| `lang/en.json` | Güncel | `meta` bölümü eklendi |
| `lang/tr.json` | Güncel | `meta` bölümü eklendi (TR SEO keywords) |
| `lang/ru.json` | Güncel | `meta` bölümü eklendi (RU SEO keywords) |
| `lang/de.json` | Güncel | `meta` bölümü eklendi (DE SEO keywords) |

**DEĞİŞMEYENLER** (bozulmadı): `style.css`, `analytics.js`, `booking-redirect.js`, `.htaccess`, `robots.txt`, `manifest.json`, `data/`, `assets/`, `Logo/`, `Pictures/`, `Resimler/`, `admin/`, `api/`.

---

## ⏳ YAYINLAMA ÖNCESİ — ZORUNLU TEK ADIM

### Google Ads Conversion Label'larını `tracking.js`'e yaz

Şu an `tracking.js` dosyasının 41-45. satırlarında **placeholder**'lar var:

```javascript
var CONVERSIONS = {
  whatsapp: AW_ID + '/XXXXXXX',   // TODO: WhatsApp Click label
  booking:  AW_ID + '/YYYYYYY',   // TODO: Booking.com Click label
  airbnb:   AW_ID + '/ZZZZZZZ'    // TODO: Airbnb Click label
};
```

**Yapılacak:**
1. Google Ads → Hedefler → Dönüşümler
2. Her dönüşüm eylemine tıkla → "Tag kurulumu" / "Etiketi kendin yükle"
3. Gördüğün `'send_to': 'AW-17307806485/XyZ...'` değerini yukarıdaki objeye yapıştır
4. 3 dönüşümün label'ını doldur, `tracking.js`'i kaydet

**Eğer bu adımı atlarsan:** Site çalışır, hiçbir şey bozulmaz — sadece Google Ads'e conversion gitmez. Console'da uyarı görürsün. Label'ları sonra girdiğinde otomatik devreye girer.

---

## 📤 YAYINLAMA — FTP/cPanel Upload Adımları

### Seçenek A — cPanel File Manager
1. GoDaddy cPanel → **File Manager** → `public_html/` klasörüne git
2. Aşağıdaki dosyaları YENİ sürümle **OVERWRITE** et (eski dosyaları sil, yenilerini yükle):
   - `index.html`
   - `privacy.html`
   - `404.html`
   - `script.js`
   - `sitemap.xml`
   - `lang/en.json`
   - `lang/tr.json`
   - `lang/ru.json`
   - `lang/de.json`
3. **YENİ DOSYA** ekle:
   - `tracking.js` (label'lar yazılmış hali)
4. Upload bittikten sonra **browser cache'i temizle** ya da **Incognito** ile aç

### Seçenek B — FTP (FileZilla vb.)
1. FTP bağlantısı kur (cPanel > FTP Accounts)
2. Aşağıdaki dosyaları siteye yükle (hedef: `public_html/`)
3. Bu paket içindeki dizin yapısı aynen kopyalanmalı (`lang/` klasörü içindekiler yerinde kalacak)

---

## ✅ YAYIN SONRASI DOĞRULAMA — 7 ADIMLIK KONTROL LİSTESİ

### 1. Tag yüklemesi (Chrome Incognito)
- https://palmiyehomekemer.com adresine git
- F12 → Console tab
- Sayfa yüklendiğinde şu çıktıları görmelisin:
  ```
  [AdsConv] Ready — WhatsApp / Booking / Airbnb Ads conversion tracking active
  [SmartRedirect] Initialized — Booking & Airbnb smart redirect active
  ```
- Label doldurulduysa:
  ```
  (hiç uyarı yok — sessiz başarı)
  ```
- Label doldurulmadıysa:
  ```
  [AdsConv] Yapılandırma: 0 hazır, 3 label eksik (placeholder).
  ```

### 2. Consent Mode v2 doğrulama
- Console'da yaz: `dataLayer.filter(x => x[0]==='consent')` → `default: denied` görmelisin
- Cookie notice'te **Accept**'e bas
- Tekrar yaz: en son `consent update: granted` görmelisin

### 3. Dinamik meta doğrulama (EN)
- Sayfa başlığı: `Palmiye Home — Pool Apartment in Kemer Göynük, Antalya | Book Direct`
- View Source → `<title>` ve `<meta name="description">` aynı olmalı

### 4. Dinamik meta doğrulama (TR)
- `https://palmiyehomekemer.com/?lang=tr` adresine git
- Sayfa başlığı: `Kemer Göynük Havuzlu Tatil Dairesi | Palmiye Home — Direkt Rezervasyon`
- F12 → Elements → `<title>` içeriği otomatik değişmiş olmalı
- `<meta name="description">` içeriği: "Kemer Göynük'te havuzlu..." ile başlamalı

### 5. Conversion tracking testi (label'lar yazıldıysa)
- Console: `PALMIYE_ADS_CONV.test()`
- 3 satır: `✅ Conversion fired → whatsapp`, `→ booking`, `→ airbnb`
- **Google Tag Assistant** eklentisi aç → AW-17307806485 "Working" olmalı

### 6. Gerçek tıklama testi
- WhatsApp butonuna tıkla (yeni sekmede WhatsApp açılmalı)
- Console'da: `✅ Conversion fired → whatsapp`
- Booking butonuna tıkla → smart redirect + conversion
- Airbnb butonuna tıkla → aynı

### 7. Sitemap erişimi
- `https://palmiyehomekemer.com/sitemap.xml` adresine git
- 5 URL görmelisin (EN, TR, RU, DE, Privacy)
- lastmod: `2026-04-24`

---

## 📊 GOOGLE ADS'DE DOĞRULAMA (3-24 saat içinde)

1. Google Ads → Hedefler → Dönüşümler
2. 3 dönüşüm eyleminin "Durumu" sütunu:
   - İlk saatlerde: **"Son zamanlarda herhangi bir dönüşüm kaydedilmedi"**
   - İlk tıklamadan sonra: **"Dönüşüm kaydetme"** (verifying)
   - 1-2 gün sonra: **"Etkin"**
3. "Tüm dönüşümler" sütununda sayı artmalı

---

## 🔗 SEARCH CONSOLE & SITEMAP GÖNDERİMİ

### Google Search Console (kritik!)
1. https://search.google.com/search-console → palmiyehomekemer.com property
2. Sol menü → **Sitemaps**
3. **Yeni site haritası ekle**: `sitemap.xml` yaz → **Gönder**
4. 24 saat içinde "Başarılı" olmalı

### Bing Webmaster Tools (DE pazarı için önemli)
1. https://www.bing.com/webmasters → Add Site
2. Verify (HTML tag veya DNS)
3. Sitemap gönder: `https://palmiyehomekemer.com/sitemap.xml`

### Yandex Webmaster (RU pazarı için kritik)
1. https://webmaster.yandex.com → Add Site
2. Verify
3. Sitemap gönder

---

## ⚠️ YAYIN SONRASI 7-14 GÜN — GOOGLE ADS STRATEJİSİ

### YAPILACAK
- Mevcut "Maksimum Tıklama" bid stratejisinde kal
- Günlük bütçeyi değiştirme
- Conversion datası biriksin (hedef: 15 conversion)

### YAPILMAYACAK (Google önerse bile!)
- ❌ "Bütçenizi ayarlayın" butonuna basma
- ❌ Smart Bidding (Target CPA / Maximize Conversions) henüz seçme
- ❌ Kampanyada major değişiklik yapma

### 15 Conversion Sonrası
- Smart Bidding'e geç: **Maximize Conversions**
- 30-50 conversion sonrası: **Target CPA** (hedef: WhatsApp için €30, Booking/Airbnb için €20)

---

## 🎯 SONRAKİ ADIMLAR (Sprint 3+)

Bu deploy ile Sprint 1 + 1.5 + 2 bitti. Sonrası için:

1. **Google Business Profile optimize** — Map pack için kritik (EN YÜKSEK LEVERAGE)
2. **Instagram business hesabı** + içerik takvimi
3. **Image optimization** — og-image.jpg ve gallery WebP'e çevirme
4. **Blog bölümü** — long-tail SEO için
5. **Review schema dinamikleştirme** — Booking'den review sync

Detay için `RAKIP-ANALIZI.md` dosyasına bak.

---

## 🆘 SORUN GİDERME

### `[AdsConv] gtag global bulunamadı` uyarısı
- `<head>` içindeki gtag script'i doğru mu yüklenmiş? View Source'ta kontrol et
- Ad blocker gtag.js'yi bloklamış olabilir — Incognito'da dene

### Sayfa açılmıyor / 500 hatası
- `.htaccess` hasar görmüş olabilir → yüklemedik, değişmedi. Ama yine de kontrol et
- File permissions: HTML 644, JS/CSS 644, klasörler 755

### TR başlık İngilizce görünüyor
- `?lang=tr` ile mi açtın? Default EN.
- localStorage temizle: `localStorage.removeItem('palmiye_lang')` → sayfa yenile

### Cookie banner gözükmüyor
- `localStorage.removeItem('palmiye_cookies')` → yenile

---

## 📞 DEĞİŞİKLİK LİSTESİ — ROLLBACK İÇİN

Eğer bir şey kırılırsa, **eski zip'i geri yükle**: `PalmiyeHome_Pro_yayınydk.zip` — GoDaddy File Manager'dan dosyaları OVERWRITE et. Ama bu sprint'te **çalışan hiçbir kod değiştirilmedi, sadece eklendi** (rule #5 uyumu), dolayısıyla rollback ihtimali düşük.
