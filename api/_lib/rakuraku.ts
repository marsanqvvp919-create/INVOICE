// 楽楽販売 API（顧客マスタ = クリニックマスタ）
//   環境変数 RAKURAKU_API_URL: 中継（Cloud Run）経由のアカウントURL（例 https://rakuraku-relay-xxxx.a.run.app/ykbxg2a）
//            楽楽販売は API の接続元IPを制限しているので、固定IPを持たない Vercel からは中継を通す
//   環境変数 RAKURAKU_API_TOKEN: X-HD-apitoken
//   レート制限: 1アカウント 20リクエスト/分
// 項目IDはクリニック発注サイト（clinic-order-main/src/lib/rakuraku.ts）と同じもの

export const CLINIC_DB = '101250';

const FIELD = {
  name: '109899',
  director: '109901',
  address: '109905',
  phone: '109911',
  email: '109919',
  note: '110249',
  deliveryGroup: '110696',
  paymentMethod: '110114',
  region: '110129',
  currency: '110130',
} as const;

// 書き込みの更新API。楽楽販売のマニュアルで確認できていないので、違っていたらここを直す
const UPDATE_PATH = 'apirecord/update';

function baseUrl() {
  const url = process.env.RAKURAKU_API_URL;
  const token = process.env.RAKURAKU_API_TOKEN;
  if (!url || !token) throw new Error('楽楽販売の API が設定されていません（RAKURAKU_API_URL / RAKURAKU_API_TOKEN）');
  return { url: url.replace(/\/+$/, ''), token: token.trim() };
}

async function post(path: string, body: Record<string, unknown>) {
  const { url, token } = baseUrl();
  return fetch(`${url}/${path}/version/v1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-HD-apitoken': token },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
}

async function callJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await post(path, body);
  const json = (await res.json().catch(() => ({}))) as T & { errors?: { code?: string; msg?: string; description?: unknown } };
  if (!res.ok || json.errors) {
    const e = json.errors;
    const detail = e?.description ? ` ${JSON.stringify(e.description).slice(0, 400)}` : '';
    throw new Error(`楽楽販売 API エラー（${e?.code ?? res.status}）: ${e?.msg ?? res.statusText}${detail}`);
  }
  return json;
}

/** CSVエクスポートAPIで1つのDBを全件読む（1回200件まで。ページの間は3秒あける） */
export async function exportCsv(dbSchemaId: string, maxPages = 20): Promise<string[][]> {
  const rows: string[][] = [];
  for (let page = 0; page < maxPages; page++) {
    if (page > 0) await new Promise((r) => setTimeout(r, 3000));
    const res = await post('api/csvexport', { dbSchemaId, viewId: '0', limit: 200, offset: page * 200 });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* CSV が返ってきた */ }
    if (!res.ok || json) {
      throw new Error(`楽楽販売 CSVエクスポート エラー（HTTP ${res.status}, ${page + 1}ページ目）: ${json?.errors?.msg ?? text.slice(0, 200)}`);
    }
    const parsed = parseCsv(text.replace(/^﻿/, ''));
    if (page === 0) rows.push(...parsed);
    else rows.push(...parsed.slice(1));
    if (parsed.length - 1 < 200) return rows;
  }
  throw new Error(`取得ページ上限（${maxPages}ページ）に達しました。全件を取り切れていません`);
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}

export type ClinicForPush = {
  rakurakuClinicId?: string;
  name: string;
  doctorName?: string;
  zip?: string;
  prefecture?: string;
  city?: string;
  address?: string;
  building?: string;
  phone?: string;
  email?: string;
};

function values(c: ClinicForPush) {
  const fullAddress = [c.prefecture, c.city, c.address, c.building].map((s) => (s || '').trim()).join('');
  const v: Record<string, string> = {
    [FIELD.name]: c.name,
    [FIELD.director]: c.doctorName || '',
    // 住所はクリニック発注サイトの登録と同じく「〒郵便番号＋住所」で入れる
    [FIELD.address]: fullAddress ? `${c.zip ? `〒${c.zip}` : ''}${fullAddress}` : '',
    [FIELD.phone]: c.phone || '',
    [FIELD.email]: c.email || '',
  };
  // 空の項目は送らない（楽楽販売の値を空で上書きしない）
  return Object.fromEntries(Object.entries(v).filter(([, s]) => s.trim() !== ''));
}

/** 楽楽販売の顧客マスタに1件書き込む。クリニックIDがあれば更新、無ければ新規登録して採番されたIDを返す */
export async function pushClinic(c: ClinicForPush): Promise<{ rakurakuClinicId: string; created: boolean }> {
  if (c.rakurakuClinicId) {
    await callJson(UPDATE_PATH, { dbSchemaId: CLINIC_DB, keyId: c.rakurakuClinicId, values: values(c) });
    return { rakurakuClinicId: c.rakurakuClinicId, created: false };
  }
  const { items: r = {} } = await callJson<{ items?: { keyId?: string; id?: string } }>('apirecord/regist', {
    dbSchemaId: CLINIC_DB,
    keyMode: '0',
    values: {
      ...values(c),
      // 既存の顧客と同じ初期値（API 登録では画面の初期値が入らない）
      [FIELD.deliveryGroup]: '200',
      [FIELD.paymentMethod]: '前払い',
      [FIELD.region]: '国内',
      [FIELD.currency]: 'JPY',
      [FIELD.note]: `インボイス作成システムから登録（${new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })}）`,
    },
  });
  const id = r.keyId ?? r.id ?? '';
  if (!id) throw new Error('楽楽販売に登録しましたが、クリニックIDが返ってきませんでした');
  return { rakurakuClinicId: id, created: true };
}
