'use client';
// 캐릭터 문서 읽기 — 추가 탭의 긴 글을 목차(제목1·2·3)와 함께 크게 읽는다. 폭은 갤러리 상세와 같은 672px.
import React, { Suspense, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLocalList } from '@/lib/postStore';
import { Character, CHAR_SEED, charWithAu, findByKey } from '@/lib/charStore';
import { useFonts } from '@/lib/fontStore';
import { PageTitle } from '@/components/ui/PageText';
import { DocReader } from '@/components/ui/DocReader';
import type { DocItem } from '@/lib/docs';

function CharReadInner() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [chars, , loaded] = useLocalList<Character>('ohome.chars.v1', CHAR_SEED);
  const { familyOf } = useFonts();
  const ch = findByKey(chars, id);
  const auKey = params.get('au');
  const eff = ch ? charWithAu(ch, auKey) : undefined;
  const docs = useMemo<DocItem[]>(() => (eff?.tabs ?? [])
    .filter(t => t.html.trim() && t.html.trim() !== '<p></p>')
    .map(t => ({ id: t.id, icon: t.icon, title: t.title, subtitle: t.subtitle, html: t.html })), [eff]);

  if (!loaded) return <section className="page" />;
  const back = ch ? `/chars/${ch.id}${auKey ? `?au=${encodeURIComponent(auKey)}` : ''}` : '/chars';
  const msg = !ch || !eff ? '캐릭터를 찾을 수 없습니다'
    : (ch.visibility === 'private' && !isAdmin) ? '비공개 캐릭터입니다'
    : (ch.visibility === 'member' && !user) ? '멤버공개 — 로그인 후 열람할 수 있습니다' : null;
  if (msg || !ch || !eff) {
    return <section className="page"><div className="page-head"><PageTitle href="/chars">CHARACTERS</PageTitle><p>{msg}</p></div></section>;
  }
  const active = params.get('tab') ?? docs[0]?.id ?? '';
  return (
    <section className="page">
      <div className="page-head">
        <PageTitle href={back}>{eff.name}</PageTitle>
        <p>{eff.sub}</p>
        <div className="head-actions">
          <button className="btn btn-dark" onClick={() => router.push(back)}>‹ 프로필로</button>
        </div>
      </div>
      <DocReader docs={docs} activeId={active} bodyFont={familyOf(eff.bodyFontId)}
        onPick={tid => router.replace(`/chars/${ch.id}/read?tab=${tid}${auKey ? `&au=${encodeURIComponent(auKey)}` : ''}`, { scroll: false })} />
    </section>
  );
}

export default function CharReadPage() {
  return <Suspense fallback={<section className="page" />}><CharReadInner /></Suspense>;
}
