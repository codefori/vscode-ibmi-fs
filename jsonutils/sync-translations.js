#!/usr/bin/env node

/**
 * Script per sincronizzare tutti i file di traduzione con il file base
 * Aggiunge le chiavi mancanti e rimuove quelle obsolete
 * Uso: node sync-translations.js [--sort] [--backup]
 */

const fs = require('fs');
const path = require('path');

// File base di riferimento
const BASE_FILE = 'package.nls.json';

// Pattern per trovare i file di traduzione
const TRANSLATION_PATTERN = /^package\.nls\.([a-z]{2}(-[a-z]{2})?)\.json$/;

// Funzione per ordinare le chiavi di un oggetto
function sortKeys(obj) {
  return Object.keys(obj)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    .reduce((sorted, key) => {
      sorted[key] = obj[key];
      return sorted;
    }, {});
}

// Funzione per creare un backup
function createBackup(filePath) {
  const backupPath = filePath.replace('.json', '.backup.json');
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

// Funzione principale
function main() {
  const args = process.argv.slice(2);
  const shouldSort = args.includes('--sort');
  const shouldBackup = args.includes('--backup');

  console.log('='.repeat(70));
  console.log('SINCRONIZZAZIONE FILE DI TRADUZIONE');
  console.log('='.repeat(70));

  // Verifica che il file base esista
  if (!fs.existsSync(BASE_FILE)) {
    console.error(`Errore: File base "${BASE_FILE}" non trovato`);
    process.exit(1);
  }

  try {
    // Leggi il file base
    console.log(`\n📖 Lettura file base: ${BASE_FILE}`);
    const baseContent = fs.readFileSync(BASE_FILE, 'utf8');
    const baseJson = JSON.parse(baseContent);
    const baseKeys = Object.keys(baseJson);
    
    console.log(`   Chiavi nel file base: ${baseKeys.length}`);

    // Trova tutti i file di traduzione
    const files = fs.readdirSync('.');
    const translationFiles = files.filter(file => TRANSLATION_PATTERN.test(file));

    if (translationFiles.length === 0) {
      console.log('\n⚠️  Nessun file di traduzione trovato');
      return;
    }

    console.log(`\n📁 File di traduzione trovati: ${translationFiles.length}`);
    translationFiles.forEach(file => console.log(`   - ${file}`));

    // Statistiche globali
    const stats = {
      filesProcessed: 0,
      filesUpdated: 0,
      totalKeysAdded: 0,
      totalKeysRemoved: 0,
      filesBackedUp: 0
    };

    // Processa ogni file di traduzione
    console.log('\n' + '='.repeat(70));
    console.log('ELABORAZIONE FILE');
    console.log('='.repeat(70));

    translationFiles.forEach(file => {
      console.log(`\n📝 Elaborazione: ${file}`);
      
      try {
        // Leggi il file di traduzione
        const translationContent = fs.readFileSync(file, 'utf8');
        const translationJson = JSON.parse(translationContent);
        const translationKeys = Object.keys(translationJson);

        console.log(`   Chiavi attuali: ${translationKeys.length}`);

        // Trova chiavi mancanti e obsolete
        const missingKeys = baseKeys.filter(key => !translationKeys.includes(key));
        const obsoleteKeys = translationKeys.filter(key => !baseKeys.includes(key));

        console.log(`   Chiavi mancanti: ${missingKeys.length}`);
        console.log(`   Chiavi obsolete: ${obsoleteKeys.length}`);

        if (missingKeys.length === 0 && obsoleteKeys.length === 0 && !shouldSort) {
          console.log(`   ✓ File già sincronizzato`);
          stats.filesProcessed++;
          return;
        }

        // Crea backup se richiesto
        if (shouldBackup) {
          const backupPath = createBackup(file);
          console.log(`   💾 Backup creato: ${backupPath}`);
          stats.filesBackedUp++;
        }

        // Crea il nuovo oggetto sincronizzato
        const syncedJson = {};

        // Aggiungi tutte le chiavi dal file base
        baseKeys.forEach(key => {
          if (translationJson.hasOwnProperty(key)) {
            // Mantieni la traduzione esistente
            syncedJson[key] = translationJson[key];
          } else {
            // Aggiungi la chiave con il valore del file base (da tradurre)
            syncedJson[key] = baseJson[key];
            console.log(`   + Aggiunta: "${key}"`);
          }
        });

        // Mostra le chiavi rimosse
        obsoleteKeys.forEach(key => {
          console.log(`   - Rimossa: "${key}"`);
        });

        // Ordina se richiesto
        const finalJson = shouldSort ? sortKeys(syncedJson) : syncedJson;

        // Scrivi il file aggiornato
        const updatedContent = JSON.stringify(finalJson, null, 2) + '\n';
        fs.writeFileSync(file, updatedContent, 'utf8');

        console.log(`   ✓ File aggiornato`);
        
        stats.filesProcessed++;
        stats.filesUpdated++;
        stats.totalKeysAdded += missingKeys.length;
        stats.totalKeysRemoved += obsoleteKeys.length;

      } catch (error) {
        console.error(`   ✗ Errore: ${error.message}`);
      }
    });

    // Mostra statistiche finali
    console.log('\n' + '='.repeat(70));
    console.log('STATISTICHE FINALI');
    console.log('='.repeat(70));
    console.log(`File elaborati: ${stats.filesProcessed}`);
    console.log(`File aggiornati: ${stats.filesUpdated}`);
    console.log(`Chiavi aggiunte totali: ${stats.totalKeysAdded}`);
    console.log(`Chiavi rimosse totali: ${stats.totalKeysRemoved}`);
    if (shouldBackup) {
      console.log(`Backup creati: ${stats.filesBackedUp}`);
    }
    console.log('='.repeat(70));

    if (stats.filesUpdated > 0) {
      console.log('\n✅ Sincronizzazione completata con successo!');
      console.log('\n⚠️  NOTA: Le nuove chiavi aggiunte contengono il testo in inglese.');
      console.log('   Ricordati di tradurle nella lingua appropriata.');
    } else {
      console.log('\n✅ Tutti i file sono già sincronizzati!');
    }

  } catch (error) {
    console.error(`\n❌ Errore fatale: ${error.message}`);
    process.exit(1);
  }
}

// Esegui lo script
main();

// Made with Bob
