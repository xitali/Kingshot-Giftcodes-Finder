// Moduł do zarządzania kodami promocyjnymi Kingshot
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataPath = path.join(__dirname, '..', 'data');
const codesFilePath = path.join(dataPath, 'codes.json');

// Inicjalizacja pliku z kodami, jeśli nie istnieje
if (!fs.existsSync(dataPath)) {
  fs.mkdirSync(dataPath, { recursive: true });
}

if (!fs.existsSync(codesFilePath)) {
  fs.writeFileSync(codesFilePath, JSON.stringify([], null, 2));
}

/**
 * Funkcja do wyszukiwania aktywnych kodów promocyjnych gry Kingshot
 * W rzeczywistej implementacji należałoby połączyć się z API gry lub innym źródłem danych
 * @returns {Promise<Array>} - Tablica znalezionych kodów promocyjnych
 */
export async function searchGiftCodes() {
  try {
    // Odczytanie kodów z pliku
    let savedCodes = [];
    if (fs.existsSync(codesFilePath)) {
       try {
         savedCodes = JSON.parse(fs.readFileSync(codesFilePath, 'utf8'));
       } catch (error) {
         console.error('Błąd podczas odczytu pliku z kodami:', error);
       }
     }
    
    // Symulacja opóźnienia odpowiedzi z API
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Przykładowe kody z różnymi datami ważności (tylko jeśli nie ma zapisanych kodów)
    if (savedCodes.length === 0) {
      const currentDate = new Date();
      const tomorrow = new Date(currentDate);
      tomorrow.setDate(currentDate.getDate() + 1);
      
      const nextWeek = new Date(currentDate);
      nextWeek.setDate(currentDate.getDate() + 7);
      
      const yesterday = new Date(currentDate);
      yesterday.setDate(currentDate.getDate() - 1);
      
      savedCodes = [
        {
          code: 'KINGSHOT2023',
          description: 'Kod promocyjny na 1000 monet',
          validUntil: nextWeek.toISOString(),
          rewards: '1000 monet'
        },
        {
          code: 'NEWPLAYER',
          description: 'Kod promocyjny dla nowych graczy',
          validUntil: tomorrow.toISOString(),
          rewards: 'Specjalna skórka broni'
        },
        {
          code: 'EXPIRED',
          description: 'Kod promocyjny, który wygasł',
          validUntil: yesterday.toISOString(),
          rewards: '500 monet'
        }
      ];
      
      // Zapisanie przykładowych kodów do pliku
      fs.writeFileSync(codesFilePath, JSON.stringify(savedCodes, null, 2));
    }
    
    return savedCodes;
  } catch (error) {
    console.error('Błąd podczas wyszukiwania kodów promocyjnych:', error);
    return [];
  }
}

/**
 * Funkcja do weryfikacji ważności kodu promocyjnego
 * @param {string} code - Kod promocyjny do sprawdzenia
 * @returns {Promise<Object>} - Obiekt zawierający informacje o kodzie
 */
export async function verifyGiftCode(code) {
  try {
    // W rzeczywistej implementacji tutaj byłoby połączenie z API gry
    // Na potrzeby demonstracji sprawdzamy w przykładowych kodach
    
    const codes = await searchGiftCodes();
    const foundCode = codes.find(c => c.code === code);
    
    if (!foundCode) {
      return { valid: false, reason: 'Kod nie istnieje' };
    }
    
    const validUntil = new Date(foundCode.validUntil);
    const currentDate = new Date();
    
    if (validUntil < currentDate) {
      return { 
        valid: false, 
        reason: 'Kod wygasł', 
        validUntil: foundCode.validUntil,
        description: foundCode.description,
        rewards: foundCode.rewards
      };
    }
    
    return { 
      valid: true, 
      validUntil: foundCode.validUntil,
      description: foundCode.description,
      rewards: foundCode.rewards
    };
  } catch (error) {
    console.error('Błąd podczas weryfikacji kodu promocyjnego:', error);
    return { valid: false, reason: 'Błąd weryfikacji' };
  }
}

/**
 * Funkcja do dodawania nowego kodu promocyjnego
 * @param {string} code - Kod promocyjny
 * @param {string} description - Opis kodu (opcjonalny)
 * @returns {Promise<Object>} - Obiekt zawierający informacje o dodanym kodzie
 */
/**
 * Funkcja do parsowania kodów promocyjnych ze strony axeetech.com
 * @param {string} html - Zawartość HTML strony
 * @returns {Array} - Tablica znalezionych kodów promocyjnych
 */
async function parseAxeetechCodes(html) {
  const codes = [];
  
  try {
    // Parsowanie HTML aby znaleźć tabelę z kodami
    // Szukamy wzorca tabeli z kodami i nagrodami - tabela jest w elemencie figure
    const tableRegex = /<figure class="wp-block-table"><table[^>]*>([\s\S]*?)<\/table><\/figure>/g;
    const tableMatch = tableRegex.exec(html);
    
    if (tableMatch && tableMatch[1]) {
      const tableContent = tableMatch[1];
      const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
      let rowMatch;
      
      // Pomijamy pierwszy wiersz (nagłówek)
      rowRegex.exec(tableContent);
      
      while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
        const rowContent = rowMatch[1];
        const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
        
        let cellMatch;
        const cellValues = [];
        
        while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
          cellValues.push(cellMatch[1].trim());
        }
        
        if (cellValues.length >= 2) {
          // Usuwanie znaczników <strong> z kodu
          let code = cellValues[0];
          code = code.replace(/<strong>|<\/strong>/g, '');
          const rewardInfo = cellValues[1];
          
          // Sprawdzenie czy to jest informacja o dacie ważności
          const validUntilMatch = rewardInfo.match(/Valid until ([\w\s,]+)(\d{4})/);
          
          let validUntil = null;
          let rewards = rewardInfo;
          
          if (validUntilMatch) {
            // Jeśli znaleziono datę ważności, ustawiamy ją
            const dateStr = validUntilMatch[1] + validUntilMatch[2];
            validUntil = new Date(dateStr);
            rewards = 'Nagroda za kod promocyjny';
          } else {
            // W przeciwnym razie ustawiamy domyślną datę ważności (30 dni)
            validUntil = new Date();
            validUntil.setDate(validUntil.getDate() + 30);
          }
          
          codes.push({
            code,
            description: `Kod promocyjny ze strony axeetech.com`,
            validUntil: validUntil.toISOString(),
            rewards
          });
        }
      }
    }
    
    console.log(`Znaleziono ${codes.length} kodów promocyjnych z axeetech.com`);
  } catch (error) {
    console.error('Błąd podczas parsowania kodów z axeetech.com:', error);
  }
  
  return codes;
}

/**
 * Funkcja do parsowania kodów promocyjnych ze strony boostbot.org
 * @param {string} html - Zawartość HTML strony
 * @returns {Array} - Tablica znalezionych kodów promocyjnych
 */
async function parseBoostbotCodes(html) {
  const codes = [];
  
  try {
    // Parsowanie HTML aby znaleźć tabelę z kodami
    // Szukamy wzorca tabeli z kodami i nagrodami
    const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/g;
    const tableMatch = tableRegex.exec(html);
    
    if (tableMatch && tableMatch[1]) {
      const tableContent = tableMatch[1];
      const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
      let rowMatch;
      
      // Pomijamy pierwszy wiersz (nagłówek)
      rowRegex.exec(tableContent);
      
      while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
        const rowContent = rowMatch[1];
        const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
        
        let cellMatch;
        const cellValues = [];
        
        while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
          cellValues.push(cellMatch[1].trim());
        }
        
        if (cellValues.length >= 2) {
          // Usuwanie znaczników HTML z kodu
          let code = cellValues[0];
          code = code.replace(/<[^>]*>/g, '').trim();
          const rewardInfo = cellValues[1].replace(/<[^>]*>/g, '').trim();
          
          // Ustawiamy domyślną datę ważności (30 dni)
          const validUntil = new Date();
          validUntil.setDate(validUntil.getDate() + 30);
          
          codes.push({
            code,
            description: `Kod promocyjny ze strony boostbot.org`,
            validUntil: validUntil.toISOString(),
            rewards: rewardInfo
          });
        }
      }
    }
    
    console.log(`Znaleziono ${codes.length} kodów promocyjnych z boostbot.org`);
  } catch (error) {
    console.error('Błąd podczas parsowania kodów z boostbot.org:', error);
  }
  
  return codes;
}

/**
 * Funkcja do pobierania kodów promocyjnych ze stron internetowych
 * @returns {Promise<Array>} - Tablica znalezionych kodów promocyjnych
 */
export async function fetchCodesFromWebsite() {
  const allCodes = [];
  
  try {
    // Pobieranie kodów z axeetech.com
    console.log('Pobieranie kodów promocyjnych ze strony axeetech.com...');
    const axeetechResponse = await fetch('https://axeetech.com/kingshot-gift-codes/');
    
    if (axeetechResponse.ok) {
      const axeetechHtml = await axeetechResponse.text();
      const axeetechCodes = await parseAxeetechCodes(axeetechHtml);
      allCodes.push(...axeetechCodes);
    } else {
      console.error(`Błąd HTTP przy pobieraniu z axeetech.com: ${axeetechResponse.status}`);
    }
    
    // Pobieranie kodów z boostbot.org
    console.log('Pobieranie kodów promocyjnych ze strony boostbot.org...');
    const boostbotResponse = await fetch('https://boostbot.org/blog/kingshot-gift-codes/');
    
    if (boostbotResponse.ok) {
      const boostbotHtml = await boostbotResponse.text();
      const boostbotCodes = await parseBoostbotCodes(boostbotHtml);
      allCodes.push(...boostbotCodes);
    } else {
      console.error(`Błąd HTTP przy pobieraniu z boostbot.org: ${boostbotResponse.status}`);
    }
    
    // Usuwanie duplikatów kodów
    const uniqueCodes = [];
    const codeSet = new Set();
    
    for (const code of allCodes) {
      if (!codeSet.has(code.code)) {
        codeSet.add(code.code);
        uniqueCodes.push(code);
      }
    }
    
    console.log(`Łącznie znaleziono ${uniqueCodes.length} unikalnych kodów promocyjnych`);
    return uniqueCodes;
  } catch (error) {
    console.error('Błąd podczas pobierania kodów ze strony:', error);
    return [];
  }
}

/**
 * Funkcja do synchronizacji kodów promocyjnych z zewnętrznej strony
 * @returns {Promise<Object>} - Obiekt zawierający informacje o synchronizacji
 */
export async function syncCodesFromWebsite() {
  try {
    // Pobieranie kodów ze strony
    const websiteCodes = await fetchCodesFromWebsite();
    
    if (websiteCodes.length === 0) {
      return { success: false, reason: 'Nie znaleziono kodów na stronie' };
    }
    
    // Odczytanie istniejących kodów
    let existingCodes = [];
    if (fs.existsSync(codesFilePath)) {
      try {
        existingCodes = JSON.parse(fs.readFileSync(codesFilePath, 'utf8'));
      } catch (error) {
        console.error('Błąd podczas odczytu pliku z kodami:', error);
      }
    }
    
    // Filtrowanie tylko nowych kodów
    const existingCodeValues = existingCodes.map(c => c.code);
    const newCodes = websiteCodes.filter(c => !existingCodeValues.includes(c.code));
    
    if (newCodes.length === 0) {
      return { success: true, added: 0, message: 'Wszystkie kody są już dodane' };
    }
    
    // Dodanie nowych kodów do istniejących
    const updatedCodes = [...existingCodes, ...newCodes];
    fs.writeFileSync(codesFilePath, JSON.stringify(updatedCodes, null, 2));
    
    return { 
      success: true, 
      added: newCodes.length, 
      newCodes,
      message: `Dodano ${newCodes.length} nowych kodów promocyjnych`
    };
  } catch (error) {
    console.error('Błąd podczas synchronizacji kodów:', error);
    return { success: false, reason: 'Błąd synchronizacji kodów' };
  }
}

export async function addGiftCode(code, description = '') {
  try {
    if (!code || typeof code !== 'string' || code.trim() === '') {
      return { success: false, reason: 'Kod nie może być pusty' };
    }
    
    // Odczytanie istniejących kodów
    let codes = [];
    if (fs.existsSync(codesFilePath)) {
      try {
        codes = JSON.parse(fs.readFileSync(codesFilePath, 'utf8'));
      } catch (error) {
        console.error('Błąd podczas odczytu pliku z kodami:', error);
      }
    }
    
    // Sprawdzenie czy kod już istnieje
    const existingCode = codes.find(c => c.code === code);
    if (existingCode) {
      return { success: false, reason: 'Kod już istnieje', existingCode };
    }
    
    // Ustawienie daty ważności (domyślnie 7 dni)
    const currentDate = new Date();
    const validUntil = new Date(currentDate);
    validUntil.setDate(currentDate.getDate() + 7);
    
    // Utworzenie nowego kodu
    const newCode = {
      code,
      description: description || `Kod promocyjny: ${code}`,
      validUntil: validUntil.toISOString(),
      rewards: 'Nagroda za kod promocyjny'
    };
    
    // Dodanie kodu do listy i zapisanie do pliku
    codes.push(newCode);
    fs.writeFileSync(codesFilePath, JSON.stringify(codes, null, 2));
    
    return { success: true, code: newCode };
  } catch (error) {
    console.error('Błąd podczas dodawania kodu promocyjnego:', error);
    return { success: false, reason: 'Błąd dodawania kodu' };
  }
}