'use client';
// 시트 수정 — 페이지형 편집
import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLocalList } from '@/lib/postStore';
import { useSectionTitle, secQuery } from '@/lib/sectionStore';
import { PlayRecord, PLAYLOG_SEED } from '@/lib/galleryStore';
import { SHEET_KEY, sheetsOf, sheetSecId, isSheetRec, toRecord } from '@/lib/sheetStore';
import { SheetForm } from '@/components/trpg/SheetForm';
import { useToast } from '@/components/ui/Toast';
import { PageTitle } from '@/components/ui/PageText';

export default function SheetEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const [all, setAll, loaded] = useLocalList<PlayRecord>(SHEET_KEY, PLAYLOG_SEED);
  const r = all.find(x => x.id === id && isSheetRec(x));
  const secId = r ? sheetSecId(r) : undefined;
  const tt = useSectionTitle('sheet', secId, 'EDIT SHEET');

  if (!loaded) return <section className="page" />;
  // 수정은 등록한 본인과 관리자
  if (!r || !secId || !(isAdmin || (!!user && r.authorId === user.id))) {
    return (
      <section className="page">
        <div className="page-head"><PageTitle href={tt.href}>{tt.title}</PageTitle><p>시트를 찾을 수 없거나 권한이 없습니다</p></div>
      </section>
    );
  }

  const back = '/sheet' + secQuery('sheet', secId);
  return (
    <section className="page">
      <div className="page-head"><PageTitle href={tt.href}>{tt.title}</PageTitle><p>{r.scenario}</p></div>
      <SheetForm initial={r} records={sheetsOf(all, secId)}
        onCancel={() => router.push(back)}
        onSave={v => {
          setAll(all.map(x => (x.id === r.id ? { ...x, ...toRecord(v) } : x)));
          toast('저장되었습니다');
          router.push(back);
        }} />
    </section>
  );
}
