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

  const outputFormats = [
    { value: 'txt', label: 'Text File (.txt)' },
    { value: 'json', label: 'JSON File (.json)' },
    { value: 'xml', label: 'XML File (.xml)' },
    { value: 'csv', label: 'CSV File (.csv)' },
    { value: 'pdf', label: 'PDF File (.pdf)' },
    { value: 'doc', label: 'Word Document (.doc)' }
  ];

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const selectedFile = event.target.files[0];
      
      // Validate file type
      if (mode === 'decode' && !selectedFile.name.toLowerCase().endsWith('.pgn')) {
        setError('Please select a PGN file for decoding');
        setFile(null);
        return;
      }

      setFile(selectedFile);
      setError(null);
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

    const formData = new FormData();
    formData.append('file', file);
    if (mode === 'decode') {
      formData.append('outputFormat', outputFormat);
    }

    try {
      console.log('Sending request to server...');
      const response = await axios.post(
        `http://localhost:5000/api/crypto/${mode}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          responseType: mode === 'decode' ? 'blob' : 'json',
        }
      );
      console.log('Server response:', response.data);

      if (mode === 'encode') {
        const pgn = response.data.pgn;
        // Create and trigger download of PGN file
        const blob = new Blob([pgn], { type: 'application/x-chess-pgn' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `encoded_${file.name}.pgn`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);

        setSuccess('File successfully encoded! The PGN file has been downloaded.');

        if (onPgnGenerated) {
          onPgnGenerated(pgn);
        }
      } else {
        // For decode, trigger file download
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        const extension = outputFormat === 'doc' ? 'docx' : outputFormat;
        link.setAttribute('download', `decoded_file.${extension}`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        setSuccess('File successfully decoded! The original file has been downloaded.');
      }
    } catch (err) {
      console.error('Upload error:', err);
      if (axios.isAxiosError(err)) {
        const errorMessage = err.response?.data?.error || err.response?.data?.details || err.message;
        setError(`Error: ${errorMessage}`);
      } else {
        setError('An error occurred while processing the file');
      }
    } finally {
      setLoading(false);
    }
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
            onChange={(e) => setMode(e.target.value as 'encode')}
            className="mr-2"
          />
          Encode to Chess Game
        </label>
        <label className="inline-block">
          <input
            type="radio"
            value="decode"
            checked={mode === 'decode'}
            onChange={(e) => setMode(e.target.value as 'decode')}
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
          />
        </div>
        {error && <div className="text-red-500 text-sm">{error}</div>}
        {success && <div className="text-green-500 text-sm">{success}</div>}
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
