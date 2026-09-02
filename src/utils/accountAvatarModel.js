function cleanText(value) {
  return String(value || "").trim();
}

function firstNonEmpty(values = []) {
  return values.map(cleanText).find(Boolean) || "";
}

export function getAccountDisplayName(user, careerProfile) {
  const basic = careerProfile?.basic_profile || {};
  const meta = user?.user_metadata || {};
  return firstNonEmpty([
    basic.fullName,
    basic.full_name,
    basic.name,
    [basic.firstName, basic.lastName].filter(Boolean).join(" "),
    meta.full_name,
    meta.name,
    meta.display_name,
    meta.preferred_username,
  ]);
}

export function getAccountAvatarUrl(user, careerProfile) {
  const basic = careerProfile?.basic_profile || {};
  const meta = user?.user_metadata || {};
  return firstNonEmpty([
    basic.avatarUrl,
    basic.avatar_url,
    basic.profilePhotoUrl,
    basic.profile_photo_url,
    careerProfile?.avatarUrl,
    careerProfile?.avatar_url,
    meta.avatar_url,
    meta.picture,
  ]);
}

export function getAccountInitials(user, careerProfile) {
  const displayName = getAccountDisplayName(user, careerProfile);
  const email = cleanText(user?.email);
  const source = displayName || email || "?";
  if (source.includes("@")) return (source[0] || "?").toUpperCase();

  const words = source.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
  }
  return (words[0]?.[0] || "?").toUpperCase();
}
