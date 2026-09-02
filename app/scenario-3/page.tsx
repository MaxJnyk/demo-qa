'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type DealStatus = 'COMPLETED_AUTO' | 'COMPLETED_MANUAL' | 'CANCELLED_CLIENT' | 'CANCELLED_SYSTEM' | 'DISPUTED';

interface Deal {
  id: number;
  status: DealStatus;
  amount: number;
  createdAt: string;
}

export default function Scenario3() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [logs, setLogs] = useState<string[]>([]);

  const log = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    setLogs(prev => [`[${timestamp}] ${prefix} ${message}`, ...prev].slice(0, 20));
  };

  // БАГ #1: Неправильный расчет конверсии - не учитываются DISPUTED сделки!
  const calculateConversion = () => {
    const totalDeals = deals.length;
    if (totalDeals === 0) return { overall: 0, auto: 0, manual: 0 };

    // БАГ: DISPUTED сделки считаются как успешные!
    const successfulDeals = deals.filter(d => 
      d.status === 'COMPLETED_AUTO' || 
      d.status === 'COMPLETED_MANUAL' ||
      d.status === 'DISPUTED' // БАГ: DISPUTED не должны считаться успешными!
    ).length;

    const autoDeals = deals.filter(d => d.status === 'COMPLETED_AUTO').length;
    const manualDeals = deals.filter(d => d.status === 'COMPLETED_MANUAL').length;

    const overallConversion = (successfulDeals / totalDeals) * 100;
    const autoConversion = autoDeals > 0 ? (autoDeals / totalDeals) * 100 : 0;
    const manualConversion = manualDeals > 0 ? (manualDeals / totalDeals) * 100 : 0;

    return {
      overall: parseFloat(overallConversion.toFixed(2)),
      auto: parseFloat(autoConversion.toFixed(2)),
      manual: parseFloat(manualConversion.toFixed(2)),
    };
  };

  // БАГ #2: Оборот считается неправильно - включает отмененные сделки!
  const calculateTurnover = () => {
    // БАГ: Считаем ВСЕ сделки, даже отмененные!
    const totalTurnover = deals.reduce((sum, deal) => sum + deal.amount, 0);
    
    // Правильно было бы:
    // const totalTurnover = deals
    //   .filter(d => d.status === 'COMPLETED_AUTO' || d.status === 'COMPLETED_MANUAL')
    //   .reduce((sum, deal) => sum + deal.amount, 0);

    return totalTurnover;
  };

  const addDeal = (status: DealStatus, amount: number) => {
    const deal: Deal = {
      id: Date.now(),
      status,
      amount,
      createdAt: new Date().toISOString(),
    };

    setDeals(prev => [deal, ...prev]);
    log(`Сделка #${deal.id} создана: ${status} на ${formatNumber(amount)}₽`, 'success');
  };

  const testConversionBug = () => {
    log('🚨 ТЕСТ: Добавляем 3 успешные + 1 disputed + 1 отмененную', 'info');
    
    addDeal('COMPLETED_AUTO', 5000);
    setTimeout(() => addDeal('COMPLETED_MANUAL', 3000), 200);
    setTimeout(() => addDeal('COMPLETED_AUTO', 7000), 400);
    setTimeout(() => addDeal('DISPUTED', 10000), 600);
    setTimeout(() => addDeal('CANCELLED_CLIENT', 2000), 800);
    
    setTimeout(() => {
      const conv = calculateConversion();
      log(`Конверсия: ${conv.overall}%`, 'info');
      log(`БАГ: DISPUTED сделка учитывается как успешная!`, 'error');
      log(`Правильная конверсия должна быть: 60% (3 из 5)`, 'error');
    }, 1000);
  };

  const testTurnoverBug = () => {
    log('🚨 ТЕСТ: Проверка оборота с отмененными сделками', 'info');
    
    addDeal('COMPLETED_AUTO', 10000);
    setTimeout(() => addDeal('CANCELLED_CLIENT', 50000), 200);
    
    setTimeout(() => {
      const turnover = calculateTurnover();
      log(`Оборот: ${formatNumber(turnover)}₽`, 'info');
      log(`БАГ: Отмененная сделка включена в оборот!`, 'error');
      log(`Правильный оборот: 10,000₽ (без отмененной)`, 'error');
    }, 500);
  };

  const reset = () => {
    setDeals([]);
    setLogs([]);
    log('Сброшено', 'info');
  };

  const conversion = calculateConversion();
  const turnover = calculateTurnover();

  const successfulCount = deals.filter(d => 
    d.status === 'COMPLETED_AUTO' || d.status === 'COMPLETED_MANUAL'
  ).length;
  const cancelledCount = deals.filter(d => 
    d.status === 'CANCELLED_CLIENT' || d.status === 'CANCELLED_SYSTEM'
  ).length;
  const disputedCount = deals.filter(d => d.status === 'DISPUTED').length;

  const formatNumber = (num: number) => {
    return mounted ? num.toLocaleString('ru-RU') : num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link href="/" className="text-sm text-blue-400 hover:text-blue-300">← Назад</Link>
          <h1 className="text-3xl font-bold text-white mt-2">Сценарий 3: Конверсия и оборот сделок</h1>
        </div>

        <div className="bg-yellow-900/20 border-2 border-yellow-500/30 rounded-lg p-6 mb-6">
          <h3 className="font-bold text-yellow-400 mb-3">📋 Задача:</h3>
          <div className="text-sm text-gray-300 space-y-2">
            <p><strong>Контекст:</strong> Система считает конверсию сделок и общий оборот для аналитики.</p>
            <p><strong>Проблема:</strong> Аналитики жалуются на завышенную конверсию и неправильный оборот.</p>
            <p><strong>Твоя задача:</strong></p>
            <ul className="ml-6 space-y-1">
              <li>1. Создай несколько сделок с разными статусами</li>
              <li>2. Запусти тесты (кнопки с 🚨)</li>
              <li>3. Найди баги в расчете конверсии и оборота</li>
            </ul>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Создать сделку</h2>
            
            <div className="space-y-3 mb-6">
              <button 
                onClick={() => addDeal('COMPLETED_AUTO', 5000)}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition text-left px-4"
              >
                ✅ Успешная (авто) - 5,000₽
              </button>
              <button 
                onClick={() => addDeal('COMPLETED_MANUAL', 3000)}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-lg transition text-left px-4"
              >
                ✅ Успешная (ручная) - 3,000₽
              </button>
              <button 
                onClick={() => addDeal('CANCELLED_CLIENT', 2000)}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition text-left px-4"
              >
                ❌ Отменена клиентом - 2,000₽
              </button>
              <button 
                onClick={() => addDeal('DISPUTED', 10000)}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 rounded-lg transition text-left px-4"
              >
                ⚠️ Спорная - 10,000₽
              </button>
            </div>

            <div className="border-t border-gray-700 pt-4 space-y-3">
              <button 
                onClick={testConversionBug}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-lg transition"
              >
                🚨 Тест: Баг конверсии (DISPUTED)
              </button>
              <button 
                onClick={testTurnoverBug}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-lg transition"
              >
                🚨 Тест: Баг оборота (отмененные)
              </button>
              <button 
                onClick={reset}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 rounded-lg transition text-sm"
              >
                Сбросить
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="font-bold text-white mb-4">Статистика</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-700 rounded">
                  <span className="text-gray-400">Всего сделок:</span>
                  <span className="font-bold text-white">{deals.length}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-green-900/30 rounded">
                  <span className="text-gray-400">Успешных:</span>
                  <span className="font-bold text-green-400">{successfulCount}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-red-900/30 rounded">
                  <span className="text-gray-400">Отмененных:</span>
                  <span className="font-bold text-red-400">{cancelledCount}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-orange-900/30 rounded">
                  <span className="text-gray-400">Спорных:</span>
                  <span className="font-bold text-orange-400">{disputedCount}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-purple-900/30 border-2 border-purple-500/50 rounded">
                  <span className="text-gray-400">Конверсия:</span>
                  <span className="font-bold text-purple-400">{conversion.overall}%</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-blue-900/30 border-2 border-blue-500/50 rounded">
                  <span className="text-gray-400">Оборот:</span>
                  <span className="font-bold text-blue-400">{formatNumber(turnover)}₽</span>
                </div>
              </div>
            </div>

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
                      <div className="flex justify-between items-center mt-1">
                        <span className={`text-xs px-2 py-1 rounded ${
                          deal.status.includes('COMPLETED') ? 'bg-green-900/50 text-green-400' :
                          deal.status.includes('CANCELLED') ? 'bg-red-900/50 text-red-400' :
                          'bg-orange-900/50 text-orange-400'
                        }`}>
                          {deal.status}
                        </span>
                        <span className="text-xs text-gray-500">
                          {mounted ? new Date(deal.createdAt).toLocaleTimeString() : new Date(deal.createdAt).toISOString().slice(11, 19)}
                        </span>
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
