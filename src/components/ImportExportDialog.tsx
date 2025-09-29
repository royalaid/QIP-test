import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileJson, AlertCircle, Eye, EyeOff } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  validateImportData,
  convertImportToEditorFormat,
  type QCIExportJSON
} from '@/utils/qciExport';

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
  const [parsedData, setParsedData] = useState<QCIExportJSON | null>(null);
  const [showPreview, setShowPreview] = useState(false);

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
        setParsedData(data as QCIExportJSON);
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
    if (editorData.qciNumber) {
      // If QCI number exists, go to edit page
      navigate(`/edit-proposal?qci=${editorData.qciNumber}`, {
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

  // Generate markdown preview - only the content, no frontmatter
  const generateMarkdownPreview = () => {
    if (!parsedData) return '';
    return parsedData.qci.content || '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import QCI from JSON</DialogTitle>
          <DialogDescription>
            Upload or paste a JSON export file to import QCI data
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="import" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="import">Import</TabsTrigger>
            <TabsTrigger value="preview" disabled={!parsedData}>
              Preview {parsedData && <Eye className="ml-2 h-3 w-3" />}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="import" className="space-y-4 overflow-y-auto flex-1">
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
                  <p className="font-semibold">Valid QCI Data Found:</p>
                  <ul className="text-sm space-y-1">
                    <li>• Title: {parsedData.qci.title}</li>
                    <li>• Chain: {parsedData.qci.chain}</li>
                    <li>• Status: {parsedData.qci.status || 'Draft'}</li>
                    <li>• Author: {parsedData.qci.author || 'Unknown'}</li>
                    {parsedData.versions && (
                      <li>• Versions: {parsedData.versions.length}</li>
                    )}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}
          </TabsContent>

          <TabsContent value="preview" className="flex-1 overflow-hidden flex flex-col">
            {parsedData && (
              <div className="h-full flex flex-col overflow-hidden">
                <div className="mb-3 p-3 bg-muted rounded-lg">
                  <h3 className="font-semibold text-sm mb-2">Preview of Imported QCI</h3>
                  <p className="text-xs text-muted-foreground mb-2">
                    Review the content that will be imported. QCI number will be assigned automatically.
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="font-medium">Title:</span> {parsedData.qci.title}</div>
                    <div><span className="font-medium">Network:</span> {parsedData.qci.chain}</div>
                    <div><span className="font-medium">Author:</span> {parsedData.qci.author || 'Unknown'}</div>
                    <div><span className="font-medium">Status:</span> {parsedData.qci.status || 'Draft'}</div>
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto border rounded-lg bg-card p-4">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {generateMarkdownPreview()}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
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
            Import QCI
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};