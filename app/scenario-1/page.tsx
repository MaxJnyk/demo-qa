'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Scenario1() {
  const [mounted, setMounted] = useState(false);
  const [requisite, setRequisite] = useState({
    name: 'Карта Сбербанк',
    dailyLimit: 500000,
    hourlyLimit: 100000,
    dailyTurnover: 0,
    hourlyTurnover: 0,
    balance: 1000000,
  });

  const [deals, setDeals] = useState<any[]>([]);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const log = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    setLogs(prev => [`[${timestamp}] ${prefix} ${message}`, ...prev].slice(0, 20));
  };

  // БАГ #1: Нет проверки на одновременные сделки!
  const createDeal = async (amount: number) => {
    log(`Создание сделки на ${amount.toLocaleString()}₽...`);
    await new Promise(resolve => setTimeout(resolve, 500));

    const newDailyTurnover = requisite.dailyTurnover + amount;
    const newHourlyTurnover = requisite.hourlyTurnover + amount;

    if (newDailyTurnover > requisite.dailyLimit) {
      log(`Превышен дневной лимит! (${newDailyTurnover.toLocaleString()} > ${requisite.dailyLimit.toLocaleString()})`, 'error');
      return;
    }

    // БАГ #2: Часовой лимит НЕ проверяется!

    const deal = {
      id: Date.now(),
      amount,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    setDeals(prev => [deal, ...prev]);
    setRequisite(prev => ({
      ...prev,
      dailyTurnover: newDailyTurnover,
      hourlyTurnover: newHourlyTurnover,
    }));

    log(`Сделка #${deal.id} создана на ${amount.toLocaleString()}₽`, 'success');
  };

  const simulateRaceCondition = async () => {
    log('🚨 СИМУЛЯЦИЯ: 3 одновременные сделки по 200,000₽', 'info');
    log('Ожидаемый результат: Только 2 сделки должны пройти', 'info');
    
    await Promise.all([
      createDeal(200000),
      createDeal(200000),
      createDeal(200000),
    ]);
  };

  const resetDay = () => {
    setRequisite(prev => ({ ...prev, dailyTurnover: 0, hourlyTurnover: 0 }));
    setDeals([]);
    setLogs([]);
    log('День сброшен', 'info');
  };

  const dailyPercent = Math.min((requisite.dailyTurnover / requisite.dailyLimit) * 100, 100);
  const hourlyPercent = Math.min((requisite.hourlyTurnover / requisite.hourlyLimit) * 100, 100);

  const formatNumber = (num: number) => {
    return mounted ? num.toLocaleString('ru-RU') : num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link href="/" className="text-sm text-blue-400 hover:text-blue-300">← Назад</Link>
          <h1 className="text-3xl font-bold text-white mt-2">Сценарий 1: Лимиты реквизитов</h1>
        </div>

        <div className="bg-yellow-900/20 border-2 border-yellow-500/30 rounded-lg p-6 mb-6">
          <h3 className="font-bold text-yellow-400 mb-3">📋 Задача:</h3>
          <div className="text-sm text-gray-300 space-y-2">
            <p><strong>Контекст:</strong> У реквизита есть дневной лимит (500,000₽) и часовой лимит (100,000₽).</p>
            <p><strong>Проблема:</strong> Пользователь жалуется, что иногда удается превысить лимит.</p>
            <p><strong>Твоя задача:</strong></p>
            <ul className="ml-6 space-y-1">
              <li>1. Протестируй создание сделок</li>
              <li>2. Нажми &quot;Симуляция&quot; (3 одновременные сделки)</li>
              <li>3. Найди баг и опиши его</li>
            </ul>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Реквизит: {requisite.name}</h2>
            
            <div className="space-y-4 mb-6">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Дневной оборот</span>
                  <span className="font-semibold text-white">
                    {formatNumber(requisite.dailyTurnover)} / {formatNumber(requisite.dailyLimit)}₽
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full transition-all ${requisite.dailyTurnover > requisite.dailyLimit ? 'bg-red-500' : 'bg-blue-500'}`}
                    style={{ width: `${dailyPercent}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Часовой оборот</span>
                  <span className="font-semibold text-white">
                    {formatNumber(requisite.hourlyTurnover)} / {formatNumber(requisite.hourlyLimit)}₽
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full transition-all ${requisite.hourlyTurnover > requisite.hourlyLimit ? 'bg-red-500' : 'bg-orange-500'}`}
                    style={{ width: `${hourlyPercent}%` }}
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-700">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Баланс трейдера</span>
                  <span className="font-bold text-green-400">{formatNumber(requisite.balance)}₽</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button 
                onClick={() => createDeal(100000)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition"
              >
                Создать сделку: 100,000₽
              </button>
              <button 
                onClick={() => createDeal(200000)}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition"
              >
                Создать сделку: 200,000₽
              </button>
              <button 
                onClick={simulateRaceCondition}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition"
              >
                🚨 Симуляция: 3 одновременные сделки
              </button>
              <button 
                onClick={resetDay}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 rounded-lg transition text-sm"
              >
                Сбросить день
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="font-bold text-white mb-4">Сделки ({deals.length})</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {deals.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">Нет сделок</p>
                ) : (
                  deals.map(deal => (
                    <div key={deal.id} className="bg-gray-700 rounded p-3">
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-gray-400 text-sm">#{deal.id}</span>
                        <span className="font-bold text-white">{formatNumber(deal.amount)}₽</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {mounted ? new Date(deal.createdAt).toLocaleTimeString() : new Date(deal.createdAt).toISOString().slice(11, 19)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-black border border-gray-700 rounded-xl p-4">
              <h3 className="text-white font-mono text-sm mb-2">Логи:</h3>
              <div className="font-mono text-xs text-green-400 space-y-1 max-h-64 overflow-y-auto">
                {logs.length === 0 ? (
                  <p className="text-gray-600">Нет логов</p>
                ) : (
                  logs.map((log, i) => <div key={i}>{log}</div>)
                )}
              </div>
            </div>
          </div>
        </div>


      </div>
    </div>
  );
}
