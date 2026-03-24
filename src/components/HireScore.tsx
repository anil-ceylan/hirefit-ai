type HireScoreProps = {
  probability: number;
  confidence: string;
};

const HireScore = ({ probability, confidence }: HireScoreProps) => {
  return (
    <div style={{
      background: "#0B1220",
      border: "1px solid rgba(59,130,246,0.2)",
      borderRadius: 16,
      padding: 20,
      marginBottom: 20
    }}>
      <h2 style={{ color: "#9ca3af", marginBottom: 8 }}>
        Hire Probability
      </h2>

      <div style={{
        fontSize: 40,
        fontWeight: "bold",
        color: "white"
      }}>
        {probability}%
      </div>

      <div style={{ color: "#9ca3af", marginTop: 6 }}>
        Confidence: {confidence}
      </div>
    </div>
  );
};

export default HireScore;