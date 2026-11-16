// شعار مشكاة: نجمة ثمانية (مربعان متراكبان) بداخلها كوّة فيها مصباح. الألوان من هوية الكيان.
const NAVY = '#0B1D3F', GOLD = '#D9B15C';

/** رؤوس النجمة الثمانية حول المركز */
function star(cx: number, cy: number, R: number): string {
  const r = R * 0.7654; // نقاط تقاطع المربعين
  return Array.from({ length: 16 }, (_, i) => {
    const a = (Math.PI / 8) * i - Math.PI / 2, rad = i % 2 ? r : R;
    return `${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
}

export function MishkatMark({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="مشكاة">
      <rect width="100" height="100" rx="22" fill={NAVY} />
      <polygon points={star(50, 50, 40)} fill="#10254f" stroke={GOLD} strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M38 66V46a12 12 0 0 1 24 0v20" fill="none" stroke={GOLD} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M33 66h34" stroke={GOLD} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M50 44c5 6 5 11 0 15-5-4-5-9 0-15z" fill={GOLD} />
    </svg>
  );
}

/** توقيع صغير يربط التطبيق بموقع مشكاة */
export function MishkatCredit() {
  return (
    <a className="credit" href="https://mishkatapps.github.io" target="_blank" rel="noreferrer">
      <MishkatMark size={22} /> من تطبيقات <b>مشكاة</b>
    </a>
  );
}
