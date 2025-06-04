import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import * as fs from 'fs';
import path from 'path';
import { encode } from '../cryptography/encode';
import { decode } from '../cryptography/decode';
import { calculateChecksum } from '../cryptography/util';

const router = express.Router();

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    console.log('Upload directory:', uploadDir);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Use original filename but sanitize it
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  },
});

// Set file size limit to 5MB
// Allowed MIME types - only text files for encoding
const ALLOWED_MIME_TYPES = [
  'text/plain'
];

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB in bytes
  },
  fileFilter: (req, file, cb) => {
    console.log('Received file:', file.originalname, 'MIME type:', file.mimetype);
    
    if (req.path === '/encode') {
      // For encoding, only allow text files
      if (file.mimetype === 'text/plain') {
        cb(null, true);
        return;
      }
      cb(new Error('Only text files (.txt) are allowed for encoding'));
      return;
    }
    
    // For decoding, only allow PGN files
    if (req.path === '/decode' && file.originalname.toLowerCase().endsWith('.pgn')) {
      cb(null, true);
      return;
    }
    
    cb(new Error('Invalid file type. For encoding, only .txt files are allowed. For decoding, only .pgn files are allowed.'));
  }
});

// Encode endpoint - converts file to PGN
router.post('/encode', (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: 'File size too large. Maximum size is 5MB.' });
        return;
      }
      res.status(400).json({ error: `Upload error: ${err.message}` });
      return;
    } else if (err) {
      res.status(500).json({ error: `Server error: ${err.message}` });
      return;
    }
    
    (async () => {
      console.log('Received encode request');
      console.log('File:', req.file);
      try {
        if (!req.file) {
          res.status(400).json({ error: 'No file uploaded' });
          return;
        }

        // Validate the file exists and is readable
        if (!fs.existsSync(req.file.path)) {
          throw new Error('Uploaded file not found on server');
        }

        // Check file size
        const stats = fs.statSync(req.file.path);
        if (stats.size === 0) {
          throw new Error('File is empty');
        }

        // Validate it's a text file
        if (!req.file.mimetype || req.file.mimetype !== 'text/plain') {
          throw new Error('Only text files are supported for encoding');
        }

        // Calculate checksum before encoding
        const fileBuffer = fs.readFileSync(req.file.path);
        const originalChecksum = calculateChecksum(fileBuffer);
        console.log(`Original file checksum: ${originalChecksum}`);

        console.log('File path:', req.file.path);
        try {
          const pgn = encode(req.file.path);
          console.log('Encoding successful, PGN length:', pgn.length);
          
          // Validate the generated PGN
          if (!pgn || pgn.trim() === '') {
            throw new Error('Generated PGN is empty');
          }

          // Verify that the PGN contains our checksum
          if (!pgn.includes(`[Checksum "${originalChecksum}"]`)) {
            console.warn('PGN does not contain the original checksum!');
          }

          // Clean up the uploaded file
          try {
            fs.unlinkSync(req.file.path);
          } catch (unlinkError) {
            console.warn('Failed to delete uploaded file:', unlinkError);
            // Continue execution, this is not a critical error
          }
          
          res.status(200).json({ pgn });
        } catch (encodeError) {
          console.error('Encoding failed:', encodeError);
          throw encodeError;
        }
      } catch (error) {
        console.error('Encode error:', error);
        console.error('Error details:', error instanceof Error ? error.message : error);
        res.status(500).json({ error: 'Failed to encode file', details: error instanceof Error ? error.message : String(error) });
      }
    })();
  });
});

// Decode endpoint - converts PGN back to text file
router.post('/decode', (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: 'File size too large. Maximum size is 5MB.' });
        return;
      }
      res.status(400).json({ error: `Upload error: ${err.message}` });
      return;
    } else if (err) {
      res.status(500).json({ error: `Server error: ${err.message}` });
      return;
    }
    
    (async () => {
      try {
        if (!req.file) {
          res.status(400).json({ error: 'No file uploaded' });
          return;
        }

        // Only txt output format is supported
        const outputFormat = 'txt';
        console.log('Decoding to format:', outputFormat);

        let outputPath: string;
        try {
          // Read the PGN file
          console.log('Reading PGN file:', req.file.path);
          const pgnContent = fs.readFileSync(req.file.path, 'utf-8');
          console.log('PGN content length:', pgnContent.length);

          if (!pgnContent.trim()) {
            throw new Error('PGN file is empty');
          }

          // Check if this appears to be a ChessCrypto file
          const isChessCryptoFile = pgnContent.includes('[Event "ChessCrypto File"]') || 
                                    pgnContent.includes('[FileSize "') ||
                                    pgnContent.includes('[Checksum "');
                                    
          if (!isChessCryptoFile) {
            console.warn('The PGN file does not appear to be a ChessCrypto file');
          }
          
          // Extract expected checksum for validation
          let expectedChecksum: string | null = null;
          const checksumMatch = pgnContent.match(/\[Checksum "([a-fA-F0-9]+)"\]/);
          if (checksumMatch && checksumMatch[1]) {
            expectedChecksum = checksumMatch[1];
            console.log('Found checksum in PGN:', expectedChecksum);
          }
          
          // Create output path for decoded file
          const uploadsDir = path.join(process.cwd(), 'uploads');
          
          // Ensure uploads directory exists
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }
          
          outputPath = path.join(uploadsDir, `decoded-${Date.now()}.txt`);
          console.log('Output path:', outputPath);

          // Decode the PGN to the original file
          console.log('Starting decode process...');
          try {
            decode(pgnContent, outputPath);
            console.log('Decode successful');
          } catch (decodeError) {
            console.error('Decode error:', decodeError);
            throw new Error(`Failed to decode PGN: ${decodeError instanceof Error ? decodeError.message : String(decodeError)}`);
          }

          if (!fs.existsSync(outputPath)) {
            throw new Error('Decoded file was not created');
          }
          
          // Check if the output file is empty
          const stats = fs.statSync(outputPath);
          if (stats.size === 0) {
            throw new Error('Decoded file is empty');
          }
          
          // Verify the checksum of the decoded file
          if (expectedChecksum) {
            const decodedBuffer = fs.readFileSync(outputPath);
            const actualChecksum = calculateChecksum(decodedBuffer);
            
            console.log(`Checksum verification: Expected=${expectedChecksum}, Actual=${actualChecksum}`);
            
            if (actualChecksum !== expectedChecksum) {
              console.warn(`Warning: Checksum mismatch! The decoded file may be corrupted.`);
            } else {
              console.log(`✓ Checksum verified: The decoded file is intact.`);
            }
          }
          
          // Validate that the decoded file appears to be text
          try {
            const fileHead = fs.readFileSync(outputPath, { encoding: 'utf8', flag: 'r' }).slice(0, 100);
            // Check if this looks like a text file (simple heuristic)
            const isBinary = /[\x00-\x08\x0E-\x1F\x7F-\xFF]/.test(fileHead);
            if (isBinary) {
              console.warn('Warning: Decoded file appears to contain binary data, but only text files are fully supported');
            }
          } catch (validateError) {
            console.warn('Warning: Could not validate decoded file content:', validateError);
          }
        } catch (error) {
          console.error('Decode process error:', error);
          throw error;
        }

        // Stream the decoded file back to client
        try {
          await new Promise<void>((resolve, reject) => {
            res.download(outputPath!, 'decoded-file.txt', (err) => {
              if (err) {
                console.error('Download error:', err);
                reject(new Error('Failed to download file'));
                return;
              }
              // Clean up files after sending
              try {
                fs.unlinkSync(req.file!.path);
              } catch (e) {
                console.warn('Failed to delete uploaded PGN file:', e);
              }
              
              try {
                fs.unlinkSync(outputPath!);
              } catch (e) {
                console.warn('Failed to delete temporary decoded file:', e);
              }
              
              resolve();
            });
          });
        } catch (error) {
          console.error('Download error:', error);
          res.status(500).json({ error: 'Failed to download file' });
        }
      } catch (error) {
        console.error('Decode error:', error);
        res.status(500).json({ error: 'Failed to decode file', details: error instanceof Error ? error.message : String(error) });
      }
    })();
  });
});

export default router;
