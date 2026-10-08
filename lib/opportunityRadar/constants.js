export const JOB_SUBTYPES = Object.freeze(["full-time", "part-time", "freelance", "internship"]);
export const USER_STATES = Object.freeze(["saved", "dismissed", "acted_on"]);
export const RANKING_VERSION = "jobs-v1";
export const LOCATION_RANKING_VERSION = "jobs-location-v1";
export const CANDIDATE_LIMIT = 200;
export const SMALL_CATALOG_LIMIT = 1000;
export const WEIGHTS = Object.freeze({ target_role: 30, target_sector: 15, skills: 20, location: 10, work_mode: 10, experience_level: 10, career_direction: 5 });
