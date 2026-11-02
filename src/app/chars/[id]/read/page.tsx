'use client';
// 캐릭터 문서 읽기 — 추가 탭의 긴 글을 목차(제목1·2·3)와 함께 크게 읽는다. 폭은 갤러리 상세와 같은 672px.
import React, { Suspense, useEffect, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLocalList } from '@/lib/postStore';
import { Character, CHAR_SEED, charWithAu, charGrant, findByKey } from '@/lib/charStore';
import { useTheme } from '@/lib/ThemeProvider';
import { useFonts } from '@/lib/fontStore';
import { PageTitle } from '@/components/ui/PageText';
import { DocReader, DocPatch } from '@/components/ui/DocReader';
import type { DocItem } from '@/lib/docs';

function CharReadInner() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [chars, setChars, loaded] = useLocalList<Character>('ohome.chars.v1', CHAR_SEED);
  const { familyOf } = useFonts();
  const ch = findByKey(chars, id);
  const auKey = params.get('au');
  const eff = ch ? charWithAu(ch, auKey) : undefined;
  const docs = useMemo<DocItem[]>(() => (eff?.tabs ?? [])
    .filter(t => t.fullRead && t.html.trim() && t.html.trim() !== '<p></p>')   // 전체 읽기를 켠 탭만
    .map(t => ({ id: t.id, icon: t.icon, title: t.title, subtitle: t.subtitle, html: t.html, size: t.size })), [eff]);

  // 캐릭터 페이지와 같은 테마 — 별도 테마컬러를 쓰는 캐릭터면 읽기 화면도 같은 팔레트
  const { setPageTheme } = useTheme();
  const auRegistered = !auKey || !!ch?.auProfiles?.[auKey];
  const pageColor = auRegistered && eff?.themeMode === 'custom' ? eff.color : null;
  useEffect(() => {
    setPageTheme(pageColor);
    return () => setPageTheme(null);
  }, [pageColor, setPageTheme]);

  if (!loaded) return <section className="page" />;
  const back = ch ? `/chars/${ch.id}${auKey ? `?au=${encodeURIComponent(auKey)}` : ''}` : '/chars';
  const msg = !ch || !eff ? '캐릭터를 찾을 수 없습니다'
    : (ch.visibility === 'private' && !isAdmin) ? '비공개 캐릭터입니다'
    : (ch.visibility === 'member' && !user) ? '멤버공개 — 로그인 후 열람할 수 있습니다' : null;
  if (msg || !ch || !eff) {
    return <section className="page"><div className="page-head"><PageTitle href="/chars">CHARACTERS</PageTitle><p>{msg}</p></div></section>;
  }
  const canEdit = isAdmin || charGrant(ch, user?.id) === 'edit';
  // 읽기 화면에서 고친 내용 저장 — AU가 자기 탭 목록을 갖고 있으면 그쪽에, 아니면 원본 탭에
  const saveDoc = (tid: string, p: DocPatch) => {
    const patchTabs = (tabs: typeof eff.tabs) => tabs.map(t => (t.id === tid ? { ...t, title: p.title, subtitle: p.subtitle || undefined, html: p.html, size: p.size } : t));
    setChars(chars.map(x => {
      if (x.id !== ch.id) return x;
      if (auKey && x.auProfiles?.[auKey]?.tabs) return { ...x, auProfiles: { ...x.auProfiles, [auKey]: { ...x.auProfiles[auKey], tabs: patchTabs(x.auProfiles[auKey].tabs!) } } };
      return { ...x, tabs: patchTabs(x.tabs) };
    }));
  };
  // 문서 순서 변경 — 문서(전체 읽기) 탭들이 차지한 자리를 새 순서로 채운다 (다른 탭 자리는 그대로) → 프로필의 아이콘 순서도 같이 바뀐다
  const reorderDocs = (ids: string[]) => {
    const order = (tabs: typeof eff.tabs) => {
      const slots = tabs.map((t, i) => (ids.includes(t.id) ? i : -1)).filter(i => i >= 0);
      const byId = new Map(tabs.map(t => [t.id, t]));
      const next = [...tabs];
      slots.forEach((slot, k) => { const t = byId.get(ids[k]); if (t) next[slot] = t; });
      return next;
    };
    setChars(chars.map(x => {
      if (x.id !== ch.id) return x;
      if (auKey && x.auProfiles?.[auKey]?.tabs) return { ...x, auProfiles: { ...x.auProfiles, [auKey]: { ...x.auProfiles[auKey], tabs: order(x.auProfiles[auKey].tabs!) } } };
      return { ...x, tabs: order(x.tabs) };
    }));
  };
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
      <DocReader docs={docs} activeId={active} bodyFont={familyOf(eff.bodyFontId)} canEdit={canEdit} onSave={saveDoc} onReorder={reorderDocs}
        onPick={tid => router.replace(`/chars/${ch.id}/read?tab=${tid}${auKey ? `&au=${encodeURIComponent(auKey)}` : ''}`, { scroll: false })} />
    </section>
  );
}

export default function CharReadPage() {
  return <Suspense fallback={<section className="page" />}><CharReadInner /></Suspense>;
}
