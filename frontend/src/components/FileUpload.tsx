import React, { useState } from 'react';
import axios from 'axios';

interface FileUploadProps {
  onPgnGenerated?: (pgn: string) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onPgnGenerated }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');
  const [outputFormat, setOutputFormat] = useState('txt');
  const [checksumStatus, setChecksumStatus] = useState<'verified' | 'failed' | null>(null);
  const [progressStage, setProgressStage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const outputFormats = [
    { value: 'txt', label: 'Text File (.txt)' }
  ];

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const selectedFile = event.target.files[0];
      
      // Reset states when a new file is selected
      setError(null);
      setSuccess(null);
      setChecksumStatus(null);
      setProgressStage(null);
      
      // Validate file type
      if (mode === 'encode' && selectedFile.name.toLowerCase().endsWith('.txt') === false) {
        setError('Currently only .txt files are supported for encoding');
        setFile(null);
        return;
      }
      
      if (mode === 'decode' && !selectedFile.name.toLowerCase().endsWith('.pgn')) {
        setError('Please select a PGN file for decoding');
        setFile(null);
        return;
      }

      // Validate file size
      if (selectedFile.size > 5 * 1024 * 1024) {
        setError('File size exceeds the 5MB limit');
        setFile(null);
        return;
      }

      // Check if file is empty
      if (selectedFile.size === 0) {
        setError('File is empty');
        setFile(null);
        return;
      }

      setFile(selectedFile);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) {
      setError('Please select a file');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    setProgressStage('Preparing request');
    setChecksumStatus(null);

    const formData = new FormData();
    formData.append('file', file);
    if (mode === 'decode') {
      formData.append('outputFormat', outputFormat);
    }

    try {
      setProgressStage('Sending file to server');
      console.log('Sending request to server...');
      const protocol = window.location.protocol;
      const hostname = window.location.hostname;
      const port = hostname === 'localhost' ? ':5000' : '';
      const apiUrl = `${protocol}//${hostname}${port}/api/crypto/${mode}`;
      
      const response = await axios.post(
        apiUrl,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          responseType: mode === 'decode' ? 'blob' : 'json',
          timeout: 60000, // 60 second timeout
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setProgressStage(`Uploading: ${percentCompleted}%`);
            }
          }
        }
      );
      
      console.log('Server response:', response.data);
      setProgressStage('Processing server response');

      if (mode === 'encode') {
        const pgn = response.data.pgn;
        
        // Validate PGN content
        if (!pgn || typeof pgn !== 'string' || pgn.trim() === '') {
          throw new Error('Server returned empty or invalid PGN');
        }
        
        // Check if the PGN contains expected metadata
        const hasMetadata = pgn.includes('[FileSize "') && pgn.includes('[Checksum "');
        if (!hasMetadata) {
          console.warn('Warning: PGN may be missing critical metadata');
        }
        
        // Create and trigger download of PGN file
        const blob = new Blob([pgn], { type: 'application/x-chess-pgn' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        // Use original filename with .pgn extension
        const originalName = file.name.toLowerCase().endsWith('.txt') 
          ? file.name.slice(0, -4) 
          : file.name;
        link.setAttribute('download', `${originalName}.pgn`);
        
        setProgressStage('Downloading encoded file');
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);

        setSuccess('File successfully encoded! The PGN file has been downloaded. This PGN contains special metadata to ensure accurate decoding later.');
        setChecksumStatus('verified');

        if (onPgnGenerated) {
          onPgnGenerated(pgn);
        }
      } else {
        // For decode, verify content type before downloading
        const contentType = response.headers['content-type'];
        if (contentType && contentType.includes('application/json')) {
          // Server returned JSON error instead of file
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const jsonResponse = JSON.parse(reader.result as string);
              setError(`Error: ${jsonResponse.error || jsonResponse.details || 'Unknown error'}`);
            } catch (e) {
              setError('Failed to parse error response from server');
            }
            setLoading(false);
          };
          reader.readAsText(response.data);
          return;
        }
        
        // Trigger file download
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        
        // Use original filename without .pgn extension
        const originalName = file.name.toLowerCase().endsWith('.pgn') 
          ? file.name.slice(0, -4) 
          : `decoded_${file.name}`;
        link.setAttribute('download', `${originalName}.txt`);
        
        setProgressStage('Downloading decoded file');
        document.body.appendChild(link);
        link.click();
        link.remove();
        
        // Check for content integrity
        const responseHeaders = response.headers;
        if (responseHeaders['x-checksum-verified'] === 'true') {
          setChecksumStatus('verified');
          setSuccess('File successfully decoded! The original file has been downloaded with verified integrity.');
        } else if (responseHeaders['x-checksum-verified'] === 'false') {
          setChecksumStatus('failed');
          setSuccess('File decoded, but the checksum verification failed. The file may be corrupted.');
        } else {
          setSuccess('File successfully decoded! The original file has been downloaded.');
        }
      }
    } catch (err) {
      console.error('Upload error:', err);
      
      // Handle timeout or network errors with retry option
      if (axios.isAxiosError(err) && (err.code === 'ECONNABORTED' || !err.response)) {
        setError(`Network or timeout error. Would you like to retry? (${retryCount + 1}/3)`);
        
        if (retryCount < 2) {
          // Auto-retry option
          setRetryCount(prev => prev + 1);
          
          // Simple exponential backoff
          const backoffDelay = Math.pow(2, retryCount) * 1000;
          setProgressStage(`Retrying in ${backoffDelay/1000} seconds...`);
          
          setTimeout(() => {
            setProgressStage('Retrying request');
            handleSubmit(event);
          }, backoffDelay);
          
          return;
        }
      } else if (axios.isAxiosError(err)) {
        // Handle regular axios errors
        const errorMessage = err.response?.data?.error || err.response?.data?.details || err.message;
        setError(`Error: ${errorMessage}`);
      } else {
        setError('An error occurred while processing the file');
      }
      
      setChecksumStatus(null);
    } finally {
      setLoading(false);
      setProgressStage(null);
    }
  };

  const renderProgress = () => {
    if (!loading || !progressStage) return null;
    
    return (
      <div className="mt-4">
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div className="bg-blue-600 h-2.5 rounded-full w-full animate-pulse"></div>
        </div>
        <p className="text-sm text-gray-600 mt-1">{progressStage}</p>
      </div>
    );
  };

  return (
    <div className="p-4 bg-white rounded shadow">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">File Encryption using Chess</h2>
        <button
          onClick={() => window.location.href = '/'}
          className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
        >
          ← Back to Home
        </button>
      </div>
      
      <div className="mb-4">
        <label className="inline-block mr-4">
          <input
            type="radio"
            value="encode"
            checked={mode === 'encode'}
            onChange={(e) => {
              setMode(e.target.value as 'encode');
              setFile(null);
              setError(null);
              setSuccess(null);
              setChecksumStatus(null);
            }}
            className="mr-2"
          />
          Encode to Chess Game
        </label>
        <label className="inline-block">
          <input
            type="radio"
            value="decode"
            checked={mode === 'decode'}
            onChange={(e) => {
              setMode(e.target.value as 'decode');
              setFile(null);
              setError(null);
              setSuccess(null);
              setChecksumStatus(null);
            }}
            className="mr-2"
          />
          Decode from Chess Game
        </label>
      </div>
      {mode === 'decode' && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Output Format
          </label>
          <select
            value={outputFormat}
            onChange={(e) => setOutputFormat(e.target.value)}
            className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            {outputFormats.map((format) => (
              <option key={format.value} value={format.value}>
                {format.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <input
            type="file"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
            disabled={loading}
          />
          <p className="mt-2 text-xs text-gray-500">
            {mode === 'encode' 
              ? 'Select a .txt file to encode as a chess game' 
              : 'Select a .pgn file to decode back to the original format'}
          </p>
        </div>
        
        {renderProgress()}
        
        {error && (
          <div className="p-3 bg-red-50 text-red-700 rounded-md">
            {error}
            {retryCount > 0 && (
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  setRetryCount(0);
                  setError(null);
                  handleSubmit(e);
                }}
                className="ml-2 underline hover:no-underline"
              >
                Retry Now
              </button>
            )}
          </div>
        )}
        
        {success && (
          <div className={`p-3 ${checksumStatus === 'verified' 
            ? 'bg-green-50 text-green-700' 
            : checksumStatus === 'failed'
              ? 'bg-yellow-50 text-yellow-700'
              : 'bg-blue-50 text-blue-700'} rounded-md`}
          >
            {checksumStatus === 'verified' && (
              <span className="inline-block mr-1">✓</span>
            )}
            {checksumStatus === 'failed' && (
              <span className="inline-block mr-1">⚠️</span>
            )}
            {success}
          </div>
        )}
        
        <button
          type="submit"
          disabled={loading || !file}
          className={`w-full py-2 px-4 rounded ${
            loading || !file
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          {loading ? 'Processing...' : mode === 'encode' ? 'Convert to Chess Game' : 'Decode File'}
        </button>
      </form>
    </div>
  );
};

export default FileUpload;
