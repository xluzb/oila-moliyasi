import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize GoogleGenAI instance server-side
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// AI Chat Endpoint
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, history = [], financialContext = '' } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!ai) {
      return res.status(200).json({
        reply: `⚠️ Gemini API kaliti sozlanmagan yoki topilmadi. Siz ilovaning barcha hisob-kitob vositalari, DTI tahlili, Ko'chki/Qor to'pi strategiyalari va kalkulyatorlaridan to'liq foydalanishingiz mumkin. Savolingiz: "${message}". Maslahat: Byudjetingizdagi yuqori foizli kreditlarni (25%+ mikrokredit yoki nasiyalar) birinchi bo'lib yopish eng katta iqtisodiy samara beradi.`,
      });
    }

    const systemInstruction = `Siz "Oila Moliya" platformasining shaxsiy moliya va kredit bo'yicha maslahatchisisiz.
Vazifangiz: O'zbekiston oilalarining moliyaviy barqarorligini oshirish, kredit yukini (DTI) kamaytirish, to'g'ri byudjet taqsimotini shakllantirish va investitsiya/jamg'arma madaniyatini rivojlantirish.
Muloqot tili: Faqat o'zbek tilida (lotin alifbosida).
Tohangiz: Do'stona, hurmatli, dalillarga va aniq raqamlarga asoslangan, tushunarli.

Muhim qoidalar:
1. O'zbekiston bank tizimi va valyutasi (so'm - UZS) xususiyatlarini inobatga oling (annuitet, differensial to'lovlar, nasiya/muddatli to'lovlar, mikromoliya).
2. Kredit strategiyasi: Avalanche (Ko'chki - eng yuqori foizlilarni birinchi yopish) va Snowball (Qor to'pi - eng kichik summalilarni tez yopib motivatsiya olish) metodlarini tushuntiring.
3. DTI (Qarz yuki nisbati) 50% dan oshsa, zudlik bilan yangi qarz olmaslikni va ortiqcha xarajatlarni to'xtatishni qat'iy tavsiya eting.
4. Har doim favqulodda zaxira (kamida 3 oylik majburiy xarajatlar) haqida eslatib turing.
5. Har bir javobingiz oxirida "Tavsiyalar umumiy xarakterga ega va professional moliyaviy maslahat o'rnini bosmaydi" degan qisqa eslatma bo'lsin.

Foydalanuvchining ayni paytdagi moliyaviy ko'rsatkichlari:
${financialContext || 'Foydalanuvchi hali toliq moliyaviy ma\'lumotlarni kiritmadi.'}`;

    // Prepare contents
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    for (const h of history.slice(-6)) {
      contents.push({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.text }],
      });
    }

    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const reply = response.text || 'Kechirasiz, javob shakllantirilmadi. Iltimos, qaytadan urinib ko\'ring.';
    return res.json({ reply });
  } catch (error: any) {
    console.error('Gemini chat error:', error);
    return res.status(500).json({
      error: 'AI xizmati bilan bog\'lanishda xatolik yuz berdi.',
      details: error?.message || String(error),
    });
  }
});

// AI Monthly Report Endpoint
app.post('/api/ai/monthly-report', async (req, res) => {
  try {
    const { summary } = req.body;

    if (!ai) {
      return res.status(200).json({
        report: {
          goodPoints: [
            'Daromad manbalari va kredit to\'lovlari intizom bilan nazorat qilinmoqda.',
            'Oylik majburiy xarajatlar aniq hisoblab chiqilgan.',
          ],
          riskPoints: [
            'Kreditlar bo\'yicha oylik to\'lov yukini doimiy nazorat qilib boring.',
            'To\'y, marosim va rejadan tashqari ko\'ngilochar xarajatlarni nazorat ostida ushlang.',
          ],
          recommendations: [
            'Erkin summaning kamida 50% qismini eng yuqori foizli kreditga qo\'shimcha to\'lov sifatida yo\'naltiring.',
            'Har oy daromadning 10% ini avariya zaxirasiga (favqulodda jamg\'armaga) ajrating.',
            'Kommunal hisoblagich ko\'rsatkichlarini oyning bir xil sanasida kiritib borish odatini shakllantiring.',
          ],
        },
      });
    }

    const prompt = `Quyidagi oilaviy moliya holatiga oylik tahlil va xulosa bering:
${JSON.stringify(summary, null, 2)}

Iltimos, JSON formatida javob bering, struktura:
{
  "goodPoints": ["nima yaxshi bo'lganligi haqida 2 ta punkt"],
  "riskPoints": ["qayerda ortiqcha sarf yoki xavf borligi haqida 2 ta punkt"],
  "recommendations": ["keyingi oy uchun 3 ta aniq va amaliy tavsiya"]
}
Barcha matnlar o'zbek tilida (lotin) bo'lsin.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.4,
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({ report: parsed });
  } catch (error: any) {
    console.error('Gemini monthly report error:', error);
    return res.status(500).json({
      error: 'Oylik hisobot shakllantirishda xatolik yuz berdi.',
      details: error?.message || String(error),
    });
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Mount Vite or serve static dist
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(express.static(path.resolve(__dirname, 'public')));
    app.use(vite.middlewares);

    const fs = await import('fs');
    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Oila Moliya server running on http://localhost:${PORT}`);
  });
}

startServer();
