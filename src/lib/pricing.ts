// حساب السعر المعروض من إعدادات صاحب التطبيق (السعر الأساسي، نسبة الخصم ومدته)
import type { AppInfo } from './types';
import { todayStr } from './format';

export interface PriceView {
  base: number;
  final: number;
  currency: string;
  percent: number;
  /** الخصم سارٍ اليوم */
  active: boolean;
  /** الخصم مُعلن ولم يبدأ بعد */
  upcoming: boolean;
  from: string | null;
  to: string | null;
}

export function priceView(info: AppInfo | null, today = todayStr()): PriceView | null {
  if (!info || info.base_price == null) return null;
  const base = Number(info.base_price);
  const percent = Number(info.discount_percent ?? 0);
  const from = info.discount_from ?? null, to = info.discount_to ?? null;
  const has = percent > 0 && !!from && !!to;
  const active = has && today >= from! && today <= to!;
  const upcoming = has && today < from!;
  return {
    base, percent, from, to, active, upcoming,
    final: active ? Math.round(base * (1 - percent / 100)) : base,
    currency: info.currency || 'جنيه',
  };
}
