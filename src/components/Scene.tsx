// خلفية مرسومة أعلى كل شاشة، تتبدل حسب القسم: غرفة معيشة، مطبخ، مكتب... (رسوم متجهة خفيفة بلا ملفات صور)
export type SceneName = 'home' | 'expenses' | 'incomes' | 'stats' | 'admin';

/** غرفة المعيشة — الرئيسية */
const Living = () => (
  <>
    <rect width="400" height="130" fill="#f1dfc8" />
    <rect y="92" width="400" height="38" fill="#b9855a" />
    <rect x="34" y="14" width="74" height="52" rx="4" fill="#fff8ec" />
    <rect x="39" y="19" width="64" height="42" fill="#9fd3ee" />
    <circle cx="88" cy="32" r="8" fill="#ffd66b" />
    <path d="M39 61 58 40l14 12 12-9 19 18z" fill="#7cc08a" />
    <path d="M71 19v42M39 40h64" stroke="#fff8ec" strokeWidth="3" />
    <rect x="150" y="22" width="36" height="28" rx="3" fill="#fff8ec" />
    <path d="M155 45l9-11 7 7 5-4 6 8z" fill="#e58b6a" />
    <rect x="196" y="28" width="24" height="22" rx="3" fill="#fff8ec" />
    <circle cx="208" cy="39" r="6" fill="#6aa9d8" />
    <ellipse cx="215" cy="108" rx="120" ry="12" fill="#d9b48f" />
    <rect x="130" y="62" width="170" height="40" rx="12" fill="#2f8f8a" />
    <rect x="120" y="72" width="26" height="34" rx="9" fill="#27807b" />
    <rect x="284" y="72" width="26" height="34" rx="9" fill="#27807b" />
    <rect x="146" y="80" width="68" height="20" rx="7" fill="#3aa39d" />
    <rect x="216" y="80" width="68" height="20" rx="7" fill="#3aa39d" />
    <rect x="158" y="66" width="30" height="20" rx="6" fill="#f2b84b" />
    <rect x="244" y="66" width="30" height="20" rx="6" fill="#e58b6a" />
    <path d="M345 104V48" stroke="#6b4a33" strokeWidth="3" />
    <path d="M327 48h36l-8-24h-20z" fill="#ffd66b" />
    <rect x="333" y="102" width="24" height="5" rx="2" fill="#6b4a33" />
    <rect x="18" y="86" width="22" height="20" rx="3" fill="#c96f4a" />
    <path d="M29 86c-12-10-12-26-4-34 2 12 6 20 4 34zm0 0c10-8 14-22 8-32-4 10-8 18-8 32zm0 0c-2-14 0-30 2-42 4 14 2 28-2 42z" fill="#4c9a5f" />
  </>
);

/** المطبخ — المصروفات */
const Kitchen = () => (
  <>
    <rect width="400" height="130" fill="#e4efe6" />
    <path d="M0 26h400M0 52h400M40 0v78M100 0v78M160 0v78M220 0v78M280 0v78M340 0v78" stroke="#d3e3d6" strokeWidth="1.5" />
    <rect y="78" width="400" height="10" fill="#c58f5f" />
    <rect y="88" width="400" height="42" fill="#f6efe2" />
    <path d="M70 88v42M140 88v42M210 88v42" stroke="#e2d6c0" strokeWidth="2" />
    <circle cx="58" cy="108" r="3" fill="#b9a98c" /><circle cx="128" cy="108" r="3" fill="#b9a98c" /><circle cx="198" cy="108" r="3" fill="#b9a98c" />
    <rect x="296" y="10" width="78" height="120" rx="8" fill="#dfe7ee" />
    <path d="M296 56h78" stroke="#c3ced8" strokeWidth="2" />
    <rect x="304" y="26" width="5" height="20" rx="2" fill="#aab7c4" /><rect x="304" y="66" width="5" height="34" rx="2" fill="#aab7c4" />
    <rect x="16" y="14" width="96" height="6" rx="2" fill="#c58f5f" />
    <rect x="24" y="-2" width="14" height="16" rx="3" fill="#e58b6a" /><rect x="44" y="1" width="14" height="13" rx="3" fill="#f2b84b" />
    <rect x="64" y="-3" width="14" height="17" rx="3" fill="#7cc08a" /><rect x="84" y="2" width="14" height="12" rx="3" fill="#6aa9d8" />
    <path d="M150 12v22M164 12v26M178 12v20" stroke="#8a97a3" strokeWidth="2.5" strokeLinecap="round" />
    <ellipse cx="150" cy="38" rx="5" ry="7" fill="#8a97a3" /><rect x="160" y="38" width="8" height="12" rx="2" fill="#8a97a3" /><circle cx="178" cy="36" r="6" fill="none" stroke="#8a97a3" strokeWidth="2.5" />
    <rect x="216" y="66" width="60" height="12" rx="3" fill="#3d4650" />
    <rect x="226" y="50" width="40" height="18" rx="5" fill="#d9534f" />
    <path d="M220 54h52" stroke="#b83f3b" strokeWidth="4" strokeLinecap="round" />
    <path d="M238 44c-4-6 4-8 0-14M252 44c-4-6 4-8 0-14" stroke="#b8c4cc" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    <path d="M88 78a26 12 0 0 0 52 0z" fill="#f6efe2" stroke="#d6c7ad" strokeWidth="1.5" />
    <circle cx="102" cy="72" r="8" fill="#e5533d" /><circle cx="116" cy="69" r="8" fill="#f2a53b" /><circle cx="128" cy="73" r="7" fill="#8cc56b" />
    <rect x="28" y="56" width="18" height="22" rx="3" fill="#fff" /><rect x="30" y="62" width="14" height="9" fill="#6aa9d8" />
  </>
);

/** المدخرات — الدخل */
const Savings = () => (
  <>
    <rect width="400" height="130" fill="#dfeaf6" />
    <rect y="94" width="400" height="36" fill="#a9774f" />
    <rect y="90" width="400" height="6" fill="#8f623e" />
    <path d="M150 26a34 34 0 0 1 68 0v40a34 34 0 0 1-68 0z" fill="#cfe6f2" opacity=".75" stroke="#9fc6dc" strokeWidth="2" />
    <rect x="158" y="14" width="52" height="8" rx="3" fill="#9fc6dc" />
    <g fill="#f2b84b" stroke="#d39a2c" strokeWidth="1.5">
      <ellipse cx="184" cy="88" rx="24" ry="6" /><ellipse cx="184" cy="80" rx="24" ry="6" /><ellipse cx="184" cy="72" rx="24" ry="6" />
      <ellipse cx="184" cy="64" rx="24" ry="6" /><ellipse cx="184" cy="56" rx="22" ry="6" />
    </g>
    <circle cx="184" cy="34" r="9" fill="#f2b84b" stroke="#d39a2c" strokeWidth="1.5" />
    <g fill="#f2b84b" stroke="#d39a2c" strokeWidth="1.5">
      <ellipse cx="252" cy="88" rx="16" ry="5" /><ellipse cx="252" cy="82" rx="16" ry="5" /><ellipse cx="252" cy="76" rx="16" ry="5" />
      <ellipse cx="290" cy="88" rx="16" ry="5" /><ellipse cx="290" cy="82" rx="16" ry="5" />
    </g>
    <rect x="62" y="64" width="70" height="28" rx="6" fill="#7a4b32" />
    <rect x="62" y="64" width="70" height="12" rx="6" fill="#8f5b3f" />
    <circle cx="120" cy="80" r="4" fill="#f2b84b" />
    <rect x="72" y="56" width="44" height="12" rx="2" fill="#7cc08a" transform="rotate(-6 94 62)" />
    <rect x="76" y="54" width="44" height="12" rx="2" fill="#8fd09c" transform="rotate(4 98 60)" />
    <rect x="334" y="70" width="28" height="22" rx="4" fill="#c96f4a" />
    <path d="M348 70V40" stroke="#4c9a5f" strokeWidth="3" />
    <path d="M348 52c-14-2-18-12-18-18 12 0 18 6 18 18zm0-10c14-2 18-12 18-18-12 0-18 6-18 18z" fill="#5fb072" />
    <path d="M20 40l20-14 16 8 22-18" stroke="#6aa9d8" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M78 16l-9 1 7 7z" fill="#6aa9d8" />
  </>
);

/** المكتب — الإحصاءات */
const Study = () => (
  <>
    <rect width="400" height="130" fill="#e9e4f5" />
    <rect y="96" width="400" height="34" fill="#9a6f4c" />
    <rect x="96" y="10" width="208" height="76" rx="6" fill="#fffdf8" stroke="#cfc6e2" strokeWidth="3" />
    <path d="M112 74h176" stroke="#cfc6e2" strokeWidth="2" />
    <g>
      <rect x="122" y="54" width="14" height="20" rx="2" fill="#2a78d6" /><rect x="138" y="60" width="14" height="14" rx="2" fill="#eb6834" />
      <rect x="162" y="40" width="14" height="34" rx="2" fill="#2a78d6" /><rect x="178" y="48" width="14" height="26" rx="2" fill="#eb6834" />
      <rect x="202" y="46" width="14" height="28" rx="2" fill="#2a78d6" /><rect x="218" y="56" width="14" height="18" rx="2" fill="#eb6834" />
      <rect x="242" y="28" width="14" height="46" rx="2" fill="#2a78d6" /><rect x="258" y="42" width="14" height="32" rx="2" fill="#eb6834" />
    </g>
    <path d="M124 38l40-12 40 8 46-14" stroke="#1baf7a" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="124" cy="38" r="3.5" fill="#1baf7a" /><circle cx="164" cy="26" r="3.5" fill="#1baf7a" /><circle cx="204" cy="34" r="3.5" fill="#1baf7a" /><circle cx="250" cy="20" r="3.5" fill="#1baf7a" />
    <rect x="26" y="52" width="46" height="44" rx="4" fill="#7a4b32" />
    <path d="M32 60h34M32 70h34M32 80h34" stroke="#f2b84b" strokeWidth="5" strokeLinecap="round" />
    <rect x="330" y="76" width="26" height="20" rx="4" fill="#c96f4a" />
    <path d="M343 76c-10-8-10-22-4-28 2 10 6 16 4 28zm0 0c8-6 12-18 6-26-2 8-6 14-6 26z" fill="#4c9a5f" />
    <rect x="296" y="88" width="20" height="8" rx="2" fill="#fff" /><path d="M300 88v-8h12v8" stroke="#8a97a3" strokeWidth="2" fill="none" />
  </>
);

/** واجهة البيت — الإدارة */
const House = () => (
  <>
    <rect width="400" height="130" fill="#cfe8f7" />
    <circle cx="338" cy="30" r="16" fill="#ffd66b" />
    <ellipse cx="80" cy="30" rx="30" ry="9" fill="#fff" opacity=".9" /><ellipse cx="104" cy="24" rx="20" ry="8" fill="#fff" opacity=".9" />
    <ellipse cx="250" cy="20" rx="22" ry="7" fill="#fff" opacity=".8" />
    <rect y="100" width="400" height="30" fill="#8cc56b" />
    <path d="M0 104c60-10 120 6 200 0s140-8 200 0v26H0z" fill="#7ab85a" />
    <rect x="146" y="56" width="108" height="50" fill="#fff4e2" />
    <path d="M134 60l66-42 66 42z" fill="#c9553f" />
    <rect x="228" y="24" width="12" height="22" fill="#a8432f" />
    <rect x="188" y="76" width="24" height="30" rx="3" fill="#7a4b32" /><circle cx="207" cy="92" r="2" fill="#f2b84b" />
    <rect x="156" y="68" width="22" height="20" rx="2" fill="#9fd3ee" stroke="#fff" strokeWidth="2.5" /><path d="M167 68v20M156 78h22" stroke="#fff" strokeWidth="2" />
    <rect x="222" y="68" width="22" height="20" rx="2" fill="#9fd3ee" stroke="#fff" strokeWidth="2.5" /><path d="M233 68v20M222 78h22" stroke="#fff" strokeWidth="2" />
    <path d="M200 106v24" stroke="#e7d3b4" strokeWidth="18" />
    <rect x="62" y="70" width="8" height="34" fill="#7a4b32" /><circle cx="66" cy="58" r="22" fill="#4c9a5f" /><circle cx="52" cy="68" r="12" fill="#5fb072" /><circle cx="80" cy="68" r="12" fill="#5fb072" />
    <rect x="316" y="78" width="6" height="26" fill="#7a4b32" /><circle cx="319" cy="68" r="16" fill="#5fb072" />
    <path d="M100 104v-12M110 104v-12M120 104v-12M130 104v-12M96 96h38" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    <path d="M266 104v-12M276 104v-12M286 104v-12M296 104v-12M262 96h38" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
  </>
);

const SCENES: Record<SceneName, () => React.JSX.Element> = { home: Living, expenses: Kitchen, incomes: Savings, stats: Study, admin: House };

/**
 * صور فوتوغرافية اختيارية لخلفية كل قسم. ضع الملفات في public/bg/ ثم سجّلها هنا، مثال:
 *   home: { day: './bg/home-day.jpg', night: './bg/home-night.jpg' }
 * القسم الذي لا صورة له يستخدم الرسم. إن لم تُحدَّد صورة ليلية تُعتَّم النهارية في الوضع الليلي.
 */
export const PHOTOS: Partial<Record<SceneName, { day: string; night?: string }>> = {};

/** خلفية الصفحة كلها خلف البطاقات نصف الشفافة */
export function Backdrop({ name }: { name: SceneName }) {
  const photo = PHOTOS[name];
  return (
    <div className="backdrop" aria-hidden="true">
      {photo ? (
        <>
          <img className={`day ${photo.night ? 'has-night' : ''}`} src={photo.day} alt="" />
          {photo.night && <img className="night" src={photo.night} alt="" />}
        </>
      ) : <Scene name={name} />}
    </div>
  );
}

export default function Scene({ name }: { name: SceneName }) {
  const Art = SCENES[name];
  return (
    <svg className="scene" viewBox="0 0 400 130" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <Art />
    </svg>
  );
}
