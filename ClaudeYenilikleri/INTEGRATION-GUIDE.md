# 🌴 Palmiye Home Pro — Entegrasyon Rehberi

Bu dosya, projenize eklenen tüm profesyonel iyileştirmeleri ve bunları nasıl entegre edeceğinizi adım adım açıklar.

---

## 📁 Dosya Listesi ve Nereye Koyulacağı

```
palmiyehome.com/
├── index.html              ← Mevcut (aşağıdaki değişiklikleri uygulayın)
├── style.css               ← YENİ VERSİYON (eskisinin üzerine yapıştırın)
├── script.js               ← YENİ VERSİYON (eskisinin üzerine yapıştırın)
├── bookings-source.js      ← YENİ VERSİYON (eskisinin üzerine yapıştırın)
├── robots.txt              ← YENİ VERSİYON (eskisinin üzerine yapıştırın)
├── sitemap.xml             ← YENİ VERSİYON (eskisinin üzerine yapıştırın)
├── netlify.toml            ← YENİ DOSYA (kök dizine koyun)
├── _redirects              ← YENİ DOSYA (kök dizine koyun)
├── _headers                ← YENİ DOSYA (kök dizine koyun)
├── manifest.json           ← YENİ DOSYA (kök dizine koyun)
├── 404.html                ← YENİ DOSYA (kök dizine koyun)
├── head-meta.html          ← SNIPPET (index.html'e entegre edin, sonra silin)
├── snippet-reviews.html    ← SNIPPET (index.html'e entegre edin, sonra silin)
├── snippet-body-extras.html← SNIPPET (index.html'e entegre edin, sonra silin)
├── admin/
│   └── index.html          ← YENİ VERSİYON (eskisinin üzerine yapıştırın)
├── data/
│   └── bookings.json       ← YENİ DOSYA (data klasörüne koyun)
├── lang/
│   ├── en.json             ← Mevcut (dokunmayın)
│   ├── tr.json             ← Mevcut (dokunmayın)
│   ├── ru.json             ← Mevcut (dokunmayın)
│   └── de.json             ← YENİ DOSYA (lang klasörüne koyun)
└── netlify/
    └── functions/
        ├── bookings.js     ← YENİ DOSYA
        └── admin-save.js   ← YENİ DOSYA
```

---

## 🔧 Adım Adım Entegrasyon

### Adım 1: Doğrudan Değiştirilen Dosyalar (Üzerine Yapıştır)
Bu dosyaları doğrudan eski versiyonların yerine kopyalayın:
- `style.css`
- `script.js`
- `bookings-source.js`
- `admin/index.html`

### Adım 2: Yeni Dosyalar (Kopyala-Yapıştır)
Bu dosyaları belirtilen konumlara koyun:
- `netlify.toml` → kök dizin
- `_redirects` → kök dizin
- `_headers` → kök dizin
- `manifest.json` → kök dizin
- `404.html` → kök dizin
- `data/bookings.json` → data/ klasörü
- `lang/de.json` → lang/ klasörü
- `netlify/functions/bookings-api.js` → netlify/functions/ klasörüne **bookings.js** olarak koyun
- `netlify/functions/admin-save-api.js` → netlify/functions/ klasörüne **admin-save.js** olarak koyun

### Adım 3: Ana index.html Düzenlemeleri

#### 3a. HEAD bölümüne SEO meta tag'leri ekleyin
`head-meta.html` dosyasının içeriğini ana `index.html`'in `<head>` bölümüne,
mevcut `<meta charset>` ve `<meta viewport>` taglarından SONRA yapıştırın.

**ÖNEMLİ:** Ana sayfadaki `<meta name="robots" content="noindex, nofollow">` satırını KALDIRIN!
(Bu sadece admin panelinde olmalı.)

#### 3b. Guest Reviews bölümünü ekleyin
`snippet-reviews.html` dosyasının içeriğini, booking-trust bölümünden SONRA yapıştırın.

#### 3c. Body Extra öğelerini ekleyin
`snippet-body-extras.html` dosyasındaki kodları `</body>` kapanış tagından ÖNCE yapıştırın.

#### 3d. Skip-to-content link'i ekleyin
`<body>` açılış tagından hemen sonra ekleyin:
```html
<a href="#hero" class="skip-to-content">Skip to content</a>
```

#### 3e. Lightbox'a ARIA ekleyin
Mevcut lightbox div'ine aria-hidden ekleyin:
```html
<div id="lightbox" class="lightbox" aria-hidden="true" role="dialog" aria-label="Image viewer">
```

#### 3f. Urgency Badge'i Takvime ekleyin
`#availability` section içindeki `.calendar-cta` div'ine ekleyin:
```html
<span class="urgency-badge" id="urgency-badge" style="display:none"></span>
```

#### 3g. Almanca dil butonu ekleyin
Navbar'daki `.lang-switcher` bölümüne ekleyin:
```html
<button class="lang-btn" data-lang="de">DE</button>
```

### Adım 4: Değiştirilmesi Gereken Yer Tutucular

Bu dosyalardaki yer tutucuları kendi bilgilerinizle değiştirin:

| Yer Tutucu | Nerede | Ne İle Değiştirilecek |
|---|---|---|
| `905XXXXXXXXX` | Birçok dosya | Gerçek WhatsApp numaranız |
| `G-XXXXXXXXXX` | snippet-body-extras.html | Google Analytics ID |
| `XXXXXXXX` | head-meta.html | Airbnb listing ID |
| `info@palmiyehome.com` | head-meta.html | Gerçek e-posta adresiniz |
| `og-image.jpg` | head-meta.html | 1200x630px sosyal medya görseli |

### Adım 5: Gerekli Görseller (Oluşturmanız Gereken)

1. **og-image.jpg** (1200x630px) — Sosyal medya paylaşım görseli
   - Havuz ve daire fotoğrafı, logo, "Kemer, Antalya" yazısı
   - `Pictures/` klasörüne koyun

2. **icon-192.png** ve **icon-512.png** — PWA ikonları
   - Logonuzdan oluşturun
   - `Logo/` klasörüne koyun

3. **apple-touch-icon.png** (180x180px) — iOS bookmark ikonu
   - `Logo/` klasörüne koyun

---

## ✅ Eklenen Profesyonel Özellikler

### SEO & Pazarlama
- [x] Open Graph meta tag'leri (WhatsApp, Facebook, Instagram paylaşımları)
- [x] Twitter Card meta tag'leri
- [x] Schema.org VacationRental yapısal veri (Google zengin sonuçlar)
- [x] Canonical URL ve hreflang (çoklu dil SEO)
- [x] Profesyonel sitemap.xml
- [x] Doğru robots.txt
- [x] PWA manifest.json

### Dönüşüm Optimizasyonu
- [x] Takvimden tarih seçerek WhatsApp'a otomatik mesaj
- [x] Urgency badge (otomatik hesaplanan müsaitlik uyarısı)
- [x] Misafir yorumları carousel'i
- [x] Google Analytics tracking altyapısı (WhatsApp, Booking.com, Airbnb)
- [x] Cookie notice (GDPR uyumu)

### Yeni Dil: Almanca
- [x] Tam Almanca çeviri (de.json)
- [x] Takvim Almanca ay/gün isimleri
- [x] Almanca otomatik dil algılama

### Erişilebilirlik (a11y)
- [x] Skip-to-content link'i
- [x] Focus-visible stilleri
- [x] Lightbox focus trap ve ARIA attribute'ları
- [x] Lightbox resim sayacı
- [x] Reduced motion desteği
- [x] Print stilleri

### Performans
- [x] Lazy image loading CSS desteği
- [x] Booking data race condition düzeltildi
- [x] Cache-Control header'ları
- [x] Preconnect hint'leri

### Güvenlik
- [x] Netlify security header'ları (CSP, HSTS, X-Frame-Options vb.)
- [x] Admin save endpoint'i origin kontrolü
- [x] Admin save endpoint'i input validasyonu

### Admin Paneli
- [x] Görsel tarih seçicili booking yönetimi
- [x] JSON düzenleyici (gelişmiş kullanıcılar için)
- [x] İstatistik dashboard (toplam rez, dolu gün, doluluk %)
- [x] Otomatik tarih sıralama
- [x] Çakışma kontrolü (görsel uyarı)
- [x] Kaydetme onayı

### Altyapı
- [x] netlify.toml (build, header, redirect ayarları)
- [x] _redirects (eski domain yönlendirmeleri)
- [x] _headers (güvenlik ve cache)
- [x] 404.html (profesyonel hata sayfası)
- [x] Netlify Functions (bookings API + admin save)
- [x] Back-to-top butonu
- [x] bookings-source.js retry mekanizması

---

## 🚀 Deploy Kontrol Listesi

Netlify'a deploy etmeden önce:

1. [ ] Tüm `905XXXXXXXXX` yer tutucuları WhatsApp numarasıyla değiştirildi
2. [ ] `og-image.jpg` oluşturuldu ve Pictures/ klasörüne kondu
3. [ ] Ana index.html'den `noindex, nofollow` meta tag'ı KALDIRILDI
4. [ ] head-meta.html içeriği index.html'e eklendi
5. [ ] snippet-reviews.html içeriği index.html'e eklendi
6. [ ] snippet-body-extras.html içeriği index.html'e eklendi
7. [ ] Almanca buton navbar'a eklendi
8. [ ] Schema.org'daki koordinatlar doğrulandı
9. [ ] Netlify Identity etkinleştirildi
10. [ ] Custom domain ayarlandı

---

Sorularınız varsa bana yazın! 🌴
