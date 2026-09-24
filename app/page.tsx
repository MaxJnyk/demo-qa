import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-white text-center mb-4">QA Interview Demo</h1>
        <p className="text-gray-400 text-center mb-12">Интерактивные сценарии для тестирования кандидатов</p>
        
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">P2P Aggregator</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Link 
              href="/scenario-1" 
              className="block bg-gray-800 border-2 border-purple-500/30 hover:border-purple-500 rounded-2xl p-6 transition-all hover:shadow-lg hover:shadow-purple-500/20"
            >
              <div className="text-5xl mb-3">💳</div>
              <h3 className="text-xl font-bold text-white mb-2">Сценарий 1</h3>
              <p className="text-sm text-gray-400">Лимиты реквизитов</p>
            </Link>

            <Link 
              href="/scenario-2" 
              className="block bg-gray-800 border-2 border-green-500/30 hover:border-green-500 rounded-2xl p-6 transition-all hover:shadow-lg hover:shadow-green-500/20"
            >
              <div className="text-5xl mb-3">💰</div>
              <h3 className="text-xl font-bold text-white mb-2">Сценарий 2</h3>
              <p className="text-sm text-gray-400">Балансы и транзакции</p>
            </Link>

            <Link 
              href="/scenario-3" 
              className="block bg-gray-800 border-2 border-orange-500/30 hover:border-orange-500 rounded-2xl p-6 transition-all hover:shadow-lg hover:shadow-orange-500/20"
            >
              <div className="text-5xl mb-3">📊</div>
              <h3 className="text-xl font-bold text-white mb-2">Сценарий 3</h3>
              <p className="text-sm text-gray-400">Конверсия и оборот</p>
            </Link>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-white mb-6">omniCRM</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Link 
              href="/omnicrm-scenario-1" 
              className="block bg-gray-800 border-2 border-blue-500/30 hover:border-blue-500 rounded-2xl p-6 transition-all hover:shadow-lg hover:shadow-blue-500/20"
            >
              <div className="text-5xl mb-3">�</div>
              <h3 className="text-xl font-bold text-white mb-2">Групповые комнаты</h3>
              <p className="text-sm text-gray-400">Лимиты клиентов и операторов</p>
            </Link>

            <Link 
              href="/omnicrm-scenario-2" 
              className="block bg-gray-800 border-2 border-cyan-500/30 hover:border-cyan-500 rounded-2xl p-6 transition-all hover:shadow-lg hover:shadow-cyan-500/20"
            >
              <div className="text-5xl mb-3">🔒</div>
              <h3 className="text-xl font-bold text-white mb-2">Proxy Manager</h3>
              <p className="text-sm text-gray-400">Логика смены прокси</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
