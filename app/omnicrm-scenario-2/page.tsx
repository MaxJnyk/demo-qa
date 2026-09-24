'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

type ErrorType = 'network' | 'captcha' | 'flood_wait' | 'account_blocked' | 'auth_error';

interface Proxy {
  id: number;
  host: string;
  port: number;
  country: string;
  status: 'active' | 'error';
  assignedAccounts: number;
  maxAccounts: number;
  lastHealthCheck: string | null;
}

interface Account {
  id: number;
  name: string;
  channel: 'telegram' | 'whatsapp';
  proxyId: number | null;
  status: 'connected' | 'error' | 'idle';
  lastError: ErrorType | null;
  connectionAttempts: number;
}

export default function OmniCRMScenario2() {
  const [proxies, setProxies] = useState<Proxy[]>([
    { id: 1, host: '185.20.30.40', port: 8080, country: 'RU', status: 'active', assignedAccounts: 0, maxAccounts: 3, lastHealthCheck: null },
    { id: 2, host: '192.168.1.100', port: 3128, country: 'RU', status: 'active', assignedAccounts: 0, maxAccounts: 3, lastHealthCheck: null },
    { id: 3, host: '10.0.0.50', port: 9090, country: 'RU', status: 'active', assignedAccounts: 0, maxAccounts: 3, lastHealthCheck: null },
  ]);
  
  const [accounts, setAccounts] = useState<Account[]>([
    { id: 1, name: 'TG Account 1', channel: 'telegram', proxyId: null, status: 'idle', lastError: null, connectionAttempts: 0 },
    { id: 2, name: 'TG Account 2', channel: 'telegram', proxyId: null, status: 'idle', lastError: null, connectionAttempts: 0 },
    { id: 3, name: 'WA Account 1', channel: 'whatsapp', proxyId: null, status: 'idle', lastError: null, connectionAttempts: 0 },
    { id: 4, name: 'TG Account 3', channel: 'telegram', proxyId: null, status: 'idle', lastError: null, connectionAttempts: 0 },
  ]);
  
  const [logs, setLogs] = useState<string[]>([]);

  // Refs для чтения актуального состояния внутри async-функций и setTimeout
  const accountsRef = useRef(accounts);
  const proxiesRef = useRef(proxies);
  useEffect(() => { accountsRef.current = accounts; }, [accounts]);
  useEffect(() => { proxiesRef.current = proxies; }, [proxies]);

  const log = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    setLogs(prev => [`[${timestamp}] ${prefix} ${message}`, ...prev].slice(0, 40));
  };

  // БАГ #1 (ЛЕГКИЙ): Прокси меняется при капче, хотя НЕ должен!
  // Правило: Прокси меняется ТОЛЬКО при network ошибке
  // Сейчас: Прокси меняется при ЛЮБОЙ ошибке
  const shouldChangeProxy = (errorType: ErrorType): boolean => {
    // БАГ: Всегда возвращает true!
    return true; 
    
    // Правильно было бы:
    // return errorType === 'network';
  };

  // БАГ #2 (СРЕДНИЙ): Race condition при одновременном запросе прокси
  // Два аккаунта одновременно запрашивают последний свободный прокси
  // Оба получают один и тот же прокси, превышая лимит maxAccounts
  const assignProxy = async (accountId: number) => {
    const account = accountsRef.current.find(a => a.id === accountId);
    if (!account) return;

    if (account.proxyId) {
      log(`Аккаунт ${account.name} уже имеет прокси #${account.proxyId}`, 'info');
      return;
    }

    log(`Запрос прокси для ${account.name}...`);
    
    // БАГ: Нет блокировки! Два запроса могут прочитать одно и то же состояние
    await new Promise(resolve => setTimeout(resolve, 300)); // Имитация задержки сети

    const availableProxy = proxiesRef.current.find(p => p.assignedAccounts < p.maxAccounts);
    if (!availableProxy) {
      log(`Нет доступных прокси для ${account.name}`, 'error');
      return;
    }

    // БАГ: Между чтением и записью может пройти время, другой запрос успеет назначить тот же прокси
    setAccounts(prev => prev.map(a => 
      a.id === accountId ? { ...a, proxyId: availableProxy.id, status: 'connected', connectionAttempts: a.connectionAttempts + 1 } : a
    ));
    
    setProxies(prev => prev.map(p => 
      p.id === availableProxy.id ? { ...p, assignedAccounts: p.assignedAccounts + 1 } : p
    ));

    log(`Прокси #${availableProxy.id} (${availableProxy.host}) назначен ${account.name}`, 'success');
  };

  // БАГ #3 (СЛОЖНЫЙ): Heartbeat не обновляется, прокси "протухает"
  // Аккаунт должен отправлять heartbeat каждые 60 секунд
  // Если heartbeat не приходит 5 минут → прокси освобождается
  // НО: lastHealthCheck никогда не обновляется!
  const sendHeartbeat = (accountId: number) => {
    const account = accountsRef.current.find(a => a.id === accountId);
    if (!account || !account.proxyId) {
      log(`Аккаунт не подключен к прокси`, 'error');
      return;
    }

    log(`Heartbeat от ${account.name}`, 'info');
    
    // БАГ: lastHealthCheck НЕ обновляется!
    // Правильно было бы:
    // setProxies(prev => prev.map(p => 
    //   p.id === account.proxyId ? { ...p, lastHealthCheck: new Date().toISOString() } : p
    // ));
    
    log(`Heartbeat отправлен`, 'success');
  };

  const checkStaleProxies = () => {
    const now = new Date().getTime();
    const STALE_TIMEOUT = 5 * 60 * 1000; // 5 минут

    let staleFound = false;

    proxiesRef.current.forEach(proxy => {
      if (proxy.lastHealthCheck) {
        const lastCheck = new Date(proxy.lastHealthCheck).getTime();
        const diff = now - lastCheck;
        
        if (diff > STALE_TIMEOUT) {
          staleFound = true;
          log(`Прокси #${proxy.id} протух (нет heartbeat ${Math.floor(diff / 1000)}с)`, 'error');
          
          // Освобождаем прокси
          setAccounts(prev => prev.map(a => 
            a.proxyId === proxy.id ? { ...a, proxyId: null, status: 'idle' } : a
          ));
          
          setProxies(prev => prev.map(p => 
            p.id === proxy.id ? { ...p, assignedAccounts: 0, lastHealthCheck: null } : p
          ));
        }
      }
    });

    if (!staleFound) {
      log('Нет протухших прокси', 'info');
    }
  };

  const simulateError = async (accountId: number, errorType: ErrorType) => {
    const account = accountsRef.current.find(a => a.id === accountId);
    if (!account || !account.proxyId) {
      log(`Аккаунт не подключен к прокси`, 'error');
      return;
    }

    log(`Симуляция ошибки: ${errorType} для ${account.name}`, 'info');

    setAccounts(prev => prev.map(a => 
      a.id === accountId ? { ...a, status: 'error', lastError: errorType } : a
    ));

    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (shouldChangeProxy(errorType)) {
      changeProxy(accountId, errorType);
    } else {
      log(`Прокси НЕ меняется (ошибка: ${errorType})`, 'info');
      setAccounts(prev => prev.map(a => 
        a.id === accountId ? { ...a, status: 'connected', lastError: null } : a
      ));
    }
  };

  const changeProxy = (accountId: number, reason: string) => {
    const account = accountsRef.current.find(a => a.id === accountId);
    if (!account || !account.proxyId) return;

    const oldProxyId = account.proxyId;
    
    setProxies(prev => prev.map(p => 
      p.id === oldProxyId ? { ...p, assignedAccounts: Math.max(0, p.assignedAccounts - 1) } : p
    ));

    const availableProxy = proxiesRef.current.find(p => p.id !== oldProxyId && p.assignedAccounts < p.maxAccounts);
    
    if (availableProxy) {
      setAccounts(prev => prev.map(a => 
        a.id === accountId ? { ...a, proxyId: availableProxy.id, status: 'connected', lastError: null } : a
      ));
      
      setProxies(prev => prev.map(p => 
        p.id === availableProxy.id ? { ...p, assignedAccounts: p.assignedAccounts + 1 } : p
      ));

      log(`Прокси изменен: #${oldProxyId} → #${availableProxy.id} (причина: ${reason})`, 'success');
    } else {
      log(`Нет доступных прокси для замены`, 'error');
    }
  };

  // ТЕСТЫ
  const testBug1_Captcha = () => {
    log('ТЕСТ 1: Симуляция капчи от Telegram', 'info');
    
    assignProxy(1);
    
    setTimeout(() => {
      simulateError(1, 'captcha');
    }, 1000);
  };

  const testBug2_RaceCondition = async () => {
    log('ТЕСТ 2: Одновременный запрос прокси (2 аккаунта)', 'info');
    
    await assignProxy(1);
    await new Promise(r => setTimeout(r, 500));
    await assignProxy(2);
    await new Promise(r => setTimeout(r, 500));
    
    log('Запускаем 2 аккаунта ОДНОВРЕМЕННО...', 'info');
    
    await Promise.all([
      assignProxy(3),
      assignProxy(4),
    ]);
    
    setTimeout(() => {
      proxiesRef.current.forEach(p => {
        log(`Прокси #${p.id}: ${p.assignedAccounts} / ${p.maxAccounts} аккаунтов`, 'info');
      });
    }, 1000);
  };

  const testBug3_Heartbeat = () => {
    log('ТЕСТ 3: Heartbeat от аккаунта', 'info');
    
    assignProxy(1);
    
    setTimeout(() => {
      const account = accountsRef.current.find(a => a.id === 1);
      const proxy = proxiesRef.current.find(p => p.id === account?.proxyId);
      
      log(`lastHealthCheck ДО: ${proxy?.lastHealthCheck || 'нет'}`, 'info');
      
      sendHeartbeat(1);
      
      setTimeout(() => {
        const proxyAfter = proxiesRef.current.find(p => p.id === account?.proxyId);
        log(`lastHealthCheck ПОСЛЕ: ${proxyAfter?.lastHealthCheck || 'нет'}`, 'info');
      }, 500);
    }, 1000);
  };

  const reset = () => {
    setAccounts(prev => prev.map(a => ({ ...a, proxyId: null, status: 'idle', lastError: null, connectionAttempts: 0 })));
    setProxies(prev => prev.map(p => ({ ...p, assignedAccounts: 0, status: 'active', lastHealthCheck: null })));
    setLogs([]);
    log('Сброшено', 'info');
  };

  const getErrorColor = (errorType: ErrorType | null) => {
    if (!errorType) return 'gray';
    switch (errorType) {
      case 'network': return 'red';
      case 'captcha': return 'yellow';
      case 'flood_wait': return 'orange';
      case 'account_blocked': return 'purple';
      case 'auth_error': return 'pink';
      default: return 'gray';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link href="/" className="text-sm text-blue-400 hover:text-blue-300">← Назад</Link>
          <h1 className="text-3xl font-bold text-white mt-2">omniCRM: Proxy Manager</h1>
        </div>

        <div className="bg-yellow-900/20 border-2 border-yellow-500/30 rounded-lg p-6 mb-6">
          <h3 className="font-bold text-yellow-400 mb-3">📋 Задача:</h3>
          <div className="text-sm text-gray-300 space-y-2">
            <p><strong>Контекст:</strong> Proxy Manager управляет прокси для Telegram и WhatsApp аккаунтов.</p>
            <p><strong>Правила:</strong></p>
            <ul className="ml-6 space-y-1">
              <li>• Прокси меняется ТОЛЬКО при сетевой ошибке (network)</li>
              <li>• Прокси НЕ меняется при: капче, FloodWait, блокировке, ошибке авторизации</li>
              <li>• Аккаунт отправляет heartbeat каждые 60 секунд</li>
              <li>• Если heartbeat не приходит 5 минут → прокси освобождается</li>
            </ul>
            <p className="mt-3"><strong>Твоя задача:</strong> Протестируй систему и найди проблемы</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">Прокси ({proxies.length})</h2>
              <div className="space-y-3">
                {proxies.map(proxy => (
                  <div key={proxy.id} className="bg-gray-700 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold text-white">Proxy #{proxy.id}</h4>
                        <p className="text-xs text-gray-400 font-mono">{proxy.host}:{proxy.port}</p>
                      </div>
                      <span className="text-xs bg-blue-900/50 text-blue-400 px-2 py-1 rounded">
                        {proxy.country}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-400">Аккаунтов:</span>
                        <span className={`font-semibold ${proxy.assignedAccounts > proxy.maxAccounts ? 'text-red-400' : proxy.assignedAccounts >= proxy.maxAccounts ? 'text-orange-400' : 'text-green-400'}`}>
                          {proxy.assignedAccounts} / {proxy.maxAccounts}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        Heartbeat: {proxy.lastHealthCheck ? new Date(proxy.lastHealthCheck).toLocaleTimeString() : 'нет'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">Аккаунты</h2>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {accounts.map(account => (
                  <div key={account.id} className="bg-gray-700 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold text-white">{account.name}</h4>
                        <p className="text-xs text-gray-400">{account.channel}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${
                        account.status === 'connected' ? 'bg-green-900/50 text-green-400' :
                        account.status === 'error' ? 'bg-red-900/50 text-red-400' :
                        'bg-gray-900/50 text-gray-400'
                      }`}>
                        {account.status}
                      </span>
                    </div>
                    
                    {account.proxyId && (
                      <div className="text-xs text-gray-500 mb-2">
                        Прокси: #{account.proxyId} | Попыток: {account.connectionAttempts}
                      </div>
                    )}
                    
                    {account.lastError && (
                      <div className={`text-xs bg-${getErrorColor(account.lastError)}-900/50 text-${getErrorColor(account.lastError)}-400 px-2 py-1 rounded mb-2`}>
                        Ошибка: {account.lastError}
                      </div>
                    )}
                    
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {!account.proxyId && (
                        <button 
                          onClick={() => assignProxy(account.id)}
                          className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
                        >
                          Назначить прокси
                        </button>
                      )}
                      {account.proxyId && (
                        <>
                          <button 
                            onClick={() => simulateError(account.id, 'captcha')}
                            className="text-xs bg-yellow-600 hover:bg-yellow-700 text-white px-2 py-1 rounded"
                          >
                            Капча
                          </button>
                          <button 
                            onClick={() => simulateError(account.id, 'network')}
                            className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded"
                          >
                            Сеть
                          </button>
                          <button 
                            onClick={() => simulateError(account.id, 'flood_wait')}
                            className="text-xs bg-orange-600 hover:bg-orange-700 text-white px-2 py-1 rounded"
                          >
                            FloodWait
                          </button>
                          <button 
                            onClick={() => sendHeartbeat(account.id)}
                            className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded"
                          >
                            Heartbeat
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="font-bold text-white mb-4">Сценарии</h3>
              <div className="space-y-3">
                <button 
                  onClick={testBug1_Captcha}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition text-left px-4"
                >
                  Тест 1: Симуляция капчи
                </button>
                <button 
                  onClick={testBug2_RaceCondition}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 rounded-lg transition text-left px-4"
                >
                  Тест 2: Одновременные запросы
                </button>
                <button 
                  onClick={testBug3_Heartbeat}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-lg transition text-left px-4"
                >
                  Тест 3: Heartbeat
                </button>
                <button 
                  onClick={checkStaleProxies}
                  className="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 rounded-lg transition text-sm"
                >
                  Проверить протухшие прокси
                </button>
                <button 
                  onClick={reset}
                  className="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 rounded-lg transition text-sm"
                >
                  Сбросить
                </button>
              </div>

              <div className="mt-6 p-4 bg-gray-900 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-400 mb-2">Правила смены прокси:</h4>
                <div className="space-y-1 text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    <span className="text-red-400">✓</span>
                    <span>Сетевая ошибка → МЕНЯЕМ</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">✗</span>
                    <span>Капча → НЕ меняем</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">✗</span>
                    <span>FloodWait → НЕ меняем</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">✗</span>
                    <span>Блокировка → НЕ меняем</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">✗</span>
                    <span>Ошибка авторизации → НЕ меняем</span>
                  </div>
                </div>
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
