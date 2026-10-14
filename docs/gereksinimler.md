# LMS Yazılım Gereksinimleri Belirtimi (SRS)

Bu belge, `lms_en_etkili_10_ozellik.md` dosyasında tanımlanan 10 modülü uygulanabilir gereksinimlere dönüştürür.
Gereksinimler **FR-xx** (fonksiyonel) ve **NFR-xx** (fonksiyonel olmayan) biçiminde numaralandırılmıştır.

Öncelik ölçeği: **Zorunlu** (ilk sürümde olmazsa ürün çalışmaz), **Olmalı** (yakın sürümde gerekli), **Olabilir** (yol haritası).

## 0. Kapsam ve Varsayımlar

Aşağıdaki varsayımlar, gereksinimlerin yazılabilmesi için alınmış ön kararlardır; onaylanması veya değiştirilmesi gerekir.

| No | Varsayım |
|---|---|
| V1 | Platform web tabanlıdır (masaüstü + mobil tarayıcı); yerel mobil uygulama ilk sürüm kapsamında değildir. |
| V2 | Arayüz dili öncelikli olarak Türkçedir, çoklu dil altyapısı hazırlanır. |
| V3 | Canlı ders (senkron video) üçüncü taraf servis ile tümleştirilir, platform içinde geliştirilmez. |
| V4 | Yapay zekâ asistanı harici bir LLM sağlayıcısı üzerinden, RAG mimarisiyle çalışır. |
| V5 | Ücretli kurslar PayTR iFrame API ile tek seferlik ödemeyle satılır; ödeme onaylanınca kayıt otomatik açılır. Ücretsiz kurslarda kayıt yönetici ataması veya açık kayıt ile yapılır. İade ve abonelik kapsam dışıdır. |
| V6 | Uygulama tek makinede (yerel sunucu/masaüstü) çalışacak şekilde tasarlanır; çok sunuculu/bulut dağıtımı kapsam dışıdır. |
| V7 | Eşzamanlı kullanıcı sayısı küçüktür (bir sınıf/kurum ölçeği, onlarca kullanıcı); binlerce eşzamanlı kullanıcı hedeflenmez. |

### Teknoloji Yığını Kararı

| Katman | Seçim | Not |
|---|---|---|
| Arayüz | React | SPA, tarayıcı üzerinden yerel sunucuya bağlanır. |
| Sunucu | Node.js (Express/Fastify) | Tek dil (JavaScript/TypeScript) ile uçtan uca geliştirme. |
| Veritabanı | SQLite (WAL modu) | Kurulum gerektirmez, dosya tabanlı; tek makine senaryosuna uygun. Prisma/Drizzle gibi bir ORM ile erişilmesi, ileride PostgreSQL'e geçişi kolaylaştırır. |

Bu karar, aşağıdaki fonksiyonel olmayan gereksinimlerin **bulut/çok-sunuculu ölçek varsayımından yerel tek-makine varsayımına** göre yeniden yazılmasını gerektirmiştir (bkz. §2.1, §2.5, §2.8).

### Aktörler ve Roller

| Rol | Tanım |
|---|---|
| **Misafir** | Giriş yapmamış kullanıcı. Yalnızca kurs kataloğunu görür. |
| **Öğrenci** | Kursa kayıtlı kullanıcı. İçerik tüketir, sınav ve ödev yapar. |
| **Eğitmen** | Kurs içeriği üretir, ödev değerlendirir, öğrenci ilerlemesini izler. |
| **Yönetici** | Kullanıcı, kurs, rol ve sistem ayarlarını yönetir. |
| **Sistem** | Zamanlanmış işleri yürütür (bildirim, rapor, sertifika üretimi). |

---

## 1. Fonksiyonel Gereksinimler

### 1.1 Kimlik Doğrulama ve Kullanıcı Yönetimi (Temel Altyapı)

| ID | Gereksinim | Öncelik |
|---|---|---|
| FR-01 | Kullanıcı e-posta ve şifre ile kayıt olabilmeli; e-posta doğrulaması zorunlu olmalıdır. | Zorunlu |
| FR-02 | Sistem Google ve Microsoft üzerinden OAuth 2.0 ile giriş desteklemelidir. | Olmalı |
| FR-03 | Kullanıcı şifresini e-posta ile sıfırlayabilmelidir (süreli, tek kullanımlık bağlantı). | Zorunlu |
| FR-04 | Sistem rol tabanlı yetkilendirme (RBAC) uygulamalı; her istek kullanıcının rolüne göre denetlenmelidir. | Zorunlu |
| FR-05 | Kullanıcı profilini düzenleyebilmelidir (ad, avatar, iletişim, bildirim tercihleri, dil). | Zorunlu |
| FR-06 | Yönetici kullanıcı listeleyebilmeli, rol atayabilmeli ve hesap askıya alabilmelidir. | Zorunlu |
| FR-07 | Kullanıcı hesabının ve kişisel verilerinin silinmesini talep edebilmelidir (KVKK). | Zorunlu |

### 1.2 Kişisel Öğrenme Paneli (Modül 1)

| ID | Gereksinim | Öncelik |
|---|---|---|
| FR-10 | Panel, öğrencinin kayıtlı kurslarını yüzdelik ilerleme göstergesiyle listelemelidir. | Zorunlu |
| FR-11 | Panel, en son erişilen derse yönlendiren "kaldığın yerden devam et" bağlantısı sunmalıdır. | Zorunlu |
| FR-12 | Panel, teslim tarihi yaklaşan ödev ve sınavları (varsayılan 7 gün) tarih sırasıyla göstermelidir. | Zorunlu |
| FR-13 | Panel özet metrikleri göstermelidir: tamamlanan ders sayısı, toplam çalışma süresi, ortalama sınav başarısı, kazanılan rozet sayısı. | Olmalı |
| FR-14 | Panel bileşenleri kullanıcı tarafından gizlenebilir ve sıralanabilir olmalıdır. | Olabilir |
| FR-15 | Eğitmen ve yönetici için rolüne özel panel görünümü sunulmalıdır (bekleyen değerlendirmeler, kurs istatistikleri). | Olmalı |

### 1.3 Kurs ve İçerik Yönetimi (Modül 2)

| ID | Gereksinim | Öncelik |
|---|---|---|
| FR-20 | Sistem üç seviyeli hiyerarşi desteklemelidir: Kurs → Modül → Ders. | Zorunlu |
| FR-21 | Bir ders şu içerik tiplerinden birini barındırabilmelidir: video, PDF, sunum, zengin metin, bağlantı, gömülü içerik, sınav, ödev. | Zorunlu |
| FR-22 | Eğitmen içerik yükleyebilmeli, sıralayabilmeli ve taslak/yayında durumunu yönetebilmelidir. | Zorunlu |
| FR-23 | Video oynatıcı ilerleme konumunu kaydetmeli, oynatma hızı ve altyazı desteği sunmalıdır. | Zorunlu |
| FR-24 | Ders tamamlanma durumu otomatik (video %90 izlenme, doküman açılma) veya manuel işaretleme ile güncellenmelidir. | Zorunlu |
| FR-25 | Kurs, sıralı erişim (önceki ders tamamlanmadan ilerlenemez) veya serbest erişim modunda yapılandırılabilmelidir. | Zorunlu |
| FR-26 | Kurs kataloğu kategori, seviye, etiket ve anahtar kelimeye göre filtrelenip aranabilmelidir. | Zorunlu |
| FR-27 | Öğrenci içerik üzerinde kişisel not alabilmeli ve içeriği yer imlerine ekleyebilmelidir. | Olabilir |
| FR-28 | Kursa kayıt; açık kayıt, davet kodu veya yönetici ataması yöntemlerinden biriyle yapılabilmelidir. | Zorunlu |
| FR-29 | Sistem kurs sürümlemesi yapmalı; yayındaki kursta yapılan değişiklik mevcut öğrencilerin ilerlemesini bozmamalıdır. | Olmalı |

### 1.4 Kişiselleştirilmiş Öğrenme Yolları (Modül 3)

| ID | Gereksinim | Öncelik |
|---|---|---|
| FR-30 | Yönetici veya eğitmen birden çok kursu sıralı bir öğrenme yolu olarak tanımlayabilmelidir. | Olmalı |
| FR-31 | Kurs ve ders düzeyinde ön koşul tanımlanabilmeli; koşul sağlanmadan erişim engellenmelidir. | Olmalı |
| FR-32 | Öğrenci kurs başında seviye belirleme testi çözebilmeli; sonuca göre başlangıç noktası önerilmelidir. | Olabilir |
| FR-33 | Sistem, öğrencinin zayıf olduğu konu başlıklarına göre telafi içeriği önermelidir. | Olabilir |
| FR-34 | Öğrenci haftalık çalışma hedefi belirleyebilmeli ve gerçekleşme oranını görebilmelidir. | Olabilir |

### 1.5 Sınav ve Değerlendirme (Modül 4)

| ID | Gereksinim | Öncelik |
|---|---|---|
| FR-40 | Sistem şu soru tiplerini desteklemelidir: çoktan seçmeli (tek ve çok cevaplı), doğru-yanlış, boşluk doldurma, eşleştirme, kısa cevap, açık uçlu. | Zorunlu |
| FR-41 | Eğitmen soru bankası oluşturabilmeli; sorular konu ve zorluk etiketleriyle sınıflandırılmalıdır. | Olmalı |
| FR-42 | Sınav; süre sınırı, soru ve cevap karıştırma, deneme hakkı sayısı, geçme notu ve havuzdan rastgele seçim parametreleriyle yapılandırılabilmelidir. | Zorunlu |
| FR-43 | Objektif sorular otomatik puanlanmalı; sonuç sınav bitiminde anında gösterilmelidir. | Zorunlu |
| FR-44 | Açık uçlu sorular eğitmen tarafından rubrik üzerinden manuel puanlanabilmelidir. | Olmalı |
| FR-45 | Sınav sonucu doğru cevap ve açıklamayla gösterilebilmeli; bu davranış eğitmen tarafından kapatılabilmelidir. | Zorunlu |
| FR-46 | Sistem konu bazlı başarı dağılımı üretmeli ve eksik konuları listelemelidir. | Olmalı |
| FR-47 | Sınav oturumu kesintiye uğrarsa cevaplar korunmalı ve kalan süreyle devam edilebilmelidir. | Zorunlu |
| FR-48 | Öğrenci konu testleri ve deneme sınavlarıyla kendini notlandırılmadan değerlendirebilmelidir. | Olmalı |

### 1.6 Yapay Zekâ Destekli Eğitim Asistanı (Modül 5)

| ID | Gereksinim | Öncelik |
|---|---|---|
| FR-50 | Öğrenci, ders bağlamında doğal dilde soru sorabilmeli ve yanıt alabilmelidir. | Olmalı |
| FR-51 | Yanıtlar kurs materyalleriyle ilişkilendirilmeli (RAG) ve kaynak ders referansı gösterilmelidir. | Olmalı |
| FR-52 | Asistan kavram açıklama, konu özeti, örnek üretme ve alıştırma sorusu üretme işlevlerini sunmalıdır. | Olmalı |
| FR-53 | Asistan sınav sorularının doğrudan cevabını vermemeli ve aktif sınav oturumunda devre dışı kalmalıdır. | Zorunlu |
| FR-54 | Sohbet geçmişi kullanıcı bazında saklanmalı ve kullanıcı tarafından silinebilmelidir. | Olmalı |
| FR-55 | Yanıt kalitesi için kullanıcı geri bildirimi toplanmalıdır. | Olabilir |
| FR-56 | Kullanıcı başına günlük istek kotası uygulanmalı, kota aşımında bilgilendirme yapılmalıdır. | Zorunlu |
| FR-57 | Yanıtın yapay zekâ üretimi olduğu ve hata içerebileceği arayüzde belirtilmelidir. | Zorunlu |

### 1.7 Ödev ve Proje Yönetimi (Modül 6)

| ID | Gereksinim | Öncelik |
|---|---|---|
| FR-60 | Eğitmen ödev tanımlayabilmelidir: açıklama, ek dosya, teslim tarihi, puan ağırlığı, kabul edilen dosya tipleri. | Zorunlu |
| FR-61 | Öğrenci dosya yükleyerek veya metin girerek ödev teslim edebilmelidir. | Zorunlu |
| FR-62 | Sistem geç teslimi işaretlemeli; eğitmen geç teslime izin verme ve ceza oranı tanımlayabilmelidir. | Zorunlu |
| FR-63 | Eğitmen ödeve puan ve yazılı veya dosya biçiminde geri bildirim verebilmelidir. | Zorunlu |
| FR-64 | Eğitmen revizyon talebi açabilmeli; teslim geçmişi sürümlü tutulmalıdır. | Olmalı |
| FR-65 | Sistem grup ödevi desteklemeli; grup üyeleri ortak teslim yapabilmelidir. | Olabilir |
| FR-66 | Öğrenci tüm ödevlerini durum filtresiyle görebilmelidir (teslim edilmedi, değerlendiriliyor, notlandı). | Zorunlu |
| FR-67 | Sistem benzerlik ve intihal kontrolü için harici servis tümleştirmesine açık olmalıdır. | Olabilir |

### 1.8 Öğrenme Analitiği (Modül 7)

| ID | Gereksinim | Öncelik |
|---|---|---|
| FR-70 | Sistem öğrenme etkinliklerini olay olarak kaydetmelidir: içerik görüntüleme, video izleme süresi, sınav denemesi, ödev teslimi, oturum süresi. | Zorunlu |
| FR-71 | Öğrenci tamamlama oranı, sınav not geçmişi, haftalık çalışma süresi ve konu bazlı yeterlilik grafiklerini görebilmelidir. | Olmalı |
| FR-72 | Eğitmen kurs düzeyinde toplu istatistik görebilmelidir: ortalama tamamlama, soru başına başarı oranı, dersin terk edildiği noktalar. | Olmalı |
| FR-73 | Sistem risk altındaki öğrencileri (düşük etkileşim, kaçırılan teslim) eğitmene bildirmelidir. | Olabilir |
| FR-74 | Raporlar CSV veya XLSX biçiminde dışa aktarılabilmelidir. | Olmalı |
| FR-75 | Yönetici platform genelinde kullanım raporu görebilmelidir (aktif kullanıcı, popüler kurs, sertifika sayısı). | Olmalı |

### 1.9 Etkileşim ve Tartışma (Modül 8)

| ID | Gereksinim | Öncelik |
|---|---|---|
| FR-80 | Her kurs için tartışma forumu bulunmalı; konu açma ve yanıtlama desteklenmelidir. | Olmalı |
| FR-81 | Ders düzeyinde soru-cevap alanı olmalı; eğitmen yanıtı resmi cevap olarak işaretlenebilmelidir. | Olmalı |
| FR-82 | Gönderiler oylanabilmeli ve çözüldü olarak işaretlenebilmelidir. | Olabilir |
| FR-83 | Uygunsuz içerik bildirilebilmeli; eğitmen ve yönetici içeriği kaldırabilmelidir. | Zorunlu |
| FR-84 | Gönderilerde zengin metin, kod bloğu ve dosya eki desteklenmelidir. | Olmalı |
| FR-85 | Öğrenci bir konuyu takip edebilmeli ve yeni yanıtlarda bildirim almalıdır. | Olmalı |

### 1.10 Takvim, Hatırlatma ve Bildirimler (Modül 9)

| ID | Gereksinim | Öncelik |
|---|---|---|
| FR-90 | Takvim; canlı ders, sınav, ödev teslimi ve etkinlikleri ay, hafta ve gün görünümünde göstermelidir. | Zorunlu |
| FR-91 | Sistem yaklaşan görevler için otomatik hatırlatma üretmelidir (varsayılan 24 saat ve 1 saat önce). | Zorunlu |
| FR-92 | Bildirimler uygulama içi, e-posta ve push kanallarından iletilmelidir. | Zorunlu |
| FR-93 | Kullanıcı bildirim tiplerini kanal bazında açıp kapatabilmelidir. | Zorunlu |
| FR-94 | Takvim ICS akışı olarak harici takvimlere abone edilebilmelidir. | Olabilir |
| FR-95 | Eğitmen kursa kayıtlı öğrencilere duyuru gönderebilmelidir. | Zorunlu |

### 1.11 Sertifika, Rozet ve Başarı Yönetimi (Modül 10)

| ID | Gereksinim | Öncelik |
|---|---|---|
| FR-100 | Kurs tamamlama koşulları sağlandığında sistem otomatik olarak PDF sertifika üretmelidir. | Olmalı |
| FR-101 | Sertifika benzersiz bir kod ve herkese açık doğrulama bağlantısı içermelidir. | Olmalı |
| FR-102 | Sertifika şablonu kurum logosu ve imza ile yapılandırılabilmelidir. | Olabilir |
| FR-103 | Sistem davranış tabanlı rozetler vermelidir (ör. ilk kurs, yedi gün üst üste çalışma, tam puan). | Olabilir |
| FR-104 | Öğrenci kazanımlarını profilinde listeleyebilmeli ve paylaşılabilir bağlantı üretebilmelidir. | Olabilir |

---

## 2. Fonksiyonel Olmayan Gereksinimler

### 2.1 Performans ve Ölçeklenebilirlik

Yerel tek-makine dağıtımı (V6, V7) nedeniyle bu başlık çok-sunuculu bulut ölçeği yerine **tek SQLite örneğinin kaldırabileceği yük** esas alınarak tanımlanmıştır.

| ID | Gereksinim |
|---|---|
| NFR-01 | Panel ve kurs sayfaları için sunucu yanıt süresi p95 < 300 ms, p99 < 800 ms olmalıdır (yerel ağ, harici gecikme yok). |
| NFR-02 | En büyük içerik boyaması (LCP) yerel ağ bağlantısında < 1,5 s olmalıdır. |
| NFR-03 | Sistem eşzamanlı en az 50 aktif kullanıcıyı (bir sınıf/kurum ölçeği) yanıt süresi hedeflerini bozmadan karşılamalıdır. Bu sınırın üzerinde büyüme planlanıyorsa SQLite'tan PostgreSQL'e geçiş değerlendirilmelidir (bkz. A6). |
| NFR-04 | Video içerikleri doğrudan dosya sisteminden (HTTP range request desteğiyle) sunulmalıdır; CDN kullanılmaz. Büyük video kütüphanelerinde disk G/Ç'si izlenmelidir. |
| NFR-05 | SQLite **WAL (Write-Ahead Logging)** modunda çalıştırılmalı; eşzamanlı okuma/yazma performansı bu şekilde sağlanmalıdır. |
| NFR-06 | Analitik sorguları ana işlemleri (sınav/ödev teslimi) kilitlememelidir; gerekirse analitik sorgular düşük öncelikli veya önbellekli çalıştırılmalıdır. |
| NFR-07 | Sınav başlangıcı gibi ani yük tepelerinde (bir sınıfın aynı anda sınava girmesi) sistem kademeli bozulma göstermeli, tamamen durmamalıdır. |

### 2.2 Güvenlik

| ID | Gereksinim |
|---|---|
| NFR-10 | Tüm trafik TLS 1.2 veya üzeri ile şifrelenmeli; HTTP istekleri HTTPS'e yönlendirilmelidir. |
| NFR-11 | Şifreler Argon2id veya bcrypt (maliyet ≥ 12) ile özetlenerek saklanmalıdır; düz metin saklama yasaktır. |
| NFR-12 | Oturum yönetimi kısa ömürlü erişim jetonu ve yenileme jetonu ile yapılmalı; çıkışta jetonlar iptal edilmelidir. |
| NFR-13 | Sistem OWASP Top 10 risklerine karşı korunmalıdır (enjeksiyon, XSS, CSRF, güvensiz doğrudan nesne referansı). |
| NFR-14 | Yetkilendirme her istekte sunucu tarafında doğrulanmalı; istemci tarafı kontrol tek başına yeterli sayılmamalıdır. |
| NFR-15 | Yüklenen dosyalar tip ve boyut doğrulamasından geçmeli, kötü amaçlı yazılım taramasına tabi tutulmalı ve uygulama alan adı dışından servis edilmelidir. |
| NFR-16 | Kimlik doğrulama uç noktalarında hız sınırlama ve kaba kuvvet koruması uygulanmalıdır. |
| NFR-17 | Yönetimsel işlemler ve not değişiklikleri değiştirilemez denetim kaydına yazılmalıdır. |
| NFR-18 | Veriler beklemede şifrelenmeli; sırlar kod deposunda değil gizli anahtar yönetiminde tutulmalıdır. |
| NFR-19 | Bağımlılıklar için otomatik güvenlik açığı taraması CI hattında çalışmalıdır. |

### 2.3 Kişisel Verilerin Korunması ve Uyumluluk

| ID | Gereksinim |
|---|---|
| NFR-20 | Sistem KVKK ve GDPR ile uyumlu olmalı; veri işleme amacı ve süresi kayıt altına alınmalıdır. |
| NFR-21 | Kullanıcı kişisel verilerini makine okunur biçimde dışa aktarabilmeli ve silinmesini talep edebilmelidir. |
| NFR-22 | Çerez ve analitik izleme için açık rıza alınmalıdır. |
| NFR-23 | Yapay zekâ asistanına gönderilen istemler kişisel veriden arındırılmalı; sağlayıcıya model eğitimi izni verilmemelidir. |
| NFR-24 | Veri saklama süreleri tanımlanmalı; süresi geçen olay kayıtları anonimleştirilmeli veya silinmelidir. |

### 2.4 Erişilebilirlik ve Kullanılabilirlik

| ID | Gereksinim |
|---|---|
| NFR-30 | Arayüz WCAG 2.1 AA düzeyine uygun olmalıdır (renk kontrastı ≥ 4.5:1, klavye ile tam gezinme, görünür odak göstergesi). |
| NFR-31 | Tüm etkileşimli bileşenler ekran okuyucu ile kullanılabilir olmalıdır (uygun ARIA etiketleri). |
| NFR-32 | Videolar için altyazı, dokümanlar için metin alternatifi sağlanmalıdır. |
| NFR-33 | Arayüz 320 piksel genişlikten masaüstüne kadar duyarlı olmalıdır. |
| NFR-34 | Yeni bir öğrenci, eğitim almadan kursa kayıt olup ilk dersi 3 dakika içinde başlatabilmelidir. |
| NFR-35 | Hata mesajları nedeni ve çözüm adımını Türkçe açıklamalıdır; teknik yığın izi kullanıcıya gösterilmemelidir. |

### 2.5 Güvenilirlik ve Süreklilik

Yerel tek-makine dağıtımında "yüksek kullanılabilirlik" bulut hedefleri yerine **veri bütünlüğü ve kolay yedekleme** öncelikli hale gelir.

| ID | Gereksinim |
|---|---|
| NFR-40 | Uygulama, barındırıldığı makine açıkken kesintisiz çalışmalıdır; çoklu sunucu/otomatik yük devretme (failover) hedeflenmez. |
| NFR-41 | SQLite veritabanı dosyasının günlük otomatik kopyası alınmalı ve en az 30 gün saklanmalıdır (basit dosya kopyalama yeterlidir). |
| NFR-42 | Kurtarma hedefleri: RPO ≤ 24 saat (günlük yedek), RTO ≤ 1 saat (dosya geri kopyalama + yeniden başlatma). |
| NFR-43 | Sınav ve ödev teslim verileri hiçbir koşulda kaybolmamalıdır; yazma işlemleri SQLite işlemleri (transaction) içinde yürütülmelidir. |
| NFR-44 | Harici servis kesintisinde (e-posta, LLM API) sistem ilgili özelliği devre dışı bırakıp çalışmaya devam etmelidir. |
| NFR-45 | Uygulama güncellemesi/yeniden başlatma öncesi kullanıcıya uygulama içi bir uyarı gösterilmelidir. |

### 2.6 Sürdürülebilirlik ve Geliştirme Kalitesi

| ID | Gereksinim |
|---|---|
| NFR-50 | Kod tabanı modüler olmalı; modüller arası bağımlılık açık arayüzler üzerinden kurulmalıdır. |
| NFR-51 | Birim test kapsamı iş mantığı katmanında ≥ %70 olmalıdır; sınav puanlama ve ilerleme hesabı için test zorunludur. |
| NFR-52 | API'ler sürümlenmeli (`/api/v1`) ve OpenAPI belirtimi ile belgelenmelidir. |
| NFR-53 | CI hattı her değişiklikte derleme, lint, test ve güvenlik taraması çalıştırmalıdır. |
| NFR-54 | Veritabanı değişiklikleri sürümlü göç dosyalarıyla yönetilmelidir. |
| NFR-55 | Yapılandırma ortam değişkenleriyle sağlanmalı; kod ile ortam ayrımı korunmalıdır. |

### 2.7 İzlenebilirlik ve Operasyon

| ID | Gereksinim |
|---|---|
| NFR-60 | Uygulama yapılandırılmış (JSON) log üretmeli; her istek bir korelasyon kimliği taşımalıdır. |
| NFR-61 | Hata izleme ve uyarı sistemi kurulmalı; kritik hatalar operasyon ekibine anında bildirilmelidir. |
| NFR-62 | Teknik ölçümler (yanıt süresi, hata oranı, kaynak kullanımı) ve iş ölçümleri panolarda izlenmelidir. |
| NFR-63 | Sağlık kontrolü uç noktaları sağlanmalıdır (health ve readiness). |
| NFR-64 | Loglarda şifre, jeton ve kişisel veri maskelenmelidir. |

### 2.8 Taşınabilirlik ve Tümleşebilirlik

| ID | Gereksinim |
|---|---|
| NFR-70 | Sistem Chrome, Edge ve Firefox'un son iki ana sürümünde çalışmalıdır. |
| NFR-71 | Uygulama tek komutla (`npm install && npm run start` benzeri) yerel ortamda ayağa kalkmalıdır; harici servis bağımlılığı (veritabanı sunucusu vb.) olmamalıdır. |
| NFR-72 | Yüklenen dosyalar (video, PDF, ödev ekleri) yerel dosya sisteminde, veritabanı dışında saklanmalıdır; veritabanı yalnızca meta veri ve dosya yolunu tutmalıdır. |
| NFR-73 | Veri modeli; ileride çok kullanıcılı bir sunucuya (PostgreSQL) taşınmaya elverecek şekilde SQLite'a özgü olmayan bir ORM (Prisma/Drizzle) üzerinden tanımlanmalıdır. |
| NFR-74 | Kullanıcı sayısı küçük olduğundan SAML/OIDC gibi kurumsal SSO ilk sürümde gerekli değildir; FR-02'deki OAuth girişi yeterlidir. |

### 2.9 Sınav Bütünlüğü

| ID | Gereksinim |
|---|---|
| NFR-80 | Sınav soruları istemciye yalnızca gerektiği ölçüde gönderilmeli; doğru cevaplar sınav sırasında istemciye hiç gönderilmemelidir. |
| NFR-81 | Sınav süresi sunucu saatine göre hesaplanmalı; istemci saati esas alınmamalıdır. |
| NFR-82 | Sınav denemeleri IP, oturum ve zaman damgasıyla kaydedilmelidir. |
| NFR-83 | Soru havuzundan rastgele seçim ile her öğrenciye farklı soru kümesi sunulabilmelidir. |

---

## 3. Sürüm Planı (Gereksinim Eşlemesi)

| Sürüm | Kapsam | Gereksinimler |
|---|---|---|
| **MVP (v1)** | Kimlik yönetimi, panel, kurs ve içerik, sınav, ödev, temel ilerleme takibi, bildirim | FR-01…07, FR-10…13, FR-20…26, FR-28, FR-40…43, FR-45, FR-47, FR-60…63, FR-66, FR-70, FR-90…93, FR-95 |
| **v2** | Analitik görselleştirme, tartışma ortamı, sertifika, soru bankası ve manuel puanlama | FR-44, FR-46, FR-48, FR-64, FR-71…75, FR-80…85, FR-100, FR-101 |
| **v3** | Yapay zekâ asistanı, kişiselleştirilmiş öğrenme yolları, rozetler | FR-30…34, FR-50…57, FR-102…104 |

Fonksiyonel olmayan gereksinimlerden **NFR-05 (WAL modu), NFR-10…19, NFR-30, NFR-33, NFR-40…43, NFR-50…55, NFR-60…64, NFR-71…73, NFR-80…83** MVP ile birlikte karşılanmalıdır. Bunlar sonraya bırakılabilir özellik değil, baştan alınması gereken mimari kararlardır.

## 4. Kabul Ölçütü Yaklaşımı

Her fonksiyonel gereksinim, geliştirmeye alınmadan önce en az bir kabul ölçütüne dönüştürülür. Örnek:

> **FR-47** — *Verilen durum:* Öğrenci 30 dakikalık bir sınavın 12. dakikasındadır ve 5 soru cevaplamıştır.
> *Yapıldığında:* Tarayıcı kapanır ve öğrenci 3 dakika sonra sınava geri döner.
> *Beklenen:* Cevaplanmış 5 soru korunur ve kalan süre 15 dakika olarak gösterilir.

## 5. Açık Konular

| No | Konu | Karar sahibi |
|---|---|---|
| A1 | Canlı ders için hangi servis kullanılacak? | Ürün |
| A2 | Yapay zekâ asistanı için sağlayıcı ve bütçe üst sınırı nedir? | Ürün + Teknik |
| A3 | Sertifika kurumsal olarak akredite mi olacak, yalnızca katılım belgesi mi? | Ürün |
| A4 | Çoklu kurum (multi-tenant) desteği gerekecek mi? | Teknik mimari |
| A5 | Hedeflenen eşzamanlı kullanıcı sayısı NFR-03'teki 50 değeri ile doğrulanıyor mu, yoksa daha büyük mü? | Ürün |
| A6 | SQLite'ın eşzamanlılık sınırına yaklaşılırsa (NFR-03 aşımı) PostgreSQL'e geçiş hangi eşikte tetiklenecek? | Teknik mimari |
| A7 | Yerel uygulama tek bir Node süreci olarak mı çalışacak, yoksa Electron gibi bir masaüstü kabuğu ile mi paketlenecek? | Teknik mimari |
