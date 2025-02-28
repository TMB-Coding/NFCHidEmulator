// High-speed Node.js script to read NDEF text records and emulate keyboard input
// Install dependencies with: npm install nfc-pcsc ndef robotjs

const { NFC } = require("nfc-pcsc");
const ndef = require("ndef");
const robot = require("robotjs");
const nfc = new NFC();

// Configuration - optimized for speed
const config = {
  typingSpeed: 0, // No delay between keystrokes for maximum speed
  startDelay: 10, // Minimal delay before typing starts (ms)
  autoEnter: true, // Press Enter after typing
};

/**
 * Read and parse NDEF records from an NFC tag, then type as keyboard input
 */
function emulateKeyboardFromNFC() {
  console.log("High-Speed NFC Text-to-Keyboard Emulator");
  console.log("Waiting for NFC tags... (Press Ctrl+C to exit)");

  nfc.on("reader", (reader) => {
    console.log(`Reader connected: ${reader.reader.name}`);

    reader.on("card", async (card) => {
      console.log(`Card detected: ${card.uid}`);

      try {
        // Simple read without authentication
        console.log("Reading tag...");

        // Read up to 256 bytes of data
        const data = await reader.read(4, 256);

        // Find NDEF data
        const ndefData = findNdefData(data);

        if (!ndefData) {
          console.log("No valid NDEF data found.");
          return;
        }

        // Parse records using the ndef package
        const records = ndef.decodeMessage(ndefData);

        // Find text records
        const textRecords = records.filter((record) => record.type === "T");

        if (textRecords.length === 0) {
          console.log("No text records found.");
          return;
        }

        // Get text from first record
        const text = ndef.text.decodePayload(textRecords[0].payload);
        console.log(`Text found: "${text}"`);

        // Type immediately
        console.log("Typing text...");
        typeText(text, config.autoEnter);
      } catch (err) {
        console.error(`Error: ${err.message}`);
      }
    });

    reader.on("error", (err) => console.error(`Reader error: ${err}`));
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
 * Type text using keyboard emulation at maximum speed
 * @param {string} text - Text to type
 * @param {boolean} pressEnter - Whether to press Enter after typing
 */
function typeText(text, pressEnter = false) {
  setTimeout(() => {
    // Process all characters as fast as possible
    let i = 0;
    const type = () => {
      while (i < text.length) {
        const char = text[i++];

        // Press Tab when forward slash is encountered
        if (char === "/") {
          robot.keyTap("tab");
        }
        // Otherwise type the character normally
        else {
          robot.typeString(char);
        }

        // Process in small batches to prevent blocking
        if (i % 10 === 0) {
          setImmediate(type);
          return;
        }
      }

      // Press Enter if requested
      if (pressEnter) {
        robot.keyTap("enter");
      }
    };

    // Start typing
    type();
  }, config.startDelay);
}

// Start the script
emulateKeyboardFromNFC();
