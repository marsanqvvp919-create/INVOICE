// 楽楽販売の顧客マスタ → クリニックマスター（Firestore clinics）の取り込み
// Vercel Cron から毎日呼ぶ（vercel.json）。楽楽販売を正として、取れた項目で上書きする。
// ただし画面で編集して楽楽販売へまだ送っていないクリニック（rakurakuPending）は上書きしない。
import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../_lib/firestore.js';
import { CLINIC_DB, exportCsv } from '../_lib/rakuraku.js';

export const maxDuration = 60;

// CSV の見出し（完全一致）→ クリニックマスターの項目。見つからない見出しは取り込まない
const COLUMNS: Record<string, string[]> = {
  rakurakuClinicId: ['クリニックID'],
  name: ['クリニック名', '顧客名'],
  branch: ['院・支店名', '院名・支店名'],
  nameEn: ['クリニック名英語表記', '英語表記'],
  corporationName: ['法人名'],
  doctorName: ['院長名', '代表者名'],
  zip: ['クリニック住所：郵便番号', '郵便番号'],
  prefecture: ['クリニック住所：都道府県', '都道府県'],
  city: ['クリニック住所：市区町村'],
  address: ['クリニック住所：町名・番地'],
  building: ['クリニック住所：建物名'],
  addressEn: ['住所英語表記'],
  phone: ['電話番号'],
  email: ['メールアドレス1', 'メールアドレス'],
  email2: ['メールアドレス2'],
  paymentMethod: ['支払方法'],
};

const normName = (s: string) => (s || '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();

export async function GET(request: Request) {
  // Vercel Cron は Authorization: Bearer <CRON_SECRET> を付けて呼ぶ
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const [header, ...rows] = await exportCsv(CLINIC_DB);
    if (!header) return Response.json({ error: '楽楽販売から0件でした' }, { status: 502 });

    const idx: Record<string, number> = {};
    for (const [key, names] of Object.entries(COLUMNS)) {
      const i = header.findIndex((h) => names.includes(h.trim()));
      if (i !== -1) idx[key] = i;
    }
    if (idx.rakurakuClinicId === undefined || idx.name === undefined) {
      return Response.json({ error: 'CSV に「クリニックID」「クリニック名」の列がありません', header }, { status: 502 });
    }

    const snap = await getDocs(collection(db, 'clinics'));
    const existing: Record<string, any>[] = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
    // 既存クリニックとの結びつけ: rakurakuClinicId → clinicId（取り込み済みの楽楽ID）→ 院名
    const byRakurakuId = new Map<string, (typeof existing)[number]>();
    for (const c of existing) {
      if (c.rakurakuClinicId) byRakurakuId.set(String(c.rakurakuClinicId), c);
    }
    for (const c of existing) {
      if (!c.rakurakuClinicId && c.clinicId && !byRakurakuId.has(String(c.clinicId))) byRakurakuId.set(String(c.clinicId), c);
    }
    const byName = new Map<string, (typeof existing)[number][]>();
    for (const c of existing) {
      if (c.rakurakuClinicId) continue;
      const k = normName(c.name);
      if (k) byName.set(k, [...(byName.get(k) ?? []), c]);
    }

    let maxSeq = existing.reduce((m, c) => Math.max(m, Number(c.sequenceNo) || 0), 0);
    const now = new Date().toISOString();
    const writes: { id: string | null; data: Record<string, unknown> }[] = [];
    const skippedPending: string[] = [];
    const used = new Set<string>();

    for (const row of rows) {
      const get = (key: string) => (idx[key] === undefined ? undefined : (row[idx[key]] ?? '').trim());
      const rakurakuClinicId = get('rakurakuClinicId');
      if (!rakurakuClinicId) continue;

      const baseName = get('name') ?? '';
      const branch = get('branch') ?? '';
      const name = branch && !baseName.includes(branch) ? `${baseName} ${branch}` : baseName;

      let target = byRakurakuId.get(rakurakuClinicId);
      if (!target) {
        const sameName = (byName.get(normName(name)) ?? []).filter((c) => !used.has(c.id));
        if (sameName.length === 1) target = sameName[0];
      }
      if (target && used.has(target.id)) target = undefined;
      if (target) used.add(target.id);

      if (target?.rakurakuPending) {
        skippedPending.push(`${rakurakuClinicId} ${name}`);
        continue;
      }

      const data: Record<string, unknown> = { rakurakuClinicId, name, rakurakuSyncedAt: now };
      for (const key of Object.keys(COLUMNS)) {
        if (key === 'rakurakuClinicId' || key === 'name' || key === 'branch') continue;
        const v = get(key);
        if (v !== undefined) data[key] = v;
      }

      if (target) {
        writes.push({ id: target.id, data });
      } else {
        maxSeq += 1;
        writes.push({
          id: null,
          data: {
            clinicId: rakurakuClinicId,
            sequenceNo: maxSeq,
            corporationName: '', contactPerson: '', doctorName: '', doctorNameEn: '',
            zip: '', prefecture: '', city: '', address: '', building: '', addressEn: '', phone: '', email: '',
            notes: '楽楽販売の顧客マスタから取り込み',
            active: true,
            createdAt: now,
            ...data,
            ...(data.nameEn ? {} : { nameEn: name }),
          },
        });
      }
    }

    for (let i = 0; i < writes.length; i += 400) {
      const batch = writeBatch(db);
      for (const w of writes.slice(i, i + 400)) {
        if (w.id) batch.set(doc(db, 'clinics', w.id), w.data, { merge: true });
        else batch.set(doc(collection(db, 'clinics')), w.data);
      }
      await batch.commit();
    }

    return Response.json({
      ok: true,
      fetched: rows.length,
      updated: writes.filter((w) => w.id).length,
      created: writes.filter((w) => !w.id).length,
      skippedPending,
      unmatchedColumns: Object.keys(COLUMNS).filter((k) => idx[k] === undefined),
      at: now,
    });
  } catch (e: any) {
    console.error('[pull-clinics]', e);
    return Response.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
