import type { Href } from 'expo-router';

import { strings } from '@/shared/constants/strings';

import type { HomeNavItem } from '../components/HomeNavBar';

/** Shared dock for map + archive screens (current routes only). */
export const APP_NAV_ITEMS: HomeNavItem[] = [
  { href: '/' as Href, label: strings.map.home, icon: 'map' },
  { href: '/playback' as Href, label: strings.playback.title, icon: 'play' },
  { href: '/cards' as Href, label: strings.cards.listTitle, icon: 'card' },
  { href: '/stamps' as Href, label: strings.stamps.title, icon: 'stamp' },
];
