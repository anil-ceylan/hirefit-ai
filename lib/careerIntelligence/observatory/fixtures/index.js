import { strongProductProfile } from "./strongProductProfile.js";
import { strategyOperationsProfile } from "./strategyOperationsProfile.js";
import { analyticsProfile } from "./analyticsProfile.js";
import { earlyStudentProfile } from "./earlyStudentProfile.js";
import { conflictingProfile } from "./conflictingProfile.js";

export const sanitizedProfileFixtures = [
  strongProductProfile,
  strategyOperationsProfile,
  analyticsProfile,
  earlyStudentProfile,
  conflictingProfile,
];

export function getSanitizedProfileFixture(id = "") {
  return sanitizedProfileFixtures.find((fixture) => fixture.id === id || fixture.id.includes(id)) || null;
}

export {
  strongProductProfile,
  strategyOperationsProfile,
  analyticsProfile,
  earlyStudentProfile,
  conflictingProfile,
};
