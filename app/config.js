/*
 * Ustawienia Salonu.
 * Zmieniaj tylko tekst w cudzysłowach i liczby. Po zmianie wrzuć plik na GitHuba
 * i opublikuj nowe wydanie (README, sekcja „Aktualizacja”).
 */
window.SALON_CONFIG = {
  // Imię w powitaniu („Dobry wieczór, Kamil”). Puste "" = powitanie bez imienia.
  name: "Kamil",

  // Miasto do pogody, np. "Poznań" albo "Brody". Puste "" wyłącza pogodę.
  city: "Warszawa",

  // Konsola podłączona przez HDMI. hdmi = numer wejścia (1–4).
  // Port zmienisz też na telewizorze: przytrzymaj OK na kafelku konsoli.
  playstation: { enabled: true, label: "PlayStation", hdmi: 1 },

  // Tło: "fale" (grafika z głębią) albo "gładkie" (samo światło aplikacji).
  background: "fale",

  // Ruch fal: kołysanie i przesuwanie za kafelkiem. false, jeśli telewizor zacznie zwalniać.
  animateBackground: true,

  // Wygaszacz „Wieczór w salonie”: po ilu minutach bez pilota, gdy Salon jest na ekranie.
  // 0 wyłącza wygaszacz.
  screensaverMinutes: 3,

  // Własne tapety zamiast tła. Wrzuć zdjęcia do folderu app/tla i wpisz nazwy,
  // np. ["tla/miasto.jpg", "tla/gory.jpg"]. Co dzień pokaże się kolejna.
  // Najlepiej 1920 x 1080 i do 1 MB. Puste [] = bez tapet.
  wallpapers: [],

  // Ulubione przy pierwszym uruchomieniu. Nazwy jak w telewizorze;
  // pokażą się tylko te aplikacje, które masz zainstalowane.
  favorites: ["YouTube", "Netflix", "Crunchyroll", "Disney+", "Prime Video", "Max", "Spotify"],

  // Klucz YouTube Data API v3 (README, sekcja „Filmy z YouTube”).
  // Bez klucza zamiast filmów zobaczysz kafelek z instrukcją.
  youtubeApiKey: "",
  youtubeRegion: "PL",

  // Port usługi w tle. Nie zmieniaj.
  servicePort: 8097
};
