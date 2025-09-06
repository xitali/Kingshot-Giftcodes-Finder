// Module for managing KingShot promotional codes
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataPath = path.join(__dirname, '..', 'data');
const codesFilePath = path.join(dataPath, 'codes.json');

// Initialize codes file if it doesn't exist
if (!fs.existsSync(dataPath)) {
  fs.mkdirSync(dataPath, { recursive: true });
}

if (!fs.existsSync(codesFilePath)) {
  fs.writeFileSync(codesFilePath, JSON.stringify([], null, 2));
}

/**
 * Function for searching active KingShot promotional codes
 * In a real implementation, this would connect to the game API or other data source
 * @returns {Promise<Array>} - Array of found promotional codes
 */
export async function searchGiftCodes() {
  try {
    // Read codes from file
    let savedCodes = [];
    if (fs.existsSync(codesFilePath)) {
       try {
         savedCodes = JSON.parse(fs.readFileSync(codesFilePath, 'utf8'));
       } catch (error) {
         console.error('Error reading codes file:', error);
       }
     }
    
    // Simulate API response delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Example codes with different expiration dates (only if there are no saved codes)
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
          description: 'Promotional code for 1000 coins',
          validUntil: nextWeek.toISOString(),
          rewards: '1000 coins'
        },
        {
          code: 'NEWPLAYER',
          description: 'Promotional code for new players',
          validUntil: tomorrow.toISOString(),
          rewards: 'Special weapon skin'
        },
        {
          code: 'EXPIRED',
          description: 'Expired promotional code',
          validUntil: yesterday.toISOString(),
          rewards: '500 coins'
        }
      ];
      
      // Save example codes to file
      fs.writeFileSync(codesFilePath, JSON.stringify(savedCodes, null, 2));
    }
    
    return savedCodes;
  } catch (error) {
    console.error('Error searching for promotional codes:', error);
    return [];
  }
}

/**
 * Function to verify the validity of a promotional code
 * @param {string} code - Promotional code to check
 * @returns {Promise<Object>} - Object containing information about the code
 */
export async function verifyGiftCode(code) {
  try {
    // In a real implementation, there would be a connection to the game API here
    // For demonstration purposes, we check in example codes
    
    const codes = await searchGiftCodes();
    const foundCode = codes.find(c => c.code === code);
    
    if (!foundCode) {
      return { valid: false, reason: 'Code does not exist' };
    }
    
    const validUntil = new Date(foundCode.validUntil);
    const currentDate = new Date();
    
    if (validUntil < currentDate) {
      return { 
        valid: false, 
        reason: 'Code expired', 
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
    console.error('Error verifying promotional code:', error);
    return { valid: false, reason: 'Verification error' };
  }
}

/**
 * Function to add a new promotional code
 * @param {string} code - Promotional code
 * @param {string} description - Code description (optional)
 * @returns {Promise<Object>} - Object containing information about the added code
 */
/**
 * Function to parse promotional codes from axeetech.com
 * @param {string} html - HTML content of the page
 * @returns {Array} - Array of found promotional codes
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
            rewards = 'Reward for promotional code';
          } else {
            // W przeciwnym razie ustawiamy domyślną datę ważności (30 dni)
            validUntil = new Date();
            validUntil.setDate(validUntil.getDate() + 30);
          }
          
          codes.push({
            code,
            description: `Promotional code from axeetech.com`,
            validUntil: validUntil.toISOString(),
            rewards
          });
        }
      }
    }
    
    console.log(`Found ${codes.length} promotional codes from axeetech.com`);
  } catch (error) {
    console.error('Error parsing codes from axeetech.com:', error);
  }
  
  return codes;
}

/**
 * Function to parse promotional codes from boostbot.org
 * @param {string} html - HTML content of the page
 * @returns {Array} - Array of found promotional codes
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
            description: `Promotional code from boostbot.org`,
            validUntil: validUntil.toISOString(),
            rewards: rewardInfo
          });
        }
      }
    }
    
    console.log(`Found ${codes.length} promotional codes from boostbot.org`);
  } catch (error) {
    console.error('Error parsing codes from boostbot.org:', error);
  }
  
  return codes;
}

/**
 * Function to fetch promotional codes from websites
 * @returns {Promise<Array>} - Array of found promotional codes
 */
export async function fetchCodesFromWebsite() {
  const allCodes = [];
  
  try {
    // Fetching codes from axeetech.com
    console.log('Fetching promotional codes from axeetech.com...');
    const axeetechResponse = await fetch('https://axeetech.com/kingshot-gift-codes/');
    
    if (axeetechResponse.ok) {
      const axeetechHtml = await axeetechResponse.text();
      const axeetechCodes = await parseAxeetechCodes(axeetechHtml);
      allCodes.push(...axeetechCodes);
    } else {
      console.error(`HTTP error when fetching from axeetech.com: ${axeetechResponse.status}`);
    }
    
    // Fetching codes from boostbot.org
    console.log('Fetching promotional codes from boostbot.org...');
    const boostbotResponse = await fetch('https://boostbot.org/blog/kingshot-gift-codes/');
    
    if (boostbotResponse.ok) {
      const boostbotHtml = await boostbotResponse.text();
      const boostbotCodes = await parseBoostbotCodes(boostbotHtml);
      allCodes.push(...boostbotCodes);
    } else {
      console.error(`HTTP error when fetching from boostbot.org: ${boostbotResponse.status}`);
    }
    
    // Removing duplicate codes
    const uniqueCodes = [];
    const codeSet = new Set();
    
    for (const code of allCodes) {
      if (!codeSet.has(code.code)) {
        codeSet.add(code.code);
        uniqueCodes.push(code);
      }
    }
    
    console.log(`Found a total of ${uniqueCodes.length} unique promotional codes`);
    return uniqueCodes;
  } catch (error) {
    console.error('Error fetching codes from website:', error);
    return [];
  }
}

/**
 * Function to synchronize promotional codes from external website
 * @returns {Promise<Object>} - Object containing synchronization information
 */
export async function syncCodesFromWebsite() {
  try {
    // Pobieranie kodów ze strony
    const websiteCodes = await fetchCodesFromWebsite();
    
    if (websiteCodes.length === 0) {
      return { success: false, reason: 'No codes found on the website' };
    }
    
    // Reading existing codes
    let existingCodes = [];
    if (fs.existsSync(codesFilePath)) {
      try {
        const fileContent = fs.readFileSync(codesFilePath, 'utf8');
        if (fileContent && fileContent.trim()) {
          existingCodes = JSON.parse(fileContent);
        }
      } catch (error) {
        console.error('Error reading codes file:', error);
        // Create backup of corrupted file
        const backupPath = `${codesFilePath}.backup-${Date.now()}`;
        try {
          fs.copyFileSync(codesFilePath, backupPath);
          console.log(`Created backup of corrupted codes file at ${backupPath}`);
        } catch (backupError) {
          console.error('Failed to create backup of corrupted codes file:', backupError);
        }
      }
    }
    
    // Filtering only new codes
    const existingCodeValues = existingCodes.map(c => c.code);
    const newCodes = websiteCodes.filter(c => !existingCodeValues.includes(c.code));
    
    if (newCodes.length === 0) {
      return { success: true, added: 0, message: 'All codes are already added' };
    }
    
    // Dodanie nowych kodów do istniejących
    const updatedCodes = [...existingCodes, ...newCodes];
    fs.writeFileSync(codesFilePath, JSON.stringify(updatedCodes, null, 2));
    
    return { 
      success: true, 
      added: newCodes.length, 
      newCodes,
      message: `Added ${newCodes.length} new promotional codes`
    };
  } catch (error) {
    console.error('Error synchronizing codes:', error);
    return { success: false, reason: 'Code synchronization error' };
  }
}

export async function addGiftCode(code, description = '') {
  try {
    if (!code || typeof code !== 'string' || code.trim() === '') {
      return { success: false, reason: 'Code cannot be empty' };
    }
    
    // Odczytanie istniejących kodów
    let codes = [];
    if (fs.existsSync(codesFilePath)) {
      try {
        codes = JSON.parse(fs.readFileSync(codesFilePath, 'utf8'));
      } catch (error) {
        console.error('Error reading codes file:', error);
      }
    }
    
    // Sprawdzenie czy kod już istnieje
    const existingCode = codes.find(c => c.code === code);
    if (existingCode) {
      return { success: false, reason: 'Code already exists', existingCode };
    }
    
    // Ustawienie daty ważności (domyślnie 7 dni)
    const currentDate = new Date();
    const validUntil = new Date(currentDate);
    validUntil.setDate(currentDate.getDate() + 7);
    
    // Utworzenie nowego kodu
    const newCode = {
      code,
      description: description || `Promotional code: ${code}`,
      validUntil: validUntil.toISOString(),
      rewards: 'Reward for promotional code'
    };
    
    // Dodanie kodu do listy i zapisanie do pliku
    codes.push(newCode);
    fs.writeFileSync(codesFilePath, JSON.stringify(codes, null, 2));
    
    return { success: true, code: newCode };
  } catch (error) {
    console.error('Error adding promotional code:', error);
    return { success: false, reason: 'Error adding code' };
  }
}