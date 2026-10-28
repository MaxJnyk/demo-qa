'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

const ANIM_STYLE = `
@keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
`;

interface Platform {
  id: number; name: string; url: string; membersCount: number;
  category: string; auctionCost: number; status: 'active' | 'busy'; hasActivePost: boolean;
}
interface Campaign {
  id: number; name: string; advertiser: string;
  budgetRemaining: number | null; minPrice: number; maxPrice: number;
  excludedPlatforms: number[]; status: string;
}
interface AdInPost {
  revisionId: number; campaignId: number; campaignName: string;
  place: number; baseCost: number; actualCost: number;
  moneyStatus: 'HELD' | 'CAPTURED' | 'RELEASED';
}
interface Post {
  id: number; platformId: number; platformName: string;
  status: 'pending' | 'published' | 'failed' | 'removed';
  totalCost: number; post_id_on_platform: number | null; ads: AdInPost[];
}

const COST_MULTIPLIERS = [1.20, 1.15, 1.10, 1.08, 1.07, 1.06, 1.05, 1.04, 1.03, 1.02, 1.01, 1.00];

function getCostsForItems(totalCost: number, count: number): number[] {
  const mult = COST_MULTIPLIERS.slice(0, count);
  const sum = mult.reduce((a, b) => a + b, 0);
  const base = totalCost / sum;
  return mult.map(m => Math.ceil(base * m * 100) / 100);
}

const moneyLabel = (s: string) => s === 'HELD' ? 'Заморожены' : s === 'CAPTURED' ? 'Списаны' : 'Возвращены';
const moneyColor = (s: string) =>
  s === 'HELD' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
  s === 'CAPTURED' ? 'bg-orange-50 text-orange-700 border border-orange-200 animate-pulse' :
  'bg-green-50 text-green-700 border border-green-200';

const statusColor = (s: string) =>
  s === 'published' ? 'bg-green-100 text-green-700' :
  s === 'failed' ? 'bg-red-100 text-red-700' :
  s === 'removed' ? 'bg-gray-100 text-gray-500' :
  'bg-amber-100 text-amber-700';

const INITIAL_PLATFORMS: Platform[] = [
  { id: 1, name: 'Mash', url: '@mash', membersCount: 3278000, category: 'Новости', auctionCost: 1000, status: 'active', hasActivePost: false },
  { id: 2, name: 'РИА Новости', url: '@rian_ru', membersCount: 3365000, category: 'Новости', auctionCost: 1500, status: 'active', hasActivePost: false },
  { id: 3, name: 'Readovka', url: '@readovkanews', membersCount: 2600000, category: 'Новости', auctionCost: 800, status: 'active', hasActivePost: false },
];

const INITIAL_CAMPAIGNS: Campaign[] = [
  { id: 1, name: 'Реклама кошелька PayX', advertiser: 'PayX Inc.', budgetRemaining: 500, minPrice: 300, maxPrice: 700, excludedPlatforms: [2], status: 'active' },
  { id: 2, name: 'Продвижение биржи', advertiser: 'CryptoEx', budgetRemaining: 2000, minPrice: 800, maxPrice: 1200, excludedPlatforms: [], status: 'active' },
  { id: 3, name: 'Маркетинг курса', advertiser: 'EduPro', budgetRemaining: 1500, minPrice: 300, maxPrice: 500, excludedPlatforms: [], status: 'active' },
  { id: 4, name: 'Запуск приложения', advertiser: 'AppLaunch', budgetRemaining: null, minPrice: 200, maxPrice: 700, excludedPlatforms: [], status: 'active' },
];

const REVISIONS = [
  { id: 101, campaignId: 1, approvedDate: '2026-10-20T10:00:00Z' },
  { id: 102, campaignId: 2, approvedDate: '2026-10-21T12:00:00Z' },
  { id: 103, campaignId: 3, approvedDate: '2026-10-22T09:00:00Z' },
  { id: 104, campaignId: 4, approvedDate: '2026-10-23T14:00:00Z' },
];

function filterByExclusion(ads: typeof REVISIONS): typeof REVISIONS { return ads; }
function filterByBudget(ads: typeof REVISIONS, perAdCost: number, campaigns: Campaign[]): typeof REVISIONS {
  const result: typeof REVISIONS = [];
  const remaining = new Map<number, number | null>();
  for (const ad of ads) {
    const c = campaigns.find(c => c.id === ad.campaignId);
    if (!c) continue;
    if (!remaining.has(c.id)) remaining.set(c.id, c.budgetRemaining);
    const rem = remaining.get(c.id);
    if (rem === null || rem === undefined) { result.push(ad); continue; }
    if (rem >= perAdCost) { remaining.set(c.id, rem - perAdCost); result.push(ad); }
  }
  return result;
}

function collectAuctionAds(platform: Platform, campaigns: Campaign[]) {
  for (let count = 12; count >= 2; count--) {
    const perAdCost = platform.auctionCost / count;
    let candidates = REVISIONS.filter(ad => {
      const c = campaigns.find(c => c.id === ad.campaignId);
      if (!c) return false;
      return c.minPrice <= perAdCost * 0.8 && c.maxPrice >= perAdCost * 1.1;
    });
    if (candidates.length < 2) continue;
    candidates = filterByExclusion(candidates);
    candidates = filterByBudget(candidates, perAdCost, campaigns);
    if (candidates.length < 2) continue;
    candidates.sort((a, b) => a.approvedDate.localeCompare(b.approvedDate));
    const perCampaign = new Map<number, number>();
    const selected: typeof REVISIONS = [];
    for (const ad of candidates) {
      if (selected.length >= count) break;
      const used = perCampaign.get(ad.campaignId) || 0;
      if (used >= 3) continue;
      perCampaign.set(ad.campaignId, used + 1);
      selected.push(ad);
    }
    if (selected.length < 2) continue;
    return { ads: selected, perAdCost, count: selected.length };
  }
  return null;
}

export default function TadScenario() {
  const [platforms, setPlatforms] = useState<Platform[]>(INITIAL_PLATFORMS);
  const [campaigns, setCampaigns] = useState<Campaign[]>(INITIAL_CAMPAIGNS);
  const [posts, setPosts] = useState<Post[]>([]);
  const [logs, setLogs] = useState<{msg: string, hint: string, type: string}[]>([]);
  const [showHints, setShowHints] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);
  const [loading, setLoading] = useState(false);
  const idCounter = useRef(0);
  const platformsRef = useRef(platforms);
  const campaignsRef = useRef(campaigns);
  const postsRef = useRef(posts);

  useEffect(() => { platformsRef.current = platforms; }, [platforms]);
  useEffect(() => { campaignsRef.current = campaigns; }, [campaigns]);
  useEffect(() => { postsRef.current = posts; }, [posts]);

  const log = (msg: string, type: 'info' | 'error' | 'success' | 'warning' = 'info', hint: string = '') => {
    const time = new Date().toLocaleTimeString('ru-RU', { hour12: false });
    const icon = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
    setLogs(prev => [...prev, { msg: `[${time}] ${icon} ${msg}`, hint, type }].slice(-200));
  };

  async function runMatching(platformId: number) {
    const platform = platformsRef.current.find(p => p.id === platformId);
    if (!platform || platform.hasActivePost) return;
    setLoading(true);
    log(`Подбор для Площадки #${platformId} (${platform.name})...`);
    const result = collectAuctionAds(platform, campaignsRef.current);
    if (!result) { log('Не нашлось объявлений', 'error'); setLoading(false); return; }
    log(`Найдено ${result.ads.length} объявлений, per_ad_cost=${result.perAdCost.toFixed(2)}₽`);
    const costs = getCostsForItems(platform.auctionCost, result.ads.length);
    result.ads.forEach((ad, i) => {
      const c = campaignsRef.current.find(c => c.id === ad.campaignId)!;
      log(`  ${c.name}: место ${i+1}, цена ${costs[i].toFixed(2)}₽`);
    });
    const postId = Date.now();
    const adInPost: AdInPost[] = result.ads.map((ad, i) => ({
      revisionId: ad.id, campaignId: ad.campaignId,
      campaignName: campaignsRef.current.find(c => c.id === ad.campaignId)!.name,
      place: i + 1, baseCost: result.perAdCost, actualCost: costs[i], moneyStatus: 'HELD',
    }));
    const newPost: Post = {
      id: postId, platformId: platform.id, platformName: platform.name,
      status: 'pending', totalCost: platform.auctionCost, post_id_on_platform: null, ads: adInPost,
    };
    setPosts(prev => [...prev, newPost]);
    setPlatforms(prev => prev.map(p => p.id === platformId ? { ...p, hasActivePost: true, status: 'busy' } : p));
    log(`Пост #${postId} создан (status=pending), деньги зарезервированы`);
    setLoading(false);
  }

  async function publishPost(postId: number, telegramResponds: boolean) {
    const post = postsRef.current.find(p => p.id === postId);
    if (!post || post.status !== 'pending') return;
    setLoading(true);
    log(`Отправка в Telegram...`);
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      return { ...p, ads: p.ads.map((ad, i) => i === 0 ? { ...ad, moneyStatus: 'CAPTURED' } : ad) };
    }));
    log(`queue[0] (${post.ads[0].campaignName}): Заморожены → Списаны`, 'info', '⚠️ БАГ: Списание денег ДО подтверждения Telegram. Если публикация провалится — списанные деньги не вернутся');
    await new Promise(r => setTimeout(r, 1500));
    if (telegramResponds) {
      const messageId = ++idCounter.current;
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, post_id_on_platform: messageId, status: 'published' } : p));
      log(`Telegram подтвердил (message_id=${messageId})`, 'success');
    } else {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, status: 'failed' } : p));
      log(`Telegram не ответил (таймаут)`, 'info', 'Пост не опубликовался — теперь тедаун должен вернуть ВСЕ деньги (резерв + захват)');
      log(`Пост #${postId} → failed`, 'info', 'Пост не опубликовался. Деньги должны вернуться');
    }
    setLoading(false);
  }

  function retirePost(postId: number) {
    const post = postsRef.current.find(p => p.id === postId);
    if (!post || post.status === 'removed') return;
    let released = 0, stuck = 0;
    for (const ad of post.ads) {
      if (ad.moneyStatus === 'HELD') released++;
      if (ad.moneyStatus === 'CAPTURED') stuck++;
    }
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      return { ...p, ads: p.ads.map(ad => ad.moneyStatus === 'HELD' ? { ...ad, moneyStatus: 'RELEASED' } : ad), status: 'removed' };
    }));
    setPlatforms(prev => prev.map(p => p.id === post.platformId ? { ...p, hasActivePost: false, status: 'active' } : p));
    log(`Тедаун поста #${postId}...`);
    log(`Освобождено (резерв): ${released}`);
    log(`Застряло (списано): ${stuck}`, 'info', stuck > 0 ? `⚠️ БАГ: ДЕНЬГИ НЕ ВЕРНУЛИСЬ! Тедаун возвращает только замороженные, но не списанные. ${stuck} объявление(й) осталось со списанными деньгами` : '');
  }

  function toggleExclusion(campaignId: number, platformId: number) {
    const c = campaignsRef.current.find(c => c.id === campaignId);
    if (!c) return;
    const isExcluded = c.excludedPlatforms.includes(platformId);
    log(`Кампания "${c.name}": площадка #${platformId} ${isExcluded ? 'включена' : 'исключена'}`, isExcluded ? 'success' : 'warning');
    setCampaigns(prev => prev.map(c => {
      if (c.id !== campaignId) return c;
      return { ...c, excludedPlatforms: isExcluded ? c.excludedPlatforms.filter(id => id !== platformId) : [...c.excludedPlatforms, platformId] };
    }));
  }

  function changeBudget(campaignId: number, delta: number) {
    const c = campaignsRef.current.find(c => c.id === campaignId);
    if (!c || c.budgetRemaining === null) return;
    const newBudget = Math.max(0, c.budgetRemaining + delta);
    log(`Кампания "${c.name}": бюджет ${c.budgetRemaining}₽ → ${newBudget}₽`);
    setCampaigns(prev => prev.map(c => c.id === campaignId && c.budgetRemaining !== null ? { ...c, budgetRemaining: Math.max(0, c.budgetRemaining + delta) } : c));
  }

  function reset() {
    setPlatforms(INITIAL_PLATFORMS);
    setCampaigns(INITIAL_CAMPAIGNS);
    setPosts([]);
    setLogs([]);
    log('Сброшено');
  }

  // Тесты
  const testBug1 = async () => {
    log('═══ ТЕСТ 1 ═══', 'info'); log('', 'info');
    await new Promise(r => setTimeout(r, 400));
    log('Кампания "PayX" исключила Площадку #2 (РИА Новости)', 'info');
    await new Promise(r => setTimeout(r, 400));
    log('Правило: объявления не должны попадать на исключённые площадки', 'info'); log('', 'info');
    await new Promise(r => setTimeout(r, 400));
    const platform = platformsRef.current.find(p => p.id === 2)!;
    if (platform.hasActivePost) { log('Площадка #2 уже занята — сбрось сначала', 'info'); return; }
    log(`Запуск подбора для Площадки #2 (${platform.name})...`);
    await new Promise(r => setTimeout(r, 500));
    const result = collectAuctionAds(platform, campaignsRef.current);
    if (!result) return;
    log(`Найдено ${result.ads.length} объявлений:`, 'info');
    await new Promise(r => setTimeout(r, 300));
    for (const ad of result.ads) {
      const c = campaignsRef.current.find(c => c.id === ad.campaignId)!;
      const excluded = c.excludedPlatforms.includes(platform.id);
      const msg = `  ${c.name} (рекламодатель: ${c.advertiser})`;
      log(msg, 'info', excluded ? '⚠️ ИСКЛЮЧЁН, НО ПОПАЛ! Кампания исключила эту площадку, но объявление попало в подбор' : '');
      await new Promise(r => setTimeout(r, 300));
    }
    // Создаём пост в UI
    const costs = getCostsForItems(platform.auctionCost, result.ads.length);
    const postId = Date.now();
    const adInPost: AdInPost[] = result.ads.map((ad, i) => ({
      revisionId: ad.id, campaignId: ad.campaignId,
      campaignName: campaignsRef.current.find(c => c.id === ad.campaignId)!.name,
      place: i + 1, baseCost: result.perAdCost, actualCost: costs[i], moneyStatus: 'HELD',
    }));
    const newPost: Post = {
      id: postId, platformId: platform.id, platformName: platform.name,
      status: 'pending', totalCost: platform.auctionCost, post_id_on_platform: null, ads: adInPost,
    };
    setPosts(prev => [...prev, newPost]);
    setPlatforms(prev => prev.map(p => p.id === platform.id ? { ...p, hasActivePost: true, status: 'busy' } : p));
    log(`Пост #${postId} создан (status=pending), деньги зарезервированы`, 'info');
    await new Promise(r => setTimeout(r, 400));
    log('', 'info');
    log('Подбор завершён', 'info', 'БАГ: Объявление попало на исключённую площадку! exclude_platforms не работает');
  };

  const testBug2 = async () => {
    log('═══ ТЕСТ 2 ═══', 'info'); log('', 'info');
    await new Promise(r => setTimeout(r, 400));
    log('Кампания "PayX" имеет бюджет 500₽', 'info');
    await new Promise(r => setTimeout(r, 400));
    log('Правило: реальная цена места не должна превышать остаток бюджета', 'info'); log('', 'info');
    await new Promise(r => setTimeout(r, 400));
    const platform = platformsRef.current.find(p => p.id === 1)!;
    if (platform.hasActivePost) { log('Площадка #1 уже занята — сбрось сначала', 'info'); return; }
    log(`Запуск подбора для Площадки #1 (${platform.name}, цена поста ${platform.auctionCost}₽)...`);
    await new Promise(r => setTimeout(r, 500));
    const result = collectAuctionAds(platform, campaignsRef.current);
    if (!result) return;
    log(`Подобрано ${result.ads.length} объявлений, per_ad_cost = ${result.perAdCost.toFixed(2)}₽`, 'info'); log('', 'info');
    await new Promise(r => setTimeout(r, 400));
    log('Реальные цены мест (с множителями):', 'info');
    const costs = getCostsForItems(platform.auctionCost, result.ads.length);
    for (let i = 0; i < costs.length; i++) {
      log(`  Место ${i+1}: ${costs[i].toFixed(2)}₽`, 'info');
      await new Promise(r => setTimeout(r, 300));
    }
    log('', 'info');
    await new Promise(r => setTimeout(r, 400));
    for (let i = 0; i < result.ads.length; i++) {
      const c = campaignsRef.current.find(c => c.id === result.ads[i].campaignId)!;
      const budget = c.budgetRemaining;
      if (budget !== null) {
        const over = costs[i] > budget;
        const msg = `${c.name}: бюджет=${budget}₽, цена=${costs[i].toFixed(2)}₽`;
        log(msg, 'info', over ? `⚠️ ПЕРЕРАСХОД на ${(costs[i] - budget).toFixed(2)}₽! Budget filter проверяет базовую цену (${result.perAdCost.toFixed(2)}₽), а не реальную цену места с множителем` : '');
        await new Promise(r => setTimeout(r, 300));
      }
    }
    // Создаём пост в UI
    const postId = Date.now();
    const adInPost: AdInPost[] = result.ads.map((ad, i) => ({
      revisionId: ad.id, campaignId: ad.campaignId,
      campaignName: campaignsRef.current.find(c => c.id === ad.campaignId)!.name,
      place: i + 1, baseCost: result.perAdCost, actualCost: costs[i], moneyStatus: 'HELD',
    }));
    const newPost: Post = {
      id: postId, platformId: platform.id, platformName: platform.name,
      status: 'pending', totalCost: platform.auctionCost, post_id_on_platform: null, ads: adInPost,
    };
    setPosts(prev => [...prev, newPost]);
    setPlatforms(prev => prev.map(p => p.id === platform.id ? { ...p, hasActivePost: true, status: 'busy' } : p));
    log(`Пост #${postId} создан (status=pending), деньги зарезервированы`, 'info');
  };

  const testBug3 = async () => {
    log('═══ ТЕСТ 3 ═══', 'info'); log('', 'info');
    await new Promise(r => setTimeout(r, 400));
    log('Правило: если пост не опубликовался — все деньги должны вернуться', 'info'); log('', 'info');
    await new Promise(r => setTimeout(r, 400));
    const platform = platformsRef.current.find(p => p.id === 3)!;
    log(`Запуск подбора для Площадки #3 (${platform.name})...`);
    await new Promise(r => setTimeout(r, 500));
    const result = collectAuctionAds(platform, campaignsRef.current);
    if (!result) return;
    log(`Создание поста с ${result.ads.length} объявлениями...`);
    await new Promise(r => setTimeout(r, 400));
    log(`Расчёт цен для ${result.ads.length} объявлений:`, 'info');
    const costs = getCostsForItems(platform.auctionCost, result.ads.length);
    log(`  Базовая цена (per_ad_cost): ${result.perAdCost.toFixed(2)}₽`, 'info');
    await new Promise(r => setTimeout(r, 400));
    for (let i = 0; i < costs.length; i++) {
      log(`  Место ${i+1}: ${costs[i].toFixed(2)}₽ (множитель ${COST_MULTIPLIERS[i]})`, 'info');
      await new Promise(r => setTimeout(r, 300));
    }
    log('', 'info');
    await new Promise(r => setTimeout(r, 400));
    const postId = Date.now();
    const adInPost: AdInPost[] = result.ads.map((ad, i) => ({
      revisionId: ad.id, campaignId: ad.campaignId,
      campaignName: campaignsRef.current.find(c => c.id === ad.campaignId)!.name,
      place: i + 1, baseCost: result.perAdCost, actualCost: costs[i], moneyStatus: 'HELD',
    }));
    const newPost: Post = {
      id: postId, platformId: platform.id, platformName: platform.name,
      status: 'pending', totalCost: platform.auctionCost, post_id_on_platform: null, ads: adInPost,
    };
    setPosts(prev => [...prev, newPost]);
    setPlatforms(prev => prev.map(p => p.id === platform.id ? { ...p, hasActivePost: true, status: 'busy' } : p));
    log(`Пост #${postId} создан (status=pending), деньги зарезервированы`, 'info');
    await new Promise(r => setTimeout(r, 600));
    log('Симуляция: Telegram НЕ отвечает (таймаут)...', 'info', 'Пост не опубликовался — теперь тедаун должен вернуть ВСЕ деньги');
    await publishPost(postId, false);
    await new Promise(r => setTimeout(r, 500));
    log('', 'info');
    log('Запуск тедауна (retire_due_auction_posts)...', 'info');
    await new Promise(r => setTimeout(r, 400));
    retirePost(postId);
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <style dangerouslySetInnerHTML={{ __html: ANIM_STYLE }} />
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-[1800px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-slate-400 hover:text-slate-600 text-sm">← Назад</Link>
            <div className="h-6 w-px bg-slate-200" />
            <h1 className="text-lg font-bold text-slate-900">TAD — Auction Posting Manager</h1>
          </div>
          <button onClick={reset} className="text-sm text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition">
            ↻ Сбросить
          </button>
        </div>
      </header>

      {/* Rules */}
      <div className="max-w-[1800px] mx-auto px-6 pt-4">
        <details className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
          <summary className="font-semibold text-amber-800 cursor-pointer">📋 Задача: протестируй систему и найди проблемы</summary>
          <div className="text-xs text-slate-700 space-y-1 mt-2">
            <p><strong>Контекст:</strong> TAD — платформа для размещения рекламы в Telegram-каналах. Подбор объявлений: фильтры → бюджет → скоринг → создание поста → публикация.</p>
            <p><strong>Правила:</strong></p>
            <ul className="ml-4 space-y-0.5">
              <li>• Рекламодатель может исключать площадки — его объявления не должны туда попадать</li>
              <li>• Budget filter должен гарантировать, что <strong>реальная цена места</strong> ≤ остатка бюджета</li>
              <li>• Цена места = базовая × множитель (1.20, 1.15, 1.10, ...) — первое место дороже</li>
              <li>• Если пост не опубликовался — <strong>все деньги</strong> (резерв + захват) должны вернуться</li>
              <li>• Деньги захватываются когда объявление становится текущим в ротации</li>
            </ul>
          </div>
        </details>
      </div>

      {/* 3 колонки */}
      <div className="max-w-[1800px] mx-auto px-6 pt-4">
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Площадки */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h2 className="font-bold text-slate-900 mb-1">Площадки <span className="text-slate-400 font-normal">({platforms.length})</span></h2>
            <p className="text-xs text-slate-500 mb-3">Telegram-каналы для размещения рекламы</p>
            <div className="space-y-3">
              {platforms.map(p => (
                <div key={p.id} className={`rounded-lg border p-3 ${p.hasActivePost ? 'border-slate-200 bg-slate-50 opacity-60' : 'border-slate-200 bg-white'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-semibold text-slate-900 text-sm">#{p.id} {p.name}</h4>
                      <p className="text-xs text-slate-500 font-mono">{p.url}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                      {p.status === 'active' ? 'свободна' : 'занята'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 mb-2">
                    Подписчиков: <span className="font-mono font-semibold">{p.membersCount.toLocaleString('ru-RU')}</span> • Цена поста: <span className="font-mono font-semibold">{p.auctionCost}₽</span>
                  </div>
                  {!p.hasActivePost && (
                    <button onClick={() => runMatching(p.id)} disabled={loading}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium py-2 rounded-lg transition">
                      Подобрать объявления
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Кампании */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h2 className="font-bold text-slate-900 mb-1">Кампании <span className="text-slate-400 font-normal">({campaigns.length})</span></h2>
            <p className="text-xs text-slate-500 mb-3">Рекламные кампании с бюджетом и настройками</p>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {campaigns.map(c => (
                <div key={c.id} className="rounded-lg border border-slate-200 p-3 hover:shadow-sm transition">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-semibold text-slate-900 text-sm">{c.name}</h4>
                      <p className="text-xs text-slate-500">{c.advertiser}</p>
                    </div>
                    {c.budgetRemaining !== null ? (
                      <span className="text-sm font-mono font-semibold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">{c.budgetRemaining}₽</span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-lg bg-slate-100 text-slate-500 border border-slate-200">∞</span>
                    )}
                  </div>
                  
                  {/* Исключения */}
                  <div className="mb-3">
                    {c.excludedPlatforms.length > 0 ? (
                      <div className="bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5 mb-2">
                        <span className="text-xs text-red-700 font-semibold">🚫 Исключено: {c.excludedPlatforms.map(id => `#${id}`).join(', ')}</span>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 mb-2">Исключений нет</div>
                    )}
                    <div className="flex gap-1.5">
                      {platforms.map(p => {
                        const isExcluded = c.excludedPlatforms.includes(p.id);
                        return (
                          <button key={p.id} onClick={() => toggleExclusion(c.id, p.id)}
                            className={`text-xs px-2.5 py-1 rounded-md font-medium transition border ${
                              isExcluded
                                ? 'bg-red-500 text-white border-red-500 hover:bg-red-600'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                            }`}>#{p.id}</button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Бюджет */}
                  {c.budgetRemaining !== null && (
                    <div className="flex items-center justify-between bg-slate-50 rounded-lg p-2 border border-slate-100">
                      <span className="text-xs text-slate-500">Бюджет:</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => changeBudget(c.id, -100)} className="w-7 h-7 rounded-md bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-sm transition">−</button>
                        <span className="text-sm font-mono font-semibold text-slate-900 min-w-[60px] text-center">{c.budgetRemaining}₽</span>
                        <button onClick={() => changeBudget(c.id, 100)} className="w-7 h-7 rounded-md bg-green-50 hover:bg-green-100 text-green-600 border border-green-200 font-bold text-sm transition">+</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Посты */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h2 className="font-bold text-slate-900 mb-1">Посты <span className="text-slate-400 font-normal">({posts.length})</span></h2>
            <p className="text-xs text-slate-500 mb-2">Аукционные посты с объявлениями и деньгами</p>
            <div className="text-xs text-slate-600 bg-slate-50 rounded-lg p-2 mb-3 space-y-1 border border-slate-200">
              <div className="flex items-center gap-1.5"><span className="bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded text-xs font-medium">Заморожены</span> — деньги на холде, рекламодатель их ещё может получить назад</div>
              <div className="flex items-center gap-1.5"><span className="bg-orange-50 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded text-xs font-medium">Списаны</span> — деньги ушли платформе, вернуть уже нельзя</div>
              <div className="flex items-center gap-1.5"><span className="bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded text-xs font-medium">Возвращены</span> — деньги вернулись рекламодателю</div>
            </div>
            {posts.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                <p>Постов пока нет</p>
                <p className="text-xs mt-1">Нажми «Подобрать» на площадке</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {posts.map(post => (
                  <div key={post.id} className={`rounded-lg border p-3 ${post.status === 'pending' ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-semibold text-slate-900 text-sm">Пост #{post.id.toString().slice(-6)}</h4>
                        <p className="text-xs text-slate-500">{post.platformName}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(post.status)}`}>{post.status}</span>
                    </div>
                    <div className="text-xs text-slate-500 mb-2">Всего: {post.totalCost}₽ • msg: {post.post_id_on_platform ?? '—'}</div>
                    <div className="space-y-1">
                      {post.ads.map(ad => (
                        <div key={ad.revisionId} className="flex items-center justify-between text-xs bg-slate-50 rounded px-2 py-1">
                          <span className="text-slate-700">#{ad.place} {ad.campaignName}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 font-mono">{ad.actualCost.toFixed(2)}₽</span>
                            <span title={ad.moneyStatus === 'HELD' ? 'Деньги на холде, рекламодатель их ещё может получить назад' : ad.moneyStatus === 'CAPTURED' ? 'Деньги ушли платформе, вернуть уже нельзя' : 'Деньги вернулись рекламодателю'} className={`px-1.5 py-0.5 rounded text-xs font-medium cursor-help ${moneyColor(ad.moneyStatus)}`}>{moneyLabel(ad.moneyStatus)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {post.status === 'pending' && (
                      <div className="mt-3 border-t border-slate-200 pt-2">
                        <p className="text-xs text-slate-500 mb-2">Дальше: нажми чтобы отправить в Telegram</p>
                        <div className="flex gap-2">
                          <button onClick={() => publishPost(post.id, true)} disabled={loading} className="text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1.5 rounded">✓ Опубликовать</button>
                          <button onClick={() => publishPost(post.id, false)} disabled={loading} className="text-xs bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white px-3 py-1.5 rounded">✗ Таймаут телеги</button>
                        </div>
                      </div>
                    )}
                    {(post.status === 'failed' || post.status === 'published') && (
                      <div className="mt-3 border-t border-slate-200 pt-2">
                        <p className="text-xs text-slate-500 mb-2">Дальше: заверши пост и верни деньги</p>
                        <button onClick={() => retirePost(post.id)} disabled={loading} className="text-xs bg-slate-600 hover:bg-slate-700 disabled:opacity-50 text-white px-3 py-1.5 rounded">Тедаун</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Тесты + Логи */}
      <div className="max-w-[1800px] mx-auto px-6 py-4">
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h3 className="font-bold text-slate-900 mb-3">Сценарии</h3>
            <div className="space-y-2">
              <button onClick={testBug1} className="w-full bg-red-50 hover:bg-red-100 text-red-700 font-medium py-2.5 rounded-lg transition text-sm border border-red-200">Тест 1</button>
              <button onClick={testBug2} className="w-full bg-orange-50 hover:bg-orange-100 text-orange-700 font-medium py-2.5 rounded-lg transition text-sm border border-orange-200">Тест 2</button>
              <button onClick={testBug3} className="w-full bg-purple-50 hover:bg-purple-100 text-purple-700 font-medium py-2.5 rounded-lg transition text-sm border border-purple-200">Тест 3</button>
            </div>
            <div className="mt-3 p-3 bg-slate-50 rounded-lg text-xs space-y-1">
              <div className="flex items-center gap-2"><span className="text-blue-700 font-mono">Заморожены</span><span className="text-slate-500">→ на холде, можно вернуть</span></div>
              <div className="flex items-center gap-2"><span className="text-orange-700 font-mono">Списаны</span><span className="text-slate-500">→ ушли платформе, нельзя вернуть</span></div>
              <div className="flex items-center gap-2"><span className="text-green-700 font-mono">Возвращены</span><span className="text-slate-500">→ вернулись рекламодателю</span></div>
            </div>
          </div>
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 lg:col-span-2 relative">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-slate-300 font-mono text-sm">Логи:</h3>
              <button onClick={() => setShowHints(!showHints)} title="Показать подсказки" className={`text-xs px-2 py-1 rounded transition ${showHints ? 'text-amber-400 bg-amber-900/30' : 'text-slate-500 hover:text-slate-300'}`}>
                {showHints ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            <div className="font-mono text-xs space-y-0.5 h-[300px] overflow-y-auto">
              {logs.length === 0 ? <p className="text-slate-600">Нет логов</p> :
                logs.map((l, i) => (
                  <div key={i} className={`px-2 py-0.5 rounded animate-[fadeIn_0.3s_ease-in-out] ${l.type === 'error' ? 'text-red-400' : l.type === 'success' ? 'text-green-400' : l.type === 'warning' ? 'text-yellow-400' : 'text-slate-300'}`}>
                    {l.msg}
                    {showHints && l.hint && <span className="block ml-4 text-amber-400 text-xs">  ↳ {l.hint}</span>}
                  </div>
                ))}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
