import { useEffect, useState } from "react";

export default function Hero() {
  const [score, setScore] = useState(62);

  useEffect(() => {
    let i = 62;
    const interval = setInterval(() => {
      if (i >= 85) return clearInterval(interval);
      i++;
      setScore(i);
    }, 25);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-20 grid lg:grid-cols-2 gap-12 items-center">

      {/* LEFT */}
      <div>
        <p className="text-sm text-purple-400 mb-4">
          Yapay Zeka Destekli CV Analizi
        </p>
        <h1 className="text-5xl font-bold leading-tight mb-6">
          CV’nin neden elendiğini tahmin etmeyi bırak.
        </h1>
        <p className="text-gray-400 mb-8 text-lg">
          10 saniyede net geri bildirim, eksik anahtar kelimeler ve recruiter içgörüsü al.
        </p>
        <div className="flex gap-4">
          <button className="bg-gradient-to-r from-purple-500 to-blue-500 px-6 py-3 rounded-xl font-medium hover:opacity-90 transition">
            CV Skorumu Gör →
          </button>
          <button className="border border-gray-600 px-6 py-3 rounded-xl hover:bg-gray-800 transition">
            Demoyu Gör
          </button>
        </div>
      </div>

      {/* RIGHT */}
      <div className="bg-[#0f172a] border border-gray-800 rounded-2xl p-6 shadow-xl">
        <p className="text-sm text-gray-400 mb-4">Canlı Analiz Önizlemesi</p>

        <div className="flex items-center gap-4 mb-6">
          <div className="text-3xl font-bold text-red-400">62</div>
          <div className="text-gray-500">→</div>
          <div className="text-3xl font-bold text-green-400">{score}</div>
          <div className="text-green-400 text-sm">(+23)</div>
        </div>

        <div className="mb-4">
          <p className="text-sm text-red-400 mb-1">Eksik Anahtar Kelimeler</p>
          <ul className="text-gray-300 text-sm space-y-1">
            <li>- SQL</li>
            <li>- Paydaş Yönetimi</li>
          </ul>
        </div>

        <div className="mb-4">
          <p className="text-sm text-yellow-400 mb-1">Kritik Riskler</p>
          <ul className="text-gray-300 text-sm space-y-1">
            <li>- Ölçülebilir sonuç yok</li>
            <li>- Zayıf aksiyon dili</li>
          </ul>
        </div>

        <div>
          <p className="text-sm text-green-400 mb-1">Düzeltme Önerileri</p>
          <ul className="text-gray-300 text-sm space-y-1">
            <li>- Metrik ekle (%)</li>
            <li>- Madde netliğini artır</li>
          </ul>
        </div>
      </div>

    </div>
  );
}