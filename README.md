# KingShot Discord Bot

Bot Discord do zarządzania kodami promocyjnymi gry Kingshot. Bot umożliwia wyszukiwanie aktywnych kodów promocyjnych, udostępnianie ich na wybranym kanale oraz automatyczne usuwanie wygasłych kodów.

## Funkcje

- Wyszukiwanie aktywnych kodów promocyjnych gry Kingshot
- Udostępnianie kodów na wybranym kanale
- Weryfikacja ważności kodów i automatyczne usuwanie wygasłych
- Konfiguracja kanału do udostępniania kodów przez administratorów

## Wymagane uprawnienia bota

### Uprawnienia OAuth2

- **bot** - Podstawowe uprawnienie wymagane do działania bota
- **applications.commands** - Uprawnienie do rejestracji i używania komend slash

### Uprawnienia bota

- **Read Messages/View Channels** - Odczytywanie wiadomości i wyświetlanie kanałów
- **Send Messages** - Wysyłanie wiadomości
- **Manage Messages** - Zarządzanie wiadomościami (usuwanie wygasłych kodów)
- **Embed Links** - Osadzanie linków w wiadomościach
- **Read Message History** - Odczytywanie historii wiadomości

## Instalacja i konfiguracja

### Wymagania

- Node.js w wersji 16.9.0 lub nowszej
- npm (Node Package Manager)

### Kroki instalacji

1. Sklonuj repozytorium lub pobierz pliki projektu
2. Zainstaluj zależności:

```bash
npm install
```

3. Skonfiguruj plik `.env` z danymi bota (token, application ID, public key)
4. Zarejestruj komendy slash:

```bash
node deploy-commands.js
```

5. Uruchom bota:

```bash
npm start
```

### Konfiguracja bota na serwerze Discord

1. Przejdź do [Discord Developer Portal](https://discord.com/developers/applications)
2. Wybierz swoją aplikację lub utwórz nową
3. W zakładce "OAuth2" > "URL Generator" wybierz następujące uprawnienia:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Read Messages/View Channels`, `Send Messages`, `Manage Messages`, `Embed Links`, `Read Message History`
4. Skopiuj wygenerowany URL i otwórz go w przeglądarce
5. Wybierz serwer, na który chcesz dodać bota i potwierdź

## Użytkowanie

### Konfiguracja kanału

Administrator serwera musi skonfigurować kanał do udostępniania kodów promocyjnych:

```
/setup channel:[wybierz kanał]
```

### Wyszukiwanie i udostępnianie kodów

Użytkownicy z uprawnieniem "Zarządzanie wiadomościami" mogą wyszukiwać i udostępniać kody:

```
/codes search
```

### Weryfikacja ważności kodów

Użytkownicy z uprawnieniem "Zarządzanie wiadomościami" mogą weryfikować ważność kodów i usuwać wygasłe:

```
/codes verify
```

### Ręczne dodawanie kodów promocyjnych

Administratorzy mogą ręcznie dodawać nowe kody promocyjne:

```
/code giftcode:[kod] description:[opis - opcjonalnie]
```

Dodany kod zostanie automatycznie udostępniony na skonfigurowanym kanale.

## Rozwiązywanie problemów

- **Bot nie odpowiada na komendy** - Upewnij się, że bot jest online i ma odpowiednie uprawnienia na serwerze
- **Bot nie może wysyłać wiadomości** - Sprawdź czy bot ma uprawnienia do wysyłania wiadomości na skonfigurowanym kanale
- **Komendy slash nie działają** - Upewnij się, że komendy zostały poprawnie zarejestrowane za pomocą `deploy-commands.js`