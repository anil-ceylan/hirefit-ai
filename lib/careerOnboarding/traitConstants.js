/** Measured trait dimensions (Career DNA assessment). */
export const TRAIT_DIMENSIONS = [
  "leadership",
  "communication",
  "risk_taking",
  "analytical_thinking",
  "creativity",
  "execution",
  "collaboration",
  "ambiguity_tolerance",
];

/** Career archetypes — behavior model (not MBTI). */
export const ARCHETYPE_TYPES = {
  builder: {
    id: "builder",
    labelEn: "Builder",
    labelTr: "Kurucu Ruh",
    paths: ["product_manager", "ai_product_management", "software_engineer", "founder"],
  },
  operator: {
    id: "operator",
    labelEn: "Operator",
    labelTr: "Operatör",
    paths: ["operations_management", "project_manager", "program_management", "general_operations"],
  },
  strategist: {
    id: "strategist",
    labelEn: "Strategist",
    labelTr: "Stratejist",
    paths: ["strategy_analyst", "management_consulting", "business_analyst", "corporate_finance"],
  },
  analyst: {
    id: "analyst",
    labelEn: "Analyst",
    labelTr: "Analist",
    paths: ["data_analyst", "financial_analyst", "business_analyst", "risk_analyst"],
  },
  creator: {
    id: "creator",
    labelEn: "Creator",
    labelTr: "Yaratıcı",
    paths: ["ui_ux_designer", "brand_management", "content_strategy", "growth_manager"],
  },
  founder: {
    id: "founder",
    labelEn: "Founder",
    labelTr: "Girişimci",
    paths: ["founder", "business_development", "growth", "product_manager"],
  },
  researcher: {
    id: "researcher",
    labelEn: "Researcher",
    labelTr: "Araştırmacı",
    paths: ["user_research", "data_analyst", "market_research", "health_informatics"],
  },
  communicator: {
    id: "communicator",
    labelEn: "Communicator",
    labelTr: "İletişimci",
    paths: ["brand_communications", "social_media", "pr", "customer_success"],
  },
  leader: {
    id: "leader",
    labelEn: "Leader",
    labelTr: "Lider",
    paths: ["product_manager", "operations_management", "general_operations", "founder"],
  },
};
