// High-speed Node.js script to read NDEF text records and emulate keyboard input
// Install dependencies with: npm install nfc-pcsc ndef @nut-tree/nut-js

const { NFC } = require("nfc-pcsc");
const ndef = require("ndef");
const { keyboard, Key } = require("@nut-tree-fork/nut-js");
const nfc = new NFC();

// Configure NutJS for maximum speed
keyboard.config.autoDelayMs = 0;

// Configuration - optimized for speed
const config = {
  startDelay: 10, // Minimal delay before typing starts (ms)
  autoEnter: true, // Press Enter after typing
};

// Track last processed card to prevent duplicate processing
let lastProcessedCard = null;
let processingCard = false;

/**
 * Read and parse NDEF records from an NFC tag, then type as keyboard input
 */
function emulateKeyboardFromNFC() {
  console.log("High-Speed NFC Text-to-Keyboard Emulator (NutJS version)");
  console.log("Waiting for NFC tags... (Press Ctrl+C to exit)");

  nfc.on("reader", (reader) => {
    console.log(`Reader connected: ${reader.reader.name}`);

    reader.on("card", async (card) => {
      const cardId = card.uid;
      console.log(`Card detected: ${cardId}`);

      // Prevent duplicate processing or concurrent processing
      if (processingCard || lastProcessedCard === cardId) {
        console.log("Ignoring duplicate card or concurrent processing");
        return;
      }

      processingCard = true;
      lastProcessedCard = cardId;

      try {
        // Simple read without authentication
        console.log("Reading tag...");

        // Read up to 256 bytes of data
        const data = await reader.read(4, 256);

        // Find NDEF data
        const ndefData = findNdefData(data);

        if (!ndefData) {
          console.log("No valid NDEF data found.");
          processingCard = false;
          return;
        }

        // Parse records using the ndef package
        const records = ndef.decodeMessage(ndefData);

        // Find text records
        const textRecords = records.filter((record) => record.type === "T");

        if (textRecords.length === 0) {
          console.log("No text records found.");
          processingCard = false;
          return;
        }

        // Get text from first record
        const text = ndef.text.decodePayload(textRecords[0].payload);
        console.log(`Text found: "${text}"`);

        // Type immediately
        console.log("Typing text...");
        await typeText(text, config.autoEnter);

        // Reset processing flag after a short delay to prevent bouncing
        setTimeout(() => {
          processingCard = false;
          console.log("Ready for next card");
        }, 1000);
      } catch (err) {
        console.error(`Error: ${err.message}`);
        processingCard = false;
      }
    });

    reader.on("error", (err) => console.error(`Reader error: ${err}`));

    // Handle card removal to reset the lastProcessedCard
    reader.on("card.off", (card) => {
      console.log(`Card removed: ${card.uid}`);
      if (lastProcessedCard === card.uid) {
        lastProcessedCard = null;
      }
    });
  });

  nfc.on("error", (err) => console.error(`NFC error: ${err}`));
}

/**
 * Find NDEF data in raw tag data (simplified for speed)
 * @param {Buffer} data - Raw data from NFC tag
 * @return {Buffer} - NDEF message data or null if not found
 */
function findNdefData(data) {
  // Quick look for NDEF TLV (Tag 0x03)
  for (let i = 0; i < data.length - 2; i++) {
    if (data[i] === 0x03) {
      const length = data[i + 1];
      if (i + 2 + length <= data.length) {
        return data.slice(i + 2, i + 2 + length);
      }
    }
  }

  // Fast fallback - look for NDEF header pattern
  for (let i = 0; i < data.length - 3; i++) {
    const headerByte = data[i];
    const mb = (headerByte & 0x80) !== 0; // Message Begin
    const tnf = headerByte & 0x07;

    if (mb && tnf >= 0x01 && tnf <= 0x06) {
      return data.slice(i);
    }
  }

  return null;
}

/**
 * Type text using NutJS keyboard emulation at maximum speed
 * @param {string} text - Text to type
 * @param {boolean} pressEnter - Whether to press Enter after typing
 * @returns {Promise} - Resolves when typing is complete
 */
async function typeText(text, pressEnter = false) {
  return new Promise(async (resolve) => {
    setTimeout(async () => {
      try {
        // Clear any previous input
        await keyboard.pressKey(Key.Escape);
        await keyboard.releaseKey(Key.Escape);

        // Process text in chunks to prevent any potential buffer issues
        const chunkSize = 50;
        for (let i = 0; i < text.length; i += chunkSize) {
          const chunk = text.slice(i, i + chunkSize);

          for (let j = 0; j < chunk.length; j++) {
            const char = chunk[j];

            // Press Tab when forward slash is encountered
            if (char === "/") {
              await keyboard.pressKey(Key.Tab);
              await keyboard.releaseKey(Key.Tab);
            } else {
              // Otherwise type the character
              await keyboard.type(char);
            }
          }

          // Small yield to prevent potential issues with long texts
          await new Promise((resolve) => setImmediate(resolve));
        }

        // Press Enter if requested
        if (pressEnter) {
          await keyboard.pressKey(Key.Enter);
          await keyboard.releaseKey(Key.Enter);
        }

        resolve();
      } catch (error) {
        console.error("Error during typing:", error);
        resolve();
      }
    }, config.startDelay);
  });
}

// Start the script
emulateKeyboardFromNFC();
