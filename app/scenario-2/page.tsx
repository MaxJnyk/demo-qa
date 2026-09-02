'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Scenario2() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  const [deal, setDeal] = useState({
    amount: 10000,
    baseRate: 95.50,
    appliedRate: 96.50,
    commissionIncluded: false,
    traderBalanceBefore: 50000,
  });

  const [logs, setLogs] = useState<string[]>([]);

  const log = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    setLogs(prev => [`[${timestamp}] ${prefix} ${message}`, ...prev].slice(0, 15));
  };

  // БАГ #1: Неправильный расчет спреда при commission_included=true
  const calculateSpread = () => {
    const spread = ((deal.appliedRate - deal.baseRate) / deal.baseRate) * 100;
    return spread.toFixed(2);
  };

  // БАГ #2: Округление - доход трейдера + доход платформы != amount
  const calculateIncomes = () => {
    const amountInUsdt = deal.amount / deal.appliedRate;
    const baseAmountInUsdt = deal.amount / deal.baseRate;
    
    const platformIncome = (amountInUsdt - baseAmountInUsdt) * deal.baseRate;
    const traderIncome = deal.amount - platformIncome;

    // БАГ: Используем toFixed(2), что дает ошибку округления!
    return {
      platformIncome: parseFloat(platformIncome.toFixed(2)),
      traderIncome: parseFloat(traderIncome.toFixed(2)),
      total: parseFloat((platformIncome + traderIncome).toFixed(2)),
    };
  };

  // БАГ #3: Баланс обновляется неправильно при commission_included
  const calculateNewBalance = () => {
    const incomes = calculateIncomes();
    
    if (deal.commissionIncluded) {
      // БАГ: При commission_included баланс считается неправильно!
      return deal.traderBalanceBefore + incomes.traderIncome;
    } else {
      return deal.traderBalanceBefore + incomes.traderIncome;
    }
  };

  const createDeal = () => {
    log('Создание сделки...', 'info');
    
    const incomes = calculateIncomes();
    const spread = calculateSpread();
    const newBalance = calculateNewBalance();

    log(`Сумма сделки: ${formatNumber(deal.amount)}₽`, 'info');
    log(`Базовый курс: ${deal.baseRate} | Применен: ${deal.appliedRate}`, 'info');
    log(`Спред: ${spread}%`, 'info');
    log(`Доход платформы: ${formatNumber(incomes.platformIncome)}₽`, 'success');
    log(`Доход трейдера: ${formatNumber(incomes.traderIncome)}₽`, 'success');
    log(`Сумма доходов: ${formatNumber(incomes.total)}₽`, 'info');
    
    // БАГ: Проверка суммы
    if (incomes.total !== deal.amount) {
      log(`⚠️ ОШИБКА ОКРУГЛЕНИЯ! ${incomes.total} !== ${deal.amount} (разница: ${(deal.amount - incomes.total).toFixed(2)}₽)`, 'error');
    }

    log(`Баланс ДО: ${formatNumber(deal.traderBalanceBefore)}₽`, 'info');
    log(`Баланс ПОСЛЕ: ${formatNumber(newBalance)}₽`, 'success');
  };

  const testCommissionBug = () => {
    log('🚨 ТЕСТ: Комиссия включена в сумму', 'info');
    setDeal(prev => ({ ...prev, commissionIncluded: true }));
    
    setTimeout(() => {
      const incomes = calculateIncomes();
      log(`При commission_included=true:`, 'info');
      log(`Доход платформы: ${formatNumber(incomes.platformIncome)}₽`, 'info');
      log(`Доход трейдера: ${formatNumber(incomes.traderIncome)}₽`, 'info');
      log(`БАГ: Спред рассчитывается одинаково, хотя логика должна отличаться!`, 'error');
    }, 500);
  };

  const incomes = calculateIncomes();
  const spread = calculateSpread();

  const formatNumber = (num: number) => {
    return mounted ? num.toLocaleString('ru-RU') : num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link href="/" className="text-sm text-blue-400 hover:text-blue-300">← Назад</Link>
          <h1 className="text-3xl font-bold text-white mt-2">Сценарий 2: Расчет комиссий и спреда</h1>
        </div>

        <div className="bg-yellow-900/20 border-2 border-yellow-500/30 rounded-lg p-6 mb-6">
          <h3 className="font-bold text-yellow-400 mb-3">📋 Задача:</h3>
          <div className="text-sm text-gray-300 space-y-2">
            <p><strong>Контекст:</strong> При создании сделки рассчитывается спред, доход платформы и трейдера.</p>
            <p><strong>Проблема:</strong> Бухгалтерия жалуется на расхождения в копейках. Иногда сумма доходов != сумме сделки.</p>
            <p><strong>Твоя задача:</strong></p>
            <ul className="ml-6 space-y-1">
              <li>1. Создай несколько сделок с разными суммами</li>
              <li>2. Проверь расчет при commission_included=true</li>
              <li>3. Найди баги округления и логики</li>
            </ul>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Параметры сделки</h2>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Сумма сделки (₽)</label>
                <input 
                  type="number"
                  value={deal.amount}
                  onChange={(e) => setDeal(prev => ({ ...prev, amount: parseFloat(e.target.value) }))}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Базовый курс</label>
                  <input 
                    type="number"
                    step="0.01"
                    value={deal.baseRate}
                    onChange={(e) => setDeal(prev => ({ ...prev, baseRate: parseFloat(e.target.value) }))}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Применен курс</label>
                  <input 
                    type="number"
                    step="0.01"
                    value={deal.appliedRate}
                    onChange={(e) => setDeal(prev => ({ ...prev, appliedRate: parseFloat(e.target.value) }))}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Баланс трейдера ДО</label>
                <input 
                  type="number"
                  value={deal.traderBalanceBefore}
                  onChange={(e) => setDeal(prev => ({ ...prev, traderBalanceBefore: parseFloat(e.target.value) }))}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                />
              </div>

              <div className="flex items-center gap-3">
                <input 
                  type="checkbox"
                  checked={deal.commissionIncluded}
                  onChange={(e) => setDeal(prev => ({ ...prev, commissionIncluded: e.target.checked }))}
                  className="w-5 h-5"
                />
                <label className="text-sm text-gray-300">Комиссия включена в сумму</label>
              </div>
            </div>

            <div className="space-y-3">
              <button 
                onClick={createDeal}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition"
              >
                Создать сделку
              </button>
              <button 
                onClick={testCommissionBug}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition"
              >
                🚨 Тест: commission_included=true
              </button>
              <button 
                onClick={() => setLogs([])}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 rounded-lg transition text-sm"
              >
                Очистить логи
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="font-bold text-white mb-4">Расчет доходов</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-700 rounded">
                  <span className="text-gray-400">Спред:</span>
                  <span className="font-bold text-purple-400">{spread}%</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-700 rounded">
                  <span className="text-gray-400">Доход платформы:</span>
                  <span className="font-bold text-blue-400">{formatNumber(incomes.platformIncome)}₽</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-700 rounded">
                  <span className="text-gray-400">Доход трейдера:</span>
                  <span className="font-bold text-green-400">{formatNumber(incomes.traderIncome)}₽</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-700 rounded border-2 border-yellow-500/30">
                  <span className="text-gray-400">Сумма доходов:</span>
                  <span className="font-bold text-white">{formatNumber(incomes.total)}₽</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-700 rounded">
                  <span className="text-gray-400">Сумма сделки:</span>
                  <span className="font-bold text-white">{formatNumber(deal.amount)}₽</span>
                </div>
                {incomes.total !== deal.amount && (
                  <div className="p-3 bg-red-900/30 border border-red-500/50 rounded">
                    <p className="text-red-400 text-sm font-semibold">
                      ⚠️ ОШИБКА: Разница {(deal.amount - incomes.total).toFixed(2)}₽
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-black border border-gray-700 rounded-xl p-4">
              <h3 className="text-white font-mono text-sm mb-2">Логи:</h3>
              <div className="font-mono text-xs text-green-400 space-y-1 max-h-96 overflow-y-auto">
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
