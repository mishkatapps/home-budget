// دالة Supabase Edge: تستقبل صورة فاتورة وتعيد بياناتها باستخدام Gemini.
// مفتاح Gemini يبقى سراً على الخادم:  supabase secrets set GEMINI_API_KEY=...
// النشر:  supabase functions deploy analyze-receipt
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    // لا يُسمح إلا لعضو معتمد (مدير أو عضو)
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: role } = await sb.rpc('my_role');
    if (role !== 'admin' && role !== 'member') return json({ error: 'غير مصرح لك بتحليل الفواتير' }, 403);

    // حد يومي لكل أسرة حتى لا تُستنزف حصة Gemini المشتركة
    const { data: allowed } = await sb.rpc('claim_receipt_scan');
    if (!allowed) return json({ error: 'بلغت أسرتك الحد اليومي لتحليل الفواتير (30). حاول غداً أو أدخل البيانات يدوياً.' }, 429);

    const key = Deno.env.get('GEMINI_API_KEY');
    if (!key) return json({ error: 'لم يُضبط مفتاح GEMINI_API_KEY على الخادم' }, 500);
    const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-flash-latest';

    const { image, mime, categories } = await req.json();
    if (typeof image !== 'string' || image.length > 8_000_000) return json({ error: 'صورة غير صالحة أو كبيرة جداً' }, 400);
    const cats = Array.isArray(categories) ? categories.filter((c) => typeof c === 'string').slice(0, 100) : [];

    const prompt = `هذه صورة فاتورة أو إيصال شراء (قد تكون بالعربية أو الإنجليزية، مطبوعة أو بخط اليد).
استخرج البيانات وأعد JSON فقط بهذا الشكل:
{"merchant": اسم المحل أو null, "date": تاريخ الفاتورة بصيغة YYYY-MM-DD أو null, "total": الإجمالي النهائي المدفوع كرقم أو null,
 "items": [{"name": اسم الصنف, "price": إجمالي سعر الصنف كرقم أو null}], "category": أنسب بند من القائمة التالية حرفياً أو null}
قائمة البنود: ${JSON.stringify(cats)}
لا تخمّن أرقاماً غير مقروءة؛ ضع null. الأرقام بدون فواصل آلاف أو رمز عملة.`;

    const body = JSON.stringify({
      contents: [{ parts: [{ inline_data: { mime_type: mime || 'image/jpeg', data: image } }, { text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0 },
    });
    // أسماء النماذج تتغير: نجرب المضبوط ثم بدائل، وننتقل للتالي إن كان النموذج غير موجود
    const models = [...new Set([model, 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash'])];
    let res: Response | null = null;
    let detail = '';
    for (const m of models) {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body,
      });
      if (res.ok) break;
      const errText = await res.text();
      console.error('gemini error', m, res.status, errText);
      try { detail = JSON.parse(errText)?.error?.message ?? ''; } catch { detail = ''; }
      if (res.status !== 404) break;
    }
    if (!res || !res.ok) {
      return json({ error: `خدمة التحليل رفضت الطلب (${res?.status}): ${detail.slice(0, 200)}` }, 502);
    }
    const out = await res.json();
    const text: string = out?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
    if (!text) {
      console.error('gemini empty', JSON.stringify(out).slice(0, 500));
      return json({ error: `لم يُرجع النموذج نصاً (${out?.candidates?.[0]?.finishReason ?? out?.promptFeedback?.blockReason ?? 'بلا سبب'})` }, 502);
    }
    const start = text.indexOf('{');
    const r = JSON.parse(start >= 0 ? text.slice(start, text.lastIndexOf('}') + 1) : text);

    const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : null);
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
    return json({
      merchant: str(r.merchant),
      date: str(r.date),
      total: num(r.total),
      items: (Array.isArray(r.items) ? r.items : []).slice(0, 100)
        .map((i: { name?: unknown; price?: unknown }) => ({ name: str(i?.name) ?? '', price: num(i?.price) }))
        .filter((i: { name: string }) => i.name),
      category: cats.includes(r.category) ? r.category : null,
    });
  } catch (e) {
    console.error(e);
    return json({ error: `تعذرت قراءة الفاتورة. حاول بصورة أوضح. (${String((e as Error)?.message ?? e).slice(0, 120)})` }, 500);
  }
});
