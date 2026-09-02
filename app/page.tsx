import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center p-8">
      <div className="max-w-4xl mx-auto">
        <div className="grid md:grid-cols-3 gap-8">
          <Link 
            href="/scenario-1" 
            className="block bg-gray-800 border-2 border-purple-500/30 hover:border-purple-500 rounded-2xl p-8 transition-all hover:shadow-lg hover:shadow-purple-500/20 text-center"
          >
            <div className="text-6xl mb-4">💳</div>
            <h3 className="text-2xl font-bold text-white">Сценарий 1</h3>
          </Link>

          <Link 
            href="/scenario-2" 
            className="block bg-gray-800 border-2 border-green-500/30 hover:border-green-500 rounded-2xl p-8 transition-all hover:shadow-lg hover:shadow-green-500/20 text-center"
          >
            <div className="text-6xl mb-4">💰</div>
            <h3 className="text-2xl font-bold text-white">Сценарий 2</h3>
          </Link>

          <Link 
            href="/scenario-3" 
            className="block bg-gray-800 border-2 border-orange-500/30 hover:border-orange-500 rounded-2xl p-8 transition-all hover:shadow-lg hover:shadow-orange-500/20 text-center"
          >
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-2xl font-bold text-white">Сценарий 3</h3>
          </Link>
        </div>
      </div>
    </div>
  );
}
