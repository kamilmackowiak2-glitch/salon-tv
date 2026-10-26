# Salon

Nowoczesny ekran startowy dla telewizorów Samsung z systemem Tizen (2017 i nowsze), działający jako moduł [TizenBrew](https://github.com/reisxd/TizenBrew). Napisany pod Samsunga QE55Q64R z 2019 roku.

Co potrafi:

- rzędy **Ulubione**, **Ostatnio używane**, **Popularne na YouTube** i **Skróty**,
- kafelek **PlayStation**, który przełącza telewizor na wybrane wejście HDMI,
- otwieranie aplikacji jednym kliknięciem (YouTube, Netflix, Crunchyroll i każda inna zainstalowana),
- zegar, data i pogoda,
- tło z falami, które powoli się kołyszą i przesuwają za wybranym kafelkiem,
- światło w kolorze aplikacji, na której stoisz,
- wygaszacz „Wieczór w salonie” z dużym zegarem i pogodą na 3 dni.

Niczego w telewizorze nie zmienia na stałe. Usunięcie modułu z TizenBrew przywraca wszystko.

---

## 1. Podgląd na komputerze

Otwórz `app/index.html` w Chrome. Zobaczysz Salon z przykładowymi aplikacjami.

| Klawisz | Działanie |
|---|---|
| Strzałki | poruszanie się |
| Enter | OK |
| Przytrzymany Enter | opcje (dodaj, usuń, przesuń, port HDMI) |
| Esc lub Backspace | Wróć |
| S | od razu włącza wygaszacz (tylko w podglądzie) |

## 2. Ustawienia przed wysłaniem

Kliknij `app/config.js` prawym przyciskiem myszy, wybierz **Otwórz za pomocą > Notatnik** i zmień:

- `name`: imię w powitaniu,
- `city`: miasto do pogody,
- `playstation.hdmi`: numer wejścia HDMI, do którego jest podłączona konsola (możesz go zmienić później na telewizorze),
- `youtubeApiKey`: klucz YouTube, jeśli chcesz rząd z filmami (sekcja 6),
- `background` i `wallpapers`: wygląd tła (sekcja 2a),
- `animateBackground`: ruch fal (sekcja 2a),
- `screensaverMinutes`: po ilu minutach włącza się wygaszacz (sekcja 2b).

Nie otwieraj plików `.js` dwuklikiem. Windows uruchamia je wtedy jako skrypt i pokazuje błąd „Brak definicji window”. Plikowi nic się nie dzieje, po prostu zamknij okno.

## 2a. Tło

- `background: "fale"`: domyślna grafika z warstwami i światłem z lewej strony. Światło aplikacji, na której stoisz, zabarwia ją od prawej.
- `background: "gładkie"`: samo światło aplikacji, bez grafiki.
- `animateBackground: true`: fale kołyszą się powoli, każda w swoim tempie, a przy zmianie kafelka przesuwają się za nim (bliższe bardziej, dalsze mniej). Jeśli telewizor zacznie przycinać, ustaw `false`, a fale staną w miejscu.
- Własne tapety: wrzuć zdjęcia do folderu `app/tla` i wpisz ich nazwy, na przykład `wallpapers: ["tla/miasto.jpg", "tla/gory.jpg"]`. Co dzień pojawi się kolejna. Salon sam przyciemni lewą stronę i dół, żeby napisy i kafelki były czytelne. Najlepiej sprawdzają się zdjęcia 1920 x 1080 do 1 MB.

## 2b. Wygaszacz „Wieczór w salonie”

Gdy Salon jest na ekranie i przez `screensaverMinutes` minut (domyślnie 3) nikt nie dotyka pilota, napisy i kafelki znikają, a zostaje duży zegar, data, pogoda na dziś i na 3 kolejne dni oraz fale w tle. Światło powoli zmienia kolor, a zegar co minutę przesuwa się w inne miejsce.

Dowolny przycisk wraca do Salonu i nic przy tym nie uruchamia. Gdy oglądasz Netfliksa albo grasz na konsoli, Salon jest w tle, więc wygaszacz się nie włącza. `screensaverMinutes: 0` wyłącza go całkiem.

## 3. Wrzucenie na GitHuba

TizenBrew pobiera moduły z publicznych repozytoriów GitHuba.

1. Załóż darmowe konto na github.com.
2. Kliknij **New repository**, nazwij je `salon-tv`, zostaw **Public** i kliknij **Create repository**.
3. Kliknij **uploading an existing file**.
4. Przeciągnij **zawartość** folderu `salon-tv` (plik `package.json`, foldery `app` i `service` oraz `README.md`), a nie sam folder. Plik `package.json` musi leżeć na samej górze repozytorium.
5. Kliknij **Commit changes**.
6. Po prawej stronie kliknij **Create a new release**. W polu **Choose a tag** wpisz `v1.3.0`, wybierz **Create new tag**, a potem kliknij **Publish release**.

## 4. Telewizor

1. **Host PC IP na 127.0.0.1.** Wejdź w **Aplikacje**, wpisz na pilocie `12345`. Tryb dewelopera zostaw włączony, a w polu **Host PC IP** wpisz `127.0.0.1`. Kliknij OK i uruchom telewizor ponownie: przytrzymaj przycisk zasilania na pilocie, aż telewizor się wyłączy i włączy. TizenBrew potrzebuje tego adresu, żeby działać samodzielnie i startować moduły automatycznie.
2. **Dodanie modułu.** Otwórz TizenBrew, wejdź w **Module Manager** (ikona pudełka) i wybierz **Add GitHub Module**. Wpisz `TWÓJ_LOGIN/salon-tv@v1.3.0`, na przykład `kamil123/salon-tv@v1.3.0`. Zatwierdź, a potem zejdź strzałką z pola: TizenBrew dodaje moduł, gdy pole przestaje być zaznaczone.
3. **Pierwsze uruchomienie.** Na liście modułów pojawi się **Salon**. Otwórz go.
4. **Zgoda na pilota sieciowego.** Gdy pierwszy raz klikniesz PlayStation, Źródła albo Ustawienia, telewizor zapyta, czy zezwolić urządzeniu „Salon”. Wybierz **Zezwól**. Pytanie pojawia się tylko raz.

## 5. Start razem z telewizorem

1. W TizenBrew wejdź w **Ustawienia** i w opcji automatycznego uruchamiania (AutoLaunch) wybierz **Salon**.
2. W telewizorze wejdź w **Ustawienia > Ogólne > Funkcje Smart** i włącz automatyczne uruchamianie ostatniej aplikacji (nazwa może się nieco różnić).

Ograniczenie: Samsung zawsze otwiera aplikację używaną jako ostatnia. Jeśli wyłączysz telewizor w trakcie Netfliksa, po włączeniu może wystartować Netflix. Żeby wrócić do TizenBrew mimo automatycznego startu Salonu, przytrzymaj strzałkę w górę podczas uruchamiania TizenBrew.

## 6. Filmy z YouTube

Rząd **Popularne na YouTube** potrzebuje darmowego klucza od Google.

1. Wejdź na console.cloud.google.com i zaloguj się kontem Google.
2. Utwórz nowy projekt, na przykład „Salon”.
3. W **Interfejsy API i usługi > Biblioteka** wyszukaj **YouTube Data API v3** i kliknij **Włącz**.
4. W **Dane logowania** kliknij **Utwórz dane logowania > Klucz interfejsu API**.
5. Kliknij **Edytuj klucz** i w **Ograniczeniach interfejsów API** zostaw tylko **YouTube Data API v3**. Zapisz.
6. Skopiuj klucz do `youtubeApiKey` w `app/config.js` i opublikuj nowe wydanie (sekcja 7).

Repozytorium jest publiczne, więc klucz też będzie widoczny. Dlatego ogranicz go do YouTube Data API v3 i nie podpinaj do projektu karty płatniczej. Wtedy w najgorszym razie ktoś zużyje darmowy dzienny limit.

Na kafelku z filmem OK otwiera ten film w aplikacji YouTube. Niektóre wersje oprogramowania otwierają tylko samą aplikację YouTube albo pytają o zgodę na ekranie.

## 7. Aktualizacja

TizenBrew pobiera pliki przez jsDelivr, który zapamiętuje każde wydanie na stałe. Każda zmiana potrzebuje więc nowego wydania.

1. Na GitHubie otwórz plik, kliknij ikonę ołówka, zmień i kliknij **Commit changes** (albo wrzuć nowe pliki przez **Add file > Upload files**).
2. Utwórz nowe wydanie z kolejnym numerem, na przykład `v1.3.1`.
3. W TizenBrew usuń stary moduł i dodaj `TWÓJ_LOGIN/salon-tv@v1.3.1`.

Nowa wersja usługi sama przejmuje miejsce starej. Jeśli coś zachowuje się dziwnie, uruchom telewizor ponownie.

## 8. Gdy coś nie działa

- **Napis „Brak połączenia z usługą Salonu”.** Uruchom telewizor ponownie, przytrzymując przycisk zasilania. Sprawdź, czy Host PC IP to `127.0.0.1`.
- **PlayStation, Źródła albo Ustawienia nie działają.** Salon łączy się z pilotem sieciowym telewizora przez jego adres w sieci domowej. Wejdź w **Ustawienia > Ogólne > Menedżer urządzeń zewnętrznych > Menedżer połączeń urządzeń**. Ustaw **Powiadomienie o dostępie** na „Tylko za pierwszym razem”, a w **Liście urządzeń** zezwól urządzeniu „Salon”, jeśli tam jest. Potem kliknij PlayStation jeszcze raz. Port konsoli zmienisz, przytrzymując OK na jej kafelku.
- **Konsola sama przełącza telewizor.** To funkcja Anynet+ (HDMI-CEC). Gdy jest włączona w telewizorze i w ustawieniach PlayStation, włączenie pada przełącza telewizor na konsolę bez Salonu.
- **Brak pogody.** Sprawdź nazwę miasta w `config.js`.
- **Przycina się.** Ustaw `animateBackground: false` w config.js. Fale staną, a reszta zostanie bez zmian.
- **Zamiast ikony jest litera.** Salon bierze prawdziwe ikony z telewizora: najpierw te z paska Smart Hub, potem z informacji o aplikacji, a na końcu z jej folderu z zasobami. Zastępczą ikonę Tizena (wiatraczek) pomija. Litera oznacza, że telewizor nie udostępnił ikony tej aplikacji. Wszystko inne działa normalnie.

## 9. Jak to działa

Strona modułu TizenBrew nie ma dostępu do API telewizora, więc Salon ma dwie części:

- `app/`: ekran (HTML, CSS i JavaScript w ES5, pod przeglądarkę telewizora z 2019 roku),
- `service/service.js`: usługa, którą TizenBrew uruchamia w swoim procesie Node.js. Otwiera aplikacje przez API Tizen, przełącza HDMI przez sieciowego pilota telewizora (porty 8002 i 8001), otwiera filmy przez DIAL i udostępnia ikony.

Usługa nasłuchuje tylko na `127.0.0.1:8097`. Polecenia przyjmuje wyłącznie od strony Salonu: wymaga lokalnego pochodzenia zapytania i jednorazowego klucza sesji, więc żadna strona z internetu nie może sterować telewizorem.

Ulubione, historia i ustawiony port HDMI są zapisywane w pamięci telewizora (localStorage modułu).
