
const form = document.getElementById("search-form");
const cityInput = document.getElementById("city-input");
const searchButton = document.getElementById("search-button");
const statusMessage = document.getElementById("status-message");
const weatherCard = document.getElementById("weather-card");

const weatherCodes = {
  0: ["Clear sky", "☀️"],
  1: ["Mainly clear", "🌤️"],
  2: ["Partly cloudy", "⛅"],
  3: ["Overcast", "☁️"],
  45: ["Foggy", "🌫️"],
  48: ["Rime fog", "🌫️"],
  51: ["Light drizzle", "🌦️"],
  53: ["Drizzle", "🌦️"],
  55: ["Heavy drizzle", "🌧️"],
  61: ["Light rain", "🌦️"],
  63: ["Moderate rain", "🌧️"],
  65: ["Heavy rain", "🌧️"],
  71: ["Light snow", "🌨️"],
  73: ["Moderate snow", "🌨️"],
  75: ["Heavy snow", "❄️"],
  80: ["Rain showers", "🌦️"],
  81: ["Moderate rain showers", "🌧️"],
  82: ["Heavy rain showers", "⛈️"],
  95: ["Thunderstorm", "⛈️"],
  96: ["Thunderstorm with hail", "⛈️"],
  99: ["Severe thunderstorm", "⛈️"]
};

function showStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.style.color = isError ? "#b42318" : "";
  statusMessage.setAttribute("role", isError ? "alert" : "status");
}

function normalizeCityName(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function findCity(cityName) {
  const url = new URL(
    "https://geocoding-api.open-meteo.com/v1/search"
  );

  url.search = new URLSearchParams({
    name: cityName.split(",")[0].trim(),
    count: "10",
    language: "en",
    format: "json"
  });

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("City search failed. Please try again.");
  }

  const data = await response.json();
  const results = data.results || [];

  if (results.length === 0) {
    throw new Error(
      `City "${cityName}" was not found. Check the spelling.`
    );
  }

  const parts = cityName.split(",").map(normalizeCityName);
  const cityPart = parts[0];

  const exactMatches = results.filter(
    city => normalizeCityName(city.name) === cityPart
  );

  if (exactMatches.length === 0) {
    throw new Error(
      `No exact match for "${cityName}". Please check the spelling.`
    );
  }

  if (parts.length > 1) {
    const locationPart = parts[1];

    const locationMatch = exactMatches.find(city =>
      normalizeCityName(city.country || "") === locationPart ||
      normalizeCityName(city.admin1 || "") === locationPart
    );

    if (locationMatch) return locationMatch;

    throw new Error(
      `Couldn't match "${cityName}". Try just the city name, e.g. London.`
    );
  }

  // Prefer a capital city when several places share the same name.
  return exactMatches.find(city =>
    city.feature_code === "PPLC"
  ) || exactMatches[0];
}

async function getWeather(city) {
  const url = new URL(
    "https://api.open-meteo.com/v1/forecast"
  );

  url.search = new URLSearchParams({
    latitude: city.latitude,
    longitude: city.longitude,
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "is_day",
      "precipitation",
      "weather_code",
      "wind_speed_10m"
    ].join(","),
    daily: "precipitation_sum",
    timezone: "auto",
    forecast_days: "1"
  });

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Weather data couldn't be loaded. Try again.");
  }

  const data = await response.json();

  if (!data.current) {
    throw new Error("Weather information is unavailable for this city.");
  }

  return data;
}

function setText(id, value) {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(
      `Page element "${id}" is missing. Please check index.html.`
    );
  }

  element.textContent = value;
}

function displayWeather(city, data) {
  const current = data.current;
  const daily = data.daily || {};

  const [description, symbol] =
    weatherCodes[current.weather_code] ||
    ["Unknown conditions", "🌡️"];

  setText("place-name", `${city.name}, ${city.country}`);
  setText("weather-description", description);
  setText("weather-symbol", symbol);
  setText("temperature", `${Math.round(current.temperature_2m)}°`);
  setText("feels-like", `${Math.round(current.apparent_temperature)}°`);
  setText("humidity", `${current.relative_humidity_2m}%`);
  setText("wind", `${current.wind_speed_10m} km/h`);
  setText("rain", `${daily.precipitation_sum?.[0] ?? 0} mm`);

  setText(
    "day-note",
    current.is_day
      ? "It's daytime. Check the conditions before heading out."
      : "It's nighttime. Check the conditions before heading out."
  );

  setText(
    "updated-note",
    `Local time: ${current.time.replace("T", " ")}`
  );

  weatherCard.hidden = false;
}

if (!form || !cityInput || !searchButton ||
    !statusMessage || !weatherCard) {
  console.error(
    "Weather App setup error: Check the HTML IDs for the form, input, button, status message and weather card."
  );
} else {
  form.addEventListener("submit", async event => {
    event.preventDefault();

    const cityName = cityInput.value.trim();

    if (!cityName) {
      weatherCard.hidden = true;
      showStatus("Please enter a city name.", true);
      cityInput.focus();
      return;
    }

    searchButton.disabled = true;
    searchButton.textContent = "Searching...";
    weatherCard.hidden = true;

    showStatus("Finding your city and checking the weather...");

    try {
      const city = await findCity(cityName);
      const weather = await getWeather(city);

      displayWeather(city, weather);
      showStatus(`Weather loaded for ${city.name}.`);
    } catch (error) {
      weatherCard.hidden = true;
      showStatus(
        error.message || "Something went wrong. Please try again.",
        true
      );

      console.error("Weather App error:", error);
    } finally {
      searchButton.disabled = false;
      searchButton.textContent = "Check weather";
    }
  });
}
