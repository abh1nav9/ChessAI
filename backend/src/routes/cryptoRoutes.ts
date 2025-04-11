import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import * as fs from 'fs';
import path from 'path';
import { encode } from '../cryptography/encode';
import { decode } from '../cryptography/decode';

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
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

// Set file size limit to 5MB
// Allowed file types for encoding
const ALLOWED_MIME_TYPES = [
  'text/plain',
  'text/csv',
  'application/json',
  'application/xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB in bytes
  },
  fileFilter: (req, file, cb) => {
    console.log('Received file:', file.originalname, 'MIME type:', file.mimetype);
    
    // Allow PGN files for decoding
    if (req.path === '/decode' && file.originalname.toLowerCase().endsWith('.pgn')) {
      cb(null, true);
      return;
    }

    // For encoding, check allowed MIME types
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. For encoding, allowed types are: ${ALLOWED_MIME_TYPES.join(', ')}. For decoding, only .pgn files are allowed.`));
    }
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

    console.log('File path:', req.file.path);
    try {
      const pgn = encode(req.file.path);
      console.log('Encoding successful');
      
      // Clean up the uploaded file
      fs.unlinkSync(req.file.path);
      
      res.status(200).json({ pgn });
    } catch (encodeError) {
      console.error('Encoding failed:', encodeError);
      throw encodeError;
    }
    return;
    } catch (error) {
      console.error('Encode error:', error);
      console.error('Error details:', error instanceof Error ? error.message : error);
      res.status(500).json({ error: 'Failed to encode file', details: error instanceof Error ? error.message : String(error) });
      return;
    }
  })();
  });
});

// Decode endpoint - converts PGN back to original file
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

        const outputFormat = req.body.outputFormat || 'txt';
        console.log('Decoding to format:', outputFormat);

        // Validate output format
        const validFormats = ['txt', 'json', 'xml', 'csv', 'pdf', 'doc'];
        if (!validFormats.includes(outputFormat)) {
          res.status(400).json({ error: 'Invalid output format' });
          return;
        }

        let outputPath: string;
        try {
          // Read the PGN file
          console.log('Reading PGN file:', req.file.path);
          const pgnContent = fs.readFileSync(req.file.path, 'utf-8');
          console.log('PGN content length:', pgnContent.length);

          if (!pgnContent.trim()) {
            throw new Error('PGN file is empty');
          }

          // Create output path for decoded file with extension
          const extension = outputFormat === 'doc' ? 'docx' : outputFormat;
          const uploadsDir = path.join(process.cwd(), 'uploads');
          
          // Ensure uploads directory exists
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }
          
          outputPath = path.join(uploadsDir, `decoded-${Date.now()}.${extension}`);
          console.log('Output path:', outputPath);

          // Decode the PGN to the original file
          console.log('Starting decode process...');
          decode(pgnContent, outputPath);
          console.log('Decode successful');

          if (!fs.existsSync(outputPath)) {
            throw new Error('Decoded file was not created');
          }
        } catch (error) {
          console.error('Decode process error:', error);
          throw error;
        }

        // Stream the decoded file back to client
        try {
          await new Promise<void>((resolve, reject) => {
            res.download(outputPath!, 'decoded-file', (err) => {
              if (err) {
                console.error('Download error:', err);
                reject(new Error('Failed to download file'));
                return;
              }
              // Clean up files after sending
              fs.unlinkSync(req.file!.path);
              fs.unlinkSync(outputPath!);
              resolve();
            });
          });
        } catch (error) {
          console.error('Download error:', error);
          res.status(500).json({ error: 'Failed to download file' });
        }
      } catch (error) {
        console.error('Decode error:', error);
        res.status(500).json({ error: 'Failed to decode file' });
      }
    })();
  });
});

export default router;
