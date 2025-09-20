import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileJson, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import {
  validateImportData,
  convertImportToEditorFormat,
  type QIPExportJSON
} from '@/utils/qipExport';

interface ImportExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ImportExportDialog: React.FC<ImportExportDialogProps> = ({
  open,
  onOpenChange
}) => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [jsonContent, setJsonContent] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [parsedData, setParsedData] = useState<QIPExportJSON | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      setJsonContent(text);
      validateJSON(text);
    } catch (error) {
      setErrors(['Failed to read file']);
    }
  };

  const validateJSON = (content: string) => {
    setIsValidating(true);
    setErrors([]);

    try {
      const data = JSON.parse(content);
      const validation = validateImportData(data);

      if (validation.valid) {
        setParsedData(data as QIPExportJSON);
      } else {
        setErrors(validation.errors);
        setParsedData(null);
      }
    } catch (error) {
      setErrors(['Invalid JSON format']);
      setParsedData(null);
    } finally {
      setIsValidating(false);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const content = e.target.value;
    setJsonContent(content);

    // Validate on change with debouncing
    if (content.trim()) {
      validateJSON(content);
    } else {
      setErrors([]);
      setParsedData(null);
    }
  };

  const handleImport = () => {
    if (!parsedData) return;

    const editorData = convertImportToEditorFormat(parsedData);

    // Navigate to create or edit page with imported data
    if (editorData.qipNumber) {
      // If QIP number exists, go to edit page
      navigate(`/edit-proposal?qip=${editorData.qipNumber}`, {
        state: {
          importedData: editorData,
          fromImport: true
        }
      });
    } else {
      // Otherwise, go to create page
      navigate('/create-proposal', {
        state: {
          importedData: editorData,
          fromImport: true
        }
      });
    }

    onOpenChange(false);
  };

  const handleReset = () => {
    setJsonContent('');
    setErrors([]);
    setParsedData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import QIP from JSON</DialogTitle>
          <DialogDescription>
            Upload or paste a JSON export file to import QIP data
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Upload */}
          <div>
            <Label htmlFor="file-upload">Upload JSON File</Label>
            <div className="mt-2">
              <input
                ref={fileInputRef}
                type="file"
                id="file-upload"
                accept=".json,application/json"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
              >
                <Upload className="mr-2 h-4 w-4" />
                Choose File
              </Button>
            </div>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or paste JSON
              </span>
            </div>
          </div>

          {/* JSON Textarea */}
          <div>
            <Label htmlFor="json-content">JSON Content</Label>
            <Textarea
              id="json-content"
              value={jsonContent}
              onChange={handleTextareaChange}
              placeholder="Paste your JSON export here..."
              className="font-mono text-sm min-h-[200px]"
            />
          </div>

          {/* Validation Errors */}
          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1">
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Preview of Parsed Data */}
          {parsedData && (
            <Alert>
              <FileJson className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-semibold">Valid QIP Data Found:</p>
                  <ul className="text-sm space-y-1">
                    {parsedData.qip.qipNumber && (
                      <li>• QIP Number: {parsedData.qip.qipNumber}</li>
                    )}
                    <li>• Title: {parsedData.qip.title}</li>
                    <li>• Chain: {parsedData.qip.chain}</li>
                    <li>• Status: {parsedData.qip.status || 'Draft'}</li>
                    {parsedData.versions && (
                      <li>• Versions: {parsedData.versions.length}</li>
                    )}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleReset}>
            Clear
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!parsedData || isValidating}
          >
            Import QIP
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};