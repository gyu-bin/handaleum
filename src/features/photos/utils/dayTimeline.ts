import type { DisplayPhoto, PhotoRef, PlaceCluster } from '../types';
import { clusterPhotos } from '../services/cluster';
import { placeBucketKey } from '../utils/placeJourney';
import { isLocatedPhoto } from './monthlyPhotoDisplay';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

export type DayPlaceBlock = {
  key: string;
  placeKey: string;
  centerLat: number;
  centerLng: number;
  photos: PhotoRef[];
  cluster: PlaceCluster;
};

export type DayTimelineSection = {
  dayKey: string;
  dateLabel: string;
  places: DayPlaceBlock[];
  /** Every photo from this date, including rows without GPS metadata. */
  photos: DisplayPhoto[];
  /** GPS-less rows stay in the same day collage without a made-up place. */
  noLocationPhotos: DisplayPhoto[];
};

function dayKeyFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso.slice(0, 10);
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dateLabelFromKey(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  if (!y || !m || !d) {
    return dayKey;
  }
  const date = new Date(y, m - 1, d);
  const weekday = WEEKDAYS[date.getDay()] ?? '';
  return `${m}월 ${d}일 (${weekday})`;
}

/**
 * Newest day first. Within a day, place clusters (existing clusterPhotos).
 */
export function buildDayTimeline(photos: DisplayPhoto[]): DayTimelineSection[] {
  if (photos.length === 0) {
    return [];
  }
  const byDay = new Map<string, DisplayPhoto[]>();
  for (const photo of photos) {
    const key = dayKeyFromIso(photo.takenAt);
    const list = byDay.get(key);
    if (list) {
      list.push(photo);
    } else {
      byDay.set(key, [photo]);
    }
  }

  const days = [...byDay.keys()].sort((a, b) => b.localeCompare(a));
  return days.map((dayKey) => {
    const dayPhotos = (byDay.get(dayKey) ?? []).slice().sort((a, b) =>
      b.takenAt.localeCompare(a.takenAt),
    );
    const locatedPhotos = dayPhotos.filter(isLocatedPhoto);
    const clusters = clusterPhotos(locatedPhotos, 14).sort((a, b) => {
      const a0 = a.photos[0]?.takenAt ?? '';
      const b0 = b.photos[0]?.takenAt ?? '';
      return b0.localeCompare(a0);
    });
    const places: DayPlaceBlock[] = clusters.map((cluster) => ({
      key: cluster.id,
      placeKey: placeBucketKey(cluster.centerLat, cluster.centerLng),
      centerLat: cluster.centerLat,
      centerLng: cluster.centerLng,
      photos: cluster.photos,
      cluster,
    }));
    return {
      dayKey,
      dateLabel: dateLabelFromKey(dayKey),
      places,
      photos: dayPhotos,
      noLocationPhotos: dayPhotos.filter((photo) => !isLocatedPhoto(photo)),
    };
  });
}
