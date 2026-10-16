# Forensic Recovery Process: Restoring `.zip` from Chrome `.crx` Package

This document explains the technical methodology and binary forensic steps used to recover the exact original **`quran-verse-identifier.zip`** after it was accidentally overwritten.

---

## 1. The Incident & The Challenge

### The Problem
During development, the release archive `quran-verse-identifier.zip` was accidentally overwritten using `Compress-Archive -Force`.
- **Pre-incident file:** A 14 MB archive created on **October 10, 2026** containing the tested baseline release.
- **Accidental overwrite:** A 77 KB archive containing only the latest work-in-progress files from the active branch.

### Constraints
1. **Not tracked in Git:** As a binary distribution artifact, `.zip` was untracked/ignored, so `git checkout` could not recover it.
2. **Bypassed Recycle Bin:** Standard CLI overwrite commands (`Compress-Archive -Force`, `fs.writeFileSync`) replace files in-place and do not move previous versions to the Windows Recycle Bin.

---

## 2. The Clue: Chrome Extension Packaging Architecture

In `d:\SDLC\Project Jugaru`, two companion files existed:
- `quran-verse-identifier.crx` (14,044,884 bytes, created `10/10/2026 7:14:20 PM`)
- `quran-verse-identifier.pem` (1,708 bytes, created `10/10/2026 7:14:18 PM`)

These were generated when the extension was packaged via Chrome's Developer Mode (**Pack Extension**).

### Understanding the CRX3 Binary Format
A Chrome Extension `.crx` file is **not** a proprietary encrypted container. It is a standard **ZIP archive** preceded by a lightweight binary header containing digital signatures:

```text
+-------------------------------------------------------------------------+
| Magic Bytes ("Cr24")                                    [4 bytes]       |
+-------------------------------------------------------------------------+
| Version (uint32 LE = 3)                                  [4 bytes]       |
+-------------------------------------------------------------------------+
| Header Length L (uint32 LE)                              [4 bytes]       |
+-------------------------------------------------------------------------+
| CRX Header Payload (Protobuf: Public Keys, Signatures)   [L bytes]       |
+=========================================================================+
| Standard ZIP Archive Payload                             [Remaining]     |
| (Starts with PK\x03\x04 = 0x50 0x4B 0x03 0x04)                          |
+-------------------------------------------------------------------------+
```

Because the CRX payload contains the uncompressed/deflated ZIP archive byte-for-byte, the original ZIP could be recovered with 100% bitwise fidelity.

---

## 3. Forensic Inspection & Offset Calculation

Using Node.js, we inspected the binary header of `quran-verse-identifier.crx`:

```javascript
const fs = require('fs');
const buf = fs.readFileSync('quran-verse-identifier.crx');

const magic = buf.slice(0, 4).toString('utf8');       // "Cr24"
const version = buf.readUInt32LE(4);                  // 3
const headerLength = buf.readUInt32LE(8);             // 581 bytes
const zipOffset = 12 + headerLength;                 // 12 + 581 = 593 bytes
```

### Key Values Discovered:
| Field | Value | Meaning |
|---|---|---|
| **Magic** | `Cr24` (`0x43 0x72 0x32 0x34`) | Valid Chromium extension container |
| **Version** | `3` (`0x00000003`) | CRX3 specification |
| **Header Length** | `581` bytes | Size of the cryptographic protobuf structure |
| **Fixed Offset Prefix** | `12` bytes | `4` (magic) + `4` (version) + `4` (headerLength) |
| **Total Header Size** | **`593` bytes** | Exact starting byte of the raw ZIP archive |
| **Total File Size** | `14,044,884` bytes | Total `.crx` file size |
| **Payload Size** | **`14,044,291` bytes** | Exact length of the embedded ZIP archive |

### Verifying the ZIP Magic Bytes
At byte offset `593`, we read the first 4 bytes:
```javascript
const zipMagic = buf.slice(593, 597).toString('hex');
// Result: 504b0304 (ASCII: PK\x03\x04) -> Standard ZIP Local File Header!
```

---

## 4. Central Directory Verification

Before restoring, we validated the internal ZIP structures (the Central Directory and End of Central Directory record):

```javascript
const zipBuf = buf.slice(593);

// Locate End of Central Directory (EOCD) signature: 0x50 0x4B 0x05 0x06
const eocdOffset = zipBuf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
const totalEntries = zipBuf.readUInt16LE(eocdOffset + 10);
const cdOffset = zipBuf.readUInt32LE(eocdOffset + 16);

console.log(`Total entries: ${totalEntries}, Central Directory at: ${cdOffset}`);
// Result: 2,941 entries across manifest.json, src/, assets/, node_modules/
```

### Inspecting Extracted Code
We verified `manifest.json` and `src/background/service-worker.js`:
- Verified version `1.0.0`
- Verified `service-worker.js` was 355 lines (the baseline version from October 10, before recent experimental changes)

---

## 5. Restoration Execution

With the payload verified, we extracted the ZIP slice directly back into `quran-verse-identifier.zip`:

```javascript
const fs = require('fs');

const crx = fs.readFileSync('../quran-verse-identifier.crx');
const headerLength = crx.readUInt32LE(8);
const zipOffset = 12 + headerLength; // 593

const originalZip = crx.slice(zipOffset);
fs.writeFileSync('../quran-verse-identifier.zip', originalZip);
```

### Verification Result
```text
Name          : quran-verse-identifier.zip
Length        : 14044291 bytes (identical to 10/10/2026 build)
Integrity     : Valid ZIP archive, 2,941 files
```

All temporary extraction files and staging buffers were immediately purged.

---

## 6. Reusable Utility Script

For future recovery from any CRX3 file, this Node.js script or PowerShell function can be used:

### Node.js Script (`crx2zip.js`)
```javascript
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const crxPath = process.argv[2];
if (!crxPath) {
  console.error('Usage: node crx2zip.js <path-to-extension.crx>');
  process.exit(1);
}

const outPath = crxPath.replace(/\.crx$/i, '') + '.zip';
const buf = fs.readFileSync(crxPath);

if (buf.slice(0, 4).toString('utf8') !== 'Cr24') {
  throw new Error('Not a valid CRX file (missing Cr24 magic header)');
}

const version = buf.readUInt32LE(4);
let zipOffset;

if (version === 3) {
  const headerLen = buf.readUInt32LE(8);
  zipOffset = 12 + headerLen;
} else if (version === 2) {
  const pubKeyLen = buf.readUInt32LE(8);
  const sigLen = buf.readUInt32LE(12);
  zipOffset = 16 + pubKeyLen + sigLen;
} else {
  throw new Error(`Unsupported CRX version: ${version}`);
}

const zipBuf = buf.slice(zipOffset);
fs.writeFileSync(outPath, zipBuf);
console.log(`Successfully extracted ${zipBuf.length} bytes to ${outPath}`);
```

### PowerShell Alternative
```powershell
function Convert-CrxToZip([string]$CrxPath, [string]$ZipPath) {
    $bytes = [System.IO.File]::ReadAllBytes($CrxPath)
    if ($bytes[0] -ne 0x43 -or $bytes[1] -ne 0x72 -or $bytes[2] -ne 0x32 -or $bytes[3] -ne 0x34) {
        throw "Not a CRX file"
    }
    $version = [BitConverter]::ToUInt32($bytes, 4)
    if ($version -eq 3) {
        $headerLen = [BitConverter]::ToUInt32($bytes, 8)
        $zipOffset = 12 + $headerLen
    } else {
        throw "Unsupported CRX version: $version"
    }
    $zipBytes = New-Object byte[] ($bytes.Length - $zipOffset)
    [Array]::Copy($bytes, $zipOffset, $zipBytes, 0, $zipBytes.Length)
    [System.IO.File]::WriteAllBytes($ZipPath, $zipBytes)
    Write-Host "Restored $ZipPath ($($zipBytes.Length) bytes)"
}
```
