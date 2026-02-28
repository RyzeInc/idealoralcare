'use client';

import { useState } from 'react';
import { Upload, FileUp, AlertCircle, CheckCircle, Clock } from 'lucide-react';

/**
 * ELIGIBILITY FILE UPLOAD PAGE
 * 
 * CSV upload with validation, progress tracking, and error reporting
 */

interface UploadedFile {
  id: string;
  name: string;
  uploadedAt: string;
  status: 'processing' | 'completed' | 'error';
  totalRecords: number;
  processedRecords: number;
  errorRecords: number;
  errors?: string[];
}

// Mock data for demonstration
const MOCK_FILES: UploadedFile[] = [
  {
    id: '1',
    name: 'members_2026_02.csv',
    uploadedAt: '2026-02-20 10:30 AM',
    status: 'completed',
    totalRecords: 150,
    processedRecords: 150,
    errorRecords: 0,
  },
  {
    id: '2',
    name: 'members_2026_01.csv',
    uploadedAt: '2026-01-20 2:15 PM',
    status: 'completed',
    totalRecords: 140,
    processedRecords: 138,
    errorRecords: 2,
    errors: [
      'Row 25: Missing email address',
      'Row 87: Invalid date format',
    ],
  },
];

export default function EligibilityUploadPage() {
  const [files, setFiles] = useState<UploadedFile[]>(MOCK_FILES);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    // Handle file upload
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Simulate upload
      const newFile: UploadedFile = {
        id: `${Date.now()}`,
        name: file.name,
        uploadedAt: new Date().toLocaleString(),
        status: 'processing',
        totalRecords: 100,
        processedRecords: 0,
        errorRecords: 0,
      };
      setFiles([newFile, ...files]);
      setUploadingFile(newFile.id);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="text-green-600" size={20} />;
      case 'processing':
        return <Clock className="text-blue-600 animate-spin" size={20} />;
      case 'error':
        return <AlertCircle className="text-red-600" size={20} />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Eligibility Files</h1>
        <p className="text-slate-600">Upload CSV files to batch import or update member records</p>
      </div>

      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-slate-300 bg-slate-50 hover:border-slate-400'
        }`}
      >
        <Upload className="mx-auto mb-4 text-slate-400" size={40} />
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Upload CSV File</h3>
        <p className="text-slate-600 mb-4">Drag and drop your file here, or click to select</p>
        <label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Choose File
          </button>
        </label>
        <p className="text-xs text-slate-500 mt-4">CSV format required. Max 50MB.</p>
      </div>

      {/* File Options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 border border-slate-200 rounded-lg">
          <p className="text-sm text-slate-600 mb-2">File Action</p>
          <select className="w-full px-3 py-2 border border-slate-300 rounded">
            <option>Full Replace</option>
            <option>Additions Only</option>
            <option>Terminations</option>
            <option>Delta (Smart)</option>
          </select>
        </div>
        <div className="p-4 border border-slate-200 rounded-lg">
          <p className="text-sm text-slate-600 mb-2">Group</p>
          <select className="w-full px-3 py-2 border border-slate-300 rounded">
            <option>Select Group...</option>
            <option>DTC-DEFAULT-2026</option>
            <option>ACME-GROUP-2026</option>
          </select>
        </div>
        <div className="p-4 border border-slate-200 rounded-lg">
          <p className="text-sm text-slate-600 mb-2">Date Format</p>
          <select className="w-full px-3 py-2 border border-slate-300 rounded">
            <option>YYYY-MM-DD</option>
            <option>MM/DD/YYYY</option>
            <option>DD/MM/YYYY</option>
          </select>
        </div>
      </div>

      {/* Uploaded Files List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Upload History</h2>
        </div>
        
        {files.length === 0 ? (
          <div className="p-6 text-center text-slate-500">
            No files uploaded yet
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">File Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Uploaded</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Progress</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {files.map((file) => (
                <tr key={file.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <FileUp size={18} className="text-slate-400" />
                      <span className="font-medium text-slate-900">{file.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 text-sm">{file.uploadedAt}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(file.status)}
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(file.status)}`}>
                        {file.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full transition-all"
                        style={{
                          width: `${
                            file.totalRecords > 0
                              ? (file.processedRecords / file.totalRecords) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      {file.processedRecords} / {file.totalRecords}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="px-3 py-1 text-blue-600 hover:bg-blue-50 rounded text-sm">
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
