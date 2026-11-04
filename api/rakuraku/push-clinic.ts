// クリニックマスター → 楽楽販売の顧客マスタへ1件書き込む（画面の「楽楽販売へ送信」ボタンから呼ぶ）
// 楽楽販売のクリニックIDがあれば更新、無ければ新規登録して採番されたIDを返す
import { pushClinic, type ClinicForPush } from '../_lib/rakuraku.js';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as ClinicForPush | null;
  if (!body?.name?.trim()) return Response.json({ error: 'クリニック名がありません' }, { status: 400 });
  try {
    return Response.json(await pushClinic(body));
  } catch (e: any) {
    console.error('[push-clinic]', e);
    return Response.json({ error: String(e?.message ?? e) }, { status: 502 });
  }
}
