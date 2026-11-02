'use client';
// 시트 추가 — 페이지형 등록
import React, { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useMenuSettings, canWriteAt, writeKeyOf, writeDefaultOf } from '@/lib/menuStore';
import { useSectionParam, secQuery, useSectionTitle } from '@/lib/sectionStore';
import { useLocalList, newId } from '@/lib/postStore';
import { PlayRecord, PLAYLOG_SEED } from '@/lib/galleryStore';
import { SHEET_KEY, sheetSecOf, toRecord } from '@/lib/sheetStore';
import { SheetForm } from '@/components/trpg/SheetForm';
import { useToast } from '@/components/ui/Toast';
import { PageTitle, EditableDesc } from '@/components/ui/PageText';

function SheetNewPageInner() {
  // 어느 섹션에서 눌러 왔는지 — 새 항목을 그 목록에 넣는다
  const sec = useSectionParam('sheet');
  const tt = useSectionTitle('sheet', sec.id, 'ADD SHEET');
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const [all, setAll] = useLocalList<PlayRecord>(SHEET_KEY, PLAYLOG_SEED);
  const [menuSet, , menuLoaded] = useMenuSettings();

  if (!menuLoaded) return <section className="page" />;
  if (!user || !canWriteAt(menuSet, writeKeyOf('/sheet', sec.id), { loggedIn: true, isAdmin, id: user.id }, writeDefaultOf('/sheet'))) {
    return (
      <section className="page">
        <div className="page-head"><PageTitle href={tt.href}>{tt.title}</PageTitle><p>허용된 회원만 등록할 수 있습니다</p></div>
      </section>
    );
  }

  const back = '/sheet' + secQuery('sheet', sec.id);
  return (
    <section className="page">
      <div className="page-head"><PageTitle href={tt.href}>{tt.title}</PageTitle><EditableDesc k="sheet-new-desc" def="시트 추가" /></div>
      <SheetForm initial={null} secId={sec.id}
        onCancel={() => router.push(back)}
        onSave={v => {
          // 등록한 사람을 남긴다 — 수정·삭제는 본인과 관리자
          setAll([...all, { id: newId(), ...toRecord(v), secId: sheetSecOf(sec.id), authorId: user.id }]);
          toast('시트가 추가되었습니다');
          router.push(back);
        }} />
    </section>
  );
}

export default function SheetNewPage() {
  return <Suspense fallback={<section className="page" />}><SheetNewPageInner /></Suspense>;
}
