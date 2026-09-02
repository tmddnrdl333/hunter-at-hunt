'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CAMPUS_BOUNDARY } from '@/lib/campus-boundary';
import type { Perk } from '@/lib/types';

export interface MapEventItem {
  id: number;
  title: string;
  startsAt: string;
  locationName: string | null;
  perks: Perk[];
  lat: number;
  lng: number;
}

/** 초기 뷰: 메인 캠퍼스 핵심부 (+ Centennial 북단) */
const INITIAL_CENTER: L.LatLngExpression = [35.7822, -78.6785];
const INITIAL_ZOOM = 15;

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!,
  );
}

/**
 * 캠퍼스 지도 뷰 — 좌표가 있는 이벤트만 핀으로 표시.
 * free food는 🍕, 그 외 freebies는 🎁, 나머지는 📍.
 */
export default function MapView({ events }: { events: MapEventItem[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current).setView(INITIAL_CENTER, INITIAL_ZOOM);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    // 캠퍼스 경계선 (OSM 폴리곤) — NC State 레드 점선
    for (const ring of CAMPUS_BOUNDARY) {
      L.polygon(ring, {
        color: '#b80000',
        weight: 2,
        dashArray: '6 4',
        fill: true,
        fillColor: '#b80000',
        fillOpacity: 0.04,
        interactive: false,
      }).addTo(map);
    }
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();
    for (const e of events) {
      const emoji = e.perks.includes('free_food') ? '🍕' : e.perks.length > 0 ? '🎁' : '📍';
      const icon = L.divIcon({
        className: '',
        html: `<span style="font-size:22px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,.45))">${emoji}</span>`,
        iconSize: [24, 24],
        iconAnchor: [12, 20],
      });
      const time = new Date(e.startsAt).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
      });
      layer.addLayer(
        L.marker([e.lat, e.lng], { icon }).bindPopup(
          `<strong>${escapeHtml(e.title)}</strong><br>${time}${
            e.locationName ? ' · ' + escapeHtml(e.locationName) : ''
          }<br><a href="/event/${e.id}">View event →</a>`,
        ),
      );
    }
    // 뷰포트는 고정(캠퍼스 핵심부) — 필터가 바뀌어도 지도가 널뛰지 않는다.
    // 화면 밖 핀은 사용자가 직접 이동/줌아웃하면 보임.
  }, [events]);

  return (
    // isolate: Leaflet 내부의 높은 z-index가 스티키 필터바 위로 새는 것 방지
    <div
      ref={containerRef}
      className="relative isolate z-0 h-[65vh] w-full rounded-xl border border-stone-200 dark:border-stone-700"
    />
  );
}
