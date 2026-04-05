"use client"

import { useState } from "react";



const [cv, setCv] = useState("");
const [jd, setJd] = useState("");
const [result, setResult] = useState(null);
const [loading, setLoading] = useState(false);

const handleAnalyze = async () => {
  setLoading(true);

  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cv, jd }),
    });

    const data = await res.json();
    setResult(data);
  } catch (err) {
    console.error(err);
  }

  setLoading(false);
};




