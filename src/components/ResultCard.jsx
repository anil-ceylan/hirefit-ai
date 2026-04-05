
export default function ResultCard({ data }) {
  if (!data) return null;

  const score = data?.score || 34;
  const decision = data?.decision || "Not Likely";

  return (
    <div className="mt-6 p-6 rounded-2xl border border-red-500/30 bg-red-500/5 backdrop-blur-lg shadow-xl">

      {/* DECISION */}
      <div className="mb-4">
        <p className="text-xs text-red-400 tracking-widest">DECISION</p>
        <h2 className="text-3xl font-bold text-red-400">{decision}</h2>
        <p className="text-sm text-gray-400 mt-1">{score}% Fit Score</p>
      </div>

      {/* BIGGEST MISTAKE */}
      <div className="mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
        <p className="text-xs text-red-300 mb-1">⚡ BIGGEST MISTAKE</p>
        <p className="text-sm text-white">
          {data?.mistake || "No measurable impact. Every bullet says 'responsible for'."}
        </p>
      </div>

      {/* FIX */}
      <div className="mb-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
        <p className="text-xs text-green-300 mb-1">→ FIX</p>
        <p className="text-sm text-white">
          {data?.fix || "Replace with numbers. 'Grew email list by 40% in 3 months.'"}
        </p>
      </div>

      {/* RECRUITER INSIGHT */}
      <div className="mb-4 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
        <p className="text-xs text-yellow-300 mb-1">💬 RECRUITER INSIGHT</p>
        <p className="text-sm text-white">
          {data?.insight || "This CV looks like everyone else's. Nothing stands out in 7 seconds."}
        </p>
      </div>

      {/* CTA */}
      <button className="w-full mt-2 bg-gradient-to-r from-blue-500 to-purple-500 py-3 rounded-xl font-medium hover:opacity-90">
        Fix my CV now →
      </button>

    </div>
  );
}