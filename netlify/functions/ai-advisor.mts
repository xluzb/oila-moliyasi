import { GoogleGenAI } from '@google/genai';

const MODEL = 'gemini-3.8-flash';

interface HistoryItem {
  role: 'user' | 'model';
  text: string;
}

const buildSystemInstruction = (contextData: unknown) => `Siz "Oila Moliya" platformasining shaxsiy moliya va kredit bo'yicha maslahatchisisiz.
Vazifangiz: O'zbekiston oilalarining moliyaviy barqarorligini oshirish, kredit yukini (DTI) kamaytirish, to'g'ri byudjet taqsimotini shakllantirish va investitsiya/jamg'arma madaniyatini rivojlantirish.
Muloqot tili: Faqat o'zbek tilida (lotin alifbosida).
Ohangingiz: Do'stona, hurmatli, dalillarga va aniq raqamlarga asoslangan, tushunarli.

Muhim qoidalar:
1. O'zbekiston bank tizimi va valyutasi (so'm - UZS) xususiyatlarini inobatga oling (annuitet, differensial to'lovlar, nasiya/muddatli to'lovlar, mikromoliya).
2. Kredit strategiyasi: Avalanche (Ko'chki - eng yuqori foizlilarni birinchi yopish) va Snowball (Qor to'pi - eng kichik summalilarni tez yopib motivatsiya olish) metodlarini tushuntiring.
3. DTI (Qarz yuki nisbati) 50% dan oshsa, zudlik bilan yangi qarz olmaslikni va ortiqcha xarajatlarni to'xtatishni qat'iy tavsiya eting.
4. Har doim favqulodda zaxira (kamida 3 oylik majburiy xarajatlar) haqida eslatib turing.
5. Javoblarni qisqa va aniq tuzing, oddiy matn formatida yozing.
6. Har bir javobingiz oxirida "Tavsiyalar umumiy xarakterga ega va professional moliyaviy maslahat o'rnini bosmaydi" degan qisqa eslatma bo'lsin.

Foydalanuvchining ayni paytdagi moliyaviy ko'rsatkichlari (JSON):
${contextData ? JSON.stringify(contextData, null, 2) : "Foydalanuvchi hali to'liq moliyaviy ma'lumotlarni kiritmadi."}`;

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body: { question?: unknown; contextData?: unknown; history?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Noto'g'ri so'rov formati" }, { status: 400 });
  }

  const question = typeof body.question === 'string' ? body.question.trim().slice(0, 2000) : '';
  if (!question) {
    return Response.json({ error: 'Savol kiritilmagan' }, { status: 400 });
  }

  const history: HistoryItem[] = Array.isArray(body.history)
    ? (body.history as HistoryItem[])
        .filter((h) => h && typeof h.text === 'string')
        .slice(-6)
    : [];

  const contents = [
    ...history.map((h) => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text.slice(0, 4000) }],
    })),
    { role: 'user', parts: [{ text: question }] },
  ];

  try {
    const ai = new GoogleGenAI({});
    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction: buildSystemInstruction(body.contextData),
        temperature: 0.7,
      },
    });

    return Response.json({
      text: response.text || "Kechirasiz, javob shakllantirilmadi. Iltimos, qaytadan urinib ko'ring.",
    });
  } catch (error) {
    console.error('AI advisor error:', error);
    return Response.json({ error: "AI xizmati bilan bog'lanishda xatolik yuz berdi." }, { status: 502 });
  }
};

export const config = {
  path: '/api/ai/advisor',
};
