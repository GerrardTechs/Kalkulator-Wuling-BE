import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1);

app.use(cors({
  origin: [
    'https://wulingmate.netlify.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 35,
  message: { error: 'Terlalu banyak permintaan. Silakan tunggu sebentar sebelum bertanya lagi, Kak.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================================================
// 1. KONFIGURASI LOAD BALANCER (Mendukung Banyak API Key Gemini + Groq Backup)
// ============================================================================
const geminiKeys = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2, // Opsional: jika nanti kamu tambah key ke-2 di Render
  process.env.GEMINI_API_KEY_3  // Opsional: jika nanti kamu tambah key ke-3 di Render
].filter(Boolean);

let currentKeyIndex = 0;

// Fungsi Round-Robin: Mengambil API Key Gemini secara bergantian agar tidak kelelahan
const getNextGeminiClient = () => {
  const key = geminiKeys[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % geminiKeys.length;
  return new GoogleGenAI({ apiKey: key });
};

// ============================================================================
// 2. IN-MEMORY CACHE (Menyimpan jawaban AI agar pertanyaan sama tidak boros kuota)
// ============================================================================
const aiResponseCache = new Map();
const MAX_CACHE_SIZE = 200; // Maksimal menyimpan 200 variasi pertanyaan di RAM

// ============================================================================
// 3. LOCAL ENGINE (Menjawab Instan < 0.01 Detik untuk Rekomendasi & Sapaan)
// ============================================================================
const checkLocalEngine = (userMessage) => {
  const q = userMessage.trim().toLowerCase();

  // A. Sapaan Singkat
  if (/^(halo|hallo|hai|hi|hello|pagi|siang|sore|malam|assalamualaikum|permisi|ping|tes|test)[!.? ]*$/i.test(q)) {
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

  // B. Pertanyaan Rekomendasi 1: Promo Diskon Binguo MY26
  if (q === 'apa promo diskon binguo my26?' || (q.includes('promo') && q.includes('binguo'))) {
    return {
      reply: 'Khusus bulan November di Wuling Arista Lampung, **New Binguo MY26 Interior Baru** sedang ada diskon spesial OTR Lampung:\n\n• **Binguo Lite MY26:** Turun dari Rp 301,5 Juta menjadi **Rp 274.500.000** (Tuas transmisi baru di kiri setir, console tengah baru, jok *Mocca Latte* motif Batik).\n• **Binguo Pro MY26:** Turun dari Rp 331,5 Juta menjadi **Rp 304.500.000** (Tambah *Wireless Charging 50W*, jok *Caramel Latte*, & Velg Alloy/Racing).',
      visual: 'none',
      recommendations: [
        'Apa itu Magic Battery Pro pada Wuling EV?',
        'Apa bedanya unit Darion dengan Eksion?',
        'Di mana lokasi showroom Wuling Lampung?'
      ]
    };
  }

  // C. Pertanyaan Rekomendasi 2: WFMS pada Darion
  if (q === 'apa itu wfms pada unit darion?' || q.includes('wfms')) {
    return {
      reply: '**WFMS (Wonder Flexible Modular System)** pada unit **Wuling Darion** adalah desain arsitektur modular generasi terbaru Wuling untuk mengintegrasikan teknologi pintar dan elektrifikasi.\n\nKeunggulannya memberikan pengalaman berkendara lebih stabil, pengisian daya lebih cepat, keamanan tinggi, serta jarak tempuh mencapai **540 KM**!',
      visual: 'wfms',
      recommendations: [
        'Apa bedanya unit Darion dengan Eksion?',
        'Berapa jarak tempuh Darion EV vs Darion PHEV?',
        'Apa itu Magic Battery Pro pada Wuling EV?'
      ]
    };
  }

  // D. Pertanyaan Rekomendasi 3: Magic Battery Pro
  if (q === 'apa itu magic battery pro pada wuling ev?' || q.includes('magic battery')) {
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

  // E. Pertanyaan Rekomendasi 4: Ling Power Hybrid System
  if (q.includes('ling power')) {
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

  // F. Pertanyaan Rekomendasi 5: Garansi Mesin Wuling Eksion
  if (q === 'berapa lama garansi mesin untuk wuling eksion?' || (q.includes('garansi') && q.includes('eksion'))) {
    return {
      reply: 'Untuk unit **Wuling Eksion (EV maupun PHEV)** di Wuling Arista Lampung, Kakak mendapatkan perlindungan **Lifetime Warranty (Garansi Seumur Hidup)** khusus untuk **3 komponen inti elektrifikasi** (Baterai *MAGIC Battery Pro*, *Drive Motor*, dan *Motor Control Unit*).\n\nSelain itu, mesin dan komponen kendaraan lainnya juga dilindungi garansi resmi pabrik Wuling secara menyeluruh, Kak! 😊',
      visual: 'none',
      recommendations: [
        'Apa bedanya unit Darion dengan Eksion?',
        'Apa itu Ling Power Hybrid System?',
        'Apa promo diskon Binguo MY26?'
      ]
    };
  }

  // G. Pertanyaan Rekomendasi 6: Beda Darion dengan Eksion
  if (q.includes('beda') && q.includes('darion') && q.includes('eksion')) {
    return {
      reply: 'Perbedaan utama antara **Wuling Darion** dan **Wuling Eksion** terletak pada kapasitas kabin dan karakternya, Kak:\n\n• **Wuling Darion:** MPV/SUV **7-Seater** keluarga yang lapang dengan jarak tempuh EV hingga **540 KM** (Harga OTR Lampung mulai **Rp 417,8 Juta** EV & **Rp 462 Juta** PHEV).\n• **Wuling Eksion:** SUV **5-Seater** tangguh berkapasitas baterai **69,10 kWh** dengan jarak tempuh **530 KM CLTC** (Harga OTR Lampung mulai **Rp 416,8 Juta** EV & **Rp 474 Juta** PHEV).',
      visual: 'none',
      recommendations: [
        'Berapa jarak tempuh Darion EV vs Darion PHEV?',
        'Berapa lama pengecasan Darion EV jika mengecas di SPKLU?',
        'Berapa lama garansi mesin untuk Wuling Eksion?'
      ]
    };
  }

  // H. Pertanyaan Rekomendasi 7: Jarak Tempuh Darion EV vs PHEV
  if (q.includes('jarak tempuh') && q.includes('darion')) {
    return {
      reply: '**Wuling Darion EV** sanggup menempuh jarak hingga **540 KM** dalam sekali pengisian daya penuh (biaya cas di rumah hanya sekitar **Rp 100 ribuan**).\n\nSedangkan **Darion PHEV** menggabungkan motor listrik dengan mesin bensin 1.5L *Ling Power Hybrid*, sehingga bebas khawatir untuk perjalanan jauh lintas provinsi.',
      visual: 'none',
      recommendations: [
        'Berapa lama pengecasan Darion EV jika mengecas di SPKLU?',
        'Apa itu Ling Power Hybrid System?',
        'Apa bedanya unit Darion dengan Eksion?'
      ]
    };
  }

  // I. Pertanyaan Rekomendasi 8: Lama Pengecasan SPKLU
  if (q === 'berapa lama pengecasan darion ev jika mengecas di spklu?' || (q.includes('spklu') && q.includes('lama'))) {
    return {
      reply: 'Jika mengecas di **SPKLU** menggunakan fitur *DC Fast Charging*, pengisian daya **Darion EV** maupun **Eksion EV** dari 30% hingga 80% hanya membutuhkan waktu sekitar **30–35 menit** saja, Kak (tarif SPKLU ±Rp 2.466/kWh).',
      visual: 'none',
      recommendations: [
        'Apa itu Magic Battery Pro pada Wuling EV?',
        'Berapa lama garansi mesin untuk Wuling Eksion?',
        'Di mana lokasi showroom Wuling Lampung?'
      ]
    };
  }

  // J. Pertanyaan Rekomendasi 9: Lokasi Showroom Lampung
  if (q === 'di mana lokasi showroom wuling lampung?' || q.includes('lokasi showroom')) {
    return {
      reply: 'Showroom & Bengkel Resmi kami berlokasi di **Wuling Arista Lampung**, **Jl. ZA Pagar Alam No. 99, Rajabasa, Bandar Lampung**.\n\nKakak bisa datang langsung atau jadwalkan *Home Test Drive* melalui tombol WhatsApp di halaman utama ya! 😊',
      visual: 'none',
      recommendations: [
        'Apa promo diskon Binguo MY26?',
        'Apa bedanya unit Darion dengan Eksion?',
        'Apa itu WFMS pada unit Darion?'
      ]
    };
  }

  return null; // Bukan pertanyaan rekomendasi standar -> Lanjutkan ke Cache / AI
};

// Basis Pengetahuan untuk Pertanyaan Bebas (AI)
const WULING_KNOWLEDGE_BASE = `
Dealer: Wuling Arista Lampung, Jl. ZA Pagar Alam No. 99, Rajabasa, Bandar Lampung.
Garansi: Lifetime Warranty (Garansi Seumur Hidup) komponen inti EV & PHEV (Baterai, Drive Motor, MCU). Pajak EV ~Rp 150rb/thn, Servis ~Rp 400rb/thn.
Tarif Cas: Rumah Rp 1.444,70/kWh | Rumah 6600W Rp 1.700/kWh | SPKLU Rp 2.466,78/kWh (Fast charging 30-80% ~30 menit).
Harga OTR Lampung (November 2026):
- Promo New Binguo MY26 Interior Baru: Lite MY26 diskon dari Rp 301,5jt jadi Rp 274.500.000 | Pro MY26 diskon dari Rp 331,5jt jadi Rp 304.500.000 (Tambah Wireless Charging 50W, Jok Caramel Latte, Velg Racing). Reguler Lite Rp 330,4jt, Pro Rp 375,5jt.
- Aira EV (16,2 kWh, 205 km): STDRT Rp 168,5jt | +HC Rp 177jt | +HC Fullpack Rp 183,5jt | PRO Rp 188,5jt | PRO+HC Rp 197jt | PRO+HC Fullpack Rp 203,5jt.
- Darion (7-Seater, WFMS, EV 540 km): EV CE 480 Rp 417,8jt | EV CE Rp 427,8jt | EV EX Rp 487,8jt | PHEV CE Rp 462jt | PHEV EX Rp 512jt.
- Eksion (SUV 5-Seater, 69,1 kWh, 530 km): EV CE Rp 416,8jt | EV EX Rp 486,8jt | PHEV CE Rp 474jt | PHEV EX Rp 524jt.
- New Air EV: 200 Rp 246jt | Lite Rp 282,9jt | Pro Rp 340,1jt.
- New Cloud EV: Lite 360 Rp 310,5jt | Pro 360 Rp 350,5jt | Lite Rp 428,2jt | Pro Rp 456,2jt.
- Unit Bensin & Niaga: Alvez mulai Rp 261jt | Confero mulai Rp 230,8jt | Mitra EV mulai Rp 347jt | Formo mulai Rp 200,6jt.
`;

app.get('/', (req, res) => {
  res.send('🚀 Backend WulingMate AI (Local Engine + Cache + Load Balancer) Aktif!');
});

app.post('/api/chat', chatLimiter, async (req, res) => {
  const { history, message } = req.body || {};

  if (!message) {
    return res.status(400).json({ error: 'Pesan tidak boleh kosong.' });
  }

  const normalizedKey = message.trim().toLowerCase();

  // LAPIS 1: Cek Local Engine (Instan 0ms untuk pertanyaan rekomendasi & sapaan)
  const localHit = checkLocalEngine(message);
  if (localHit) {
    console.log(`⚡ [LOCAL ENGINE] Menjawab instan: "${message}"`);
    return res.json(localHit);
  }

  // LAPIS 2: Cek In-Memory Cache (Instan 0ms jika pertanyaan bebas ini sudah pernah ditanyakan user lain)
  if (aiResponseCache.has(normalizedKey)) {
    console.log(`💾 [CACHE HIT] Mengambil dari RAM: "${message}"`);
    return res.json(aiResponseCache.get(normalizedKey));
  }

  // LAPIS 3: Panggil AI dengan Load Balancing (Gemini Multi-Key -> Failover ke Groq)
  const systemInstruction = `
Kamu adalah Wuling AI Assistant resmi Wuling Arista Lampung.
Jawab pertanyaan pengguna secara langsung, fokus pada unit yang ditanyakan saja, ramah ("Kak"), dan ringkas berdasarkan data ini:
${WULING_KNOWLEDGE_BASE}

WAJIB BALAS HANYA DALAM FORMAT JSON VALID SEPERTI INI:
{
  "reply": "Jawaban langsung dengan **bold** pada poin penting",
  "visual": "none",
  "recommendations": ["Pertanyaan lanjutan 1?", "Pertanyaan lanjutan 2?", "Pertanyaan lanjutan 3?"]
}
Aturan field "visual": Isi "none" kecuali user spesifik meminta penjelasan komponen "wfms", "magic-battery", atau "ling-power".
`;

  const cleanHistory = Array.isArray(history)
    ? history
        .filter((h, index) => !(index === 0 && h.sender === 'bot'))
        .slice(-4)
        .map(h => ({
          role: h.sender === 'user' ? 'user' : 'model',
          parts: [{ text: h.text }]
        }))
    : [];

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), 7000)
    );

    const geminiPromise = (async () => {
      const aiClient = getNextGeminiClient(); // Load balancing antar API key
      const chat = aiClient.chats.create({
        model: 'gemini-3.8-flash',
        history: cleanHistory,
        config: {
          systemInstruction,
          temperature: 0.3,
          responseMimeType: 'application/json'
        }
      });

      const result = await chat.sendMessage({ message });
      return JSON.parse(result.text);
    })();

    const aiData = await Promise.race([geminiPromise, timeoutPromise]);

    // Simpan jawaban ke Cache RAM agar penanya berikutnya tidak mengurangi kuota Gemini
    if (aiResponseCache.size >= MAX_CACHE_SIZE) {
      const firstKey = aiResponseCache.keys().next().value;
      aiResponseCache.delete(firstKey);
    }
    aiResponseCache.set(normalizedKey, aiData);

    console.log(`🤖 [GEMINI AI] Berhasil menjawab & disimpan ke Cache: "${message}"`);
    return res.json(aiData);

  } catch (geminiError) {
    console.warn(`⚠️ Gemini sibuk (${geminiError.message || geminiError.status}). Mencoba Load Balancer cadangan...`);

    // FAILOVER LOAD BALANCER: Jika kamu memasang GROQ_API_KEY di Render, otomatis beralih ke Groq
    if (process.env.GROQ_API_KEY) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            temperature: 0.3,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: message }
            ]
          })
        });

        const groqJson = await groqRes.json();
        if (groqRes.ok && groqJson.choices?.[0]?.message?.content) {
          const parsedGroq = JSON.parse(groqJson.choices[0].message.content);
          aiResponseCache.set(normalizedKey, parsedGroq);
          console.log(`🚀 [GROQ LOAD BALANCER] Berhasil menjawab: "${message}"`);
          return res.json(parsedGroq);
        }
      } catch (groqErr) {
        console.warn('⚠️ Groq cadangan gagal:', groqErr.message);
      }
    }

    // Jika semua AI sedang penuh, beri balasan sopan yang mengarahkan ke rekomendasi lokal
    return res.json({
      reply: `Halo Kak! Untuk rincian spesifik mengenai **"${message}"**, Kakak bisa langsung klik tombol WhatsApp di halaman utama agar dibantu hitung simulasi lengkapnya, atau pilih topik informasi unit di bawah ini ya! 😊`,
      visual: 'none',
      recommendations: [
        'Apa promo diskon Binguo MY26?',
        'Apa bedanya unit Darion dengan Eksion?',
        'Berapa lama garansi mesin untuk Wuling Eksion?'
      ]
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Backend Wuling AI berjalan di http://localhost:${PORT}`);
});