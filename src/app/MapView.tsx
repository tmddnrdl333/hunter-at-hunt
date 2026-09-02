'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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

/** NC State 메인 캠퍼스 (벨타워 인근) */
const CAMPUS_CENTER: L.LatLngExpression = [35.7847, -78.6821];

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
    const map = L.map(containerRef.current).setView(CAMPUS_CENTER, 15);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
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
    const points: L.LatLngExpression[] = [];
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
      points.push([e.lat, e.lng]);
    }
    // 초기 뷰포트는 캠퍼스 인근(±약 9km) 핀 기준으로만 — 원거리 이벤트가
    // 있어도 주 단위로 줌아웃되지 않게 (원거리 핀은 직접 이동하면 보임)
    const [cLat, cLng] = CAMPUS_CENTER as [number, number];
    const near = points.filter(
      (p) =>
        Math.abs((p as [number, number])[0] - cLat) < 0.08 &&
        Math.abs((p as [number, number])[1] - cLng) < 0.08,
    );
    const boundsSource = near.length > 0 ? near : points;
    if (boundsSource.length > 0) {
      map.fitBounds(L.latLngBounds(boundsSource).pad(0.15), { maxZoom: 16 });
    }
  }, [events]);

  return (
    // isolate: Leaflet 내부의 높은 z-index가 스티키 필터바 위로 새는 것 방지
    <div
      ref={containerRef}
      className="relative isolate z-0 h-[65vh] w-full rounded-xl border border-stone-200 dark:border-stone-700"
    />
  );
}
