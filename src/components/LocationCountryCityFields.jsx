import CountryMultiSelect from "./CountryMultiSelect.jsx";
import CitySelect from "./CitySelect.jsx";
import CityMultiSelect from "./CityMultiSelect.jsx";
import { getCityGroupsForCountries, resolveCountryCode } from "../data/locationData.js";

/**
 * Single country + city pair (residence or university).
 */
export function LocationCountryCityPair({
  lang = "TR",
  countryLabel,
  cityLabel,
  countryCode = "",
  city = "",
  countryPlaceholder,
  cityPlaceholderDisabled,
  cityPlaceholderEnabled,
  onCountryChange,
  onCityChange,
}) {
  const code = resolveCountryCode(countryCode);
  const hasCountry = Boolean(code);

  return (
    <div className="hf-location-fields__pair">
      <div className="hf-location-fields__block">
        <label className="hf-location-fields__label">{countryLabel}</label>
        <CountryMultiSelect
          lang={lang}
          maxSelections={1}
          value={code ? [code] : []}
          placeholder={countryPlaceholder}
          onChange={(list) => {
            const next = list[0] || "";
            onCountryChange?.(next);
            if (!next || (code && next !== code)) onCityChange?.("");
          }}
        />
      </div>
      <div className="hf-location-fields__block">
        <label className={`hf-location-fields__label${!hasCountry ? " hf-location-fields__label--disabled" : ""}`}>
          {cityLabel}
        </label>
        <CitySelect
          lang={lang}
          countryCode={code}
          value={city}
          onChange={onCityChange}
          disabled={!hasCountry}
          placeholder={hasCountry ? cityPlaceholderEnabled : cityPlaceholderDisabled}
        />
      </div>
    </div>
  );
}

/**
 * @param {"residence"|"university"|"target"} mode
 */
export default function LocationCountryCityFields({
  mode = "residence",
  lang = "TR",
  countryCodes = [],
  city = "",
  targetCities = [],
  onCountryCodesChange,
  onCityChange,
  onTargetCitiesChange,
  /** residence mode — split props */
  residenceCountryCode = "",
  residenceCity = "",
  onResidenceCountryChange,
  onResidenceCityChange,
  universityCountryCode = "",
  universityCity = "",
  universityCities = [],
  onUniversityCountryChange,
  onUniversityCityChange,
  onUniversityCitiesChange,
}) {
  const tr = lang === "TR";

  if (mode === "residence" && onResidenceCountryChange) {
    const countryPh = tr ? "Yaşadığın ülkeyi seç veya ara" : "Search or select your country";
    return (
      <div className="hf-location-fields">
        <div className="hf-location-section">
          <h3 className="hf-location-section__title">{tr ? "Kalıcı İkamet" : "Permanent residence"}</h3>
          <LocationCountryCityPair
            lang={lang}
            countryLabel={tr ? "İkamet Ülkesi" : "Country of residence"}
            cityLabel={tr ? "Kalıcı İkamet Şehri" : "Home city"}
            countryCode={residenceCountryCode}
            city={residenceCity}
            countryPlaceholder={countryPh}
            cityPlaceholderDisabled={tr ? "Önce ikamet ülkesini seç" : "Select country first"}
            cityPlaceholderEnabled={tr ? "Şehir seç veya ara" : "Search or select city"}
            onCountryChange={onResidenceCountryChange}
            onCityChange={onResidenceCityChange}
          />
        </div>
        <div className="hf-location-section">
          <h3 className="hf-location-section__title">{tr ? "Eğitim Şehirleri" : "Education cities"}</h3>
          <div className="hf-location-fields__block">
            <label className="hf-location-fields__label">{tr ? "Üniversite Ülkesi" : "University country"}</label>
            <CountryMultiSelect
              lang={lang}
              maxSelections={1}
              value={universityCountryCode ? [resolveCountryCode(universityCountryCode)] : []}
              placeholder={tr ? "Yaşadığın ülkeyi seç veya ara" : "Search or select your country"}
              onChange={(list) => {
                const next = list[0] || "";
                onUniversityCountryChange?.(next);
              }}
            />
          </div>
          <div className="hf-location-fields__block">
            <label className={`hf-location-fields__label${!universityCountryCode ? " hf-location-fields__label--disabled" : ""}`}>
              {tr ? "Eğitim şehirleri" : "Education cities"}
            </label>
            <CityMultiSelect
              lang={lang}
              countryCode={universityCountryCode}
              value={universityCities?.length ? universityCities : universityCity ? [universityCity] : []}
              disabled={!universityCountryCode}
              placeholder={tr ? "Şehir seç veya ara" : "Search or select city"}
              onChange={(cities) => {
                if (onUniversityCitiesChange) {
                  onUniversityCitiesChange(cities);
                  return;
                }
                onUniversityCityChange?.(cities[0] || "");
              }}
            />
            <p className="hf-location-fields__helper">
              {tr
                ? "Birden fazla eğitim şehri ekleyebilirsin — mobilite ve şehir bazlı öneriler için kullanılır."
                : "Add multiple education cities — used for mobility and city-based recommendations."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isResidence = mode === "residence";
  const codes = (countryCodes || []).map((c) => resolveCountryCode(c)).filter(Boolean);
  const hasCountry = codes.length > 0;
  const countryLabel = isResidence
    ? tr
      ? "İkamet ülkesi"
      : "Country of residence"
    : tr
      ? "Hedef ülke"
      : "Target country";
  const cityLabel = tr ? "Şehir" : "City";
  const countryPlaceholder = tr ? "Yaşadığın ülkeyi seç veya ara" : "Search or select country";
  const cityPlaceholderDisabled = tr ? "Önce ikamet ülkesini seç" : "Select country first";
  const cityPlaceholderEnabled = tr ? "Şehir seç veya ara" : "Search or select city";
  const helper = tr ? "Şehir önerileri seçtiğin ülkeye göre gelir." : "City suggestions depend on your selected country.";

  if (isResidence) {
    const countryCode = codes[0] || "";
    return (
      <div className="hf-location-fields">
        <LocationCountryCityPair
          lang={lang}
          countryLabel={countryLabel}
          cityLabel={cityLabel}
          countryCode={countryCode}
          city={city}
          countryPlaceholder={countryPlaceholder}
          cityPlaceholderDisabled={cityPlaceholderDisabled}
          cityPlaceholderEnabled={cityPlaceholderEnabled}
          onCountryChange={(c) => onCountryCodesChange?.(c ? [c] : [])}
          onCityChange={onCityChange}
        />
        <p className="hf-location-fields__helper">{helper}</p>
      </div>
    );
  }

  const groups = getCityGroupsForCountries(codes, lang);

  const setTargetCityForCountry = (countryCode, cityName) => {
    const code = resolveCountryCode(countryCode);
    const next = [...(targetCities || [])];
    const idx = next.findIndex((t) => resolveCountryCode(t.countryCode || t.country) === code);
    const row = { countryCode: code, city: cityName };
    if (idx >= 0) {
      if (cityName) next[idx] = row;
      else next.splice(idx, 1);
    } else if (cityName) next.push(row);
    onTargetCitiesChange?.(next);
  };

  const getTargetCity = (countryCode) => {
    const code = resolveCountryCode(countryCode);
    const row = (targetCities || []).find((t) => resolveCountryCode(t.countryCode || t.country) === code);
    return row?.city || "";
  };

  return (
    <div className="hf-location-fields">
      <div className="hf-location-fields__block">
        <label className="hf-location-fields__label">{countryLabel}</label>
        <CountryMultiSelect
          lang={lang}
          value={codes}
          placeholder={countryPlaceholder}
          onChange={(list) => {
            onCountryCodesChange?.(list);
            const kept = (targetCities || []).filter((t) =>
              list.includes(resolveCountryCode(t.countryCode || t.country))
            );
            onTargetCitiesChange?.(kept);
          }}
        />
      </div>
      <div className="hf-location-fields__block">
        <label className={`hf-location-fields__label${!hasCountry ? " hf-location-fields__label--disabled" : ""}`}>
          {cityLabel}
        </label>
        {hasCountry ? (
          groups.length === 1 ? (
            <CitySelect
              lang={lang}
              countryCode={groups[0].code}
              value={getTargetCity(groups[0].code)}
              onChange={(c) => setTargetCityForCountry(groups[0].code, c)}
              placeholder={cityPlaceholderEnabled}
            />
          ) : (
            <div className="hf-location-fields__city-groups">
              {groups.map((g) => (
                <CitySelect
                  key={g.code}
                  lang={lang}
                  countryCode={g.code}
                  groupLabel={g.country}
                  value={getTargetCity(g.code)}
                  onChange={(c) => setTargetCityForCountry(g.code, c)}
                  placeholder={cityPlaceholderEnabled}
                />
              ))}
            </div>
          )
        ) : (
          <CitySelect
            lang={lang}
            countryCode=""
            value=""
            onChange={() => {}}
            disabled
            placeholder={cityPlaceholderDisabled}
          />
        )}
        <p className="hf-location-fields__helper">{helper}</p>
      </div>
    </div>
  );
}

