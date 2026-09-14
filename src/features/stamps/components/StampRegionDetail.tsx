import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AssetThumbImage } from '@/features/photos/components/AssetThumbImage';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';
import { useShellInk } from '@/shared/hooks/useShellBackground';

import type { StampsCollected } from '../types';
import { loadSidoCoverAssetIds } from '../services/stampDongPhotos';
import { sidoEn, sidoFormal } from '../utils/sidoLabels';
import { CityList, type CityRow } from './CityList';
import { TravelStamp, stampInkForKey } from './TravelStamp';

const MOMENT_SIZE = 88;

export interface StampRegionDetailProps {
  sido: string;
  collected: StampsCollected;
  cities: CityRow[];
  visitedL1: number;
  onSelectCity: (key: string) => void;
}

/**
 * 시·도 stamp page — hero seal, L1 stamp book, optional moments strip.
 */
export function StampRegionDetail({
  sido,
  collected,
  cities,
  visitedL1,
  onSelectCity,
}: StampRegionDetailProps) {
  const shell = useShellInk();
  const [covers, setCovers] = useState<string[]>([]);
  const visited = visitedL1 > 0;

  const momentIds = useMemo(() => {
    // Prefer multiple leaf covers when index is warm — loadSido fills one map.
    return covers;
  }, [covers]);

  useEffect(() => {
    let cancelled = false;
    void loadSidoCoverAssetIds(collected, [sido]).then((map) => {
      if (cancelled) {
        return;
      }
      const one = map[sido];
      // Gather up to 8 leaf photos via peek after index warm.
      void import('../services/stampDongPhotos').then((mod) => {
        const ids: string[] = [];
        if (one) {
          ids.push(one);
        }
        for (const entry of Object.values(collected)) {
          if (entry?.sido !== sido) {
            continue;
          }
          const photos = mod.peekPhotosForStampLeaf({
            sido: entry.sido,
            city: entry.city,
            leaf: entry.name,
          });
          for (const p of photos ?? []) {
            if (!ids.includes(p.assetId)) {
              ids.push(p.assetId);
            }
            if (ids.length >= 8) {
              break;
            }
          }
          if (ids.length >= 8) {
            break;
          }
        }
        if (!cancelled) {
          setCovers(ids);
        }
      });
    });
    return () => {
      cancelled = true;
    };
  }, [collected, sido]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      nestedScrollEnabled
    >
      <View style={styles.hero}>
        <TravelStamp
          name={sido}
          nameEn={sidoEn(sido)}
          collected={visited}
          size="hero"
          ink={stampInkForKey(sido)}
        />
        <Text style={[styles.formal, shell.ink]}>{sidoFormal(sido)}</Text>
        <Text style={[styles.heroSub, shell.soft]}>
          {strings.stamps.regionStampCount(visitedL1)}
        </Text>
      </View>

      <Text style={[styles.section, shell.ink]}>
        {strings.stamps.regionDistricts(sido)}
      </Text>

      <CityList cities={cities} onSelect={onSelectCity} />

      {momentIds.length > 0 ? (
        <View style={styles.moments}>
          <Text style={[styles.section, shell.ink]}>
            {strings.stamps.regionMoments(sido)}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.momentRow}
          >
            {momentIds.map((assetId) => (
              <View key={assetId} style={styles.momentCell}>
                <AssetThumbImage
                  assetId={assetId}
                  size={MOMENT_SIZE}
                  priority="low"
                  style={styles.momentImg}
                />
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: theme.spacing.xl,
  },
  hero: {
    alignItems: 'center',
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
    gap: 6,
  },
  formal: {
    fontFamily: theme.fonts.sans,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    marginTop: theme.spacing.sm,
  },
  heroSub: {
    fontFamily: theme.fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    fontFamily: theme.fonts.sans,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  moments: {
    marginTop: theme.spacing.md,
  },
  momentRow: {
    paddingHorizontal: theme.spacing.lg,
    gap: 8,
  },
  momentCell: {
    width: MOMENT_SIZE,
    height: MOMENT_SIZE,
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceAlt,
  },
  momentImg: {
    borderRadius: theme.radius.sm,
  },
});
