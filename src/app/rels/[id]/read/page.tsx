'use client';
// 자관 문서 읽기 — 문서 탭의 긴 글을 목차(제목1·2·3)와 함께 크게 읽는다. 폭은 갤러리 상세와 같은 672px.
import React, { Suspense, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLocalList } from '@/lib/postStore';
import { Relation, REL_SEED, findByKey } from '@/lib/charStore';
import { useFonts } from '@/lib/fontStore';
import { PageTitle } from '@/components/ui/PageText';
import { DocReader } from '@/components/ui/DocReader';
import type { DocItem } from '@/lib/docs';

function RelReadInner() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [rels, , loaded] = useLocalList<Relation>('ohome.rels.v1', REL_SEED);
  const { familyOf } = useFonts();
  const rel = findByKey(rels, id);
  const docs = useMemo<DocItem[]>(() => (rel?.docs ?? [])
    .filter(d => d.html.trim() && d.html.trim() !== '<p></p>')
    .map(d => ({ id: d.id, icon: d.icon, title: d.title, subtitle: d.subtitle, html: d.html })), [rel]);

  if (!loaded) return <section className="page" />;
  if (!rel || (rel.visibility === 'private' && !isAdmin) || (rel.visibility === 'member' && !user)) {
    return <section className="page"><div className="page-head"><PageTitle href="/rels">RELATIONS</PageTitle><p>자관을 찾을 수 없거나 열람 권한이 없습니다</p></div></section>;
  }
  const back = `/rels/${rel.id}`;
  const active = params.get('doc') ?? docs[0]?.id ?? '';
  return (
    <section className="page">
      <div className="page-head">
        <PageTitle href={back}>{rel.name}</PageTitle>
        <p>{rel.catchphrase}</p>
        <div className="head-actions">
          <button className="btn btn-dark" onClick={() => router.push(back)}>‹ 자관으로</button>
        </div>
      </div>
      <DocReader docs={docs} activeId={active} bodyFont={familyOf(rel.bodyFontId)}
        onPick={did => router.replace(`/rels/${rel.id}/read?doc=${did}`, { scroll: false })} />
    </section>
  );
}

export default function RelReadPage() {
  return <Suspense fallback={<section className="page" />}><RelReadInner /></Suspense>;
}
