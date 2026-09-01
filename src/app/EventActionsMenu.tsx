'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { googleCalendarUrl } from '@/lib/calendar';
import { useEscapeKey } from '@/lib/use-escape';

const ITEM_CLASS =
  'block w-full px-3 py-1.5 text-left text-sm text-stone-700 hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-stone-800';

interface CalendarEvent {
  id: number;
  title: string;
  startsAt: string;
  endsAt: string | null;
  locationName: string | null;
  summary: string | null;
  sourceUrl: string | null;
}

/**
 * 카드 우상단의 ⋮ 메뉴 — 캘린더 추가 / 링크 복사 (이후 항목 추가도 여기로).
 * 복사 토스트는 portal로 body에 그린다 (카드 hover transform이 fixed 기준이 되는 것 방지).
 */
export function EventActionsMenu({ event }: { event: CalendarEvent }) {
  const [open, setOpen] = useState(false);
  /** 복사 시각(ms). 0이면 토스트 숨김 — 연속 복사 시 타이머가 매번 리셋되도록 시각을 키로 사용 */
  const [copiedAt, setCopiedAt] = useState(0);
  const wrapRef = useRef<HTMLSpanElement>(null);
  useEscapeKey(open, () => setOpen(false));

  // 메뉴 밖 클릭/터치 시 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open]);

  // 토스트 자동 소멸 (언마운트/재복사 시 타이머 정리)
  useEffect(() => {
    if (!copiedAt) return;
    const t = setTimeout(() => setCopiedAt(0), 2000);
    return () => clearTimeout(t);
  }, [copiedAt]);

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/event/${event.id}`;
    // 터치 기기는 시스템 공유 시트, 데스크톱은 클립보드
    // (macOS 크롬도 navigator.share가 있어 포인터 종류로 분기해야 복사가 동작)
    if (window.matchMedia('(pointer: coarse)').matches && navigator.share) {
      try {
        await navigator.share({ url });
      } catch {
        /* 사용자가 공유 시트를 닫음 */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      if (!ok) return; // 복사 실패 시 성공 토스트를 띄우지 않음
    }
    setCopiedAt(Date.now());
  };

  return (
    <span ref={wrapRef} className="relative">
      <button
        onClick={(e) => {
          stop(e);
          setOpen(!open);
        }}
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-md px-1.5 py-0.5 text-base leading-none text-stone-400 transition-colors hover:bg-stone-200/60 hover:text-stone-700 dark:hover:bg-stone-700/60 dark:hover:text-stone-200"
      >
        ⋮
      </button>
      {open && (
        // onClick={stop}: 패널 자체 여백 클릭이 카드 <a>로 새어나가 네비게이션되는 것 방지
        // z-50: 스티키 필터바(z-40)보다 위
        <span
          role="menu"
          onClick={stop}
          className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-lg border border-stone-200 bg-white py-1 shadow-lg dark:border-stone-700 dark:bg-stone-900"
        >
          <button
            role="menuitem"
            onClick={(e) => {
              stop(e);
              window.open(googleCalendarUrl(event), '_blank', 'noopener');
              setOpen(false);
            }}
            className={ITEM_CLASS}
          >
            📅 Add to Google Calendar
          </button>
          <button
            role="menuitem"
            onClick={(e) => {
              stop(e);
              copyLink();
              setOpen(false);
            }}
            className={ITEM_CLASS}
          >
            🔗 Copy link
          </button>
        </span>
      )}
      {copiedAt > 0 &&
        createPortal(
          <span
            role="status"
            className="pointer-events-none fixed bottom-20 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-full bg-stone-900/95 px-4 py-2 text-sm font-medium text-white shadow-lg dark:bg-white/95 dark:text-stone-900"
          >
            🔗 Link copied to clipboard
          </span>,
          document.body,
        )}
    </span>
  );
}
