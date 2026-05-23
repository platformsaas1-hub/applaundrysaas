# LAUNDRYKU: BLUEPRINT UTAMA & ARSITEKTUR MULTI-TENANT SAAS MVP
*Sistem Point of Sales (POS) & Operational Tracking Laundry Modern untuk Usaha Menengah, Kecil, dan Mikro (UMKM)*

---

## 1. ANALISIS KEBUTUHAN SISTEM MVP

Untuk meluncurkan Minimum Viable Product (MVP) yang solid di bawah batasan **Firebase Spark Plan (Gratis)**, fungsionalitas utama disaring secara ketat agar hanya retensi nilai tertinggi yang dikembangkan dengan konsumsi kuota sekecil mungkin.

### Kebutuhan Fungsional Utama
- **Multi-Tenant Isolation**: Mengamankan data tiap brand/laundry agar tidak saling mengintip, bertindak sebagai ruang kerja independen dengan basis data logic-separated.
- **Micro POS (Point of Sales)**: Input transaksi kiloan/satuan dengan pencatatan status bayar (Lunas / Belum Lunas) dan metode bayar (Tunai / QRIS / Transfer).
- **Internal Status Tracking**: Alur status progress cucian: *Diterima (Received) -> Proses (Processing) -> Selesai Cuci (Ready) -> Diambil (Delivered)*.
- **Manajemen Customer & Layanan**: Pencatatan data pelanggan sederhana (Nama & WhatsApp) dan daftar harga jasa laundry dinamis per outlet.
- **WhatsApp Notification Sederhana**: Pengiriman struk digital & notifikasi status selesai via API Gateway pihak ketiga yang murah/gratis (e.g., Fonnte, Wablas, atau integrasi Whatsapp Click-to-Send protocol).
- **Dashboard Ringkas**: Total keuntungan harian, volume beban cucian aktif, dan statistik harian.

### Kebutuhan Non-Fungsional MVP
- **Optimasi Kuota Firestore**: Maksimal membaca 50.000 dokumen/hari dan menulis 20.000 dokumen/hari. Semua proses transaksi diupayakan meminimalkan operasional pengulangan baca (*Read Overhead*).
- **Skalabilitas Vertikal**: Mudah ditingkatkan dari Spark (Gratis) ke Blaze (Pay-as-you-go) tanpa menulis ulang arsitektur database.
- **Keamanan Data**: Mencegah kebocoran data antar outlet dan penyalahgunaan wewenang kasir.

---

## 2. STRUKTUR ARSITEKTUR SISTEM BERBASIS FIREBASE

Arsitektur dirancang dengan pendekatan **Client-Authoritative Serverless (Zero-Backend)** untuk meminimalkan latensi dan biaya server, dijamin penuh oleh **Firestore Security Rules** yang berperan sebagai "Satpam Pintar".

```
               +-------------------------------------------------------------+
               |                       CLIENT INTERFACE                      |
               |       React (Vite) + Tailwind CSS + Lucide Icons + Motion   |
               +-------------------------------------------------------------+
                               /                             \
                (Authentication)                        (Read/Write Requests)
                             /                                 \
                            v                                   v
+-------------------------------+              +------------------------------------+
|    FIREBASE AUTHENTICATION    |              |          CLOUD FIRESTORE           |
|  - Google JWT Token Provider  |              |  - Rules Engine (ABAC Check)       |
|  - Tenant ID Mapping on custom|              |  - Secure Document Multi-Tenancy   |
|    claims/user profile        |              |  - High Performance Indexes        |
+-------------------------------+              +------------------------------------+
                                                                ^
                                                                | (Storage Access)
                                                                v
                                               +------------------------------------+
                                               |          FIREBASE STORAGE          |
                                               |  - Bukti Transfer / Invoice QR     |
                                               |  - Nota Laundry Brand Logo         |
                                               +------------------------------------+
```

- **Firebase Hosting**: Menyajikan aset static SPA React dengan caching CDN global yang efisien, tanpa tagihan transfer data di bawah limit gratis harian.
- **Firebase Authentication**: Autentikasi utama menggunakan Google OAuth (atau Email/Sandi) sebagai pelindung identitas. Informasi relasi Tenant (`tenantId`) diletakkan pada dokumen referensi profile pengguna `/users/{userId}`.
- **Cloud Firestore**: Database utama no-SQL real-time, menyimpan data konfigurasi tenant, transaksi, status, layanan, dan laporan teragregasi.
- **Firebase Storage**: Menyimpan logo usaha dari tenant untuk kop nota digital dan lampiran bukti pembayaran/QRIS statis.

---

## 3. STRUKTUR DATABASE FIRESTORE EFFISIEN & HEMAT KUOTA

Kunci keberhasilan menjalankan SaaS di tingkat gratis adalah **Denormalisasi Terkontrol** dan **Aggregated Writes**. Kita harus menghindari pattern "Query relational berantai" di Client.

### Strategi Efisiensi Firestore
1. **Aggregated Writes (Laporan Teragregasi)**: Jangan menghitung omzet dengan melakukan `read` terhadap semua dokumen transaksi hari ini tiap kali Owner membuka dashboard. Sebaliknya, gunakan **Single Document Aggregator** (`dailyReports/{reportId}`). Setiap kasir membuat transaksi baru, kurangi/tambah total omzet harian ke dokumen harian tunggal ini. Membuka dashboard hanya mengonsumsi **1 kali Read** dokumen, bukan *N kali Read* (di mana *N* adalah jumlah transaksi).
2. **Data Caching / Profile Normalization**: Menyalin nama dan nomor handphone customer ke dalam dokumen transaksi. 
   - *Kenapa?* Saat menampilkan list 50 transaksi kasir hari ini, kita tidak perlu memanggil query `get()` ke koleksi `/customers` sebanyak 50 kali. Nama customer sudah langsung nempel di transaksi (*cached*). Jika customer mengubah nomor HP, sisa transaksi lama tetap sah, dan transaksi baru yang menggunakan data baru.
3. **Pemberian ID Terprediksi (Deterministic IDs)**:
   - Dokumen laporan harian menggunakan ID berformat `YYYY-MM-DD_[outletId]`. Menghindari proses pencarian query (Query) dan langsung memanggil `getDoc(doc(db, "dailyReports", "2026-05-22_outletA"))` yang sangat cepat dan hemat kuota.

---

## 4. SKEMA DEKORATIF COLLECTION & DOCUMENT FIRESTORE

Berikut adalah detail skema data JSON yang efisien dan aman:

### `/users/{userId}` (Root Collection)
Setiap user (pegawai/owner) terdaftar di sistem harus memiliki 1 data profile global untuk menentukan role dan kaitan tenant.
```json
{
  "userId": "auth_uid_01726...",
  "name": "Budi Santoso",
  "email": "budi.laundry@gmail.com",
  "role": "kasir", 
  "tenantId": "tenant_laundry_barokah",
  "activeOutletId": "outlet_cabang_depok",
  "createdAt": "2026-05-22T23:31:00Z"
}
```

### `/tenants/{tenantId}` (Root Collection)
Induk mutlak dari seluruh ekosistem bisnis brand laundry tersebut.
```json
{
  "tenantId": "tenant_laundry_barokah",
  "businessName": "Laundry Barokah Utama",
  "ownerId": "auth_uid_owner_123",
  "status": "active",
  "plan": "free",
  "createdAt": "2026-01-10T12:00:00Z"
}
```

### `/tenants/{tenantId}/outlets/{outletId}` (Sub-collection)
Daftar outlet fisik yang dimiliki oleh tenant.
```json
{
  "outletId": "outlet_cabang_depok",
  "name": "Laundry Barokah - Depok Margonda",
  "address": "Jl. Margonda Raya No. 45, Depok",
  "phone": "08123456789",
  "createdAt": "2026-01-10T12:05:00Z"
}
```

### `/tenants/{tenantId}/services/{serviceId}` (Sub-collection)
Daftar layanan harga jasa laundry.
```json
{
  "serviceId": "svc_cuci_setrika_kg",
  "name": "Cuci + Setrika Reguler",
  "type": "kiloan",
  "unit": "kg",
  "pricePerUnit": 8000,
  "estimatedDays": 2,
  "isActive": true,
  "createdAt": "2026-01-10T12:15:00Z"
}
```

### `/tenants/{tenantId}/customers/{customerId}` (Sub-collection)
Daftar customer tetap di tenant ini.
```json
{
  "customerId": "cust_82713...",
  "name": "Ahmad Dani",
  "phone": "628998877665",
  "address": "Apartemen Margonda Residence Tower 2",
  "notes": "Parfum wangi Sakura, jangan terlalu banyak pemutih",
  "createdAt": "2026-02-15T09:10:00Z"
}
```

### `/tenants/{tenantId}/transactions/{transactionId}` (Sub-collection)
Daftar transaksi Point of Sales (POS).
```json
{
  "transactionId": "INV-20260522-001",
  "outletId": "outlet_cabang_depok",
  "customerId": "cust_82713...",
  "customerName": "Ahmad Dani",
  "customerPhone": "628998877665",
  "items": [
    {
      "serviceId": "svc_cuci_setrika_kg",
      "name": "Cuci + Setrika Reguler",
      "qty": 3.5,
      "pricePerUnit": 8000,
      "totalPrice": 28000
    }
  ],
  "totalAmount": 28000,
  "discountAmount": 0,
  "paymentStatus": "paid",
  "paymentMethod": "qris",
  "orderStatus": "processing",
  "weight": 3.5,
  "workerId": "auth_uid_01726...",
  "notes": "Lipat rapi, gantung kemeja",
  "receivedAt": "2026-05-22T23:31:00Z",
  "completedAt": null,
  "deliveredAt": null
}
```

### `/tenants/{tenantId}/dailyReports/{reportId}` (Sub-collection)
Penyimpanan agregasi harian untuk optimasi read pada grafik omzet.
- Formatting ID: `YYYY-MM-DD_outletId` (contoh: `2026-05-22_outlet_cabang_depok`)
```json
{
  "reportId": "2026-05-22_outlet_cabang_depok",
  "date": "2026-05-22",
  "outletId": "outlet_cabang_depok",
  "totalRevenue": 450000,
  "cashRevenue": 200000,
  "qrisRevenue": 250000,
  "transferRevenue": 0,
  "totalOrders": 15,
  "completedOrders": 8,
  "updatedAt": "2026-05-22T23:31:00Z"
}
```

---

## 5. STRATEGI MULTI-TENANT SEDERHANA & AMAN

Strategi multi-tenant ini menggunakan model **Logical Separation within Subcollections** (Pemisahan Logis dalam Sub-koleksi).

1. **Path Isolation**: Semua data transaksi, customer, layanan, laporan ditaruh di dalam subkoleksi berdasar `tenantId` masing-masing (lihat struktur folder database di atas, e.g., `/tenants/{tenantId}/transactions/{transactionId}`).
2. **User Binding**: Ketika pegawai masuk login, backend-auth melempar detail user profile dari `/users/{userId}`. Client React menangkap variabel `tenantId` dan menyimpannya di React Context / Global State.
3. **Query Guarding**: Seluruh query data Firestore di sisi client wajib menyertakan path parameter `tenantId` yang diperoleh dari data terautentikasi tersebut.
4. **Security Enforcement**: Firebase Security Rules memverifikasi bahwa `userId` yang meminta data `/tenants/{tenantId}/...` memiliki dokumen profil dengan isi data `tenantId` yang sama persis dengan variabel di path tersebut.

---

## 6. STRUKTUR ROLE & PERMISSION

Kita membagi wewenang secara hierarkis guna menjaga integritas data operasional dan data keuangan.

| Fitur / Modul | Owner | Admin | Kasir | Pegawai (Cuci/Setrika) |
| :--- | :---: | :---: | :---: | :---: |
| **Membuka Dashboard Laporan Keuangan** | ✅ (Semua Outlet) | ✅ (Hanya Cabangnya) | ❌ | ❌ |
| **Mengedit Program Harga & Layanan** | ✅ | ✅ | ❌ | ❌ |
| **Membuat Transaksi Baru (POS)** | ✅ | ✅ | ✅ | ❌ |
| **Menerima Pembayaran Pelanggan** | ✅ | ✅ | ✅ | ❌ |
| **Mengubah Status Cucian (Ready)** | ✅ | ✅ | ✅ | ✅ |
| **Menyetujui Penyerahan (Delivered)**| ✅ | ✅ | ✅ | ❌ |
| **Menambah Cabang Outlet Baru** | ✅ | ❌ | ❌ | ❌ |
| **Menambah Akun Pegawai Baru** | ✅ | ✅ | ❌ | ❌ |

---

## 7. ALUR KERJA PENGGUNA (USER FLOW)

Berikut adalah visualisasi alur transaksi harian di dalam aplikasi LaundryKu.

### A. Alur Kerja Kasir & Pegawai (Daily Operational)
```
[Pelanggan Datang] 
       |
       v
[Kasir Cari/Daftarkan Customer] 
       |
       v
[Kasir Pilih Layanan & Input Detail POS] ---> [Kalkulasi Total Otomatis] 
                                                        |
                                                        v
                                             [Pilih Metode Pembayaran]
                                              - QRIS / Cash / Transfer
                                                        |
                                                        v
    [Pegawai Update Status] <--- [Struk Digital Dikirim (WA)] + [Kop Nota Tercetak]
     1. Diterima (Received)
     2. Diproses (Processing)
     3. Selesai (Ready) ---> [Kirim WA Notifikasi "Cucian Selesai, Silakan Diambil!"]
                                                        |
                                                        v
                                    [Cucian Diserahkan & Status Diubah: Delivered]
```

### B. Alur Kerja Bulanan Owner (Analytics & SaaS Bilings)
1. Owner membuka aplikasi -> Dialihkan ke Dashboard Utama LaundryKu.
2. Membaca rangkuman omzet harian & bulanan yang bersumber dari koleksi `dailyReports` harian tanpa melambungkan pemakaian kuota read.
3. Mengontrol performa kerja tiap outlet dan pegawai secara real-time.

---

## 8. STRUKTUR FOLDER FRONTEND DAN BACKEND (REACT + FIREBASE)

Sistem akan dikompresi dalam satu repo monolitik ringan berskala produksi (Vite React + Client SDK Firestore):

```
/
├── firebase-blueprint.json    # Rancangan Data IR
├── firestore.rules            # Keamanan Ketat Level Database
├── package.json               # Dependensi & Script Execution
├── vite.config.ts             # Bundler Konfigurasi
├── src/
│   ├── main.tsx               # Bootstrapping Entry Point
│   ├── index.css              # Setup Tailwind V4
│   ├── App.tsx                # Client Routing & Main Layout
│   │
│   ├── components/            # Shared Visual UI (Atomic Components)
│   │   ├── ui/                # Button, Input, Modal, Cards
│   │   ├── StatCard.tsx       # Mini widget untuk metrics
│   │   └── Layout.tsx         # Sidebar navigasi modern
│   │
│   ├── context/               # Core state management
│   │   └── AuthContext.tsx    # Firebase Auth Listener & User Profiling
│   │
│   ├── services/              # Modul interaksi Firestore
│   │   ├── db.ts              # Inisialisasi Firebase App, Firestore, Auth
│   │   ├── transactions.ts    # CRUD & Aggregation Transaksi POS
│   │   ├── services.ts        # Setup Jasa & Pricing
│   │   └── reports.ts         # Query Laporan Dashboard Harian
│   │
│   ├── views/                 # Screen views modular
│   │   ├── login/             # Login & Register Tenant Page
│   │   ├── dashboard/         # Owner Overview Analytics
│   │   ├── pos/               # Active cashier POS terminal
│   │   ├── tracking/          # Status tracking monitor
│   │   ├── customers/         # List directory pelanggan tetap
│   │   └── settings/          # Service customization & Outlets configuration
│   │
│   ├── utils/
│   │   └── formatting.ts      # Convert Rupiah, Tanggal lokal, etc.
│   │
│   └── types.ts               # Strict TS Typings untuk entitas database
```

---

## 9. STRATEGI KEAMANAN FIRESTORE RULES

Sesuai dengan **Pillar Keamanan Zero-Trust** dari Firebase Integration Skill, Firestore wajib dikorbankan dari pembacaan bebas. Autentikasi token tidak boleh membawa hak mutlak tanpa pengecekan integritas data:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // 1. SAFETY NET GATES
    match /{document=**} {
      allow read, write: if false;
    }

    // Helper Fungsi Global
    function isSignedIn() {
      return request.auth != null;
    }

    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }

    function isValidId(id) {
       return id is string && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$');
    }

    // 2. USER PROFILE ACCESS RULES
    match /users/{userId} {
      allow read: if isSignedIn() && (request.auth.uid == userId || getUserData().role == "owner");
      allow create: if isSignedIn() && request.auth.uid == userId;
      allow update: if isSignedIn() && request.auth.uid == userId 
                     && !request.resource.data.keys().hasAny(['role', 'tenantId']); // Blokir eskalasi role mandiri!
    }

    // 3. TENANT INDEPENDENT DATA ACCESS
    match /tenants/{tenantId} {
      allow read: if isSignedIn() && (getUserData().tenantId == tenantId);
      allow write: if isSignedIn() && (getUserData().tenantId == tenantId && getUserData().role == "owner");

      // NESTED SUBCOLLECTIONS 
      // Menggunakan relational check terhadap tenantId pengguna yang sedang terautentikasi
      
      // OUTLETS COLLECTION
      match /outlets/{outletId} {
        allow read: if isSignedIn() && (getUserData().tenantId == tenantId);
        allow write: if isSignedIn() && (getUserData().tenantId == tenantId && getUserData().role == "owner");
      }

      // SERVICES & PRICE CATALOG
      match /services/{serviceId} {
        allow read: if isSignedIn() && (getUserData().tenantId == tenantId);
        allow write: if isSignedIn() && (getUserData().tenantId == tenantId && (getUserData().role == "admin" || getUserData().role == "owner"));
      }

      // CUSTOMERS
      match /customers/{customerId} {
        allow read: if isSignedIn() && (getUserData().tenantId == tenantId);
        allow write: if isSignedIn() && (getUserData().tenantId == tenantId && (getUserData().role == "kasir" || getUserData().role == "admin" || getUserData().role == "owner"));
      }

      // TRANSACTIONS (POS)
      match /transactions/{transactionId} {
        allow read: if isSignedIn() && (getUserData().tenantId == tenantId);
        allow create: if isSignedIn() && (getUserData().tenantId == tenantId && (getUserData().role == "kasir" || getUserData().role == "admin" || getUserData().role == "owner"));
        // Khusus Pegawai biasa hanya boleh update status order (orderStatus), dilarang mengedit harga atau isi item transaksi!
        allow update: if isSignedIn() && getUserData().tenantId == tenantId && (
          (getUserData().role in ["kasir", "admin", "owner"]) || 
          (getUserData().role == "pegawai" && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['orderStatus', 'workerId']))
        );
      }

      // DAILY REPORTS AGGREGATION
      match /dailyReports/{reportId} {
        allow read: if isSignedIn() && (getUserData().tenantId == tenantId);
        allow write: if isSignedIn() && (getUserData().tenantId == tenantId && (getUserData().role == "kasir" || getUserData().role == "admin" || getUserData().role == "owner"));
      }
    }
  }
}
```

---

## 10. STRATEGI HEMAT PENGGUNAAN FIREBASE GRATIS (SPARK PLAN)

Untuk memastikan startup UMKM dapat berjalan bertahun-tahun di tier gratis tanpa menyentuh batas kredit, optimasi penulisan logic ditekankan di sisi aplikasi:

1. **Local State & Memory Cache (React Query / Context)**: Data statis seperti daftar Layanan (`services`), informasi `outlet`, dan profil `user` hanya dipanggil sekali saat login. Sistem akan menyimpan data ini di memori aplikasi, sehingga berpindah-pindah tab kasir tidak melakukan re-fetch dokumen ke Firestore.
2. **Debounced/Buffered Inputs**: Saat mencari pelanggan, sistem pencarian dilakukan terhadap array lokal yang sudah di-fetch terlebih dahulu (*Local Search Filtering*) alih-alih melakukan Firebase query real-time di setiap ketukan keyboard (*on every keystroke*).
3. **Optimistic UI Updates**: Menghindari double clicks atau loading berulang yang memicu pemborosan baca-tulis. Layar kasir diperbarui secara instan secara optimistis di client selagi data diunggah di latar belakang.
4. **Offline Persistence (Local Storage / IndexedDB)**: Mengaktifkan opsi persistensi offline pada inisialisasi Firestore SDK:
   ```ts
   initializeFirestore(app, { localCache: persistentLocalCache() });
   ```
   Ini memungkinkan data dibaca secara instan dari disk HP Kasir jika dokumen tidak berubah, memotong tagihan `Read` Firestore sampai dengan 80%.

---

## 11. ROADMAP PENGEMBANGAN APLIKASI BERTAHAP (ROADMAP MVP TO SCALE)

```
       [ PHASE 1: FOUNDATION MVP ]             [ PHASE 2: AUTOMATION & EXPANSION ]          [ PHASE 3: SAAS MONETIZATION ]
 - Multi-Tenant Isolation                 - WhatsApp Auto Gateway integration         - Fitur Subscription SaaS (Midtrans/Stripe)
 - POS Kiloan / Satuan Terintegrasi       - Laporan Grafik Omzet Mingguan/Bulanan    - Loyalty Program & Diskon Kupon Pelanggan
 - Tracking Status Operasional Sederhana  - Print Struk Termal via Bluetooth          - Multi-Branch Inventory & Stock Alat Cuci
 - Notifikasi Link Whatsapp Click-to-Send - Pengeluaran & Kasbon Karyawan             - Mobile App (React Native/PWA)
```

---

## 12. TANTANGAN TEKNIS YANG PERLU DIPERHATIKAN

- **Integritas Konsistensi Laporan**: Karena agregasi dilakukan terdistribusi di sisi client (`dailyReports` diupdate oleh kasir di hp masing-masing sewaktu transaksi dibuat), ada risiko balapan data (*Race Condition*).
  - *Mitigasi*: Gunakan penulisan Firestore `runTransaction()` atau `FieldValue.increment()` secara eksklusif untuk memperbarui nominal omzet di dokumen laporan harian.
- **Batasan Skala Koleksi**: Satu dokumen Firestore berkapasitas maksimal 1MB. Kita tidak mendesain total daftar transaksi masuk ke dalam satu dokumen, melainkan sebagai koleksi dokumen mandiri `/transactions/{transactionId}` yang aman dari limit data 1MB.
- **Intersepsi Data Klien**: Mengingat client memegang kendali pembacaan, peretasan lewat DevTools diantisipasi secara kokoh dengan skema aturan ketat **Firestore Rules** di atas. Pengguna jahat tidak akan sanggup mengintip tenant id lain meskipun mereka mengganti kode variabel di frontend mereka.
- **WhatsApp API Gateway Tanpa Biaya**: Alternatif termurah tanpa membebani kas startup adalah meluncurkan notifikasi berbasis **Deep Link API**. Pengguna diarahkan membuka link WA Web/App (`https://api.whatsapp.com/send?phone=...&text=...`) secara semi-otomatis dari dashboard kasir.

---
*Blueprint ini siap untuk dieksekusi ke tahapan konstruksi visual dan pengkodean framework React dan Firebase SDK.*
---
