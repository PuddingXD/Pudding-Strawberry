'use client';
// 자관 문서 읽기 — 문서 탭의 긴 글을 목차(제목1·2·3)와 함께 크게 읽는다. 폭은 갤러리 상세와 같은 672px.
import { NavLink } from '@/components/ui/NavLink';
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLocalList, newId } from '@/lib/postStore';
import { Relation, REL_SEED, findByKey, auStyle, isLinkDoc } from '@/lib/charStore';
import { useTheme } from '@/lib/ThemeProvider';
import { useFonts } from '@/lib/fontStore';
import { PageTitle } from '@/components/ui/PageText';
import { DocReader, DocPatch } from '@/components/ui/DocReader';
import type { DocItem } from '@/lib/docs';

function RelReadInner() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [rels, setRels, loaded] = useLocalList<Relation>('ohome.rels.v1', REL_SEED);
  const { familyOf } = useFonts();
  const rel = findByKey(rels, id);
  const [justAdded, setJustAdded] = useState<string | undefined>(undefined);   // 방금 추가한 문서 — 열리면 바로 수정 모드
  const docs = useMemo<DocItem[]>(() => (rel?.docs ?? [])
    .filter(d => !isLinkDoc(d))   // 새창 링크 문서는 읽기 화면에 없다
    .filter(d => isAdmin || (d.html.trim() && d.html.trim() !== '<p></p>'))   // 비어 있는 문서는 관리자에게만 보인다(새로 추가하면 바로 채울 수 있게)
    .map(d => ({ id: d.id, icon: d.icon, title: d.title, subtitle: d.subtitle, html: d.html, size: d.size })), [rel, isAdmin]);

  // 자관 페이지와 같은 테마 — 별도 테마컬러·페이지 배경을 쓰는 자관이면 읽기 화면도 똑같이 (원본 기준)
  const { setPageTheme, setPageBg } = useTheme();
  const pageColor = rel?.themeMode === 'custom' && rel.themeColor ? rel.themeColor : null;
  const pageTone = rel?.themeTone;
  useEffect(() => {
    setPageTheme(pageColor, pageTone);
    return () => setPageTheme(null);
  }, [pageColor, pageTone, setPageTheme]);
  const bg = rel ? auStyle(rel, rel.aus.find(a => a.id === 'base')) : undefined;
  const bgG1 = bg?.pageBgG1, bgG2 = bg?.pageBgG2, bgAngle = bg?.pageBgAngle;
  useEffect(() => {
    if (!bgG1 && !bgG2) return;
    setPageBg({ g1: bgG1 ?? '#2b3038', g2: bgG2 ?? '#121418', angle: bgAngle ?? 180 });
    return () => setPageBg(null);
  }, [bgG1, bgG2, bgAngle, setPageBg]);

  if (!loaded) return <section className="page" />;
  if (!rel || (rel.visibility === 'private' && !isAdmin) || (rel.visibility === 'member' && !user)) {
    return <section className="page"><div className="page-head"><PageTitle href="/rels">RELATIONS</PageTitle><p>자관을 찾을 수 없거나 열람 권한이 없습니다</p></div></section>;
  }
  const back = `/rels/${rel.id}`;
  const addDoc = () => {
    const did = newId();
    setRels(rels.map(x => (x.id === rel.id ? { ...x, docs: [...(x.docs ?? []), { id: did, icon: '✦', title: '새 문서', html: '' }] } : x)));
    setJustAdded(did);
    router.replace(`/rels/${rel.id}/read?doc=${did}`, { scroll: false });
  };
  const saveDoc = (did: string, p: DocPatch) =>
    setRels(rels.map(x => (x.id === rel.id
      ? { ...x, docs: (x.docs ?? []).map(d => (d.id === did ? { ...d, title: p.title, subtitle: p.subtitle || undefined, html: p.html, size: p.size } : d)) }
      : x)));
  const deleteDoc = (did: string) =>
    setRels(rels.map(x => (x.id === rel.id ? { ...x, docs: (x.docs ?? []).filter(d => d.id !== did) } : x)));
  // 문서 순서 변경 — 보이는 문서들이 차지한 자리를 새 순서로 채운다 → 자관 페이지의 문서 아이콘 순서도 같이 바뀐다
  const reorderDocs = (ids: string[]) =>
    setRels(rels.map(x => {
      if (x.id !== rel.id) return x;
      const all = x.docs ?? [];
      const slots = all.map((d, i) => (ids.includes(d.id) ? i : -1)).filter(i => i >= 0);
      const byId = new Map(all.map(d => [d.id, d]));
      const next = [...all];
      slots.forEach((slot, k) => { const d = byId.get(ids[k]); if (d) next[slot] = d; });
      return { ...x, docs: next };
    }));
  const active = params.get('doc') ?? docs[0]?.id ?? '';
  return (
    <section className="page">
      <div className="page-head">
        <PageTitle href={back}>{rel.name}</PageTitle>
        <p>{rel.catchphrase}</p>
        <div className="head-actions">
          <NavLink className="btn btn-dark" href={back}>‹ 자관으로</NavLink>
        </div>
      </div>
      <DocReader docs={docs} activeId={active} bodyFont={familyOf(rel.bodyFontId)} canEdit={isAdmin} onSave={saveDoc} onDelete={deleteDoc} deleteNote="자관 페이지의 문서 아이콘도 함께 사라집니다." onReorder={reorderDocs} onAdd={addDoc} startEditId={justAdded} onStartedEdit={() => setJustAdded(undefined)}
        onPick={did => router.replace(`/rels/${rel.id}/read?doc=${did}`, { scroll: false })} />
    </section>
  );
}

export default function RelReadPage() {
  return <Suspense fallback={<section className="page" />}><RelReadInner /></Suspense>;
}
