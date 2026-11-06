import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 25,
  message: {
    error: 'Terlalu banyak permintaan. Silakan tunggu sebentar sebelum bertanya lagi, Kak.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const WULING_KNOWLEDGE_BASE = `
IDENTITAS DEALER & SALES:
- Dealer: Wuling Arista Lampung (PT Arista Jaya Lestari), Jl. ZA Pagar Alam No. 99, Rajabasa, Bandar Lampung.
- Sales Executive: Alessandro Farrel Gerrard Wijaya (Mas Farrel), WA: 085768390480.
- Layanan: Pembelian Cash, Kredit (tenor 1-5 tahun), Trade-In (tukar tambah segala merek), dan Home Test Drive area Bandar Lampung.

TEKNOLOGI & KOMPONEN UTAMA WULING:
1. WFMS (Wonder Flexible Modular System):
   - Arsitektur modular generasi terbaru pada unit Wuling Darion untuk integrasi teknologi pintar dan elektrifikasi.
   - Keunggulan: Pengalaman berkendara lebih baik, pengecasan (charging) lebih cepat, keamanan lebih tinggi, kualitas andal, dan jarak tempuh (driving range) lebih jauh.
2. MAGIC Battery Pro:
   - Tersedia pada unit EV & PHEV Wuling ("The Safety in the Power You Can Feel").
   - 5 perlindungan keamanan lengkap: Zero Spontaneous Combustion, Zero Diffusion, Zero Water Ingress, Zero Intrusion, Zero Leakage.
3. LING POWER Hybrid System:
   - Sistem penggerak khusus varian PHEV (Plug-in Hybrid) yang menggabungkan efisiensi energi tinggi & berkendara halus.
   - 4 Komponen Inti: 1.5L Atkinson-cycle Dedicated Hybrid Engine (efisiensi termal 43,2%), 145 kW Drive Motor (adaptasi teknologi kereta cepat), Dedicated Hybrid Transmission / DHT (kopling elektromagnetik respons 0,1 detik), dan Ultra Safe MAGIC Battery Pro.
   - 3 Mode Energi: EV Mode, Series Hybrid, Parallel Hybrid.
4. Garansi Mesin & Komponen (Eksion, Darion, Binguo, Air EV, Cloud EV, Aira EV):
   - Program Worry Free Bersama Wuling memberikan Lifetime Warranty (Garansi Seumur Hidup) untuk komponen inti EV & Plug-in Hybrid (mencakup Power Battery / Baterai, Drive Motor / Motor Penggerak, dan Motor Control Unit / MCU).
   - Selain itu didukung garansi umum kendaraan dari pabrik berstandar global Wuling di Indonesia.

SPESIFIKASI & HARGA OTR WULING ARISTA LAMPUNG (NOVEMBER 2026):
1. NEW BINGUO EV (PROMO SPESIAL NOVEMBER - MY26 INTERIOR BARU):
   - Upgrade MY26: Tuas transmisi baru di samping kiri setir, console tengah baru, jok motif Batik Wuling.
   - NEW BINGUO EV LITE MY26: Diskon dari Rp 301.500.000 menjadi Rp 274.500.000 (Jok kain warna Mocca Latte, velg standar).
   - NEW BINGUO EV PRO MY26: Diskon dari Rp 331.500.000 menjadi Rp 304.500.000 (Tambah Wireless Charging 50W, jok synthetic Caramel Latte, Velg Alloy/Racing baru).
   - Varian Reguler: New Binguo EV Lite Rp 330.400.000 | New Binguo EV Pro Rp 375.500.000.
2. AIRA EV (16,2 kWh, jarak tempuh 205 km):
   - STDRT: Rp 168.500.000 | +HC: Rp 177.000.000 | +HC Fullpack: Rp 183.500.000
   - PRO: Rp 188.500.000 | +HC: Rp 197.000.000 | +HC Fullpack: Rp 203.500.000
3. WULING DARION (Baterai 69,10 kWh, MPV 7-Seater Keluarga, Arsitektur WFMS, EV jarak 530 km sekali cas ~Rp 100 ribuan):
   - Darion EV CE 480 + HC Fullpack: Rp 417.800.000 | Darion EV CE + HC Fullpack: Rp 427.800.000 | Darion EV EX + HC Fullpack: Rp 487.800.000
   - Darion PHEV CE: Rp 462.000.000 | Darion PHEV EX: Rp 512.000.000
4. WULING EKSION (SUV 7-Seater Tangguh, Baterai 69,10 kWh, jarak hingga 530 km CLTC):
   - Eksion EV CE (Non HC): Rp 416.800.000 | Eksion EV EX (Non HC): Rp 486.800.000
   - Eksion PHEV CE: Rp 474.000.000 | Eksion PHEV EX: Rp 524.000.000
5. NEW AIR EV: 200 Rp 246.000.000 | Lite Rp 282.900.000 | Pro Rp 340.100.000
6. NEW CLOUD EV: Lite 360 Rp 310.500.000 | Pro 360 Rp 350.500.000 | Lite Rp 428.200.000 | Pro Rp 456.200.000
7. UNIT BENSIN & NIAGA: Alvez mulai Rp 261.000.000 | Confero mulai Rp 230.800.000 | Mitra EV mulai Rp 347.000.000 | Formo mulai Rp 200.600.000
`;

// Cadangan cerdas yang akurat & sesuai konteks jika Gemini API terkena 503
const getSmartJsonFallback = (userMessage) => {
  const q = userMessage.toLowerCase();

  // 1. Sapaan
  if (/^(halo|hallo|hai|hi|hello|pagi|siang|sore|malam|assalamualaikum|permisi|ping|tes|test)[!.? ]*$/i.test(q.trim())) {
    return {
      reply: 'Halo Kak! 👋 Selamat datang di **Wuling Arista Lampung**. Senang bisa menyapa Kakak hari ini! Ada unit, teknologi, atau promo Wuling yang ingin Kakak tanyakan?',
      visual: 'none',
      recommendations: [
        'Apa promo diskon Binguo MY26?',
        'Apa bedanya unit Darion dengan Eksion?',
        'Berapa lama garansi mesin untuk Wuling Eksion?'
      ]
    };
  }

  // 2. Garansi Mesin / Komponen Wuling Eksion (PERBAIKAN KEKELIRUAN 2: Fokus hanya ke garansi Eksion, visual: none)
  if (q.includes('garansi')) {
    return {
      reply: 'Untuk unit **Wuling Eksion (EV maupun PHEV)** di Wuling Arista Lampung, Kakak mendapatkan perlindungan **Lifetime Warranty (Garansi Seumur Hidup)** khusus untuk **3 komponen inti elektrifikasi** (Baterai *MAGIC Battery Pro*, *Drive Motor*, dan *Motor Control Unit*).\n\nSelain itu, mesin dan komponen kendaraan lainnya juga dilindungi garansi resmi pabrik Wuling secara menyeluruh, sehingga sangat aman untuk pemakaian jangka panjang, Kak! 😊',
      visual: 'none',
      recommendations: [
        'Apa bedanya unit Darion dengan Eksion?',
        'Apa itu Ling Power Hybrid System pada Eksion PHEV?',
        'Berapa harga OTR Wuling Eksion di Lampung?'
      ]
    };
  }

  // 3. Perbandingan Darion vs Eksion (PERBAIKAN KEKELIRUAN 1: Set visual ke 'none' karena user tidak meminta WFMS)
  if (q.includes('beda') && q.includes('darion') && q.includes('eksion')) {
    return {
      reply: 'Perbedaan utama antara **Wuling Darion** dan **Wuling Eksion** terletak pada kapasitas kabin dan karakternya, Kak:\n\n• **Wuling Darion:** Dirancang sebagai MPV/SUV **7-Seater** keluarga yang lapang dengan jarak tempuh EV hingga **540 KM** (Harga OTR Lampung mulai **Rp 417,8 Juta** untuk EV & **Rp 462 Juta** untuk PHEV).\n• **Wuling Eksion:** Dirancang sebagai SUV tangguh berkapasitas baterai **69,10 kWh** dengan jarak tempuh **530 KM CLTC** (Harga OTR Lampung mulai **Rp 416,8 Juta** untuk EV & **Rp 474 Juta** untuk PHEV).',
      visual: 'none',
      recommendations: [
        'Berapa jarak tempuh Darion EV vs Darion PHEV?',
        'Berapa lama garansi mesin untuk Wuling Eksion?',
        'Apa itu WFMS pada unit Darion?'
      ]
    };
  }

  // 4. Jarak Tempuh Darion EV vs PHEV (Tanpa tombol visual yang tidak diminta)
  if (q.includes('jarak') && q.includes('darion')) {
    return {
      reply: '**Wuling Darion EV** sanggup menempuh jarak hingga **540 KM** dalam sekali pengisian daya penuh (biaya cas di rumah hanya sekitar **Rp 100 ribuan**).\n\nSedangkan **Darion PHEV** menggabungkan motor listrik dengan mesin bensin 1.5L *Ling Power Hybrid*, sehingga bisa menempuh perjalanan jarak jauh lintas kota (1.125 KM ++) tanpa perlu khawatir mencari SPKLU.',
      visual: 'none',
      recommendations: [
        'Berapa lama pengecasan Darion EV jika mengecas di SPKLU?',
        'Apa itu Ling Power Hybrid System?',
        'Apa bedanya unit Darion dengan Eksion?'
      ]
    };
  }

  // 5. Pengecasan SPKLU
  if (q.includes('spklu') || (q.includes('lama') && q.includes('cas'))) {
    return {
      reply: 'Jika mengecas di **SPKLU** menggunakan fitur *DC Fast Charging*, pengisian daya **Darion EV** maupun **Eksion EV** dari 30% hingga 80% hanya membutuhkan waktu sekitar **30–35 menit** saja, Kak (tarif SPKLU ±Rp 2.466/kWh).',
      visual: 'none',
      recommendations: [
        'Apa itu Magic Battery Pro pada Wuling EV?',
        'Berapa lama garansi mesin untuk Wuling Eksion?',
        'Apa promo diskon Binguo MY26?'
      ]
    };
  }

  // 6. Spesifik bertanya tentang WFMS (BARU MUNCULKAN VISUAL WFMS)
  if (q.includes('wfms')) {
    return {
      reply: '**WFMS (Wonder Flexible Modular System)** pada unit **Wuling Darion** adalah desain arsitektur modular generasi terbaru Wuling untuk mengintegrasikan teknologi pintar dan elektrifikasi.\n\nKeunggulannya memberikan pengalaman berkendara lebih stabil, pengisian daya lebih cepat, keamanan tinggi, serta jarak tempuh lebih jauh.',
      visual: 'wfms',
      recommendations: [
        'Apa bedanya unit Darion dengan Eksion?',
        'Berapa jarak tempuh Darion EV vs Darion PHEV?',
        'Apa itu Magic Battery Pro pada Wuling EV?'
      ]
    };
  }

  // 7. Spesifik bertanya tentang Magic Battery Pro (BARU MUNCULKAN VISUAL BATERAI)
  if (q.includes('magic') || q.includes('battery') || q.includes('baterai')) {
    return {
      reply: '**MAGIC Battery Pro** pada Wuling EV & PHEV dilengkapi **5 perlindungan keamanan tingkat tinggi**:\n1. **Zero Spontaneous Combustion** (Tanpa terbakar spontan)\n2. **Zero Diffusion** (Tanpa penyebaran api/panas)\n3. **Zero Water Ingress** (Kedap air)\n4. **Zero Intrusion** (Tahan benturan fisik)\n5. **Zero Leakage** (Bebas kebocoran)',
      visual: 'magic-battery',
      recommendations: [
        'Apa itu Ling Power Hybrid System?',
        'Berapa lama garansi mesin untuk Wuling Eksion?',
        'Berapa lama pengecasan Darion EV jika mengecas di SPKLU?'
      ]
    };
  }

  // 8. Spesifik bertanya tentang Ling Power Hybrid (BARU MUNCULKAN VISUAL LING POWER)
  if (q.includes('ling power') || q.includes('hybrid')) {
    return {
      reply: '**LING POWER Hybrid System** (khusus varian PHEV) memadukan 4 komponen inti:\n• **1.5L Atkinson-cycle Engine** (Efisiensi termal 43,2%)\n• **145 kW Drive Motor** (Adaptasi teknologi kereta cepat)\n• **Dedicated Hybrid Transmission (DHT)** (Respons 0,1 detik)\n• **Ultra Safe MAGIC Battery Pro**\n\nDilengkapi **3 Mode Energi**: *EV Mode*, *Series Hybrid*, dan *Parallel Hybrid*.',
      visual: 'ling-power',
      recommendations: [
        'Berapa lama garansi mesin untuk Wuling Eksion?',
        'Apa bedanya unit Darion dengan Eksion?',
        'Apa itu Magic Battery Pro pada Wuling EV?'
      ]
    };
  }

  // 9. Promo Binguo MY26
  if (q.includes('binguo') || q.includes('my26') || q.includes('promo') || q.includes('diskon')) {
    return {
      reply: 'Khusus bulan November di Wuling Arista Lampung, **New Binguo MY26 Interior Baru** sedang ada diskon spesial:\n• **Binguo Lite MY26:** Turun dari Rp 301,5 Juta menjadi **Rp 274.500.000** (Transmisi baru di kiri setir, console tengah baru, jok *Mocca Latte* motif Batik).\n• **Binguo Pro MY26:** Turun dari Rp 331,5 Juta menjadi **Rp 304.500.000** (Tambah *Wireless Charging 50W*, jok *Caramel Latte*, & Velg Racing/Alloy).',
      visual: 'none',
      recommendations: [
        'Apa itu Magic Battery Pro pada Wuling EV?',
        'Apa bedanya unit Darion dengan Eksion?',
        'Di mana lokasi showroom Wuling Lampung?'
      ]
    };
  }

  // 10. Harga Eksion / Darion
  if (q.includes('eksion') || q.includes('darion')) {
    return {
      reply: 'Untuk lini SUV & MPV elektrifikasi terbaru kami di Wuling Arista Lampung:\n• **Wuling Eksion:** EV mulai **Rp 416,8 Juta** & PHEV mulai **Rp 474 Juta**.\n• **Wuling Darion (7-Seater):** EV mulai **Rp 417,8 Juta** & PHEV mulai **Rp 462 Juta**.\n\nKeduanya sudah dilengkapi **Garansi Seumur Hidup (Lifetime Warranty)** komponen inti EV/PHEV!',
      visual: 'none',
      recommendations: [
        'Apa bedanya unit Darion dengan Eksion?',
        'Berapa lama garansi mesin untuk Wuling Eksion?',
        'Apa itu WFMS pada unit Darion?'
      ]
    };
  }

  return {
    reply: `Halo Kak! Untuk pertanyaan mengenai **"${userMessage}"**, Kakak bisa langsung konsultasi dengan Mas Farrel melalui tombol WhatsApp di halaman utama agar mendapatkan rincian yang paling pas, atau pilih topik informasi unit Wuling di bawah ini ya! 😊`,
    visual: 'none',
    recommendations: [
      'Apa promo diskon Binguo MY26?',
      'Apa bedanya unit Darion dengan Eksion?',
      'Berapa lama garansi mesin untuk Wuling Eksion?'
    ]
  };
};

app.post('/api/chat', chatLimiter, async (req, res) => {
  const { history, message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Pesan tidak boleh kosong.' });
  }

  const systemInstruction = `
Kamu adalah Wuling AI Assistant resmi untuk Alessandro Farrel Gerrard Wijaya (Sales Executive Wuling Arista Lampung).
Gunakan DATA PENGETAHUAN RESMI berikut untuk menjawab pertanyaan pengguna secara langsung, fokus pada unit yang ditanyakan saja, ramah (panggil "Kak"), dan ringkas. Gunakan **teks tebal** pada poin penting.

${WULING_KNOWLEDGE_BASE}

ATURAN KETAT:
1. Jawab HANYA apa yang ditanyakan pengguna. Jangan menyebutkan daftar harga mobil lain jika pengguna hanya bertanya tentang 1 unit tertentu (misal hanya bertanya garansi Eksion, jawab khusus garansi Eksion).
2. ATURAN VISUAL SANGAT KETAT: Isi field "visual" dengan "none" KECUALI pengguna secara eksplisit bertanya tentang komponen teknis berikut:
   - Isi "wfms" HANYA jika pengguna bertanya langsung tentang apa itu WFMS. Jika hanya bertanya perbandingan mobil Darion vs Eksion, WAJIB isi "none".
   - Isi "magic-battery" HANYA jika pengguna bertanya langsung tentang Magic Battery Pro / spesifikasi keamanan baterai.
   - Isi "ling-power" HANYA jika pengguna bertanya langsung tentang cara kerja Ling Power Hybrid System.
   - Selain 3 pertanyaan komponen di atas, WAJIB isi "none".
3. Pada field "recommendations", buatkan 3 pertanyaan lanjutan singkat yang berkaitan erat dengan jawabanmu.
`;

  const cleanHistory = Array.isArray(history)
    ? history
        .filter((h, index) => !(index === 0 && h.sender === 'bot'))
        .slice(-6)
        .map(h => ({
          role: h.sender === 'user' ? 'user' : 'model',
          parts: [{ text: h.text }]
        }))
    : [];

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), 5000)
    );

    const geminiPromise = (async () => {
      const chat = ai.chats.create({
        model: 'gemini-3.8-flash',
        history: cleanHistory,
        config: {
          systemInstruction,
          temperature: 0.3,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: {
                type: Type.STRING,
                description: 'Jawaban langsung yang fokus pada pertanyaan pengguna.'
              },
              visual: {
                type: Type.STRING,
                description: 'Isi "none" kecuali user spesifik bertanya komponen "wfms", "magic-battery", atau "ling-power".'
              },
              recommendations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '3 pertanyaan rekomendasi lanjutan.'
              }
            },
            required: ['reply', 'visual', 'recommendations']
          }
        }
      });

      const result = await chat.sendMessage({ message });
      return JSON.parse(result.text);
    })();

    const structuredData = await Promise.race([geminiPromise, timeoutPromise]);
    return res.json(structuredData);

  } catch (error) {
    console.warn(`⚡ Menggunakan JSON Fallback Akurat (${error.message || error.status})`);
    return res.json(getSmartJsonFallback(message));
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Backend Wuling AI (Precision Mode) berjalan di http://localhost:${PORT}`);
});