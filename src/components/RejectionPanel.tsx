type RejectionReasons = {
  high: string[];
  medium: string[];
  low: string[];
};

const RejectionPanel = ({ reasons }: { reasons: RejectionReasons }) => {
  return (
    <div style={{
      background: "#0B1220",
      border: "1px solid rgba(239,68,68,0.2)",
      borderRadius: 16,
      padding: 20,
      marginBottom: 20
    }}>
      <h2 style={{ color: "#ef4444", marginBottom: 16 }}>
        🚫 Why You Get Rejected
      </h2>

      {["high", "medium", "low"].map((level) => (
        <div key={level} style={{ marginBottom: 12 }}>
          <h3 style={{
            color:
              level === "high"
                ? "#ef4444"
                : level === "medium"
                ? "#facc15"
                : "#9ca3af",
            fontSize: 14,
            marginBottom: 6
          }}>
            {level.toUpperCase()} RISK
          </h3>

          <ul style={{ paddingLeft: 16 }}>
            {reasons[level as keyof RejectionReasons]?.map((item: string, i: number) => (
              <li key={i} style={{ color: "#d1d5db", marginBottom: 4 }}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

export default RejectionPanel;