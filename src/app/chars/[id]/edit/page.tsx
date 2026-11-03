'use client';
// 캐릭터 프로필 편집 페이지 (4.4) — 전용 페이지 (모달 아님)
// ?au=<relId:auId> 로 진입하면 그 AU 전용 프로필 편집 (v1.9 사용자 확정) —
// 아예 새 프로필처럼 이름·스펙·아트·탭 전부 그 AU만의 값으로 작성. base는 건드리지 않음.
import React, { Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLocalList, newId } from '@/lib/postStore';
import { Character, CHAR_SEED, charGrant, charWithAu, Relation, REL_SEED , findByKey, defaultSpecGroups } from '@/lib/charStore';
import { CharEditForm } from '@/components/chars/CharEditForm';
import { useToast } from '@/components/ui/Toast';
import { PageTitle, EditableDesc } from '@/components/ui/PageText';

function CharEditInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const params = useSearchParams();
  const auKey = params.get('au');   // `${relId}:${auId}`
  const [chars, setChars, loaded] = useLocalList<Character>('ohome.chars.v1', CHAR_SEED);
  const [rels] = useLocalList<Relation>('ohome.rels.v1', REL_SEED);

  // 별명 주소로도 열린다 (v2.0 사용자 요청 — 주소를 나중에 바꿔도 옛 주소가 살아 있게)
  const ch = findByKey(chars, id);
  // 관리자 또는 「편집까지」 권한이 부여된 회원 (3차 회원-캐릭터 연결, v1.9)
  const canEdit = isAdmin || (ch && charGrant(ch, user?.id) === 'edit');
  if (!loaded) return <section className="page" />;
  if (!canEdit || !ch) {
    return (
      <section className="page">
        <div className="page-head"><PageTitle>EDIT</PageTitle><p>{!ch ? '캐릭터를 찾을 수 없습니다' : '편집 권한이 없습니다'}</p></div>
      </section>
    );
  }

  // 아트 전용 프로필 (사용자 요청 — 아트마다 한마디·프로필을 다르게). 키 `art:<아트 ref>`
  const artRef = auKey?.startsWith('art:') ? auKey.slice(4) : null;
  // 그 아트가 어느 프로필(원본 / 자관 AU)의 그림인지 — 처음 만들 때 그 프로필 값으로 채운다
  const artOwner = artRef
    ? (Object.entries(ch.auProfiles ?? {}).find(([k, p]) => !k.startsWith('art:') && p.arts?.includes(artRef))?.[0] ?? null)
    : null;
  const artBase = artRef ? charWithAu(ch, artOwner) : ch;

  // AU 라벨 (타이틀 표시용)
  const auLabel = (() => {
    if (!auKey) return null;
    if (artRef) {
      const n = (artBase.arts ?? []).indexOf(artRef);
      return `아트 ${n >= 0 ? n + 1 : ''} 전용 프로필`;
    }
    const [relId, auId] = auKey.split(':');
    return rels.find(r => r.id === relId)?.aus.find(a => a.id === auId)?.label ?? auKey;
  })();

  const back = auKey ? `/chars/${ch.id}?au=${encodeURIComponent(auKey)}` : `/chars/${ch.id}`;

  // AU 프로필 초기값 (v1.9 사용자 확정) — 이미 등록된 AU면 그 값, 처음이면 "아예 새 등록"처럼 빈 폼
  // (이름·스펙·아트·탭 전부 비움 — 폰트·대표색 등 스타일 기본만 base에서)
  const auProf = auKey ? ch.auProfiles?.[auKey] : undefined;
  const formInitial = artRef
    // 아트 전용: 있으면 그 값, 처음이면 원래 프로필을 그대로 복사해 시작 (다른 부분만 고치면 되게)
    ? (auProf ? charWithAu({ ...artBase, auProfiles: ch.auProfiles }, auKey) : artBase)
    : auKey
    ? (auProf
      ? charWithAu(ch, auKey)
      : {
        ...ch, name: '', sub: '', basicHtml: '', tabs: [], colors: [], colorTipMode: 'hex' as const,
        specs: [], specGroups: defaultSpecGroups(newId), quote: undefined, quoteColor: undefined, quoteMarkColor: undefined,
        arts: [], artId: undefined, thumbId: undefined, thumbCrop: undefined,
      })
    : ch;

  return (
    <section className="page">
      <div className="page-head">
        <PageTitle>EDIT — {auKey ? `${ch.name} · ${auLabel}` : ch.name}</PageTitle>
        {!auKey && <EditableDesc k="chars-edit-desc" def="프로필 편집 — 변경은 [SAVE]를 눌러야 저장됩니다" />}
      </div>
      <CharEditForm
        initial={formInitial}
        existingIds={chars.filter(c => c.id !== ch.id).flatMap(c => [c.id, ...(c.slug ? [c.slug] : [])])}
        auMode={!!auKey}
        artMode={!!artRef}
        onCancel={() => router.push(back)}
        onSave={c => {
          if (auKey) {
            // AU 프로필 스냅샷 저장 — base 필드는 그대로, auProfiles[auKey]만 폼 값 전체로
            setChars(chars.map(x => (x.id === ch.id ? {
              ...x,
              auProfiles: {
                ...x.auProfiles,
                [auKey]: {
                  // 폼 밖에서 정한 값(상세 아트 위치 등)은 그대로 두고 폼 값만 덮어쓴다 (v2.0)
                  ...x.auProfiles?.[auKey],
                  name: c.name, sub: c.sub, color: c.color, themeMode: c.themeMode,
                  colors: c.colors, colorTipMode: c.colorTipMode,
                  specs: c.specs, specGroups: c.specGroups, quote: c.quote ?? '', quoteColor: c.quoteColor, quoteMarkColor: c.quoteMarkColor, quoteSize: c.quoteSize, quoteFontId: c.quoteFontId, artCrops: c.artCrops, tabs: c.tabs, basicHtml: c.basicHtml,
                  // 아트 전용 프로필은 그림을 따로 갖지 않는다 (원래 프로필의 아트를 그대로 쓴다)
                  ...(artRef ? {} : { arts: c.arts, thumbId: c.thumbId, thumbCrop: c.thumbCrop }),
                  fontId: c.fontId, nameSize: c.nameSize, nameBold: c.nameBold, bodyFontId: c.bodyFontId,
                },
              },
            } : x)));
            toast(artRef ? '아트 전용 프로필이 저장되었습니다' : 'AU 프로필이 저장되었습니다');
          } else {
            // 폼이 다루지 않는 값(상세 아트 위치 등)이 저장할 때마다 사라지지 않게 덮어쓰지 않고 합친다 (v2.0)
            setChars(chars.map(x => (x.id === c.id ? { ...x, ...c } : x)));
            toast('저장되었습니다');
          }
          router.push(back);
        }}
      />
    </section>
  );
}

export default function CharEditPage() {
  // useSearchParams는 Suspense 경계 필요 (Next App Router)
  return <Suspense fallback={<section className="page" />}><CharEditInner /></Suspense>;
}
