
export default function ResultCard({ data }) {
  if (!data) return null;

  const score = data?.score || 34;
  const decision = data?.decision || "Büyük ihtimalle eleneceksin.";

  return (
    <div className="mt-6 p-6 rounded-2xl border border-red-500/30 bg-red-500/5 backdrop-blur-lg shadow-xl">

      <div className="mb-4">
        <p className="text-xs text-red-400 tracking-widest">KARAR</p>
        <h2 className="text-3xl font-bold text-red-400">{decision}</h2>
        <p className="text-sm text-gray-400 mt-1">{score}% Uyum Skoru</p>
      </div>

      <div className="mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
        <p className="text-xs text-red-300 mb-1">⚡ EN KRİTİK HATA</p>
        <p className="text-sm text-white">
          {data?.mistake || "CV’n gerçek sonuçlar göstermiyor."}
        </p>
      </div>

      <div className="mb-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
        <p className="text-xs text-green-300 mb-1">→ DÜZELTME</p>
        <p className="text-sm text-white">
          {data?.fix || "Sonuç ekle: '3 ayda dönüşümü %40 artırdım.'"}
        </p>
      </div>

      <div className="mb-4 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
        <p className="text-xs text-yellow-300 mb-1">💬 RECRUITER GÖRÜŞÜ</p>
        <p className="text-sm text-white">
          {data?.insight || "Bu CV herkes gibi görünüyor. 7 saniyede ayırt edilmiyor."}
        </p>
      </div>

      <button className="w-full mt-2 bg-gradient-to-r from-blue-500 to-purple-500 py-3 rounded-xl font-medium hover:opacity-90">
        CV’ni bu role göre yeniden konumlandır →
      </button>

    </div>
  );
}