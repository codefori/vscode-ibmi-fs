#!/usr/bin/env node

/**
 * Script per trovare le differenze tra le chiavi di due file JSON
 * Uso: node diff-json-keys.js <file1> <file2> [opzioni]
 */

const fs = require('fs');
const path = require('path');

// Funzione per estrarre tutte le chiavi da un oggetto JSON (ricorsivamente)
function extractKeys(obj, prefix = '') {
  const keys = new Set();
  
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      const newPrefix = prefix ? `${prefix}[${index}]` : `[${index}]`;
      extractKeys(item, newPrefix).forEach(key => keys.add(key));
    });
  } else if (obj !== null && typeof obj === 'object') {
    Object.keys(obj).forEach(key => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      keys.add(fullKey);
      extractKeys(obj[key], fullKey).forEach(k => keys.add(k));
    });
  }
  
  return keys;
}

// Funzione per estrarre solo le chiavi di primo livello
function extractTopLevelKeys(obj) {
  if (obj !== null && typeof obj === 'object' && !Array.isArray(obj)) {
    return new Set(Object.keys(obj));
  }
  return new Set();
}

// Funzione principale
function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Errore: Specificare due file JSON da confrontare');
    console.log('Uso: node diff-json-keys.js <file1> <file2> [--recursive] [--output=file.json]');
    console.log('');
    console.log('Opzioni:');
    console.log('  --recursive    Confronta anche le chiavi annidate');
    console.log('  --output=FILE  Salva il risultato in un file JSON');
    process.exit(1);
  }

  const file1 = args[0];
  const file2 = args[1];
  const recursive = args.includes('--recursive');
  const outputArg = args.find(arg => arg.startsWith('--output='));
  const outputFile = outputArg ? outputArg.split('=')[1] : null;

  // Verifica che i file esistano
  if (!fs.existsSync(file1)) {
    console.error(`Errore: Il file "${file1}" non esiste`);
    process.exit(1);
  }
  if (!fs.existsSync(file2)) {
    console.error(`Errore: Il file "${file2}" non esiste`);
    process.exit(1);
  }

  try {
    // Leggi i file JSON
    console.log(`Lettura di: ${file1}`);
    const json1 = JSON.parse(fs.readFileSync(file1, 'utf8'));
    
    console.log(`Lettura di: ${file2}`);
    const json2 = JSON.parse(fs.readFileSync(file2, 'utf8'));
    
    // Estrai le chiavi
    console.log(`\nEstrazione chiavi${recursive ? ' (ricorsivo)' : ' (primo livello)'}...`);
    const keys1 = recursive ? extractKeys(json1) : extractTopLevelKeys(json1);
    const keys2 = recursive ? extractKeys(json2) : extractTopLevelKeys(json2);
    
    // Trova le differenze
    const onlyInFile1 = [...keys1].filter(key => !keys2.has(key)).sort();
    const onlyInFile2 = [...keys2].filter(key => !keys1.has(key)).sort();
    const common = [...keys1].filter(key => keys2.has(key)).sort();
    
    // Prepara il risultato
    const result = {
      file1: path.basename(file1),
      file2: path.basename(file2),
      statistics: {
        totalKeysFile1: keys1.size,
        totalKeysFile2: keys2.size,
        commonKeys: common.length,
        onlyInFile1: onlyInFile1.length,
        onlyInFile2: onlyInFile2.length
      },
      keysOnlyInFile1: onlyInFile1,
      keysOnlyInFile2: onlyInFile2,
      commonKeys: common
    };
    
    // Mostra i risultati
    console.log('\n' + '='.repeat(60));
    console.log('STATISTICHE');
    console.log('='.repeat(60));
    console.log(`File 1: ${result.file1} (${result.statistics.totalKeysFile1} chiavi)`);
    console.log(`File 2: ${result.file2} (${result.statistics.totalKeysFile2} chiavi)`);
    console.log(`Chiavi comuni: ${result.statistics.commonKeys}`);
    console.log(`Chiavi solo in File 1: ${result.statistics.onlyInFile1}`);
    console.log(`Chiavi solo in File 2: ${result.statistics.onlyInFile2}`);
    
    if (onlyInFile1.length > 0) {
      console.log('\n' + '='.repeat(60));
      console.log(`CHIAVI SOLO IN ${result.file1}`);
      console.log('='.repeat(60));
      onlyInFile1.forEach(key => console.log(`  - ${key}`));
    }
    
    if (onlyInFile2.length > 0) {
      console.log('\n' + '='.repeat(60));
      console.log(`CHIAVI SOLO IN ${result.file2}`);
      console.log('='.repeat(60));
      onlyInFile2.forEach(key => console.log(`  - ${key}`));
    }
    
    // Salva in file se richiesto
    if (outputFile) {
      fs.writeFileSync(outputFile, JSON.stringify(result, null, 2) + '\n', 'utf8');
      console.log(`\n✓ Risultato salvato in: ${outputFile}`);
    }
    
    console.log('\n' + '='.repeat(60));
    
  } catch (error) {
    console.error('Errore durante l\'elaborazione:', error.message);
    process.exit(1);
  }
}

// Esegui lo script
main();

// Made with Bob
