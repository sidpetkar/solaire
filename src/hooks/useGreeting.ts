import { useState, useEffect, useRef } from 'react';

export type GreetingFrame = [string, string];

const VISIT_KEY = 'solaire_visits';
const WEATHER_KEY = 'solaire_weather';
const FRAMES_KEY = 'solaire_greeting_frames';
const WEATHER_TTL = 60 * 60 * 1000;

type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

interface WeatherData {
  temp: number;
  condition: string;
}

function timeOfDay(h: number): TimeOfDay {
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

function dayName(d: number) {
  return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][d];
}

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function pick<T>(a: T[], r: () => number): T {
  return a[Math.floor(r() * a.length)];
}

function shuffle<T>(a: T[], r: () => number): T[] {
  const c = [...a];
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
}

function getCachedWeather(): WeatherData | null {
  try {
    const raw = localStorage.getItem(WEATHER_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > WEATHER_TTL) return null;
    return data;
  } catch {
    return null;
  }
}

function fetchWeatherInBackground() {
  fetch('https://wttr.in/?format=j1', {
    signal: AbortSignal.timeout(3000),
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((json) => {
      const c = json?.current_condition?.[0];
      if (!c) return;
      const data: WeatherData = {
        temp: parseFloat(c.temp_C),
        condition: c.weatherDesc?.[0]?.value ?? '',
      };
      localStorage.setItem(WEATHER_KEY, JSON.stringify({ data, ts: Date.now() }));
    })
    .catch(() => {});
}

function buildFrames(
  name: string | null,
  tod: TimeOfDay,
  day: string,
  photos: number,
  visits: number,
  weather: WeatherData | null,
  rand: () => number,
): GreetingFrame[] {
  const n = name;
  const has = !!n;

  const timePool: GreetingFrame[] = [];
  const dayPool: GreetingFrame[] = [];
  const galleryPool: GreetingFrame[] = [];
  const weatherPool: GreetingFrame[] = [];
  const returnPool: GreetingFrame[] = [];
  const genericPool: GreetingFrame[] = [];

  switch (tod) {
    case 'morning':
      timePool.push(
        [has ? `morning ${n},` : 'good morning,', 'fresh edits await'],
        [has ? `hey ${n},` : 'hey there,', 'morning edits hit'],
        ['rise & edit,', 'fresh canvas'],
        [has ? `${n}'s up,` : "you're up,", 'morning edit?'],
      );
      break;
    case 'afternoon':
      timePool.push(
        [has ? `afternoon ${n},` : 'good afternoon,', 'edits look sharp'],
        [has ? `hey ${n},` : 'hey there,', 'midday magic'],
        [has ? `${n} drops in,` : 'dropping in?', 'perfect timing'],
        [has ? `hey ${n},` : 'hey there,', 'quick edit session?'],
      );
      break;
    case 'evening':
      timePool.push(
        [has ? `evening ${n},` : 'good evening,', 'warm tones await'],
        [has ? `hey ${n},` : 'hey there,', 'moody edits calling'],
        [has ? `${n}'s here,` : "you're here,", 'moody edits await'],
        [has ? `hey ${n},` : 'hey there,', 'edit hour'],
      );
      break;
    case 'night':
      timePool.push(
        ['night owl?', has ? `hey ${n}` : 'hey there'],
        [has ? `hey ${n},` : 'hey there,', 'late night edits'],
        [has ? `${n} returns,` : 'welcome back,', 'midnight creativity'],
        ['still up?', 'dark edits rule'],
      );
      break;
  }

  switch (day) {
    case 'monday':
      dayPool.push(['happy monday,', has ? `fresh week ${n}` : 'fresh start']);
      break;
    case 'friday':
      dayPool.push([has ? `friday ${n}!` : 'happy friday!', 'weekend vibes']);
      break;
    case 'saturday':
      dayPool.push([has ? `hey ${n},` : 'hey there,', 'weekend freedom']);
      break;
    case 'sunday':
      dayPool.push([has ? `hey ${n},` : 'hey there,', 'sunday slow edits']);
      break;
    default:
      dayPool.push(['midweek grind,', 'keep creating']);
  }

  if (photos > 0) {
    galleryPool.push(
      [has ? `hey ${n},` : 'hey there,', "gallery's growing"],
      ['welcome back,', `${photos} edits strong`],
      [has ? `${n} returns,` : 'welcome back,', 'new edits await'],
    );
  }

  if (weather) {
    const t = Math.round(weather.temp);
    const cond = weather.condition.toLowerCase();
    weatherPool.push([has ? `${n} returns,` : 'hey there,', `${t}° outside`]);
    if (t < 15) weatherPool.push(['chilly outside,', has ? `warm edits ${n}` : 'warm edits']);
    else if (t > 28) weatherPool.push(['hot outside,', 'cool edits inside']);
    if (cond.includes('rain') || cond.includes('drizzle'))
      weatherPool.push(['rainy vibes,', 'indoor edit day']);
    else if (cond.includes('sun') || cond.includes('clear'))
      weatherPool.push(['sunny outside,', 'stay in, edit']);
    else if (cond.includes('cloud') || cond.includes('overcast'))
      weatherPool.push(['overcast sky,', 'cozy edit day']);
  }

  if (visits > 1) {
    returnPool.push(
      ['there you are,', has ? `welcome ${n}` : 'welcome back'],
      ["look who's back,", has ? `hey ${n}` : 'hey there'],
    );
    if (visits > 5) returnPool.push(['back again?', has ? `missed you ${n}` : 'missed you']);
  }

  if (has) {
    genericPool.push(
      [`hey ${n},`, 'ready to edit?'],
      [`${n}'s back,`, "let's go"],
      [`welcome ${n},`, 'make magic'],
      [`hey ${n},`, 'create something'],
      [`${n} walks in,`, "studio's ready"],
      [`${n}'s here,`, 'edits await'],
      [`${n} returns,`, 'vision awaits'],
      [`hey ${n},`, 'canvas waits'],
      [`${n} enters,`, 'lights are on'],
      [`hey ${n},`, 'where were we?'],
      [`${n} mode,`, 'activated'],
      [`hey ${n},`, 'your move'],
    );
  } else {
    genericPool.push(
      ['welcome,', 'ready to edit?'],
      ['hey there,', "let's create"],
      ['welcome back,', 'make magic'],
      ['hello,', "studio's open"],
      ['hey there,', 'canvas waits'],
      ['welcome,', 'create something'],
    );
  }

  const selected: GreetingFrame[] = [];

  selected.push(pick(timePool, rand));
  if (dayPool.length > 0) selected.push(pick(dayPool, rand));
  if (weatherPool.length > 0) selected.push(pick(weatherPool, rand));
  if (galleryPool.length > 0) selected.push(pick(galleryPool, rand));
  if (returnPool.length > 0) selected.push(pick(returnPool, rand));

  const sg = shuffle(genericPool, rand);
  let gi = 0;
  while (selected.length < 5 && gi < sg.length) selected.push(sg[gi++]);
  if (selected.length > 5) selected.length = 5;

  const shuffled = shuffle(selected, rand);

  const landingIdx = shuffled.findIndex(
    (f) =>
      f[1].includes('ready') ||
      f[1].includes("let's") ||
      f[1].includes('create') ||
      f[1].includes('make') ||
      f[1].includes('activated'),
  );
  if (landingIdx >= 0 && landingIdx !== shuffled.length - 1) {
    const [landing] = shuffled.splice(landingIdx, 1);
    shuffled.push(landing);
  }

  return shuffled;
}

export function useGreeting(firstName: string | null, photoCount: number): GreetingFrame[] {
  const [frames, setFrames] = useState<GreetingFrame[]>(() => {
    try {
      const raw = sessionStorage.getItem(FRAMES_KEY);
      if (!raw) return [];
      const { name, frames: cached } = JSON.parse(raw);
      if (name === (firstName ?? '') && Array.isArray(cached) && cached.length > 0) return cached;
    } catch {}
    return [];
  });

  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current || frames.length > 0) return;
    initRef.current = true;

    const visits = (parseInt(localStorage.getItem(VISIT_KEY) ?? '0', 10) || 0) + 1;
    localStorage.setItem(VISIT_KEY, String(visits));

    const now = new Date();
    const seed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
    const rand = seeded(seed + visits);
    const tod = timeOfDay(now.getHours());
    const dn = dayName(now.getDay());
    const weather = getCachedWeather();

    const result = buildFrames(firstName, tod, dn, photoCount, visits, weather, rand);
    setFrames(result);
    sessionStorage.setItem(FRAMES_KEY, JSON.stringify({ name: firstName ?? '', frames: result }));
  }, [firstName, photoCount, frames.length]);

  useEffect(() => {
    fetchWeatherInBackground();
  }, []);

  return frames;
}
