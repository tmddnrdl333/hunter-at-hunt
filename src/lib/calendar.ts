/** Google Calendar "이벤트 추가" URL 생성 (NCSU는 구글 캠퍼스라 사실상 전원 커버) */
export function googleCalendarUrl(e: {
  title: string;
  startsAt: string;
  endsAt: string | null;
  locationName: string | null;
  summary: string | null;
  sourceUrl: string | null;
}): string {
  const fmt = (iso: string) =>
    new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const start = fmt(e.startsAt);
  const end = fmt(
    e.endsAt ?? new Date(new Date(e.startsAt).getTime() + 3600_000).toISOString(),
  );
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${start}/${end}`,
    details: [e.summary, e.sourceUrl].filter(Boolean).join('\n\n'),
    location: e.locationName ?? '',
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
