#!/usr/bin/env node

/**
 * Script per ordinare un file JSON in ordine alfabetico per chiave
 * Uso: node sort-json.js <percorso-file-input> [percorso-file-output]
 */

const fs = require('fs');
const path = require('path');

// Funzione per ordinare ricorsivamente un oggetto JSON
function sortJsonKeys(obj) {
  if (Array.isArray(obj)) {
    return obj.map(sortJsonKeys);
  } else if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      .reduce((sorted, key) => {
        sorted[key] = sortJsonKeys(obj[key]);
        return sorted;
      }, {});
  }
  return obj;
}

// Funzione principale
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Errore: Specificare il percorso del file JSON da ordinare');
    console.log('Uso: node sort-json.js <percorso-file-input> [percorso-file-output]');
    process.exit(1);
  }

  const inputFile = args[0];
  const outputFile = args[1] || inputFile;

  // Verifica che il file esista
  if (!fs.existsSync(inputFile)) {
    console.error(`Errore: Il file "${inputFile}" non esiste`);
    process.exit(1);
  }

  try {
    // Leggi il file JSON
    console.log(`Lettura del file: ${inputFile}`);
    const fileContent = fs.readFileSync(inputFile, 'utf8');
    
    // Parse del JSON
    const jsonData = JSON.parse(fileContent);
    
    // Ordina le chiavi
    console.log('Ordinamento delle chiavi in ordine alfabetico...');
    const sortedData = sortJsonKeys(jsonData);
    
    // Converti in stringa JSON con indentazione
    const sortedJson = JSON.stringify(sortedData, null, 2);
    
    // Scrivi il file ordinato
    fs.writeFileSync(outputFile, sortedJson + '\n', 'utf8');
    
    console.log(`✓ File ordinato salvato in: ${outputFile}`);
    
    // Statistiche
    const keyCount = Object.keys(jsonData).length;
    console.log(`✓ Numero di chiavi ordinate: ${keyCount}`);
    
  } catch (error) {
    console.error('Errore durante l\'elaborazione del file:', error.message);
    process.exit(1);
  }
}

// Esegui lo script
main();

// Made with Bob
