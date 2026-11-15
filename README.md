# ميزانية البيت

تطبيق ويب عربي من [مشكاة](https://mishkatapps.github.io) لتسجيل دخل الأسرة ومصروفاتها ومتابعة ميزانيتها. يعمل من المتصفح على أندرويد وآيفون وويندوز وماك، ويمكن تثبيته على الشاشة الرئيسية.

- **الأسرة**: كل مستخدم ينشئ أسرته ويصبح مديرها، ثم يدعو أفرادها برمز دعوة ويمنحهم الصلاحيات (مدير / عضو / مشاهد). بيانات كل أسرة معزولة عن غيرها.
- **الدخل**: دفعة واحدة أو عدة دفعات في الشهر، تُجمع تلقائياً.
- **المصروفات**: بند، مبلغ، تاريخ، مستفيد، ملاحظات، وصورة فاتورة اختيارية.
- **الإحصاءات**: المتبقي من الشهر، الرصيد التراكمي، معدل الصرف اليومي والمتوقع، مقارنة بالشهر السابق، توزيع حسب البند والمستفيد، رسم شهري، وملخص السنوات.
- **الميزانيات**: ميزانية شهرية اختيارية لكل عضو ولكل بند.
- **سجل العمليات**: كل إضافة وتعديل وحذف يُسجَّل بالتاريخ والوقت واسم المستخدم.
- **الفواتير**: تصوير الفاتورة وتحليلها بـ Gemini لملء المبلغ والتاريخ والبند والأصناف.

## التشغيل محلياً

```bash
npm install
npm run dev
```

بدون إعدادات Supabase يعمل التطبيق في وضع تجريبي على الجهاز فقط (التعديلات لا تُحفظ بعد إعادة التحميل).
للربط بقاعدة: انسخ `.env.example` إلى `.env.local` واملأ القيمتين.

## إعداد الخادم (Supabase)

1. أنشئ مشروعاً على [supabase.com](https://supabase.com).
2. من **SQL Editor** شغّل محتوى `supabase/schema.sql` (آمن لإعادة التشغيل).
3. من **Authentication → Sign In / Providers → Google** فعّل جوجل بـ Client ID و Secret من
   [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (OAuth client من نوع Web، وفيه عنوان الـ callback الذي يعرضه Supabase).
4. من **Authentication → URL Configuration** اجعل Site URL عنوان التطبيق، وأضف عنوان التطبيق و `http://localhost:5173/**` إلى Redirect URLs.

### تحليل الفواتير (Gemini)

```bash
supabase login
supabase link --project-ref <معرّف-المشروع>
supabase secrets set GEMINI_API_KEY=<مفتاح من Google AI Studio>
supabase functions deploy analyze-receipt
```

النموذج الافتراضي `gemini-2.5-flash`؛ لتغييره: `supabase secrets set GEMINI_MODEL=<اسم النموذج>`. الحد اليومي 30 فاتورة لكل أسرة.

## النشر (GitHub Pages)

كل push إلى `main` يبني التطبيق وينشره (`.github/workflows/deploy.yml`). يلزم مرة واحدة: **Settings → Pages → Source: GitHub Actions**.

إعدادات القاعدة تُقرأ من `.env.production`. لنشر نسخة مربوطة بقاعدة أخرى من مستودع آخر أضف في
**Settings → Secrets and variables → Actions → Variables** القيمتين `VITE_SUPABASE_URL` و `VITE_SUPABASE_ANON_KEY` فتأخذان الأولوية.

## الخصوصية والأمان

- مفتاح publishable/anon عام بطبيعته؛ الحماية في سياسات RLS داخل `supabase/schema.sql`: لا يقرأ بيانات الأسرة إلا عضو اعتمده مديرها.
- صور الفواتير في مخزن خاص بمجلد لكل أسرة، ومفتاح Gemini على الخادم فقط.

## الدخول بحساب آبل

يتطلب اشتراك Apple Developer. بعد تفعيل Apple في Supabase اجعل `VITE_ENABLE_APPLE=true` فيظهر الزر.
