'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

// ─── Типы домена TAD ────────────────────────────────────────────────

interface Platform {
  id: number;
  name: string;
  url: string;
  membersCount: number;
  category: string;
  status: 'active' | 'occupied';
  auctionCost: number; // цена поста
  crm: number;
  categoryRisk: number; // 0=LOW, 1=MIDDLE, 2=HIGH
  themeRisk: number;
  hasActivePost: boolean;
}

interface Campaign {
  id: number;
  name: string;
  advertiser: string;
  budgetRemaining: number | null; // null = безлимит
  minPrice: number;
  maxPrice: number;
  crm: number;
  excludedPlatforms: number[]; // exclude_platforms
  status: 'active' | 'draft';
}

interface Revision {
  id: number;
  campaignId: number;
  content: string;
  erid: string;
  status: 'active' | 'draft';
  approvedDate: string | null;
}

interface AdInPost {
  revisionId: number;
  campaignId: number;
  campaignName: string;
  place: number; // 1..N (1 = первый показ, дороже)
  baseCost: number; // per_ad_cost = total / count
  actualCost: number; // baseCost * multiplier
  moneyStatus: 'HELD' | 'CAPTURED' | 'RELEASED';
}

// Перевод статусов денег для отображения
const moneyStatusLabel = (status: 'HELD' | 'CAPTURED' | 'RELEASED'): string => {
  switch (status) {
    case 'HELD': return 'ЗАРЕЗЕРВ';
    case 'CAPTURED': return 'ЗАХВАЧЕН';
    case 'RELEASED': return 'ВОЗВРАЩЕН';
  }
};

interface Post {
  id: number;
  platformId: number;
  platformName: string;
  ads: AdInPost[];
  totalCost: number;
  status: 'pending' | 'published' | 'failed' | 'removed';
  post_id_on_platform: number | null; // message_id от телеги
  currentAdRevisionId: number | null;
  rotationCompletedAt: string | null;
  lastRotatedAt: string | null;
}

// ─── Константы из реального кода TAD ────────────────────────────────

// generate_cost_multipliers: первые N коэффициентов из таблицы на 12 мест
const COST_MULTIPLIERS = [1.20, 1.15, 1.10, 1.08, 1.07, 1.06, 1.05, 1.04, 1.03, 1.02, 1.01, 1.00];

// get_costs_for_items: base = total / sum(mult); item = base * mult
function getCostsForItems(totalCost: number, count: number): number[] {
  const mult = COST_MULTIPLIERS.slice(0, count);
  const sum = mult.reduce((a, b) => a + b, 0);
  const base = totalCost / sum;
  return mult.map(m => Math.ceil(base * m * 100) / 100); // округление до копеек
}

// ─── Компонент ──────────────────────────────────────────────────────

export default function TadScenario() {
  // 3 платформы-кандидата
  const [platforms, setPlatforms] = useState<Platform[]>([
    { id: 1, name: 'Tech News', url: '@technews', membersCount: 45000, category: 'Технологии', status: 'active', auctionCost: 1000, crm: 70, categoryRisk: 0, themeRisk: 0, hasActivePost: false },
    { id: 2, name: 'Crypto Daily', url: '@cryptodaily', membersCount: 80000, category: 'Криптовалюта', status: 'active', auctionCost: 1500, crm: 90, categoryRisk: 1, themeRisk: 0, hasActivePost: false },
    { id: 3, name: 'Startup Hub', url: '@startuphub', membersCount: 30000, category: 'Технологии', status: 'active', auctionCost: 800, crm: 50, categoryRisk: 0, themeRisk: 0, hasActivePost: false },
  ]);

  // 4 кампании (рекламодатели)
  const [campaigns, setCampaigns] = useState<Campaign[]>([
    { id: 1, name: 'Реклама кошелька PayX', advertiser: 'PayX Inc.', budgetRemaining: 500, minPrice: 300, maxPrice: 700, crm: 80, excludedPlatforms: [2], status: 'active' },
    { id: 2, name: 'Продвижение биржи', advertiser: 'CryptoEx', budgetRemaining: 2000, minPrice: 800, maxPrice: 1200, crm: 90, excludedPlatforms: [], status: 'active' },
    { id: 3, name: 'Маркетинг курса', advertiser: 'EduPro', budgetRemaining: 1500, minPrice: 300, maxPrice: 500, crm: 60, excludedPlatforms: [], status: 'active' },
    { id: 4, name: 'Запуск приложения', advertiser: 'AppLaunch', budgetRemaining: null, minPrice: 200, maxPrice: 700, crm: 70, excludedPlatforms: [], status: 'active' },
  ]);

  // Ревизии (по одной активной на кампанию)
  const [revisions] = useState<Revision[]>([
    { id: 101, campaignId: 1, content: 'PayX — мгновенные переводы...', erid: '2VtNxxxx', status: 'active', approvedDate: '2026-10-20T10:00:00Z' },
    { id: 102, campaignId: 2, content: 'CryptoEx — торговая биржа...', erid: '2VtNyyyy', status: 'active', approvedDate: '2026-10-21T12:00:00Z' },
    { id: 103, campaignId: 3, content: 'EduPro — онлайн-курсы...', erid: '2VtNzzzz', status: 'active', approvedDate: '2026-10-22T09:00:00Z' },
    { id: 104, campaignId: 4, content: 'AppLaunch — новое приложение...', erid: '2VtNwwww', status: 'active', approvedDate: '2026-10-23T14:00:00Z' },
  ]);

  const [posts, setPosts] = useState<Post[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const idCounter = useRef(0);

  // Refs
  const platformsRef = useRef(platforms);
  const campaignsRef = useRef(campaigns);
  const postsRef = useRef(posts);
  useEffect(() => { platformsRef.current = platforms; }, [platforms]);
  useEffect(() => { campaignsRef.current = campaigns; }, [campaigns]);
  useEffect(() => { postsRef.current = posts; }, [posts]);

  const log = (message: string, type: 'info' | 'error' | 'success' | 'warning' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
    setLogs(prev => [`[${timestamp}] ${prefix} ${message}`, ...prev].slice(0, 60));
  };

  // ─── БАГ #1 (ЛЕГКИЙ): exclude_platforms не работает ───────────────
  // Реальный баг: в collect_ads_for_auction_post (advertisement.py:291-308)
  // exclude_platforms загружен в eager load (line 338), но НЕ используется в условиях фильтра.

  // БАГ: фильтр не проверяет excludedPlatforms
  function filterByExclusion(ads: Revision[], platformId: number, campaignsList: Campaign[]): Revision[] {
    // БАГ: exclude_platforms проигнорирован!
    return ads;
    // Правильно было бы:
    // return ads.filter(ad => {
    //   const campaign = campaignsList.find(c => c.id === ad.campaignId);
    //   return !campaign?.excludedPlatforms.includes(platformId);
    // });
  }

  // ─── БАГ #2 (СРЕДНИЙ): Budget filter занижает реальную цену ─────────
  // Реальный баг: budget filter проверяет per_ad_cost = opt.cost / count (базовая цена),
  // но реальная цена = base * multiplier (1.20, 1.15, ...). Первое место всегда дороже.

  // БАГ: проверяет per_ad_cost (базовая), а не максимальную реальную цену
  function filterByBudget(ads: Revision[], perAdCost: number, campaignsList: Campaign[]): Revision[] {
    const result: Revision[] = [];
    const remaining = new Map<number, number | null>();
    for (const ad of ads) {
      const campaign = campaignsList.find(c => c.id === ad.campaignId);
      if (!campaign) continue;
      if (!remaining.has(campaign.id)) remaining.set(campaign.id, campaign.budgetRemaining);
      const rem = remaining.get(campaign.id);
      if (rem === null || rem === undefined) { result.push(ad); continue; } // безлимит
      // БАГ: проверяет per_ad_cost (базовая цена), а не реальную (с множителем)
      if (rem >= perAdCost) {
        remaining.set(campaign.id, rem - perAdCost);
        result.push(ad);
      }
    }
    return result;
  }

  // ─── БАГ #3 (СЛОЖНЫЙ): Capture до подтверждения телеги → деньги застревают ─
  // Реальный баг: в rotate_auction_post (tasks/posting.py:147) _capture_auction_display
  // вызывается для queue[0] сразу при отправке, до подтверждения от телеги.
  // Если телега не ответит → пост failed, но retire_due_auction_posts (line 334-340)
  // освобождает только HELD, не CAPTURED. Деньги queue[0] застревают.

  // ─── Подбор объявлений для платформы (упрощённая симуляция) ────────

  async function collectAuctionAds(platform: Platform): Promise<{ ads: Revision[]; perAdCost: number; count: number } | null> {
    const minCount = 2;
    const maxCount = 12;
    const activeRevisions = revisions.filter(r => r.status === 'active');

    // Идём от max к min (как в реальном коде)
    for (let count = maxCount; count >= minCount; count--) {
      const perAdCost = platform.auctionCost / count;

      // 1. Фильтр по цене (min_prise <= cost*0.8, max_prise >= cost*1.1)
      let candidates = activeRevisions.filter(ad => {
        const campaign = campaignsRef.current.find(c => c.id === ad.campaignId);
        if (!campaign) return false;
        return campaign.minPrice <= perAdCost * 0.8 && campaign.maxPrice >= perAdCost * 1.1;
      });

      if (candidates.length < minCount) continue;

      // 2. БАГ #1: фильтр исключённых платформ (не работает!)
      candidates = filterByExclusion(candidates, platform.id, campaignsRef.current);

      // 3. БАГ #2: фильтр по бюджету (занижает реальную цену!)
      candidates = filterByBudget(candidates, perAdCost, campaignsRef.current);

      if (candidates.length < minCount) continue;

      // 4. Детерминированный отбор: сортировка по score (упрощённо — по approved_date)
      candidates.sort((a, b) => (a.approvedDate || '').localeCompare(b.approvedDate || ''));

      // 5. Анти-монополия: ≤K на рекламодателя
      const maxPerAdvertiser = 3;
      const perCampaign = new Map<number, number>();
      const selected: Revision[] = [];
      for (const ad of candidates) {
        if (selected.length >= count) break;
        const used = perCampaign.get(ad.campaignId) || 0;
        if (used >= maxPerAdvertiser) continue;
        perCampaign.set(ad.campaignId, used + 1);
        selected.push(ad);
      }

      if (selected.length < minCount) continue;

      return { ads: selected, perAdCost, count: selected.length };
    }
    return null;
  }

  // ─── Создание поста ────────────────────────────────────────────────

  async function createAuctionPost(platform: Platform, selectedAds: Revision[], perAdCost: number): Promise<number | null> {
    const costs = getCostsForItems(platform.auctionCost, selectedAds.length);

    log(`Расчёт цен для ${selectedAds.length} объявлений:`, 'info');
    log(`  Базовая цена (per_ad_cost): ${perAdCost.toFixed(2)}₽`, 'info');
    costs.forEach((c, i) => log(`  Место ${i + 1}: ${c.toFixed(2)}₽ (множитель ${COST_MULTIPLIERS[i]})`, 'info'));

    // Проверка бюджета с реальными ценами (для лога)
    selectedAds.forEach((ad, i) => {
      const campaign = campaignsRef.current.find(c => c.id === ad.campaignId);
      const realCost = costs[i];
      const budget = campaign?.budgetRemaining;
      if (budget !== null && budget !== undefined) {
        log(`  ${campaign?.name}: бюджет=${budget}₽, цена места=${realCost.toFixed(2)}₽`, 'info');
      }
    });

    const adInPost: AdInPost[] = selectedAds.map((ad, i) => {
      const campaign = campaignsRef.current.find(c => c.id === ad.campaignId)!;
      return {
        revisionId: ad.id,
        campaignId: ad.campaignId,
        campaignName: campaign.name,
        place: i + 1,
        baseCost: perAdCost,
        actualCost: costs[i],
        moneyStatus: 'HELD',
      };
    });

    const postId = ++idCounter.current;
    const newPost: Post = {
      id: postId,
      platformId: platform.id,
      platformName: platform.name,
      ads: adInPost,
      totalCost: platform.auctionCost,
      status: 'pending',
      post_id_on_platform: null,
      currentAdRevisionId: null,
      rotationCompletedAt: null,
      lastRotatedAt: null,
    };

    setPosts(prev => [...prev, newPost]);
    setPlatforms(prev => prev.map(p => p.id === platform.id ? { ...p, hasActivePost: true, status: 'occupied' } : p));

    return postId;
  }

  // ─── Публикация поста (симуляция rotate_auction_post) ──────────────

  async function publishPost(postId: number, telegramResponds: boolean) {
    const post = postsRef.current.find(p => p.id === postId);
    if (!post) return;

    log(`Публикация поста #${postId} на ${post.platformName}...`, 'info');

    // БАГ #3: _capture_auction_display вызывается ДО подтверждения телеги!
    // queue[0] становится CAPTURED сразу
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const updatedAds = p.ads.map((ad, i) => i === 0 ? { ...ad, moneyStatus: 'CAPTURED' as const } : ad);
      return { ...p, ads: updatedAds, currentAdRevisionId: p.ads[0].revisionId, lastRotatedAt: new Date().toISOString() };
    }));

    log(`queue[0] (${post.ads[0].campaignName}): ${moneyStatusLabel('HELD')} → ${moneyStatusLabel('CAPTURED')}`, 'info');

    await new Promise(r => setTimeout(r, 1500)); // имитация ожидания ответа телеги

    if (telegramResponds) {
      const messageId = ++idCounter.current;
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, post_id_on_platform: messageId, status: 'published' } : p));
      log(`Telegram подтвердил публикацию (message_id=${messageId})`, 'success');
      log(`Пост #${postId} опубликован на ${post.platformName}`, 'success');
    } else {
      // Телега не ответила → publish-fail
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, status: 'failed' } : p));
      log(`Telegram НЕ ответил (таймаут)`, 'error');
      log(`Пост #${postId} → failed`, 'error');
    }
  }

  // ─── Тедаун: retire_due_auction_posts ──────────────────────────────

  function retireFailedPost(postId: number) {
    const post = postsRef.current.find(p => p.id === postId);
    if (!post) return;

    log(`Тедаун поста #${postId} (retire_due_auction_posts)...`, 'info');

    // Считаем до setter — React Strict Mode вызывает updater дважды
    let released = 0;
    let stuck = 0;
    for (const ad of post.ads) {
      if (ad.moneyStatus === 'HELD') released++;
      if (ad.moneyStatus === 'CAPTURED') stuck++;
    }

    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const updatedAds = p.ads.map(ad => {
        // БАГ #3: освобождает только HELD, не CAPTURED!
        if (ad.moneyStatus === 'HELD') {
          return { ...ad, moneyStatus: 'RELEASED' as const };
        }
        // БАГ: CAPTURED не освобождается!
        return ad;
      });
      return { ...p, ads: updatedAds, status: 'removed' as const };
    }));

    setPlatforms(prev => prev.map(p => p.id === post.platformId ? { ...p, hasActivePost: false, status: 'active' } : p));

    setTimeout(() => {
      log(`Освобождено (резерв): ${released}`, 'info');
      log(`Застряло (захват): ${stuck}`, 'info');
    }, 300);
  }

  // ─── ТЕСТЫ ────────────────────────────────────────────────────────

  // ТЕСТ 1: exclude_platforms не работает
  const testBug1_Exclusion = async () => {
    log('═══ ТЕСТ 1 ═══', 'info');
    log('', 'info');

    const platform = platformsRef.current.find(p => p.id === 2)!;
    log(`Запуск подбора для Платформы #2 (${platform.name})...`, 'info');

    const result = await collectAuctionAds(platform);
    if (!result) {
      log('Не нашлось объявлений', 'error');
      return;
    }

    log(`Найдено ${result.ads.length} объявлений:`, 'info');
    result.ads.forEach(ad => {
      const campaign = campaignsRef.current.find(c => c.id === ad.campaignId)!;
      log(`  ${campaign.name} (рекламодатель: ${campaign.advertiser})`, 'info');
    });
  };

  // ТЕСТ 2: Budget filter занижает реальную цену
  const testBug2_Budget = async () => {
    log('═══ ТЕСТ 2 ═══', 'info');
    log('', 'info');

    const platform = platformsRef.current.find(p => p.id === 1)!;
    log(`Запуск подбора для Платформы #1 (${platform.name}, цена поста ${platform.auctionCost}₽)...`, 'info');

    const result = await collectAuctionAds(platform);
    if (!result) {
      log('Не нашлось объявлений', 'error');
      return;
    }

    log(`Подобрано ${result.ads.length} объявлений, per_ad_cost = ${result.perAdCost.toFixed(2)}₽`, 'info');
    log('', 'info');

    const costs = getCostsForItems(platform.auctionCost, result.ads.length);
    log(`Реальные цены мест (с множителями):`, 'info');
    costs.forEach((c, i) => log(`  Место ${i + 1}: ${c.toFixed(2)}₽`, 'info'));

    log('', 'info');
    result.ads.forEach((ad, i) => {
      const campaign = campaignsRef.current.find(c => c.id === ad.campaignId)!;
      const realCost = costs[i];
      const budget = campaign.budgetRemaining;
      if (budget !== null) {
        log(`${campaign.name}: бюджет=${budget}₽, цена=${realCost.toFixed(2)}₽`, 'info');
      }
    });
  };

  // ТЕСТ 3: Capture до подтверждения → деньги застряли
  const testBug3_StuckFunds = async () => {
    log('═══ ТЕСТ 3 ═══', 'info');
    log('', 'info');

    const platform = platformsRef.current.find(p => p.id === 3)!;
    log(`Запуск подбора для Платформы #3 (${platform.name})...`, 'info');

    const result = await collectAuctionAds(platform);
    if (!result) {
      log('Не нашлось объявлений', 'error');
      return;
    }

    log(`Создание поста с ${result.ads.length} объявлениями...`, 'info');
    const postId = await createAuctionPost(platform, result.ads, result.perAdCost);
    if (postId === null) return;

    log('', 'info');
    log(`Пост #${postId} создан (status=pending), деньги зарезервированы`, 'info');
    log('Отправка в Telegram...', 'info');

    await publishPost(postId, false);

    log('', 'info');
    log('Запуск тедауна (retire_due_auction_posts)...', 'info');
    await new Promise(r => setTimeout(r, 500));
    retireFailedPost(postId);
  };

  const reset = () => {
    setPlatforms(prev => prev.map(p => ({ ...p, hasActivePost: false, status: 'active' })));
    setCampaigns([
      { id: 1, name: 'Реклама кошелька PayX', advertiser: 'PayX Inc.', budgetRemaining: 500, minPrice: 300, maxPrice: 700, crm: 80, excludedPlatforms: [2], status: 'active' },
      { id: 2, name: 'Продвижение биржи', advertiser: 'CryptoEx', budgetRemaining: 2000, minPrice: 800, maxPrice: 1200, crm: 90, excludedPlatforms: [], status: 'active' },
      { id: 3, name: 'Маркетинг курса', advertiser: 'EduPro', budgetRemaining: 1500, minPrice: 300, maxPrice: 500, crm: 60, excludedPlatforms: [], status: 'active' },
      { id: 4, name: 'Запуск приложения', advertiser: 'AppLaunch', budgetRemaining: null, minPrice: 200, maxPrice: 700, crm: 70, excludedPlatforms: [], status: 'active' },
    ]);
    setPosts([]);
    setLogs([]);
    log('Сброшено', 'info');
  };

  // ─── Ручной подбор (кнопка на платформе) ──────────────────────────
  const runMatching = async (platformId: number) => {
    const platform = platformsRef.current.find(p => p.id === platformId);
    if (!platform) return;
    if (platform.hasActivePost) {
      log(`Платформа #${platformId} уже занята`, 'error');
      return;
    }
    log(`Ручной подбор для Платформы #${platformId} (${platform.name})...`, 'info');
    const result = await collectAuctionAds(platform);
    if (!result) {
      log(`Не нашлось объявлений для ${platform.name}`, 'error');
      return;
    }
    log(`Подобрано ${result.ads.length} объявлений (per_ad_cost=${result.perAdCost.toFixed(2)}₽)`, 'success');
    await createAuctionPost(platform, result.ads, result.perAdCost);
  };

  // ─── Исключить/включить платформу для кампании ────────────────────
  const toggleExclusion = (campaignId: number, platformId: number) => {
    const campaign = campaignsRef.current.find(c => c.id === campaignId);
    if (!campaign) return;
    const isExcluded = campaign.excludedPlatforms.includes(platformId);
    log(`Кампания "${campaign.name}": платформа #${platformId} ${isExcluded ? 'включена' : 'исключена'}`, isExcluded ? 'success' : 'warning');
    setCampaigns(prev => prev.map(c => {
      if (c.id !== campaignId) return c;
      const newExcluded = isExcluded
        ? c.excludedPlatforms.filter(id => id !== platformId)
        : [...c.excludedPlatforms, platformId];
      return { ...c, excludedPlatforms: newExcluded };
    }));
  };

  // ─── Изменить бюджет кампании ─────────────────────────────────────
  const changeBudget = (campaignId: number, delta: number) => {
    const campaign = campaignsRef.current.find(c => c.id === campaignId);
    if (!campaign || campaign.budgetRemaining === null) return;
    const newBudget = Math.max(0, campaign.budgetRemaining + delta);
    log(`Кампания "${campaign.name}": бюджет ${campaign.budgetRemaining}₽ → ${newBudget}₽`, 'info');
    setCampaigns(prev => prev.map(c =>
      c.id === campaignId && c.budgetRemaining !== null
        ? { ...c, budgetRemaining: Math.max(0, c.budgetRemaining + delta) }
        : c
    ));
  };

  // ─── Опубликовать пост вручную ────────────────────────────────────
  const publishPostManual = async (postId: number) => {
    const post = postsRef.current.find(p => p.id === postId);
    if (!post) return;
    if (post.status !== 'pending') {
      log(`Пост #${postId} уже ${post.status}`, 'error');
      return;
    }
    await publishPost(postId, true);
  };

  // ─── Таймаут телеги вручную ───────────────────────────────────────
  const simulateTimeoutManual = async (postId: number) => {
    const post = postsRef.current.find(p => p.id === postId);
    if (!post) return;
    if (post.status !== 'pending') {
      log(`Пост #${postId} уже ${post.status}`, 'error');
      return;
    }
    await publishPost(postId, false);
  };

  // ─── Тедаун поста вручную ─────────────────────────────────────────
  const retirePostManual = (postId: number) => {
    const post = postsRef.current.find(p => p.id === postId);
    if (!post) return;
    if (post.status === 'removed') {
      log(`Пост #${postId} уже удалён`, 'error');
      return;
    }
    log(`Запуск тедауна (retire_due_auction_posts)...`, 'info');
    retireFailedPost(postId);
  };

  const moneyStatusColor = (status: AdInPost['moneyStatus']) => {
    switch (status) {
      case 'HELD': return 'text-yellow-400 bg-yellow-900/30';
      case 'CAPTURED': return 'text-orange-400 bg-orange-900/30';
      case 'RELEASED': return 'text-green-400 bg-green-900/30';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link href="/" className="text-sm text-blue-400 hover:text-blue-300">← Назад</Link>
          <h1 className="text-3xl font-bold text-white mt-2">TAD: Auction Posting Manager</h1>
          <p className="text-sm text-gray-500 mt-1">Рекламная платформа для Telegram-каналов</p>
        </div>

        {/* Задача */}
        <div className="bg-yellow-900/20 border-2 border-yellow-500/30 rounded-lg p-6 mb-6">
          <h3 className="font-bold text-yellow-400 mb-3">📋 Задача:</h3>
          <div className="text-sm text-gray-300 space-y-2">
            <p><strong>Контекст:</strong> TAD — платформа для размещения рекламы в Telegram-каналах. Подбор объявлений для аукционного поста идёт через воронку: фильтры → бюджет → скоринг → создание поста → публикация.</p>
            <p><strong>Правила:</strong></p>
            <ul className="ml-6 space-y-1">
              <li>• Рекламодатель может исключать платформы — его объявления не должны туда попадать</li>
              <li>• Budget filter должен гарантировать, что <strong>реальная цена места</strong> ≤ остатка бюджета</li>
              <li>• Цена места = базовая × множитель (1.20, 1.15, 1.10, ...) — первое место дороже</li>
              <li>• Если пост не опубликовался — <strong>все деньги</strong> (резерв + захват) должны вернуться</li>
              <li>• Деньги захватываются когда объявление становится текущим в ротации</li>
            </ul>
            <p className="mt-3"><strong>Твоя задача:</strong> Протестируй систему и найди проблемы</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Левая колонка: платформы + кампании + посты */}
          <div className="space-y-6">
            {/* Платформы */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">Платформы ({platforms.length})</h2>
              <div className="space-y-3">
                {platforms.map(platform => (
                  <div key={platform.id} className={`bg-gray-700 rounded-lg p-4 ${platform.hasActivePost ? 'opacity-60' : ''}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold text-white">#{platform.id} {platform.name}</h4>
                        <p className="text-xs text-gray-400 font-mono">{platform.url}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${platform.status === 'active' ? 'bg-green-900/50 text-green-400' : 'bg-orange-900/50 text-orange-400'}`}>
                        {platform.status === 'active' ? 'свободна' : 'занята'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                      <div>Участников: {platform.membersCount.toLocaleString('ru-RU')}</div>
                      <div>Категория: {platform.category}</div>
                      <div>Цена поста: {platform.auctionCost}₽</div>
                      <div>CRM: {platform.crm}</div>
                      <div>Риск кат.: {['LOW', 'MIDDLE', 'HIGH'][platform.categoryRisk]}</div>
                      <div>Риск темы: {['LOW', 'MIDDLE', 'HIGH'][platform.themeRisk]}</div>
                    </div>
                    {!platform.hasActivePost && (
                      <button
                        onClick={() => runMatching(platform.id)}
                        className="mt-3 w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2 rounded transition"
                      >
                        Подобрать объявления
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Кампании */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">Кампании ({campaigns.length})</h2>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {campaigns.map(campaign => (
                  <div key={campaign.id} className="bg-gray-700 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold text-white text-sm">{campaign.name}</h4>
                        <p className="text-xs text-gray-400">{campaign.advertiser}</p>
                      </div>
                      <span className="text-xs bg-blue-900/50 text-blue-400 px-2 py-1 rounded">{campaign.status}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                      <div>Бюджет: {campaign.budgetRemaining === null ? '∞' : `${campaign.budgetRemaining}₽`}</div>
                      <div>Цена: {campaign.minPrice}–{campaign.maxPrice}₽</div>
                      <div>CRM: {campaign.crm}</div>
                      <div>
                        Исключено: {campaign.excludedPlatforms.length > 0
                          ? campaign.excludedPlatforms.map(id => `#${id}`).join(', ')
                          : 'нет'}
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      <div className="flex gap-2 flex-wrap">
                        <span className="text-xs text-gray-500 self-center">Исключить:</span>
                        {platforms.map(p => (
                          <button
                            key={p.id}
                            onClick={() => toggleExclusion(campaign.id, p.id)}
                            className={`text-xs px-2 py-1 rounded transition ${
                              campaign.excludedPlatforms.includes(p.id)
                                ? 'bg-red-700 text-white hover:bg-red-600'
                                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                            }`}
                          >
                            #{p.id}
                          </button>
                        ))}
                      </div>
                      {campaign.budgetRemaining !== null && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Бюджет:</span>
                          <button
                            onClick={() => changeBudget(campaign.id, -100)}
                            className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded"
                          >
                            −100₽
                          </button>
                          <span className="text-xs text-white font-mono">{campaign.budgetRemaining}₽</span>
                          <button
                            onClick={() => changeBudget(campaign.id, 100)}
                            className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded"
                          >
                            +100₽
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Посты */}
            {posts.length > 0 && (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                <h2 className="text-xl font-bold text-white mb-4">Посты ({posts.length})</h2>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {posts.map(post => (
                    <div key={post.id} className="bg-gray-700 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-bold text-white text-sm">Пост #{post.id.toString().slice(-6)}</h4>
                          <p className="text-xs text-gray-400">{post.platformName}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded ${
                          post.status === 'published' ? 'bg-green-900/50 text-green-400' :
                          post.status === 'failed' ? 'bg-red-900/50 text-red-400' :
                          post.status === 'removed' ? 'bg-gray-900/50 text-gray-400' :
                          'bg-yellow-900/50 text-yellow-400'
                        }`}>
                          {post.status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mb-2">
                        Всего: {post.totalCost}₽ | message_id: {post.post_id_on_platform ?? 'нет'}
                      </div>
                      <div className="space-y-1">
                        {post.ads.map(ad => (
                          <div key={ad.revisionId} className="flex items-center justify-between text-xs bg-gray-900/50 rounded px-2 py-1">
                            <span className="text-gray-300">
                              #{ad.place} {ad.campaignName}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500">{ad.actualCost.toFixed(2)}₽</span>
                              <span className={`px-1.5 py-0.5 rounded ${moneyStatusColor(ad.moneyStatus)}`}>
                                {moneyStatusLabel(ad.moneyStatus)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      {post.status === 'pending' && (
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => publishPostManual(post.id)}
                            className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded"
                          >
                            Опубликовать
                          </button>
                          <button
                            onClick={() => simulateTimeoutManual(post.id)}
                            className="text-xs bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded"
                          >
                            Таймаут телеги
                          </button>
                        </div>
                      )}
                      {(post.status === 'failed' || post.status === 'published') && (
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => retirePostManual(post.id)}
                            className="text-xs bg-gray-600 hover:bg-gray-700 text-white px-3 py-1.5 rounded"
                          >
                            Тедаун
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Правая колонка: тесты + логи */}
          <div className="space-y-6">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="font-bold text-white mb-4">Сценарии</h3>
              <div className="space-y-3">
                <button
                  onClick={testBug1_Exclusion}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition text-left px-4"
                >
                  Тест 1
                </button>
                <button
                  onClick={testBug2_Budget}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 rounded-lg transition text-left px-4"
                >
                  Тест 2
                </button>
                <button
                  onClick={testBug3_StuckFunds}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-lg transition text-left px-4"
                >
                  Тест 3
                </button>
                <button
                  onClick={reset}
                  className="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 rounded-lg transition text-sm"
                >
                  Сбросить
                </button>
              </div>

              {/* Множители цены */}
              <div className="mt-6 p-4 bg-gray-900 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-400 mb-2">Множители цены мест:</h4>
                <div className="grid grid-cols-6 gap-1 text-xs">
                  {COST_MULTIPLIERS.map((m, i) => (
                    <div key={i} className="bg-gray-800 rounded px-1 py-1 text-center text-gray-400">
                      <div className="text-gray-500">#{i + 1}</div>
                      <div className="text-white font-mono">{m.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">Место 1 = первый показ = самая высокая цена</p>
              </div>

              {/* Статусы денег */}
              <div className="mt-4 p-4 bg-gray-900 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-400 mb-2">Жизненный цикл денег:</h4>
                <div className="space-y-1 text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-400 font-mono">ЗАРЕЗЕРВ</span>
                    <span>→ деньги зарезервированы при создании поста</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-orange-400 font-mono">ЗАХВАЧЕН</span>
                    <span>→ объявление стало текущим (захват)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-400 font-mono">ВОЗВРАЩЕН</span>
                    <span>→ деньги возвращены (пост не опубликовался)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Логи */}
            <div className="bg-black border border-gray-700 rounded-xl p-4">
              <h3 className="text-white font-mono text-sm mb-2">Логи:</h3>
              <div className="font-mono text-xs text-green-400 space-y-1 h-[500px] overflow-y-auto">
                {logs.length === 0 ? (
                  <p className="text-gray-600">Нет логов</p>
                ) : (
                  logs.map((logLine, i) => <div key={i}>{logLine}</div>)
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
